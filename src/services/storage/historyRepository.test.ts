import { buildDemoData } from '../demo/demoData';
import { createAsset, deleteAsset, updateAsset } from './assetRepository';
import { clearDemoData, loadDemoData } from './demoRepository';
import { createFamilyMember } from './familyMemberRepository';
import {
  addManualSnapshot,
  addManualValuation,
  deleteSnapshot,
  listSnapshots,
  listValuations,
  saveWealthSnapshot,
} from './historyRepository';
import { createLiability } from './liabilityRepository';

let A = '';
beforeEach(async () => {
  A = (await createFamilyMember({ name: 'Person A', relationship: 'Self', isActive: true })).id;
});

const fd = {
  name: 'Example FD',
  assetClass: 'Fixed Income',
  valuationMethod: 'manual' as const,
  currentValue: 1000000,
  valuationDate: '2026-01-01',
  liquidity: 'semi-liquid' as const,
};

describe('wealth snapshots (Phase 12 acceptance)', () => {
  it('captures current totals; historical values stay unchanged when current values change', async () => {
    const asset = await createAsset({ ...fd, owners: [{ familyMemberId: A, percentage: 100 }] });
    await createLiability({ name: 'Example Loan', type: 'Other', ownerId: A, currentOutstanding: 200000 });
    const first = await saveWealthSnapshot('Before the update');
    expect(first).toMatchObject({ totalAssets: 1000000, totalLiabilities: 200000, netWorth: 800000, source: 'captured', notes: 'Before the update' });

    await updateAsset(asset.id, { ...fd, currentValue: 1500000, owners: [{ familyMemberId: A, percentage: 100 }] });
    await saveWealthSnapshot();

    const [old, current] = await listSnapshots();
    expect(old!.netWorth).toBe(800000); // unchanged
    expect(current!.netWorth).toBe(1300000);
  });

  it('adds manual past snapshots and deletes them', async () => {
    const s = await addManualSnapshot({ date: '2025-06-30', totalAssets: 900000, totalLiabilities: 250000 });
    expect(s).toMatchObject({ netWorth: 650000, source: 'manual' });
    await expect(addManualSnapshot({ date: '2999-01-01', totalAssets: 1, totalLiabilities: 0 })).rejects.toThrow('Date cannot be in the future');
    await deleteSnapshot(s.id);
    expect(await listSnapshots()).toEqual([]);
  });
});

describe('asset valuation history', () => {
  it('records a value when an asset is created or its value/date changes, not otherwise', async () => {
    const owners = [{ familyMemberId: A, percentage: 100 }];
    const asset = await createAsset({ ...fd, owners });
    await updateAsset(asset.id, { ...fd, name: 'Renamed FD', owners }); // value unchanged
    await updateAsset(asset.id, { ...fd, currentValue: 1070000, valuationDate: '2026-06-30', owners });
    expect((await listValuations()).map((v) => [v.date, v.value, v.source])).toEqual([
      ['2026-01-01', 1000000, 'asset-update'],
      ['2026-06-30', 1070000, 'asset-update'],
    ]);
  });

  it('accepts manual past values, and is removed with the asset', async () => {
    const asset = await createAsset({ ...fd, owners: [{ familyMemberId: A, percentage: 100 }] });
    await addManualValuation(asset.id, { date: '2024-01-01', value: 800000, notes: 'From statement' });
    await expect(addManualValuation('missing', { date: '2024-01-01', value: 1 })).rejects.toThrow('Asset not found');
    expect((await listValuations()).map((v) => v.date)).toEqual(['2024-01-01', '2026-01-01']);
    await deleteAsset(asset.id);
    expect(await listValuations()).toEqual([]);
  });

  it('demo snapshots and valuations are removed with demo data; the user’s are kept', async () => {
    await loadDemoData(buildDemoData());
    expect((await listSnapshots()).every((s) => s.isDemo)).toBe(true);
    expect(await listSnapshots()).toHaveLength(6);
    const mine = await saveWealthSnapshot();
    await clearDemoData();
    expect((await listSnapshots()).map((s) => s.id)).toEqual([mine.id]);
    expect(await listValuations()).toEqual([]);
  });
});
