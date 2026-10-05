/**
 * Minimal Google Drive / Sheets API client used from the browser.
 * Requests go straight from the user's browser to Google with their own access token;
 * there is no server in between. Only the `drive.file` scope is needed: the app can reach
 * just the spreadsheet it created, nothing else in the user's Drive.
 */
import { ALL_TAB_TITLES, ABOUT_TAB, type CellValue, type Tab } from './sheetFormat';

const DRIVE = 'https://www.googleapis.com/drive/v3';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

/** Marks the family's data spreadsheet so it can be found again from any device. */
export const APP_PROPERTY = { key: 'familyWealthCalculator', value: 'family-data' } as const;
export const SPREADSHEET_TITLE = 'Family Wealth Calculator – data';

export type SheetFile = { id: string; name: string; modifiedTime?: string; webViewLink?: string };

export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }
  /** The access token is missing or expired: sign in again. */
  get isAuthError() {
    return this.status === 401;
  }
}

export type TokenProvider = () => Promise<string>;

/** A1 reference to a whole tab, quoted so titles with spaces work: 'Asset values'. */
export const tabRange = (title: string) => `'${title.replace(/'/g, "''")}'`;

/** Typed cell values, so text is never interpreted as a formula, number or date. */
function toExtendedValue(v: CellValue | undefined) {
  if (v === undefined || v === '') return {};
  if (typeof v === 'number') return { userEnteredValue: { numberValue: v } };
  if (typeof v === 'boolean') return { userEnteredValue: { boolValue: v } };
  return { userEnteredValue: { stringValue: v } };
}

export function createSheetsClient(getToken: TokenProvider, fetchImpl: typeof fetch = (...a) => fetch(...a)) {
  async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
    const token = await getToken();
    const res = await fetchImpl(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (!res.ok) {
      let message = `Google request failed (${res.status})`;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        if (body.error?.message) message = body.error.message;
      } catch {
        // no JSON body
      }
      throw new GoogleApiError(res.status, message);
    }
    return (await res.json()) as T;
  }

  const fileFields = 'id,name,modifiedTime,webViewLink';

  async function sheetIds(spreadsheetId: string): Promise<Map<string, number>> {
    const meta = await call<{ sheets?: { properties: { sheetId: number; title: string } }[] }>(
      `${SHEETS}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
    );
    return new Map((meta.sheets ?? []).map((s) => [s.properties.title, s.properties.sheetId]));
  }

  async function batchUpdate(spreadsheetId: string, requests: unknown[]) {
    if (requests.length === 0) return;
    await call(`${SHEETS}/${spreadsheetId}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });
  }

  return {
    /** The family's data spreadsheet created earlier by this app, if any (most recently changed first). */
    async findAppSpreadsheet(): Promise<SheetFile | null> {
      const q = `appProperties has { key='${APP_PROPERTY.key}' and value='${APP_PROPERTY.value}' } and trashed = false`;
      const params = new URLSearchParams({ q, spaces: 'drive', fields: `files(${fileFields})`, orderBy: 'modifiedTime desc', pageSize: '10' });
      const res = await call<{ files?: SheetFile[] }>(`${DRIVE}/files?${params}`);
      return res.files?.[0] ?? null;
    },

    /** Creates the data spreadsheet in the user's Drive, with all tabs, and tags it. */
    async createAppSpreadsheet(): Promise<SheetFile> {
      const created = await call<{ spreadsheetId: string }>(SHEETS, {
        method: 'POST',
        body: JSON.stringify({
          properties: { title: SPREADSHEET_TITLE },
          sheets: ALL_TAB_TITLES.map((title) => ({ properties: { title, gridProperties: { frozenRowCount: title === ABOUT_TAB ? 0 : 1 } } })),
        }),
      });
      return call<SheetFile>(`${DRIVE}/files/${created.spreadsheetId}?fields=${fileFields}`, {
        method: 'PATCH',
        body: JSON.stringify({ appProperties: { [APP_PROPERTY.key]: APP_PROPERTY.value } }),
      });
    },

    async getFile(spreadsheetId: string): Promise<SheetFile & { trashed?: boolean }> {
      return call(`${DRIVE}/files/${spreadsheetId}?fields=${fileFields},trashed`);
    },

    /** All tabs as raw cell values (title → rows). Trailing empty cells are omitted by Google. */
    async readTabs(spreadsheetId: string, onlyTitles?: string[]): Promise<Record<string, CellValue[][]>> {
      const existing = [...(await sheetIds(spreadsheetId)).keys()];
      const titles = onlyTitles ? existing.filter((t) => onlyTitles.includes(t)) : existing;
      if (titles.length === 0) return {};
      const params = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE', majorDimension: 'ROWS' });
      for (const t of titles) params.append('ranges', tabRange(t));
      const res = await call<{ valueRanges?: { values?: CellValue[][] }[] }>(`${SHEETS}/${spreadsheetId}/values:batchGet?${params}`);
      return Object.fromEntries(titles.map((t, i) => [t, res.valueRanges?.[i]?.values ?? []]));
    },

    /**
     * Replaces the contents of the given tabs. Missing tabs are added first; then every tab
     * is resized to its data and rewritten in ONE batchUpdate, which Google applies all-or-nothing,
     * so a failed save never leaves a half-written sheet.
     */
    async writeTabs(spreadsheetId: string, tabs: Tab[]): Promise<void> {
      let ids = await sheetIds(spreadsheetId);
      const missing = tabs.filter((t) => !ids.has(t.title));
      if (missing.length > 0) {
        await batchUpdate(spreadsheetId, missing.map((t) => ({ addSheet: { properties: { title: t.title } } })));
        ids = await sheetIds(spreadsheetId);
      }
      const requests = tabs.flatMap((tab) => {
        const sheetId = ids.get(tab.title)!;
        const isData = tab.title !== ABOUT_TAB;
        // Google refuses a tab with no rows below the frozen header, so data tabs keep at least one (blank) row.
        const rowCount = Math.max(tab.rows.length, isData ? 2 : 1);
        const columnCount = Math.max(1, ...tab.rows.map((r) => r.length));
        return [
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { rowCount, columnCount, frozenRowCount: isData ? 1 : 0 } },
              fields: 'gridProperties(rowCount,columnCount,frozenRowCount)',
            },
          },
          {
            // Covers the whole (resized) tab: cells not given a value are cleared.
            updateCells: {
              range: { sheetId, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: columnCount },
              rows: tab.rows.map((row) => ({
                values: Array.from({ length: columnCount }, (_, i) => toExtendedValue(row[i])),
              })),
              fields: 'userEnteredValue',
            },
          },
          ...(isData && tab.rows.length > 0
            ? [
                {
                  repeatCell: {
                    range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                    cell: { userEnteredFormat: { textFormat: { bold: true } } },
                    fields: 'userEnteredFormat.textFormat.bold',
                  },
                },
              ]
            : []),
        ];
      });
      await batchUpdate(spreadsheetId, requests);
    },
  };
}

export type SheetsClient = ReturnType<typeof createSheetsClient>;
