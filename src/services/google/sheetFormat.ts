/**
 * How a family's data is laid out in their Google Sheet (pure functions, no network).
 *
 * One tab per data type, header row = field names, one row per record; a Settings tab
 * (one setting per row) and an About tab. The sheet holds exactly what a JSON backup holds,
 * so reading it back goes through the same validation (validateBackup).
 */
import type { AppSettings } from '../../models/settings';
import {
  BACKUP_APP,
  BACKUP_FORMAT_VERSION,
  RECORD_STORES,
  STORE_NAMES,
  validateBackup,
  type Backup,
  type ParsedBackup,
  type RecordStore,
} from '../storage/backupRepository';

export type CellValue = string | number | boolean;
export type Tab = { title: string; rows: CellValue[][] };

/** Tab title for each data type, in the order tabs appear in the sheet. */
export const TAB_TITLES: Record<RecordStore, string> = {
  familyMembers: 'Family',
  assets: 'Assets',
  assetOwnerships: 'Ownership',
  liabilities: 'Liabilities',
  contributions: 'Investments',
  incomes: 'Income',
  expenses: 'Expenses',
  goals: 'Goals',
  snapshots: 'Snapshots',
  assetValuations: 'Asset values',
};
export const SETTINGS_TAB = 'Settings';
export const ABOUT_TAB = 'About';
export const ALL_TAB_TITLES = [ABOUT_TAB, ...STORE_NAMES.map((s) => TAB_TITLES[s]), SETTINGS_TAB];

/** Columns of a data tab: the fields of its stored record schema, in schema order. */
export const columnsOf = (store: RecordStore): string[] => Object.keys(RECORD_STORES[store].shape);

const toCell = (v: unknown): CellValue =>
  v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : (v as CellValue);

const SAVE_ID = 'Save ID';

/**
 * Converts a backup into sheet tabs. `saveId` is a fresh random ID per save: before saving
 * again, the app checks the sheet still has the ID it last saw, so a save from another
 * device is never silently overwritten.
 */
export function backupToTabs(backup: Backup, saveId: string): Tab[] {
  const about: Tab = {
    title: ABOUT_TAB,
    rows: [
      ['Family Wealth Calculator data'],
      ['App', BACKUP_APP],
      ['Format version', BACKUP_FORMAT_VERSION],
      ['Last saved', backup.exportedAt],
      [SAVE_ID, saveId],
      ['Note', 'This sheet is managed by the Family Wealth Calculator app. Editing it by hand may make it unreadable.'],
    ],
  };
  const data = STORE_NAMES.map((store): Tab => {
    const columns = columnsOf(store);
    const records = backup.data[store] as Record<string, unknown>[];
    return { title: TAB_TITLES[store], rows: [columns, ...records.map((r) => columns.map((c) => toCell(r[c])))] };
  });
  const settings: Tab = {
    title: SETTINGS_TAB,
    rows: [['Setting', 'Value'], ...Object.entries(backup.settings).map(([k, v]): CellValue[] => [k, toCell(v)])],
  };
  return [about, ...data, settings];
}

/** A settings value as written: objects are JSON text, other values are plain. */
const fromSettingCell = (v: CellValue): unknown => {
  if (typeof v === 'string' && /^[[{]/.test(v.trim())) {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
};

/** Reads one data tab: header row names the fields; empty cells mean "not set". */
function readRecords(rows: CellValue[][] | undefined): Record<string, unknown>[] {
  if (!rows || rows.length === 0) return [];
  const [header, ...body] = rows;
  return body
    .filter((row) => row.some((c) => c !== '' && c !== undefined))
    .map((row) => {
      const record: Record<string, unknown> = {};
      header!.forEach((name, i) => {
        const cell = row[i];
        if (typeof name === 'string' && name !== '' && cell !== undefined && cell !== '') record[name] = cell;
      });
      return record;
    });
}

/**
 * Converts tabs read from a sheet (title → rows) back into a validated backup.
 * Missing tabs count as empty. Invalid rows are reported, never silently dropped.
 */
export function tabsToBackup(tabs: Record<string, CellValue[][]>): ParsedBackup {
  const about = new Map((tabs[ABOUT_TAB] ?? []).map((r) => [String(r[0] ?? ''), r[1]]));
  const settingsRows = (tabs[SETTINGS_TAB] ?? []).slice(1);
  const settings: Partial<AppSettings> = Object.fromEntries(
    settingsRows.filter((r) => typeof r[0] === 'string' && r[0] !== '').map((r) => [r[0] as string, fromSettingCell(r[1] ?? '')]),
  );
  const data = Object.fromEntries(STORE_NAMES.map((store) => [store, readRecords(tabs[TAB_TITLES[store]])]));
  return validateBackup({
    app: about.get('App') ?? BACKUP_APP,
    formatVersion: about.get('Format version') ?? BACKUP_FORMAT_VERSION,
    exportedAt: String(about.get('Last saved') ?? ''),
    settings,
    data,
  });
}

/** The Save ID in an About tab's rows, or null if the sheet has never been saved by the app. */
export function readSaveId(aboutRows: CellValue[][] | undefined): string | null {
  const row = (aboutRows ?? []).find((r) => r[0] === SAVE_ID);
  return row && typeof row[1] === 'string' && row[1] !== '' ? row[1] : null;
}

/** True when a sheet has no records and no settings yet (e.g. just created). */
export function isEmptySheet(tabs: Record<string, CellValue[][]>): boolean {
  return STORE_NAMES.every((s) => readRecords(tabs[TAB_TITLES[s]]).length === 0) && (tabs[SETTINGS_TAB] ?? []).length <= 1;
}
