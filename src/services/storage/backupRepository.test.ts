import { DEFAULT_SETTINGS } from '../../models/settings';
import { buildDemoData } from '../demo/demoData';
import { listAssets, listOwnerships } from './assetRepository';
import { countRecords, deleteAllData, exportBackup, parseBackup, restoreBackup } from './backupRepository';
import { createExpense, createIncome } from './cashFlowRepository';
import { createContribution } from './contributionRepository';
import { loadDemoData } from './demoRepository';
import { listFamilyMembers } from './familyMemberRepository';
import { createGoal } from './goalRepository';
import { saveWealthSnapshot } from './historyRepository';
import { getSettings, saveSettings } from './settingsRepository';

async function seed() {
  await loadDemoData(buildDemoData());
  const [a] = await listFamilyMembers();
  const fund = (await listAssets()).find((x) => x.name === 'Example Equity Fund')!;
  await createContribution({ name: 'Example SIP', ownerId: a!.id, linkedAssetId: fund.id, amount: 10000, frequency: 'monthly', startDate: '2026-01-01' });
  await createIncome({ memberId: a!.id, type: 'Salary', amount: 100000, frequency: 'monthly' });
  await createExpense({ category: 'Grocery', amount: 15000, frequency: 'monthly' });
  await createGoal({ name: 'Example Car', type: 'Car', targetAmount: 1000000, savedAmount: 0, targetDate: '2030-01-01', priority: 'high' });
  await saveWealthSnapshot();
  await saveSettings({ ...DEFAULT_SETTINGS, inflationRate: 5, classDefaults: { Equity: { base: 11 } } });
}

describe('backup and restore', () => {
  it('round-trips every store and setting exactly', async () => {
    await seed();
    const backup = await exportBackup();
    const before = await countRecords();
    expect(before).toMatchObject({ familyMembers: 2, assets: 4, assetOwnerships: 6, contributions: 1, incomes: 1, expenses: 1, goals: 1, snapshots: 7, assetValuations: 4 });

    const text = JSON.stringify(backup);
    await deleteAllData();
    expect(Object.values(await countRecords()).every((n) => n === 0)).toBe(true);
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);

    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.counts).toEqual(before);
    await restoreBackup(parsed.backup);
    expect(await countRecords()).toEqual(before);
    expect((await getSettings()).inflationRate).toBe(5);
    expect((await exportBackup()).data).toEqual(backup.data); // same records (key order may differ)
  });

  it('restore replaces existing data instead of merging', async () => {
    await seed();
    const backup = parseBackup(JSON.stringify(await exportBackup()));
    await loadDemoData(buildDemoData()); // more data added after the backup
    expect((await listFamilyMembers()).length).toBe(4);
    if (backup.ok) await restoreBackup(backup.backup);
    expect((await listFamilyMembers()).length).toBe(2);
    expect(await listOwnerships()).toHaveLength(6);
  });

  it('rejects invalid files without writing anything', async () => {
    await seed();
    const good = await exportBackup();
    const bad = (mutate: (b: typeof good) => unknown) => parseBackup(JSON.stringify(mutate(structuredClone(good))));

    expect(parseBackup('not json')).toEqual({ ok: false, errors: ['This file is not valid JSON.'] });
    expect(parseBackup('{"hello":1}')).toEqual({ ok: false, errors: ['This is not a Family Wealth Calculator backup.'] });
    expect(bad((b) => ({ ...b, formatVersion: 99 }))).toEqual({ ok: false, errors: ['Unsupported backup version (99).'] });
    expect(bad((b) => ((b.data.assets[0] as { currentValue: unknown }).currentValue = 'lots', b))).toEqual({
      ok: false,
      errors: ['Assets: record 1 is not valid.'],
    });
    expect(bad((b) => (b.data.familyMembers.push({ ...b.data.familyMembers[0]! }), b))).toMatchObject({ ok: false, errors: [expect.stringContaining('duplicate ID')] });
    const orphan = bad((b) => ((b.data.familyMembers = b.data.familyMembers.slice(1)), b));
    expect(orphan.ok).toBe(false);
    if (!orphan.ok) expect(orphan.errors.some((e) => e.includes('missing family member'))).toBe(true);
    // Nothing changed
    expect((await countRecords()).familyMembers).toBe(2);
  });

  it('treats missing stores in an older backup as empty', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'family-wealth-calculator', formatVersion: 1, exportedAt: '', settings: {}, data: {} }));
    expect(parsed.ok && parsed.counts.assets).toBe(0);
  });
});
