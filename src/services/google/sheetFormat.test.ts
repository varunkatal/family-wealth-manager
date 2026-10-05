import { DEFAULT_SETTINGS } from '../../models/settings';
import { buildDemoData } from '../demo/demoData';
import { listAssets } from '../storage/assetRepository';
import { exportBackup } from '../storage/backupRepository';
import { createExpense, createIncome } from '../storage/cashFlowRepository';
import { createContribution } from '../storage/contributionRepository';
import { loadDemoData } from '../storage/demoRepository';
import { listFamilyMembers } from '../storage/familyMemberRepository';
import { createGoal } from '../storage/goalRepository';
import { saveSettings } from '../storage/settingsRepository';
import { ALL_TAB_TITLES, backupToTabs, columnsOf, isEmptySheet, readSaveId, tabsToBackup, type CellValue, type Tab } from './sheetFormat';

/** What the Sheets API gives back: rows without trailing empty cells, keyed by tab title. */
const asReadFromSheet = (tabs: Tab[]): Record<string, CellValue[][]> =>
  Object.fromEntries(
    tabs.map((t) => [
      t.title,
      t.rows.map((row) => {
        const copy = [...row];
        while (copy.length > 0 && copy.at(-1) === '') copy.pop();
        return copy;
      }),
    ]),
  );

async function seed() {
  await loadDemoData(buildDemoData());
  const [a] = await listFamilyMembers();
  const fund = (await listAssets()).find((x) => x.name === 'Example Equity Fund')!;
  await createContribution({ name: 'Example SIP', ownerId: a!.id, linkedAssetId: fund.id, amount: 10000, frequency: 'monthly', startDate: '2026-01-01', annualIncrease: 10 });
  await createIncome({ memberId: a!.id, type: 'Salary', amount: 100000, frequency: 'monthly', description: '=HYPERLINK("x")' });
  await createExpense({ category: 'Grocery', amount: 15000.5, frequency: 'monthly', notes: 'Line 1\nLine 2, with "quotes"' });
  await createGoal({ name: 'Example Car', type: 'Car', targetAmount: 1000000, savedAmount: 0, targetDate: '2030-01-01', priority: 'high' });
  await saveSettings({ ...DEFAULT_SETTINGS, theme: 'dark', inflationRate: 5.5, classDefaults: { Equity: { conservative: 9, base: 11 } } });
}

describe('Google Sheet format', () => {
  it('round-trips every record and setting exactly', async () => {
    await seed();
    const backup = await exportBackup();
    const tabs = backupToTabs(backup, 'save-1');
    expect(tabs.map((t) => t.title)).toEqual(ALL_TAB_TITLES);

    const parsed = tabsToBackup(asReadFromSheet(tabs));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.data).toEqual(backup.data);
    expect(parsed.backup.settings).toEqual(backup.settings);
    expect(parsed.backup.exportedAt).toBe(backup.exportedAt);
  });

  it('lays out readable tabs: header row of field names, one row per record', async () => {
    await seed();
    const tabs = backupToTabs(await exportBackup(), 'save-1');
    const assets = tabs.find((t) => t.title === 'Assets')!;
    expect(assets.rows[0]).toEqual(columnsOf('assets'));
    expect(assets.rows).toHaveLength(5); // header + 4 demo assets
    const settings = tabs.find((t) => t.title === 'Settings')!;
    expect(settings.rows).toContainEqual(['inflationRate', 5.5]);
    expect(settings.rows).toContainEqual(['classDefaults', '{"Equity":{"conservative":9,"base":11}}']);
    const about = tabs.find((t) => t.title === 'About')!.rows;
    expect(about[2]).toEqual(['Format version', 1]);
    expect(readSaveId(about)).toBe('save-1');
    expect(readSaveId(undefined)).toBeNull();
    expect(readSaveId([['Family Wealth Calculator data']])).toBeNull();
  });

  it('keeps formula-like text and multi-line notes as plain text', async () => {
    await seed();
    const parsed = tabsToBackup(asReadFromSheet(backupToTabs(await exportBackup(), 'save-1')));
    expect(parsed.ok && parsed.backup.data.incomes[0]!.description).toBe('=HYPERLINK("x")');
    expect(parsed.ok && parsed.backup.data.expenses[0]!.notes).toBe('Line 1\nLine 2, with "quotes"');
    expect(parsed.ok && parsed.backup.data.expenses[0]!.amount).toBe(15000.5);
  });

  it('reads columns by name, so their order does not matter', async () => {
    await seed();
    const tabs = asReadFromSheet(backupToTabs(await exportBackup(), 'save-1'));
    const family = tabs.Family!;
    tabs.Family = family.map((row) => [...row].reverse());
    const parsed = tabsToBackup(tabs);
    expect(parsed.ok && parsed.backup.data.familyMembers.map((m) => m.name).sort()).toEqual(['Person A', 'Person B']);
  });

  it('treats a new, empty sheet as empty data with default settings', () => {
    const empty = Object.fromEntries(ALL_TAB_TITLES.map((t) => [t, [] as CellValue[][]]));
    expect(isEmptySheet(empty)).toBe(true);
    const parsed = tabsToBackup({});
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(Object.values(parsed.counts).every((n) => n === 0)).toBe(true);
      expect(parsed.backup.settings).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('reports invalid rows and broken references instead of dropping them', async () => {
    await seed();
    const tabs = asReadFromSheet(backupToTabs(await exportBackup(), 'save-1'));
    expect(isEmptySheet(tabs)).toBe(false);

    const badValue = structuredClone(tabs);
    const valueCol = (badValue.Assets![0] as string[]).indexOf('currentValue');
    badValue.Assets![2]![valueCol] = 'lots';
    expect(tabsToBackup(badValue)).toEqual({ ok: false, errors: ['Assets: record 2 is not valid.'] });

    const missingMember = structuredClone(tabs);
    missingMember.Family = missingMember.Family!.slice(0, 2); // drop one member
    const r = tabsToBackup(missingMember);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('missing family member'))).toBe(true);
  });

  it('rejects a sheet from another app or a newer format', () => {
    expect(tabsToBackup({ About: [['x'], ['App', 'something-else']] })).toEqual({
      ok: false,
      errors: ['This is not a Family Wealth Calculator backup.'],
    });
    expect(tabsToBackup({ About: [['x'], ['App', 'family-wealth-calculator'], ['Format version', 2]] })).toEqual({
      ok: false,
      errors: ['Unsupported backup version (2).'],
    });
  });
});
