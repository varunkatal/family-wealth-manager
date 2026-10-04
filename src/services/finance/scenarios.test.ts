import { projectFamilyWealth } from './familyProjection';
import { calculateFutureValue } from './projection';
import { calculateInflationAdjustedValue, resolveAssetRate, SCENARIOS } from './scenarios';

const asset = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  name: `Asset ${id}`,
  assetClass: 'Equity',
  currentValue: 1000000,
  ...o,
});

describe('scenario rates (spec §15)', () => {
  const rated = asset('x', { conservativeGrowthRate: 8, baseGrowthRate: 10, optimisticGrowthRate: 12 });

  it('uses the asset’s own rate for each scenario', () => {
    expect(SCENARIOS.map((s) => resolveAssetRate(rated, s).rate)).toEqual([8, 10, 12]);
  });

  it('falls back to the Settings default for the class, then to none', () => {
    const partial = asset('y', { baseGrowthRate: 10 });
    const defaults = { Equity: { conservative: 7, optimistic: 13 } };
    expect(resolveAssetRate(partial, 'base', defaults)).toEqual({ rate: 10, source: 'asset' });
    expect(resolveAssetRate(partial, 'conservative', defaults)).toEqual({ rate: 7, source: 'default' });
    expect(resolveAssetRate(partial, 'optimistic', {})).toEqual({ rate: undefined, source: 'none' });
    expect(resolveAssetRate(asset('z', { assetClass: 'Cash' }), 'base', defaults).source).toBe('none');
  });
});

describe('inflation', () => {
  it('Real FV = Nominal FV / (1 + inflation)^n', () => {
    expect(calculateInflationAdjustedValue(2593742.46, 6, 10)).toBe(1448332.24);
    expect(calculateInflationAdjustedValue(500000, 6, 0)).toBe(500000);
    expect(calculateInflationAdjustedValue(500000, 0, 10)).toBe(500000);
  });
});

describe('family projection by scenario', () => {
  const input = {
    assets: [
      asset('eq', { conservativeGrowthRate: 8, baseGrowthRate: 10, optimisticGrowthRate: 12 }),
      asset('fd', { assetClass: 'Fixed Income', currentValue: 2000000, baseGrowthRate: 7 }),
      asset('orphan', { baseGrowthRate: 50 }),
    ],
    ownerships: [
      { assetId: 'eq', familyMemberId: 'A', percentage: 100 },
      { assetId: 'fd', familyMemberId: 'A', percentage: 50 }, // family owns ₹10L
    ],
    contributions: [],
    liabilities: [{ currentOutstanding: 1000000, interestRate: 10, monthlyEMI: 21247.04 }],
    classDefaults: { 'Fixed Income': { conservative: 6, optimistic: 7.5 } },
    today: '2026-10-05',
  };

  it('compounds each asset at its scenario rate and reconciles totals with the assets', () => {
    for (const scenario of SCENARIOS) {
      const p = projectFamilyWealth(input, scenario, 10);
      expect(p.assets.map((a) => a.asset.id)).toEqual(['eq', 'fd']); // unowned excluded
      const sum = p.assets.reduce((s, a) => s + a.values[10]!, 0);
      expect(p.assetTotals[10]).toBeCloseTo(sum, 2);
      expect(p.netWorth[10]).toBeCloseTo(p.totalAssets[10]! - p.debt[10]!, 2);
    }
    const c = projectFamilyWealth(input, 'conservative', 10);
    const o = projectFamilyWealth(input, 'optimistic', 10);
    expect(c.assetTotals[10]).toBeCloseTo(calculateFutureValue(1000000, 8, 10) + calculateFutureValue(1000000, 6, 10), 1);
    expect(o.assetTotals[10]).toBeCloseTo(calculateFutureValue(1000000, 12, 10) + calculateFutureValue(1000000, 7.5, 10), 1);
    expect(c.assets[1]!.source).toBe('default');
    expect(c.assetTotals[10]!).toBeLessThan(o.assetTotals[10]!);
  });

  it('includes loan reduction in net worth', () => {
    const p = projectFamilyWealth(input, 'base', 5);
    expect(p.debt[0]).toBe(1000000);
    expect(p.debt[5]).toBe(0);
    expect(p.netWorth[0]).toBe(1000000); // ₹20L assets − ₹10L loan
  });

  it('contributions follow the linked asset’s scenario rate unless they have their own', () => {
    const withSip = {
      ...input,
      contributions: [
        { id: 's1', amount: 10000, frequency: 'monthly' as const, startDate: '2026-11-05', linkedAssetId: 'eq' },
        { id: 's2', amount: 10000, frequency: 'monthly' as const, startDate: '2026-11-05', expectedReturn: 9 },
      ],
    };
    const rates = (s: (typeof SCENARIOS)[number]) => projectFamilyWealth(withSip, s, 1).contributions.map((c) => c.rate);
    expect(rates('conservative')).toEqual([8, 9]);
    expect(rates('optimistic')).toEqual([12, 9]);
  });
});
