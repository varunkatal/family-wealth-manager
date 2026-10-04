import { csvField, toCsv } from './csv';
import { buildExportTables } from './tables';
import { buildXlsx, columnLetter, crc32, excelDate } from './xlsx';

describe('CSV', () => {
  it('quotes, escapes and guards against formulas', () => {
    expect(csvField('Example FD')).toBe('Example FD');
    expect(csvField('A, B')).toBe('"A, B"');
    expect(csvField('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvField('line\nbreak')).toBe('"line\nbreak"');
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField('-5')).toBe("'-5"); // text, not a number
    expect(csvField(-5)).toBe('-5'); // a real number stays a number
    expect(csvField(undefined)).toBe('');
    expect(toCsv(['Name', 'Value'], [['A', 1], ['B', null]])).toBe('Name,Value\r\nA,1\r\nB,\r\n');
  });
});

describe('XLSX writer', () => {
  it('helpers', () => {
    expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926'); // standard check value
    expect([0, 25, 26, 51, 701].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'AZ', 'ZZ']);
    expect(excelDate('1900-03-01')).toBe(61);
    expect(excelDate('2026-10-05')).toBe(46300);
  });

  it('builds a zip with the workbook parts and escaped cells', () => {
    const bytes = buildXlsx([{ name: 'Assets', columns: [{ header: 'Name' }, { header: 'Value', type: 'inr' }], rows: [['A & <B>', 100]] }]);
    const text = new TextDecoder().decode(bytes); // stored entries are readable as text
    expect(text.startsWith('PK')).toBe(true);
    for (const part of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) expect(text).toContain(part);
    expect(text).toContain('A &amp; &lt;B&gt;');
    expect(text).toContain('<c r="B2" s="2"><v>100</v></c>');
  });
});

describe('export tables', () => {
  it('replaces IDs with names and includes family share values', () => {
    const tables = buildExportTables({
      members: [{ id: 'm1', name: 'Person A', relationship: 'Self', isActive: true, createdAt: '', updatedAt: '' }],
      assets: [
        { id: 'a1', name: 'Example Property', assetClass: 'Real Estate', currentValue: 1000000, valuationMethod: 'manual', valuationDate: '2026-01-01', liquidity: 'illiquid', createdAt: '', updatedAt: '' },
      ],
      ownerships: [{ id: 'o1', assetId: 'a1', familyMemberId: 'm1', percentage: 50 }],
      liabilities: [],
      contributions: [],
      incomes: [{ id: 'i1', memberId: 'm1', type: 'Rent', amount: 120000, frequency: 'yearly', createdAt: '', updatedAt: '' }],
      expenses: [],
      goals: [],
      snapshots: [],
      valuations: [],
    });
    const byKey = Object.fromEntries(tables.map((t) => [t.key, t]));
    expect(byKey.assets!.rows[0]!.slice(0, 7)).toEqual(['Example Property', 'Real Estate', undefined, undefined, 'Person A 50%', 1000000, 500000]);
    expect(byKey.income!.rows[0]!.slice(0, 7)).toEqual(['Rent', undefined, 'Person A', 120000, 'Yearly', 10000, 120000]);
    expect(byKey.summary!.rows.slice(0, 3)).toEqual([
      ['Total assets', 500000],
      ['Total liabilities', 0],
      ['Net worth', 500000],
    ]);
  });
});
