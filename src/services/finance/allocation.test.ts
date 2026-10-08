import {
  calculateAssetAllocation,
  calculateFamilyOwnedValue,
  calculateLiquidityBreakdown,
  calculateMemberAllocation,
  calculateMemberHoldings,
  calculateTopAssets,
} from './allocation';
import { calculateTotalAssets } from './netWorth';

type L = 'liquid' | 'semi-liquid' | 'illiquid';
const asset = (id: string, assetClass: string, currentValue: number, liquidity: L = 'liquid') => ({
  id,
  name: `Asset ${id}`,
  assetClass,
  liquidity,
  currentValue,
});
const own = (assetId: string, familyMemberId: string, percentage: number) => ({ assetId, familyMemberId, percentage });

// Mirrors the demo data: 45L family-owned in total
const assets = [
  asset('property', 'Real Estate', 2500000, 'illiquid'),
  asset('gold', 'Precious Metals', 1000000, 'semi-liquid'),
  asset('fund', 'Equity', 500000, 'liquid'),
  asset('fd', 'Fixed Income', 500000, 'semi-liquid'),
];
const ownerships = [
  own('property', 'A', 50),
  own('property', 'B', 50),
  own('gold', 'A', 100),
  own('fund', 'B', 100),
  own('fd', 'A', 60),
  own('fd', 'B', 40),
];

const sum = (xs: { value: number }[]) => Math.round(xs.reduce((s, x) => s + x.value, 0) * 100) / 100;
const pctSum = (xs: { percentage: number }[]) => xs.reduce((s, x) => s + x.percentage, 0);

describe('asset allocation', () => {
  it('splits family-owned value by class, largest first, reconciling with total assets', () => {
    const slices = calculateAssetAllocation(assets, ownerships);
    expect(slices.map((s) => [s.key, s.value])).toEqual([
      ['Real Estate', 2500000],
      ['Precious Metals', 1000000],
      ['Equity', 500000],
      ['Fixed Income', 500000],
    ]);
    expect(sum(slices)).toBe(calculateTotalAssets(assets, ownerships));
    expect(pctSum(slices)).toBeCloseTo(100, 10);
    expect(slices[0]!.percentage).toBeCloseTo(55.56, 2);
  });

  it('uses only the family share and skips unowned assets', () => {
    const slices = calculateAssetAllocation(
      [asset('x', 'Equity', 1000), asset('orphan', 'Cash', 999)],
      [own('x', 'A', 40)],
    );
    expect(slices).toEqual([{ key: 'Equity', value: 400, percentage: 100 }]);
  });

  it('returns nothing for no data', () => {
    expect(calculateAssetAllocation([], [])).toEqual([]);
  });
});

describe('liquidity breakdown', () => {
  it('orders liquid → semi-liquid → illiquid and reconciles', () => {
    const slices = calculateLiquidityBreakdown(assets, ownerships);
    expect(slices.map((s) => [s.key, s.value])).toEqual([
      ['liquid', 500000],
      ['semi-liquid', 1500000],
      ['illiquid', 2500000],
    ]);
    expect(sum(slices)).toBe(4500000);
  });
});

describe('member allocation', () => {
  it("splits each member's attributed value by class; members add up to the family total", () => {
    const a = calculateMemberAllocation('A', assets, ownerships);
    const b = calculateMemberAllocation('B', assets, ownerships);
    expect(a.map((s) => [s.key, s.value])).toEqual([
      ['Real Estate', 1250000],
      ['Precious Metals', 1000000],
      ['Fixed Income', 300000],
    ]);
    expect(sum(a)).toBe(2550000);
    expect(sum(b)).toBe(1950000);
    expect(sum(a) + sum(b)).toBe(calculateTotalAssets(assets, ownerships));
  });
});

describe('top assets', () => {
  it('ranks by family-owned value with % of total', () => {
    const top = calculateTopAssets(assets, ownerships, 2);
    expect(top.map((t) => [t.asset.id, t.familyValue])).toEqual([
      ['property', 2500000],
      ['gold', 1000000],
    ]);
    expect(top[1]!.percentage).toBeCloseTo(22.22, 2);
  });

  it('ranks partly-owned assets by the family share, not the full value', () => {
    const top = calculateTopAssets(
      [asset('big', 'Real Estate', 10000000), asset('small', 'Equity', 6000000)],
      [own('big', 'A', 50), own('small', 'A', 100)],
    );
    expect(top.map((t) => t.asset.id)).toEqual(['small', 'big']);
  });

  it('computes one asset family value', () => {
    expect(calculateFamilyOwnedValue({ id: 'fd', currentValue: 500000 }, ownerships)).toBe(500000);
    expect(calculateFamilyOwnedValue({ id: 'none', currentValue: 500000 }, ownerships)).toBe(0);
  });
});

describe('calculateMemberHoldings', () => {
  const assets = [
    { id: 'house', name: 'Example Property', currentValue: 10000000 },
    { id: 'fund', name: 'Example Equity Fund', currentValue: 500000 },
    { id: 'gold', name: 'Example Gold', currentValue: 300000 },
  ];
  const owns = [
    { assetId: 'house', familyMemberId: 'a', percentage: 60 },
    { assetId: 'house', familyMemberId: 'b', percentage: 40 },
    { assetId: 'fund', familyMemberId: 'a', percentage: 100 },
    { assetId: 'gold', familyMemberId: 'b', percentage: 100 },
  ];

  it('lists what one person owns, their share and value, largest first', () => {
    const a = calculateMemberHoldings('a', assets, owns);
    expect(a.map((h) => [h.asset.id, h.percentage, h.value])).toEqual([
      ['house', 60, 6000000],
      ['fund', 100, 500000],
    ]);
    expect(a[0]!.coOwners).toEqual([{ familyMemberId: 'b', percentage: 40 }]);
    expect(a[1]!.coOwners).toEqual([]);
  });

  it('adds up to the same total as the member net worth engine', () => {
    for (const id of ['a', 'b']) {
      const total = calculateMemberHoldings(id, assets, owns).reduce((s, h) => s + h.value, 0);
      const allocation = calculateMemberAllocation(id, assets.map((x) => ({ ...x, assetClass: 'X', liquidity: 'liquid' as const })), owns);
      expect(total).toBeCloseTo(allocation.reduce((s, x) => s + x.value, 0), 2);
    }
  });

  it('is empty for someone who owns nothing', () => {
    expect(calculateMemberHoldings('c', assets, owns)).toEqual([]);
  });
});
