import {
  calculateMilestoneDate,
  calculateRemainingAmount,
  calculateRequiredMonthlyContribution,
  monthsUntil,
} from './goals';

// Expected values below were computed independently of this code.
describe('goals (spec §17)', () => {
  it('remaining amount', () => {
    expect(calculateRemainingAmount(1000000, 200000)).toBe(800000);
    expect(calculateRemainingAmount(1000000, 1200000)).toBe(0);
  });

  it('months until the target date', () => {
    expect(monthsUntil('2026-10-05', '2031-10-05')).toBe(60);
    expect(monthsUntil('2026-10-05', '2031-10-04')).toBe(59);
    expect(monthsUntil('2026-10-05', '2026-11-30')).toBe(1);
    expect(monthsUntil('2026-10-05', '2025-01-01')).toBe(0);
  });

  it('required monthly contribution without a return: remaining ÷ months', () => {
    expect(calculateRequiredMonthlyContribution(1000000, 200000, 0, 40)).toBe(20000);
  });

  it('required monthly contribution with a return', () => {
    // ₹10L in 5 years at 12%: P = 10L × 1% / (1.01^60 − 1)
    expect(calculateRequiredMonthlyContribution(1000000, 0, 12, 60)).toBe(12244.45);
    // ₹1L already saved grows to ₹1,76,234.17, so less is needed each month
    expect(calculateRequiredMonthlyContribution(1000000, 100000, 12, 60)).toBe(10086.56);
  });

  it('nothing needed when savings are enough; null when time has run out', () => {
    expect(calculateRequiredMonthlyContribution(100000, 100000, 0, 12)).toBe(0);
    expect(calculateRequiredMonthlyContribution(150000, 100000, 12, 48)).toBe(0); // 1L × 1.12^4 = 1.57L
    expect(calculateRequiredMonthlyContribution(100000, 50000, 8, 0)).toBeNull();
  });
});

describe('milestone dates', () => {
  const values = [2000000, 2200000, 2420000, 2662000, 2928200]; // ₹20L growing 10% a year

  it('already reached', () => {
    expect(calculateMilestoneDate(values, 2000000)).toEqual({ kind: 'reached' });
  });

  it('estimates the month between yearly points', () => {
    // ₹25L lies 80/242 of the way through year 3 → 24 + 3.97 months → 28 months
    expect(calculateMilestoneDate(values, 2500000)).toEqual({ kind: 'estimate', months: 28 });
    expect(calculateMilestoneDate(values, 2200000)).toEqual({ kind: 'estimate', months: 12 });
  });

  it('not within the projection', () => {
    expect(calculateMilestoneDate(values, 5000000)).toEqual({ kind: 'not-within', years: 4 });
  });
});
