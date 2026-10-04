import {
  calculateFamilySharePercentage,
  calculateFamilyWealth,
  calculateMemberWealth,
  calculateNetWorth,
  calculateOwnershipValue,
  calculateTotalAssets,
  calculateTotalLiabilities,
  findUnownedAssets,
} from './netWorth';

const own = (assetId: string, familyMemberId: string, percentage: number) => ({ assetId, familyMemberId, percentage });

describe('Phase 4 acceptance tests (spec §10)', () => {
  it('Test 1: one person owns ₹10,00,000 → Assets = ₹10,00,000', () => {
    const assets = [{ id: 'x', currentValue: 1000000 }];
    expect(calculateTotalAssets(assets, [own('x', 'A', 100)])).toBe(1000000);
  });

  it('Test 2: A 50% / B 50% of ₹10,00,000 → A ₹5,00,000, B ₹5,00,000, Family ₹10,00,000', () => {
    const assets = [{ id: 'x', currentValue: 1000000 }];
    const ownerships = [own('x', 'A', 50), own('x', 'B', 50)];
    const [a, b] = calculateMemberWealth(['A', 'B'], assets, ownerships, []);
    expect(a!.assets).toBe(500000);
    expect(b!.assets).toBe(500000);
    expect(calculateTotalAssets(assets, ownerships)).toBe(1000000); // not double-counted
  });

  it('Test 3: assets ₹10,00,000 + ₹5,00,000, liabilities ₹2,00,000 → Net Worth ₹13,00,000', () => {
    const assets = [
      { id: 'x', currentValue: 1000000 },
      { id: 'y', currentValue: 500000 },
    ];
    const ownerships = [own('x', 'A', 100), own('y', 'B', 100)];
    const liabilities = [{ ownerId: 'A', currentOutstanding: 200000 }];
    const totalAssets = calculateTotalAssets(assets, ownerships);
    const totalLiabilities = calculateTotalLiabilities(liabilities);
    expect(totalAssets).toBe(1500000);
    expect(totalLiabilities).toBe(200000);
    expect(calculateNetWorth(totalAssets, totalLiabilities)).toBe(1300000);
  });
});

describe('ownership engine', () => {
  it('spec example: ₹1,00,00,000 split 60/40 → ₹60,00,000 and ₹40,00,000', () => {
    expect(calculateOwnershipValue(10000000, 60)).toBe(6000000);
    expect(calculateOwnershipValue(10000000, 40)).toBe(4000000);
  });

  it('counts only the family share when ownership totals less than 100%', () => {
    const assets = [{ id: 'x', currentValue: 10000000 }];
    expect(calculateTotalAssets(assets, [own('x', 'A', 50)])).toBe(5000000);
    expect(calculateFamilySharePercentage('x', [own('x', 'A', 30), own('x', 'B', 20)])).toBe(50);
  });

  it('excludes and reports assets with no owners', () => {
    const assets = [
      { id: 'owned', currentValue: 100 },
      { id: 'orphan', currentValue: 999 },
    ];
    const ownerships = [own('owned', 'A', 100)];
    expect(calculateTotalAssets(assets, ownerships)).toBe(100);
    expect(findUnownedAssets(assets, ownerships).map((a) => a.id)).toEqual(['orphan']);
  });

  it('member values add up to the family total for thirds', () => {
    const assets = [{ id: 'x', currentValue: 100000 }];
    const ownerships = [own('x', 'A', 33.33), own('x', 'B', 33.33), own('x', 'C', 33.34)];
    const wealth = calculateFamilyWealth(['A', 'B', 'C'], assets, ownerships, []);
    const sum = wealth.byMember.reduce((s, m) => s + m.assets, 0);
    expect(wealth.totalAssets).toBe(100000);
    expect(Math.round(sum * 100) / 100).toBe(100000);
  });

  it('computes each member net worth, including negative', () => {
    const assets = [{ id: 'x', currentValue: 1000000 }];
    const ownerships = [own('x', 'A', 60), own('x', 'B', 40)];
    const liabilities = [
      { ownerId: 'A', currentOutstanding: 100000 },
      { ownerId: 'B', currentOutstanding: 500000 },
    ];
    const wealth = calculateFamilyWealth(['A', 'B'], assets, ownerships, liabilities);
    expect(wealth.byMember).toEqual([
      { memberId: 'A', assets: 600000, liabilities: 100000, netWorth: 500000 },
      { memberId: 'B', assets: 400000, liabilities: 500000, netWorth: -100000 },
    ]);
    expect(wealth.netWorth).toBe(400000);
    expect(wealth.byMember.reduce((s, m) => s + m.netWorth, 0)).toBe(wealth.netWorth);
  });

  it('handles empty data', () => {
    expect(calculateFamilyWealth([], [], [], [])).toEqual({
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
      byMember: [],
      unownedAssetIds: [],
    });
  });

  it('keeps paise precision without floating-point drift', () => {
    const assets = [
      { id: 'x', currentValue: 0.1 },
      { id: 'y', currentValue: 0.2 },
    ];
    expect(calculateTotalAssets(assets, [own('x', 'A', 100), own('y', 'A', 100)])).toBe(0.3);
  });
});
