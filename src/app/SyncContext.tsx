import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createGoogleAuth, googleClientId, SignInError, type GoogleAuth } from '../services/google/googleAuth';
import { createSheetsClient, GoogleApiError, type SheetFile, type SheetsClient } from '../services/google/sheetsClient';
import {
  loadSheetIntoBrowser,
  openFamilySheet,
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
import { useSettings } from './SettingsContext';

/** A choice the user has to make before connecting can finish. */
export type SyncDecision = Extract<ConnectPlan, { kind: 'ask-upload' | 'choose' }> & { file: SheetFile };
export type SyncChoice = 'use-sheet' | 'use-browser' | 'cancel';

type Status = { kind: 'idle' } | { kind: 'working'; message: string } | { kind: 'error'; message: string; details?: string[] };

type SyncContextValue = {
  /** null until the user picks on the start screen. */
  mode: StorageMode | null;
  /** False when this build has no Google Client ID configured. */
  googleAvailable: boolean;
  signedIn: boolean;
  file: SheetFile | null;
  status: Status;
  decision: SyncDecision | null;
  lastSavedAt: Date | null;
  /** Changes whenever the browser's data was replaced from the sheet, so pages re-read it. */
  dataVersion: number;
  chooseBrowserOnly: () => void;
  connect: () => Promise<void>;
  resolveDecision: (choice: SyncChoice) => Promise<void>;
  saveNow: () => Promise<void>;
  disconnect: () => Promise<void>;
  dismissError: () => void;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const describe = (err: unknown): string => {
  if (err instanceof SheetChangedError) return `${err.message} Connect again to choose which copy to keep.`;
  if (err instanceof GoogleApiError) {
    if (err.isAuthError) return 'Your Google sign-in has expired. Sign in again.';
    if (err.status === 403) return `Google refused the request: ${err.message}`;
    return `Google Sheets error: ${err.message}`;
  }
  if (err instanceof SignInError) return err.message;
  if (err instanceof TypeError) return 'Could not reach Google. Check your internet connection.';
  return 'Something went wrong while talking to Google.';
};

type SyncProviderProps = {
  children: ReactNode;
  /** For tests: replaces Google sign-in (null = Google not configured). */
  auth?: GoogleAuth | null;
  /** For tests: replaces the Google Sheets client. */
  createClient?: (auth: GoogleAuth) => SheetsClient;
};

export function SyncProvider({ children, auth: authOverride, createClient = (a) => createSheetsClient(a.getToken) }: SyncProviderProps) {
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
  const [decision, setDecision] = useState<SyncDecision | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (mode !== 'browser') auth?.preload();
  }, [auth, mode]);

  const finishConnected = useCallback((f: SheetFile, saveId: string | null, saved: boolean) => {
    writeRememberedSheet({ spreadsheetId: f.id, saveId });
    writeStorageMode('google');
    setMode('google');
    setFile(f);
    setDecision(null);
    if (saved) setLastSavedAt(new Date());
    setStatus({ kind: 'idle' });
  }, []);

  const afterBrowserReplaced = useCallback(async () => {
    await reloadSettings();
    setDataVersion((v) => v + 1);
  }, [reloadSettings]);

  /** Runs one Google action at a time, turning failures into a readable status. */
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
        return;
      }
      await guarded(choice === 'use-sheet' ? 'Loading the Google Sheet…' : 'Saving to the Google Sheet…', async () => {
        if (choice === 'use-sheet' && d.kind === 'choose') {
          await loadSheetIntoBrowser(d.backup);
          await afterBrowserReplaced();
          finishConnected(d.file, d.saveId, false);
        } else {
          // Only overwrite the sheet if it still holds what the user was shown.
          const expected = d.kind === 'choose' ? d.saveId : null;
          finishConnected(d.file, await saveBrowserToSheet(client, d.file.id, expected), true);
        }
      });
    },
    [decision, client, guarded, finishConnected, afterBrowserReplaced],
  );

  const saveNow = useCallback(
    () =>
      guarded('Saving to the Google Sheet…', async () => {
        if (!auth || !client || !file) return;
        if (!auth.isSignedIn()) await auth.signIn();
        setSignedIn(true);
        const saveId = await saveBrowserToSheet(client, file.id, readRememberedSheet()?.saveId ?? null);
        writeRememberedSheet({ spreadsheetId: file.id, saveId });
        setLastSavedAt(new Date());
        setStatus({ kind: 'idle' });
      }),
    [auth, client, file, guarded],
  );

  const chooseBrowserOnly = useCallback(() => {
    writeStorageMode('browser');
    setMode('browser');
  }, []);

  const disconnect = useCallback(async () => {
    await auth?.signOut();
    writeRememberedSheet(null);
    writeStorageMode('browser');
    setMode('browser');
    setSignedIn(false);
    setFile(null);
    setLastSavedAt(null);
    setDecision(null);
    setStatus({ kind: 'idle' });
  }, [auth]);

  const dismissError = useCallback(() => setStatus({ kind: 'idle' }), []);

  const value: SyncContextValue = {
    mode,
    googleAvailable: auth !== null,
    signedIn,
    file,
    status,
    decision,
    lastSavedAt,
    dataVersion,
    chooseBrowserOnly,
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

/** Like useSync, but null outside a SyncProvider (pages rendered on their own in tests). */
export function useOptionalSync(): SyncContextValue | null {
  return useContext(SyncContext);
}
