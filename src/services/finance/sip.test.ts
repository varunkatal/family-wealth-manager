import {
  calculateGrowingSIPFutureValue,
  calculateSIPFutureValue,
  monthlyEquivalent,
  projectContributionByYear,
  projectGrowingSIPByYear,
  sumYearRows,
} from './sip';

// Expected values below were computed independently of this code.
describe('SIP future value (spec §13)', () => {
  it('monthly SIP: ₹10,000 a month at 12% for 10 years', () => {
    // FV = P × [((1+i)^n − 1) / i], i = 1%, n = 120
    expect(calculateSIPFutureValue(10000, 12, 120)).toBe(2300386.89);
  });

  it('handles a 0% return', () => {
    expect(calculateSIPFutureValue(10000, 0, 24)).toBe(240000);
  });

  it('flat growing SIP matches the closed-form formula', () => {
    const r = calculateGrowingSIPFutureValue({ payment: 10000, frequency: 'monthly', annualRatePct: 12, years: 10 });
    expect(r.futureValue).toBeCloseTo(calculateSIPFutureValue(10000, 12, 120), 1);
    expect(r.invested).toBe(1200000);
    expect(r.gains).toBeCloseTo(1100386.89, 1);
  });

  it('increasing SIP: ₹10,000 rising 10% a year at 12% for 10 years', () => {
    const r = calculateGrowingSIPFutureValue({
      payment: 10000,
      frequency: 'monthly',
      annualRatePct: 12,
      years: 10,
      annualIncrease: 10,
    });
    expect(r.futureValue).toBeCloseTo(3340917.09, 1);
    expect(r.invested).toBeCloseTo(1912490.95, 1);
  });

  it('initial lump sum compounds yearly like an asset and adds to the SIP', () => {
    const r = calculateGrowingSIPFutureValue({
      payment: 10000,
      frequency: 'monthly',
      annualRatePct: 12,
      years: 10,
      initialAmount: 100000,
    });
    expect(r.futureValue).toBeCloseTo(2610971.72, 1);
    expect(r.invested).toBe(1300000);
    const lumpOnly = calculateGrowingSIPFutureValue({ payment: 0, frequency: 'monthly', annualRatePct: 12, years: 10, initialAmount: 100000 });
    expect(lumpOnly.futureValue).toBe(310584.82);
  });

  it('different frequencies use i = r / periods per year', () => {
    const run = (payment: number, frequency: 'quarterly' | 'half-yearly' | 'yearly') =>
      calculateGrowingSIPFutureValue({ payment, frequency, annualRatePct: 12, years: 5 }).futureValue;
    expect(run(30000, 'quarterly')).toBeCloseTo(806111.23, 1);
    expect(run(60000, 'half-yearly')).toBeCloseTo(790847.7, 1);
    expect(run(120000, 'yearly')).toBeCloseTo(762341.68, 1);
  });

  it('year rows start from today and grow every year', () => {
    const rows = projectGrowingSIPByYear({ payment: 1000, frequency: 'yearly', annualRatePct: 10, years: 2, initialAmount: 500 });
    expect(rows).toEqual([
      { year: 0, invested: 500, value: 500 },
      { year: 1, invested: 1500, value: 1550 },
      { year: 2, invested: 2500, value: 2705 }, // 1000×1.1 + 1000 + 500×1.21
    ]);
  });

  it('monthly equivalents', () => {
    expect(monthlyEquivalent(30000, 'quarterly')).toBe(10000);
    expect(monthlyEquivalent(120000, 'yearly')).toBe(10000);
  });
});

describe('saved contributions projected from today', () => {
  const today = '2026-10-04';

  it('a monthly SIP starting next month matches the spec formula after one year', () => {
    const rows = projectContributionByYear({ amount: 10000, frequency: 'monthly', startDate: '2026-11-04' }, 12, 1, today);
    expect(rows[0]).toEqual({ year: 0, invested: 0, value: 0 });
    expect(rows[1]!.invested).toBe(120000);
    expect(rows[1]!.value).toBeCloseTo(126825.03, 1);
  });

  it('skips past contributions and applies the step-up from the start date', () => {
    // Started a year ago: the next 11 payments are ₹11,000, the one on the 2nd anniversary is ₹12,100.
    const rows = projectContributionByYear(
      { amount: 10000, frequency: 'monthly', startDate: '2025-10-04', annualIncrease: 10 },
      12,
      1,
      today,
    );
    expect(rows[1]!.invested).toBe(11000 * 11 + 12100);
    expect(rows[1]!.value).toBeCloseTo(140607.53, 1);
  });

  it('stops at the end date', () => {
    const rows = projectContributionByYear(
      { amount: 10000, frequency: 'monthly', startDate: '2026-11-04', endDate: '2027-03-04' },
      12,
      2,
      today,
    );
    expect(rows[1]!.invested).toBe(50000);
    expect(rows[1]!.value).toBeCloseTo(54689.68, 1);
    expect(rows[2]!.invested).toBe(50000); // nothing more, but it keeps growing
    expect(rows[2]!.value).toBeCloseTo(54689.68 * 1.01 ** 12, 1);
  });

  it('a contribution that already ended adds nothing', () => {
    const rows = projectContributionByYear(
      { amount: 5000, frequency: 'quarterly', startDate: '2020-01-01', endDate: '2025-12-31' },
      8,
      5,
      today,
    );
    expect(rows.every((r) => r.value === 0 && r.invested === 0)).toBe(true);
  });

  it('sums projections', () => {
    const a = projectContributionByYear({ amount: 1000, frequency: 'yearly', startDate: '2026-12-01' }, 0, 3, today);
    const b = projectContributionByYear({ amount: 2000, frequency: 'yearly', startDate: '2026-12-01' }, 0, 3, today);
    expect(sumYearRows([a, b], 3).map((r) => r.invested)).toEqual([0, 3000, 6000, 9000]);
  });
});
