import {
  defaultSelectedAssetIds,
  monthsToTarget,
  nominalTarget,
  planValueAfterMonths,
  projectPlan,
  requiredMonthly,
  requiredRate,
  selectCorpus,
  weightedRate,
} from './croreGoal';

const CRORE = 10000000;
type Liquidity = 'liquid' | 'semi-liquid' | 'illiquid';
const a = (id: string, liquidity: Liquidity) => ({ id, liquidity });

describe('₹1 Crore planner', () => {
  it('defaults to liquid and semi-liquid assets; selection includes only linked SIPs', () => {
    expect(defaultSelectedAssetIds([a('fund', 'liquid'), a('house', 'illiquid'), a('ppf', 'semi-liquid')])).toEqual(['fund', 'ppf']);
    const chosen = selectCorpus([a('fund', 'liquid'), a('house', 'illiquid')], [{ id: 's1', linkedAssetId: 'fund' }, { id: 's2', linkedAssetId: 'house' }, { id: 's3' }], ['fund']);
    expect(chosen.assets.map((x) => x.id)).toEqual(['fund']);
    expect(chosen.contributions.map((c) => c.id)).toEqual(['s1']);
  });

  it('weighted rate uses today’s values and skips assets with no rate', () => {
    expect(weightedRate([{ today: 100, rate: 12 }, { today: 300, rate: 8 }, { today: 500, rate: undefined }])).toBe(9);
    expect(weightedRate([{ today: 100, rate: undefined }])).toBeUndefined();
  });

  it('plan value: ₹10,000 a month at 12% for 10 years = the SIP formula', () => {
    // 10,000 × ((1.01^120 − 1) / 0.01)
    expect(planValueAfterMonths({ start: 0, monthly: 10000, ratePct: 12, stepUpPct: 0 }, 120)).toBeCloseTo(2300386.89, 1);
    // A starting amount compounds yearly: ₹10L × 1.12^10
    expect(planValueAfterMonths({ start: 1000000, monthly: 0, ratePct: 12, stepUpPct: 0 }, 120)).toBeCloseTo(3105848.21, 1);
  });

  describe('solve for monthly investment', () => {
    it('₹10 lakh start, 10 years at 12% needs ≈ ₹29,970 a month', () => {
      const expected = ((CRORE - 3105848.21) * 0.01) / (1.01 ** 120 - 1);
      expect(requiredMonthly(1000000, CRORE, 12, 120)).toBeCloseTo(expected, 0);
    });

    it('round-trips with and without a step-up', () => {
      for (const stepUpPct of [0, 10]) {
        const monthly = requiredMonthly(1000000, CRORE, 12, 84, stepUpPct)!;
        expect(planValueAfterMonths({ start: 1000000, monthly, ratePct: 12, stepUpPct }, 84)).toBeCloseTo(CRORE, -1);
      }
      expect(requiredMonthly(1000000, CRORE, 12, 84, 10)!).toBeLessThan(requiredMonthly(1000000, CRORE, 12, 84)!);
    });

    it('is 0 when the start alone is enough and null with no time left', () => {
      expect(requiredMonthly(CRORE, CRORE, 12, 24)).toBe(0);
      expect(requiredMonthly(100, CRORE, 12, 0)).toBeNull();
      expect(requiredMonthly(0, 1200, 0, 12)).toBe(100);
    });
  });

  describe('solve for years', () => {
    it('₹10 lakh at 12% with nothing added takes 244 months; investing monthly is faster', () => {
      // 1.12^(m/12) ≥ 10 → m ≥ 243.8
      expect(monthsToTarget({ start: 1000000, monthly: 0, ratePct: 12, stepUpPct: 0 }, CRORE)).toBe(244);
      const withSip = monthsToTarget({ start: 1000000, monthly: 20000, ratePct: 12, stepUpPct: 0 }, CRORE)!;
      const withStepUp = monthsToTarget({ start: 1000000, monthly: 20000, ratePct: 12, stepUpPct: 10 }, CRORE)!;
      expect(withSip).toBeLessThan(244);
      expect(withStepUp).toBeLessThan(withSip);
      // It is the first month that reaches the target
      const plan = { start: 1000000, monthly: 20000, ratePct: 12, stepUpPct: 0 };
      expect(planValueAfterMonths(plan, withSip)).toBeGreaterThanOrEqual(CRORE);
      expect(planValueAfterMonths(plan, withSip - 1)).toBeLessThan(CRORE);
    });

    it('a target in today’s money takes longer; 0 if already reached; null if never', () => {
      const plan = { start: 1000000, monthly: 20000, ratePct: 12, stepUpPct: 0 };
      expect(monthsToTarget(plan, CRORE, 6)!).toBeGreaterThan(monthsToTarget(plan, CRORE)!);
      expect(monthsToTarget({ ...plan, start: CRORE }, CRORE)).toBe(0);
      expect(monthsToTarget({ start: 0, monthly: 100, ratePct: 0, stepUpPct: 0 }, CRORE)).toBeNull();
      expect(nominalTarget(CRORE, 12, 6)).toBe(10600000);
    });
  });

  describe('solve for return', () => {
    it('finds the lowest return to 0.01% that reaches the target', () => {
      const plan = { start: 1000000, monthly: 25000, stepUpPct: 0 };
      const rate = requiredRate(plan, CRORE, 84)!;
      expect(rate).toBeGreaterThan(10);
      expect(rate).toBeLessThan(30);
      expect(planValueAfterMonths({ ...plan, ratePct: rate }, 84)).toBeGreaterThanOrEqual(CRORE);
      expect(planValueAfterMonths({ ...plan, ratePct: rate - 0.01 }, 84)).toBeLessThan(CRORE);
    });

    it('is 0 when contributions alone are enough and null when even 100% falls short', () => {
      expect(requiredRate({ start: 0, monthly: 200000, stepUpPct: 0 }, CRORE, 60)).toBe(0);
      expect(requiredRate({ start: 0, monthly: 100, stepUpPct: 0 }, CRORE, 12)).toBeNull();
    });
  });

  it('projects a plan yearly plus a final part year; invested and growth reconcile', () => {
    const plan = { start: 500000, monthly: 10000, ratePct: 12, stepUpPct: 10 };
    const rows = projectPlan(plan, 30);
    expect(rows.map((r) => r.months)).toEqual([0, 12, 24, 30]);
    expect(rows[0]).toEqual({ months: 0, value: 500000, invested: 500000, growth: 0 });
    // 12 × 10,000 in year 1, 12 × 11,000 in year 2, 6 × 12,100 in the last half-year
    expect(rows[3]!.invested).toBeCloseTo(500000 + 120000 + 132000 + 72600, 2);
    expect(rows[3]!.value).toBeCloseTo(planValueAfterMonths(plan, 30), 1);
    for (const r of rows) expect(r.growth).toBeCloseTo(r.value - r.invested, 2);
  });
});
