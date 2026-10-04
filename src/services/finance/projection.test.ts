import {
  calculateFamilyProjection,
  calculateFutureValue,
  calculateImpliedAnnualRate,
  projectByYear,
  roundRowsToRupees,
} from './projection';

describe('future value (spec §12)', () => {
  it('Phase 6 acceptance: ₹10,00,000 at 10% for 10 years ≈ ₹25,93,742', () => {
    const fv = calculateFutureValue(1000000, 10, 10);
    expect(fv).toBe(2593742.46);
    expect(Math.round(fv)).toBe(2593742);
  });

  it('handles 0 years, 0% and negative rates', () => {
    expect(calculateFutureValue(500000, 12, 0)).toBe(500000);
    expect(calculateFutureValue(500000, 0, 20)).toBe(500000);
    expect(calculateFutureValue(800000, -10, 2)).toBe(648000); // e.g. a depreciating vehicle
  });

  it('projects year by year, with growth reconciling to the change in value', () => {
    const rows = projectByYear(1000000, 10, 3);
    expect(rows).toEqual([
      { year: 0, value: 1000000, growth: null },
      { year: 1, value: 1100000, growth: 100000 },
      { year: 2, value: 1210000, growth: 110000 },
      { year: 3, value: 1331000, growth: 121000 },
    ]);
    expect(rows.at(-1)!.value).toBe(calculateFutureValue(1000000, 10, 3));
  });
});

describe('family projection', () => {
  const assets = [
    { id: 'equity', presentValue: 1000000, annualRatePct: 12 },
    { id: 'fd', presentValue: 1000000, annualRatePct: 7 },
    { id: 'gold', presentValue: 500000, annualRatePct: undefined }, // no rate set: held flat
  ];

  it('compounds each asset at its own rate and sums them', () => {
    const rows = calculateFamilyProjection(assets, 10);
    const expected =
      calculateFutureValue(1000000, 12, 10) + calculateFutureValue(1000000, 7, 10) + 500000;
    expect(rows[0]!.value).toBe(2500000);
    expect(rows[10]!.value).toBeCloseTo(expected, 1);
  });

  it('differs from applying one blended rate to the whole portfolio', () => {
    const perAsset = calculateFamilyProjection(assets.slice(0, 2), 20).at(-1)!.value;
    const blended = calculateFutureValue(2000000, 9.5, 20); // simple average rate
    expect(perAsset).toBeGreaterThan(blended);
  });

  it('growth column sums to the total change', () => {
    const rows = calculateFamilyProjection(assets, 25);
    const growth = rows.reduce((s, r) => s + (r.growth ?? 0), 0);
    expect(Math.round(growth * 100) / 100).toBe(Math.round((rows[25]!.value - rows[0]!.value) * 100) / 100);
  });

  it('is empty-safe', () => {
    expect(calculateFamilyProjection([], 3).map((r) => r.value)).toEqual([0, 0, 0, 0]);
  });

  it('describes the implied overall rate', () => {
    expect(calculateImpliedAnnualRate(1000000, 2593742.46, 10)).toBeCloseTo(10, 6);
    expect(calculateImpliedAnnualRate(0, 100, 5)).toBeNull();
  });
});

describe('whole-rupee display rows', () => {
  it('rounds values and keeps the growth column reconciling', () => {
    const rows = roundRowsToRupees(projectByYear(500000, 12, 10));
    expect(rows[10]!.value).toBe(1552924);
    const growth = rows.reduce((s, r) => s + (r.growth ?? 0), 0);
    expect(growth).toBe(rows[10]!.value - rows[0]!.value);
  });
});
