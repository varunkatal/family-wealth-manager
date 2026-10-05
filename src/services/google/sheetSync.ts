/**
 * Connecting this browser's data (IndexedDB, the working copy) with the family's Google Sheet
 * (the saved copy). Decides what to do when connecting, and never overwrites data that differs
 * without the user's say.
 */
import { countRecords, exportBackup, restoreBackup, type Backup, type RecordStore } from '../storage/backupRepository';
import { ABOUT_TAB, backupToTabs, isEmptySheet, readSaveId, tabsToBackup, type CellValue } from './sheetFormat';
import { GoogleApiError, type SheetFile, type SheetsClient } from './sheetsClient';

export type Counts = Record<RecordStore, number>;

export type ConnectPlan =
  /** Sheet and browser already hold the same data. */
  | { kind: 'in-sync'; saveId: string | null }
  /** The browser has no records: load the sheet's data. */
  | { kind: 'load'; backup: Backup; counts: Counts; saveId: string | null }
  /** Write the browser's data to the sheet without asking: the sheet is empty and so is the browser,
   *  or the sheet is unchanged since this browser last saved it (so the browser has the newer data). */
  | { kind: 'upload' }
  /** The sheet is empty but the browser has records: ask before uploading them. */
  | { kind: 'ask-upload'; local: Counts }
  /** Both hold different data: the user picks which copy to keep. */
  | { kind: 'choose'; backup: Backup; sheet: Counts; local: Counts; saveId: string | null }
  /** The sheet can't be read as app data. Nothing is changed. */
  | { kind: 'invalid'; errors: string[] };

export const totalRecords = (counts: Counts) => Object.values(counts).reduce((a, b) => a + b, 0);

/** JSON with object keys sorted and records ordered by ID, so equal data compares equal. */
function canonical(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      const items = v.map(sort);
      return items.every((i) => i && typeof i === 'object' && typeof (i as { id?: unknown }).id === 'string')
        ? [...items].sort((a, b) => String((a as { id: string }).id).localeCompare(String((b as { id: string }).id)))
        : items;
    }
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([, x]) => x !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, x]) => [k, sort(x)]),
      );
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

export const sameContent = (a: Backup, b: Backup) => canonical([a.settings, a.data]) === canonical([b.settings, b.data]);

/**
 * Works out what connecting should do, from the sheet's tabs and this browser's data.
 * `knownSaveId` is the Save ID this browser last wrote to or loaded from the sheet.
 */
export async function planConnection(tabs: Record<string, CellValue[][]>, knownSaveId: string | null): Promise<ConnectPlan> {
  const local = await countRecords();
  const localEmpty = totalRecords(local) === 0;
  if (isEmptySheet(tabs)) return localEmpty ? { kind: 'upload' } : { kind: 'ask-upload', local };

  const parsed = tabsToBackup(tabs);
  if (!parsed.ok) return { kind: 'invalid', errors: parsed.errors };
  const saveId = readSaveId(tabs[ABOUT_TAB]);

  if (sameContent(parsed.backup, await exportBackup())) return { kind: 'in-sync', saveId };
  if (localEmpty) return { kind: 'load', backup: parsed.backup, counts: parsed.counts, saveId };
  if (saveId !== null && saveId === knownSaveId) return { kind: 'upload' };
  return { kind: 'choose', backup: parsed.backup, sheet: parsed.counts, local, saveId };
}

/** Finds the family's spreadsheet (the remembered one if it still exists), or creates it. */
export async function openFamilySheet(client: SheetsClient, rememberedId: string | null): Promise<SheetFile> {
  if (rememberedId) {
    try {
      const file = await client.getFile(rememberedId);
      if (!file.trashed) return file;
    } catch (err) {
      // Deleted, or no longer reachable by this app: look for (or create) the sheet again.
      if (!(err instanceof GoogleApiError && (err.status === 404 || err.status === 403))) throw err;
    }
  }
  return (await client.findAppSpreadsheet()) ?? (await client.createAppSpreadsheet());
}

/** Replaces this browser's data with the sheet's (one transaction). */
export const loadSheetIntoBrowser = (backup: Backup) => restoreBackup(backup);

export class SheetChangedError extends Error {
  constructor() {
    super('The Google Sheet was changed from another device since this browser last saved it.');
    this.name = 'SheetChangedError';
  }
}

/**
 * Writes all of this browser's data to the sheet in one atomic update, with a new Save ID.
 * With `expectedSaveId`, first checks the sheet still has that ID, so changes saved from
 * another device are never overwritten. Returns the new Save ID.
 */
export async function saveBrowserToSheet(client: SheetsClient, spreadsheetId: string, expectedSaveId?: string | null): Promise<string> {
  if (expectedSaveId !== undefined) {
    const about = await client.readTabs(spreadsheetId, [ABOUT_TAB]);
    if (readSaveId(about[ABOUT_TAB]) !== expectedSaveId) throw new SheetChangedError();
  }
  const saveId = crypto.randomUUID();
  await client.writeTabs(spreadsheetId, backupToTabs(await exportBackup(), saveId));
  return saveId;
}

/* ---- What this browser remembers about the connection (IDs only, never financial data) ---- */

export type StorageMode = 'browser' | 'google';
const MODE_KEY = 'fwc-storage-mode';
const SHEET_KEY = 'fwc-google-sheet';
export type RememberedSheet = { spreadsheetId: string; saveId: string | null };

export function readStorageMode(): StorageMode | null {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === 'browser' || v === 'google' ? v : null;
  } catch {
    return null;
  }
}

export function writeStorageMode(mode: StorageMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // storage blocked: the choice lasts for this visit only
  }
}

export function readRememberedSheet(): RememberedSheet | null {
  try {
    const v = JSON.parse(localStorage.getItem(SHEET_KEY) ?? 'null') as Partial<RememberedSheet> | null;
    return v && typeof v.spreadsheetId === 'string' ? { spreadsheetId: v.spreadsheetId, saveId: typeof v.saveId === 'string' ? v.saveId : null } : null;
  } catch {
    return null;
  }
}

export function writeRememberedSheet(sheet: RememberedSheet | null) {
  try {
    if (sheet) localStorage.setItem(SHEET_KEY, JSON.stringify(sheet));
    else localStorage.removeItem(SHEET_KEY);
  } catch {
    // storage blocked
  }
}
