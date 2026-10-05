import { createSheetsClient, GoogleApiError, tabRange } from './sheetsClient';

type Call = { url: string; method: string; body: unknown; auth: string | null };

/** A fake fetch that answers by URL and records every request. */
function fakeFetch(answer: (url: string, method: string, body: any) => { status?: number; json: unknown }) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body, auth: new Headers(init?.headers).get('Authorization') });
    const { status = 200, json } = answer(url, method, body);
    return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { impl, calls };
}

const token = async () => 'test-token';
const meta = { sheets: [{ properties: { sheetId: 0, title: 'About' } }, { properties: { sheetId: 7, title: 'Asset values' } }] };

describe('Google Sheets client', () => {
  it('quotes tab names for ranges', () => {
    expect(tabRange('Asset values')).toBe("'Asset values'");
    expect(tabRange("Ravi's")).toBe("'Ravi''s'");
  });

  it('finds the app spreadsheet by its app property, sending the access token', async () => {
    const { impl, calls } = fakeFetch(() => ({ json: { files: [{ id: 'abc', name: 'Family Wealth Calculator – data' }] } }));
    const file = await createSheetsClient(token, impl).findAppSpreadsheet();
    expect(file).toEqual({ id: 'abc', name: 'Family Wealth Calculator – data' });
    const q = new URL(calls[0]!.url).searchParams.get('q');
    expect(q).toBe("appProperties has { key='familyWealthCalculator' and value='family-data' } and trashed = false");
    expect(calls[0]!.auth).toBe('Bearer test-token');
  });

  it('returns null when there is no spreadsheet yet', async () => {
    const { impl } = fakeFetch(() => ({ json: { files: [] } }));
    expect(await createSheetsClient(token, impl).findAppSpreadsheet()).toBeNull();
  });

  it('creates the spreadsheet with all tabs and tags it', async () => {
    const { impl, calls } = fakeFetch((url) =>
      url.startsWith('https://sheets') ? { json: { spreadsheetId: 'new1' } } : { json: { id: 'new1', name: 'Family Wealth Calculator – data' } },
    );
    const file = await createSheetsClient(token, impl).createAppSpreadsheet();
    expect(file.id).toBe('new1');
    const titles = (calls[0]!.body as { sheets: { properties: { title: string } }[] }).sheets.map((s) => s.properties.title);
    expect(titles).toEqual(['About', 'Family', 'Assets', 'Ownership', 'Liabilities', 'Investments', 'Income', 'Expenses', 'Goals', 'Snapshots', 'Asset values', 'Settings']);
    expect(calls[1]).toMatchObject({ method: 'PATCH', body: { appProperties: { familyWealthCalculator: 'family-data' } } });
  });

  it('reads tabs as unformatted values, keyed by title', async () => {
    const { impl, calls } = fakeFetch((url) =>
      url.includes('values:batchGet')
        ? { json: { valueRanges: [{ values: [['App', 'family-wealth-calculator']] }, {}] } }
        : { json: meta },
    );
    const tabs = await createSheetsClient(token, impl).readTabs('s1');
    expect(tabs).toEqual({ About: [['App', 'family-wealth-calculator']], 'Asset values': [] });
    const params = new URL(calls[1]!.url).searchParams;
    expect(params.getAll('ranges')).toEqual(["'About'", "'Asset values'"]);
    expect(params.get('valueRenderOption')).toBe('UNFORMATTED_VALUE');
  });

  it('writes all tabs in one atomic batch: resize, typed values, bold header', async () => {
    const { impl, calls } = fakeFetch((_url, method) =>
      method === 'POST' ? { json: {} } : { json: { sheets: [...meta.sheets, { properties: { sheetId: 9, title: 'Family' } }] } },
    );
    await createSheetsClient(token, impl).writeTabs('s1', [
      { title: 'About', rows: [['App', 'family-wealth-calculator']] },
      { title: 'Family', rows: [['id', 'name', 'isActive'], ['m1', '=SUM(1)', true], ['m2', 'Person B', 12.5]] },
    ]);
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(1); // everything in a single batchUpdate
    const requests = (posts[0]!.body as { requests: any[] }).requests;
    const familyResize = requests.find((r) => r.updateSheetProperties?.properties.sheetId === 9);
    expect(familyResize.updateSheetProperties.properties.gridProperties).toEqual({ rowCount: 3, columnCount: 3, frozenRowCount: 1 });
    const familyCells = requests.find((r) => r.updateCells?.range.sheetId === 9).updateCells;
    expect(familyCells.fields).toBe('userEnteredValue');
    expect(familyCells.rows[1].values).toEqual([
      { userEnteredValue: { stringValue: 'm1' } },
      { userEnteredValue: { stringValue: '=SUM(1)' } }, // text, never a formula
      { userEnteredValue: { boolValue: true } },
    ]);
    expect(familyCells.rows[2].values[2]).toEqual({ userEnteredValue: { numberValue: 12.5 } });
    expect(requests.some((r) => r.repeatCell?.range.sheetId === 9)).toBe(true);
    expect(requests.some((r) => r.repeatCell?.range.sheetId === 0)).toBe(false); // About has no header row
  });

  it('adds missing tabs before writing', async () => {
    let added = false;
    const { impl, calls } = fakeFetch((_url, method, body) => {
      if (method === 'POST' && body.requests[0].addSheet) added = true;
      if (method === 'POST') return { json: {} };
      return { json: added ? { sheets: [...meta.sheets, { properties: { sheetId: 3, title: 'Goals' } }] } : meta };
    });
    await createSheetsClient(token, impl).writeTabs('s1', [{ title: 'Goals', rows: [] }]);
    const posts = calls.filter((c) => c.method === 'POST');
    expect((posts[0]!.body as any).requests).toEqual([{ addSheet: { properties: { title: 'Goals' } } }]);
    const cells = (posts[1]!.body as any).requests.find((r: any) => r.updateCells).updateCells;
    expect(cells.range).toEqual({ sheetId: 3, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 }); // emptied
  });

  it('turns Google errors into GoogleApiError, flagging expired sign-ins', async () => {
    const { impl } = fakeFetch(() => ({ status: 401, json: { error: { code: 401, message: 'Invalid Credentials' } } }));
    const err = await createSheetsClient(token, impl).findAppSpreadsheet().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GoogleApiError);
    expect(err).toMatchObject({ status: 401, message: 'Invalid Credentials', isAuthError: true });

    const { impl: notFound } = fakeFetch(() => ({ status: 404, json: { error: { message: 'File not found' } } }));
    const e2 = await createSheetsClient(token, notFound).getFile('x').catch((e: unknown) => e);
    expect(e2).toMatchObject({ status: 404, isAuthError: false });
  });
});
