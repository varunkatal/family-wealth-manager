import { buildDemoData } from '../demo/demoData';
import { calculateFamilyWealth } from '../finance/netWorth';
import { createAsset, listAssets, listOwnerships } from './assetRepository';
import { clearDemoData, loadDemoData } from './demoRepository';
import { createFamilyMember, listFamilyMembers } from './familyMemberRepository';
import { createLiability, listLiabilities } from './liabilityRepository';

async function wealth() {
  const [members, assets, ownerships, liabilities] = await Promise.all([
    listFamilyMembers(),
    listAssets(),
    listOwnerships(),
    listLiabilities(),
  ]);
  return { members, ...calculateFamilyWealth(members.map((m) => m.id), assets, ownerships, liabilities) };
}

describe('demo data', () => {
  it('loads fake members, owned assets and a loan, all marked demo', async () => {
    await loadDemoData(buildDemoData());
    const w = await wealth();
    expect(w.members.map((m) => m.name)).toEqual(['Person A', 'Person B']);
    expect([...w.members, ...(await listAssets()), ...(await listLiabilities())].every((r) => r.isDemo)).toBe(true);
    expect(w.totalAssets).toBe(4500000);
    expect(w.totalLiabilities).toBe(200000);
    expect(w.netWorth).toBe(4300000);
    expect(w.byMember.map((m) => m.netWorth)).toEqual([2350000, 1950000]); // A: 25.5L − 2L, B: 19.5L
    expect(w.unownedAssetIds).toEqual([]);
  });

  it('clears only demo records', async () => {
    const me = await createFamilyMember({ name: 'Me', relationship: 'Self', isActive: true });
    await createAsset({
      name: 'My FD',
      assetClass: 'Fixed Income',
      valuationMethod: 'manual',
      currentValue: 100000,
      valuationDate: '2026-01-01',
      liquidity: 'semi-liquid',
      owners: [{ familyMemberId: me.id, percentage: 100 }],
    });
    await loadDemoData(buildDemoData());

    const result = await clearDemoData();
    expect(result).toEqual({ assets: 4, liabilities: 1, members: 2, keptMembers: [] });
    expect((await listFamilyMembers()).map((m) => m.name)).toEqual(['Me']);
    expect((await listAssets()).map((a) => a.name)).toEqual(['My FD']);
    expect(await listOwnerships()).toHaveLength(1);
    expect(await listLiabilities()).toEqual([]);
  });

  it('keeps a demo member who now owns real data', async () => {
    await loadDemoData(buildDemoData());
    const personA = (await listFamilyMembers()).find((m) => m.name === 'Person A')!;
    await createLiability({ name: 'My card', type: 'Credit Card', ownerId: personA.id, currentOutstanding: 5000 });

    const result = await clearDemoData();
    expect(result.keptMembers).toEqual(['Person A']);
    const remaining = await listFamilyMembers();
    expect(remaining.map((m) => m.name)).toEqual(['Person A']);
    expect(remaining[0]!.isDemo).toBeUndefined(); // now a regular member
    expect((await listLiabilities()).map((l) => l.name)).toEqual(['My card']);
  });
});
