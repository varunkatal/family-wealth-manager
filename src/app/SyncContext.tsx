import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createGoogleAuth, googleClientId, SignInError, type GoogleAuth } from '../services/google/googleAuth';
import { createSheetsClient, GoogleApiError, type SheetFile, type SheetsClient } from '../services/google/sheetsClient';
import {
  loadSheetIntoBrowser,
  openFamilySheet,
  planAfterConflict,
  planConnection,
  readRememberedSheet,
  readStorageMode,
  saveBrowserToSheet,
  SheetChangedError,
  writeRememberedSheet,
  writeStorageMode,
  type ConnectPlan,
  type StorageMode,
} from '../services/google/sheetSync';
import { deleteAllData } from '../services/storage/backupRepository';
import { onDataChanged, withoutChangeNotifications } from '../services/storage/changes';
import { useSettings } from './SettingsContext';

/** A choice the user has to make before the browser and the sheet agree again. */
export type SyncDecision = Extract<ConnectPlan, { kind: 'ask-upload' | 'choose' }> & {
  file: SheetFile;
  /** True when the sheet was changed from another device while this browser was saving to it. */
  conflict?: boolean;
};
export type SyncChoice = 'use-sheet' | 'use-browser' | 'cancel';

type Status = { kind: 'idle' } | { kind: 'working'; message: string } | { kind: 'error'; message: string; details?: string[] };

/**
 * Auto-save state while connected:
 * saved → (a change) → pending → saving → saved, or
 * error (Retry), signed-out (Google sign-in expired; changes wait in this browser), conflict (user must choose).
 */
export type SaveState = 'saved' | 'pending' | 'saving' | 'error' | 'signed-out' | 'conflict';

/** Wait after the last change before saving, so a burst of edits becomes one save. */
export const AUTOSAVE_DELAY_MS = 1500;

type SyncContextValue = {
  /** null until the user picks on the start screen. */
  mode: StorageMode | null;
  /** False when this build has no Google Client ID configured. */
  googleAvailable: boolean;
  signedIn: boolean;
  file: SheetFile | null;
  status: Status;
  saveState: SaveState;
  decision: SyncDecision | null;
  lastSavedAt: Date | null;
  /** Changes whenever the browser's data was replaced from the sheet, so pages re-read it. */
  dataVersion: number;
  chooseBrowserOnly: () => void;
  /** Starts fetching Google's sign-in script (on hover/focus of a Connect button), so the popup opens straight from the click. */
  preloadGoogle: () => void;
  /** Signs in (if needed), opens the family's sheet and brings browser and sheet in line. Also used to reconnect. */
  connect: () => Promise<void>;
  resolveDecision: (choice: SyncChoice) => Promise<void>;
  /** Saves now instead of waiting (also: Retry). */
  saveNow: () => Promise<void>;
  disconnect: (options?: { deleteBrowserData?: boolean }) => Promise<void>;
  dismissError: () => void;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const describe = (err: unknown): string => {
  if (err instanceof GoogleApiError) {
    if (err.isAuthError) return 'Your Google sign-in has expired. Sign in again.';
    if (err.status === 403) return `Google refused the request: ${err.message}`;
    return `Google Sheets error: ${err.message}`;
  }
  if (err instanceof SignInError) return err.message;
  if (err instanceof TypeError) return 'Could not reach Google. Check your internet connection.';
  return 'Something went wrong while talking to Google.';
};

const defaultClient = (auth: GoogleAuth) => createSheetsClient(auth.getToken);

type SyncProviderProps = {
  children: ReactNode;
  /** For tests: replaces Google sign-in (null = Google not configured). */
  auth?: GoogleAuth | null;
  /** For tests: replaces the Google Sheets client. */
  createClient?: (auth: GoogleAuth) => SheetsClient;
};

export function SyncProvider({ children, auth: authOverride, createClient = defaultClient }: SyncProviderProps) {
  const { reload: reloadSettings } = useSettings();
  const auth = useMemo(() => {
    if (authOverride !== undefined) return authOverride;
    const id = googleClientId();
    return id ? createGoogleAuth(id) : null;
  }, [authOverride]);
  const client = useMemo(() => (auth ? createClient(auth) : null), [auth, createClient]);

  const [mode, setMode] = useState<StorageMode | null>(readStorageMode);
  const [signedIn, setSignedIn] = useState(false);
  const [file, setFile] = useState<SheetFile | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [decision, setDecision] = useState<SyncDecision | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  // Read inside timers and event handlers, which would otherwise see stale state.
  const busy = useRef(false); // a connect / decision is in progress
  const saving = useRef(false);
  const dirty = useRef(false); // this browser has changes the sheet doesn't have yet
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const fileRef = useRef(file);
  fileRef.current = file;
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;

  // Google's sign-in script is fetched only when Google is in use (or about to be), never in browser-only use.
  useEffect(() => {
    if (mode === 'google') auth?.preload();
  }, [auth, mode]);
  const preloadGoogle = useCallback(() => auth?.preload(), [auth]);

  const finishConnected = useCallback((f: SheetFile, saveId: string | null, saved: boolean) => {
    writeRememberedSheet({ spreadsheetId: f.id, saveId });
    writeStorageMode('google');
    dirty.current = false;
    setMode('google');
    setFile(f);
    setDecision(null);
    setSaveState('saved');
    if (saved) setLastSavedAt(new Date());
    setStatus({ kind: 'idle' });
  }, []);

  const afterBrowserReplaced = useCallback(async () => {
    await reloadSettings();
    setDataVersion((v) => v + 1);
  }, [reloadSettings]);

  /** Runs one connect-type action at a time, turning failures into a readable status. */
  const guarded = useCallback(async (message: string, action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setStatus({ kind: 'working', message });
    try {
      await action();
    } catch (err) {
      if (err instanceof GoogleApiError && err.isAuthError) setSignedIn(false);
      if (err instanceof SignInError && err.cancelled) setStatus({ kind: 'idle' });
      else setStatus({ kind: 'error', message: describe(err) });
    } finally {
      busy.current = false;
    }
  }, []);

  /** Another device saved first: show both copies and let the user pick. */
  const handleConflict = useCallback(
    async (f: SheetFile) => {
      if (!client) return;
      const plan = await planAfterConflict(await client.readTabs(f.id));
      if (plan.kind === 'in-sync') {
        finishConnected(f, plan.saveId, false); // same data: just adopt the sheet's save
      } else if (plan.kind === 'invalid') {
        setSaveState('error');
        setStatus({ kind: 'error', message: 'The Google Sheet was changed elsewhere and can no longer be read. Nothing was overwritten.', details: plan.errors });
      } else {
        setSaveState('conflict');
        setDecision({ ...plan, file: f, conflict: true });
      }
    },
    [client, finishConnected],
  );

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const f = fileRef.current;
    if (!client || !auth || modeRef.current !== 'google' || !dirty.current || saving.current) return;
    if (saveStateRef.current === 'conflict') return; // waiting for the user's choice
    if (busy.current) {
      timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
      return;
    }
    if (!f || !auth.isSignedIn()) {
      setSignedIn(false);
      setSaveState('signed-out');
      return;
    }
    saving.current = true;
    dirty.current = false;
    setSaveState('saving');
    let ok = false;
    try {
      const saveId = await saveBrowserToSheet(client, f.id, readRememberedSheet()?.saveId ?? null);
      writeRememberedSheet({ spreadsheetId: f.id, saveId });
      setLastSavedAt(new Date());
      setStatus((s) => (s.kind === 'error' ? { kind: 'idle' } : s));
      ok = true;
    } catch (err) {
      dirty.current = true;
      if (err instanceof SheetChangedError) {
        await handleConflict(f).catch((e: unknown) => {
          setSaveState('error');
          setStatus({ kind: 'error', message: describe(e) });
        });
      } else if (err instanceof GoogleApiError && err.isAuthError) {
        setSignedIn(false);
        setSaveState('signed-out');
      } else {
        setSaveState('error');
        setStatus({ kind: 'error', message: `Not saved to Google Sheet. ${describe(err)} Your changes are kept in this browser.` });
      }
    } finally {
      saving.current = false;
    }
    if (ok) {
      // More changes arrived while saving: save those too.
      if (dirty.current) {
        setSaveState('pending');
        timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
      } else {
        setSaveState('saved');
      }
    }
  }, [auth, client, handleConflict]);

  // Every completed write to this browser's data schedules a save.
  useEffect(
    () =>
      onDataChanged(() => {
        if (modeRef.current !== 'google') return;
        dirty.current = true;
        if (saveStateRef.current === 'conflict') return;
        if (!fileRef.current || !auth?.isSignedIn()) {
          setSaveState('signed-out');
          return;
        }
        if (!saving.current) setSaveState('pending');
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
      }),
    [auth, flush],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  // Back online after a failed save: try again.
  useEffect(() => {
    const onOnline = () => {
      if (saveStateRef.current === 'error') void flush();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flush]);

  // Warn before closing the tab while a save is still waiting or running.
  useEffect(() => {
    if (mode !== 'google' || (saveState !== 'pending' && saveState !== 'saving')) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [mode, saveState]);

  const connect = useCallback(
    () =>
      guarded('Signing in to Google…', async () => {
        if (!auth || !client) throw new Error('Google is not set up');
        if (!auth.isSignedIn()) await auth.signIn();
        setSignedIn(true);
        setStatus({ kind: 'working', message: 'Opening your family’s Google Sheet…' });
        const remembered = readRememberedSheet();
        const f = await openFamilySheet(client, remembered?.spreadsheetId ?? null);
        const known = remembered?.spreadsheetId === f.id ? remembered.saveId : null;
        const plan = await planConnection(await client.readTabs(f.id), known);
        switch (plan.kind) {
          case 'invalid':
            setStatus({ kind: 'error', message: 'The Google Sheet could not be read, so nothing was changed.', details: plan.errors });
            return;
          case 'in-sync':
            finishConnected(f, plan.saveId, false);
            return;
          case 'load':
            await loadSheetIntoBrowser(plan.backup);
            await afterBrowserReplaced();
            finishConnected(f, plan.saveId, false);
            return;
          case 'upload':
            finishConnected(f, await saveBrowserToSheet(client, f.id), true);
            return;
          case 'ask-upload':
          case 'choose':
            setDecision({ ...plan, file: f });
            setStatus({ kind: 'idle' });
            return;
        }
      }),
    [auth, client, guarded, finishConnected, afterBrowserReplaced],
  );

  const resolveDecision = useCallback(
    async (choice: SyncChoice) => {
      const d = decision;
      if (!d || !client) return;
      if (choice === 'cancel') {
        setDecision(null);
        if (d.conflict) {
          // Stays in conflict (no saving) until the user chooses; Retry shows the choice again.
          setStatus({ kind: 'error', message: 'Not saved: your Google Sheet was changed on another device. Choose which copy to keep to continue saving.' });
        }
        return;
      }
      await guarded(choice === 'use-sheet' ? 'Loading the Google Sheet…' : 'Saving to the Google Sheet…', async () => {
        try {
          if (choice === 'use-sheet' && d.kind === 'choose') {
            await loadSheetIntoBrowser(d.backup);
            await afterBrowserReplaced();
            finishConnected(d.file, d.saveId, false);
          } else {
            // Only overwrite the sheet if it still holds what the user was shown.
            const expected = d.kind === 'choose' ? d.saveId : null;
            finishConnected(d.file, await saveBrowserToSheet(client, d.file.id, expected), true);
          }
        } catch (err) {
          if (!(err instanceof SheetChangedError)) throw err;
          // Changed yet again while the user was deciding: show the latest copies.
          await handleConflict(d.file);
          setStatus({ kind: 'idle' });
        }
      });
    },
    [decision, client, guarded, finishConnected, afterBrowserReplaced, handleConflict],
  );

  const saveNow = useCallback(async () => {
    const f = fileRef.current;
    if (!f || !auth?.isSignedIn()) {
      await connect(); // reconnecting saves waiting changes, or asks if the sheet changed meanwhile
      return;
    }
    if (saveStateRef.current === 'conflict') {
      // The user closed the choice earlier: check the sheet again and ask again.
      await handleConflict(f).catch((e: unknown) => setStatus({ kind: 'error', message: describe(e) }));
      return;
    }
    dirty.current = true;
    await flush();
  }, [auth, connect, flush, handleConflict]);

  const chooseBrowserOnly = useCallback(() => {
    writeStorageMode('browser');
    setMode('browser');
  }, []);

  const disconnect = useCallback(
    async ({ deleteBrowserData = false }: { deleteBrowserData?: boolean } = {}) => {
      clearTimeout(timer.current);
      await auth?.signOut();
      writeRememberedSheet(null);
      writeStorageMode('browser');
      dirty.current = false;
      setMode('browser');
      setSignedIn(false);
      setFile(null);
      setLastSavedAt(null);
      setDecision(null);
      setSaveState('saved');
      setStatus({ kind: 'idle' });
      if (deleteBrowserData) {
        await withoutChangeNotifications(deleteAllData);
        await afterBrowserReplaced();
      }
    },
    [auth, afterBrowserReplaced],
  );

  const dismissError = useCallback(() => setStatus({ kind: 'idle' }), []);

  const value: SyncContextValue = {
    mode,
    googleAvailable: auth !== null,
    signedIn,
    file,
    status,
    saveState,
    decision,
    lastSavedAt,
    dataVersion,
    chooseBrowserOnly,
    preloadGoogle,
    connect,
    resolveDecision,
    saveNow,
    disconnect,
    dismissError,
  };
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside SyncProvider');
  return ctx;
}

/** True when data is kept in the family's Google Sheet (for wording that depends on where data lives). */
export function useSavesToGoogle(): boolean {
  return useContext(SyncContext)?.mode === 'google';
}

/** Like useSync, but null outside a SyncProvider (pages rendered on their own in tests). */
export function useOptionalSync(): SyncContextValue | null {
  return useContext(SyncContext);
}
