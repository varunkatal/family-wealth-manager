import { vi } from 'vitest';
import type { GoogleAuth } from '../services/google/googleAuth';
import { ALL_TAB_TITLES, type CellValue, type Tab } from '../services/google/sheetFormat';
import { GoogleApiError, SPREADSHEET_TITLE, type SheetFile, type SheetsClient } from '../services/google/sheetsClient';

/** Like the Sheets API: trailing empty cells are not returned. */
const trim = (rows: CellValue[][]) =>
  rows.map((row) => {
    const copy = [...row];
    while (copy.length > 0 && copy.at(-1) === '') copy.pop();
    return copy;
  });

/** An in-memory Google Drive holding the app's spreadsheets, behind the SheetsClient interface. */
export function fakeDrive() {
  const files: SheetFile[] = [];
  const sheets: Record<string, Record<string, CellValue[][]>> = {};
  let next = 1;

  const client: SheetsClient = {
    findAppSpreadsheet: vi.fn(async () => files[0] ?? null),
    createAppSpreadsheet: vi.fn(async () => {
      const file = { id: `sheet-${next++}`, name: SPREADSHEET_TITLE, webViewLink: 'https://docs.google.com/spreadsheets/d/fake' };
      files.unshift(file);
      sheets[file.id] = Object.fromEntries(ALL_TAB_TITLES.map((t) => [t, []]));
      return file;
    }),
    getFile: vi.fn(async (id: string) => {
      const file = files.find((f) => f.id === id);
      if (!file) throw new GoogleApiError(404, 'File not found');
      return file;
    }),
    readTabs: vi.fn(async (id: string, only?: string[]) => {
      const tabs = sheets[id] ?? {};
      return Object.fromEntries(Object.entries(tabs).filter(([t]) => !only || only.includes(t)).map(([t, rows]) => [t, trim(rows)]));
    }),
    writeTabs: vi.fn(async (id: string, tabs: Tab[]) => {
      for (const t of tabs) sheets[id]![t.title] = t.rows;
    }),
  };

  /** Puts a spreadsheet with the given tabs into the fake Drive, as if saved from another device. */
  const seed = (tabs: Tab[]) => {
    const file = { id: `sheet-${next++}`, name: SPREADSHEET_TITLE, webViewLink: 'https://docs.google.com/spreadsheets/d/fake' };
    files.unshift(file);
    sheets[file.id] = Object.fromEntries(tabs.map((t) => [t.title, t.rows]));
    return file;
  };

  return { client, files, sheets, seed };
}

/** Google sign-in that always succeeds, without a popup. `expire()` simulates the hourly token expiry. */
export function fakeAuth(): GoogleAuth & { expire: () => void } {
  let signedIn = false;
  return {
    expire: () => {
      signedIn = false;
    },
    preload: vi.fn(),
    signIn: vi.fn(async () => {
      signedIn = true;
    }),
    isSignedIn: () => signedIn,
    getToken: async () => 'test-token',
    signOut: vi.fn(async () => {
      signedIn = false;
    }),
  };
}
