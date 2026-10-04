import {
  analyseLoan,
  buildAmortizationSchedule,
  calculateLoanBalance,
  calculateLoanPayment,
  calculateRemainingMonths,
  debtFreeMonth,
  projectLoanBalanceByYear,
  projectTotalDebtByYear,
  summariseScheduleByYear,
} from './loans';

// Expected values below were computed independently of this code.
describe('EMI (spec §14)', () => {
  it('matches the standard EMI formula', () => {
    expect(calculateLoanPayment(5000000, 8.5, 240)).toBe(43391.16);
    expect(calculateLoanPayment(1000000, 10, 60)).toBe(21247.04);
  });

  it('handles 0% interest', () => {
    expect(calculateLoanPayment(120000, 0, 12)).toBe(10000);
    expect(calculateRemainingMonths(120000, 0, 10000)).toBe(12);
  });
});

describe('outstanding balance and remaining months', () => {
  it('balance after 12 EMIs on ₹10L at 10% over 5 years', () => {
    expect(calculateLoanBalance(1000000, 10, 21247.04, 12)).toBeCloseTo(837731.94, 1);
    expect(calculateLoanBalance(1000000, 10, 21247.04, 60)).toBe(0);
  });

  it('remaining months, and null when the EMI does not cover the interest', () => {
    expect(calculateRemainingMonths(1000000, 10, 21247.04)).toBe(60);
    expect(calculateRemainingMonths(200000, 9, 10000)).toBe(22);
    expect(calculateRemainingMonths(1000000, 12, 10000)).toBeNull(); // interest is ₹10,000 a month
    expect(calculateRemainingMonths(0, 12, 10000)).toBe(0);
  });
});

describe('amortization schedule', () => {
  const schedule = buildAmortizationSchedule(1000000, 10, 21247.04);

  it('splits each EMI into interest and principal', () => {
    expect(schedule[0]).toEqual({ month: 1, payment: 21247.04, interest: 8333.33, principal: 12913.71, balance: 987086.29 });
    // Interest falls and principal rises over time
    expect(schedule[59]!.interest).toBeLessThan(schedule[0]!.interest);
    expect(schedule[59]!.principal).toBeGreaterThan(schedule[0]!.principal);
  });

  it('clears the loan in exactly 60 months, principal reconciling with the balance', () => {
    expect(schedule).toHaveLength(60);
    expect(schedule.at(-1)!.balance).toBe(0);
    const principal = schedule.reduce((s, r) => s + r.principal, 0);
    expect(Math.round(principal * 100) / 100).toBe(1000000);
    const interest = schedule.reduce((s, r) => s + r.interest, 0);
    expect(Math.round(interest * 100) / 100).toBe(274822.84);
    // Each row: payment = interest + principal
    expect(schedule.every((r) => Math.abs(r.payment - r.interest - r.principal) < 0.005)).toBe(true);
  });

  it('agrees with the closed-form balance', () => {
    expect(schedule[11]!.balance).toBeCloseTo(calculateLoanBalance(1000000, 10, 21247.04, 12), 0);
  });

  it('summarises by year', () => {
    const years = summariseScheduleByYear(schedule);
    expect(years).toHaveLength(5);
    expect(years[0]!.balance).toBe(schedule[11]!.balance);
    expect(years.at(-1)!.balance).toBe(0);
  });

  it('is empty when the loan would never be repaid', () => {
    expect(buildAmortizationSchedule(1000000, 12, 9000)).toEqual([]);
  });
});

describe('saved loans', () => {
  it('uses the entered EMI', () => {
    const a = analyseLoan({ currentOutstanding: 1000000, interestRate: 10, monthlyEMI: 21247.04 });
    expect(a).toMatchObject({ kind: 'schedule', emi: 21247.04, emiCalculated: false, months: 60, totalInterest: 274822.84 });
  });

  it('works out the EMI from the remaining months', () => {
    const a = analyseLoan({ currentOutstanding: 1000000, interestRate: 10, remainingMonths: 60 });
    expect(a).toMatchObject({ kind: 'schedule', emi: 21247.04, emiCalculated: true, months: 60 });
  });

  it('explains what is missing or wrong', () => {
    expect(analyseLoan({ currentOutstanding: 50000 })).toEqual({ kind: 'no-plan', reason: 'no-rate' });
    expect(analyseLoan({ currentOutstanding: 50000, interestRate: 36 })).toEqual({ kind: 'no-plan', reason: 'no-emi' });
    expect(analyseLoan({ currentOutstanding: 1000000, interestRate: 12, monthlyEMI: 5000 })).toEqual({
      kind: 'never-repaid',
      monthlyInterest: 10000,
    });
  });

  it('projects debt reduction by year; loans without a plan stay flat', () => {
    const loan = { currentOutstanding: 1000000, interestRate: 10, monthlyEMI: 21247.04 };
    const balances = projectLoanBalanceByYear(loan, 6);
    expect(balances[0]).toBe(1000000);
    expect(balances[1]).toBeCloseTo(837731.94, 0);
    expect(balances[5]).toBe(0);
    expect(balances[6]).toBe(0);
    expect(projectTotalDebtByYear([loan, { currentOutstanding: 50000 }], 5)).toEqual(balances.slice(0, 6).map((b) => Math.round((b + 50000) * 100) / 100));
  });

  it('debt-free month counts the next EMI as next month', () => {
    expect(debtFreeMonth(60, '2026-10-05')).toBe('2031-10');
    expect(debtFreeMonth(3, '2026-11-30')).toBe('2027-02');
  });
});
