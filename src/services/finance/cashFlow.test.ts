import { annualAmount, calculateCashFlow, incomeByMember, monthlyByKey, totalMonthly } from './cashFlow';

const today = '2026-10-05';

describe('cash flow (spec §16)', () => {
  const incomes = [
    { memberId: 'A', amount: 100000, frequency: 'monthly' as const },
    { memberId: 'B', amount: 240000, frequency: 'yearly' as const }, // ₹20,000 a month
    { memberId: 'A', amount: 30000, frequency: 'quarterly' as const }, // ₹10,000 a month
    { memberId: 'B', amount: 50000, frequency: 'monthly' as const, endDate: '2025-12-31' }, // ended: excluded
    { memberId: 'B', amount: 50000, frequency: 'monthly' as const, startDate: '2027-01-01' }, // not started: excluded
  ];
  const expenses = [
    { category: 'Grocery', amount: 15000, frequency: 'monthly' as const },
    { category: 'Insurance', amount: 60000, frequency: 'yearly' as const }, // ₹5,000 a month
    { category: 'Grocery', amount: 5000, frequency: 'monthly' as const },
  ];

  it('monthly and annual income, expenses and free cash flow', () => {
    expect(calculateCashFlow(incomes, expenses, today)).toEqual({
      monthlyIncome: 130000,
      annualIncome: 1560000,
      monthlyExpenses: 25000,
      annualExpenses: 300000,
      monthlyFreeCashFlow: 105000,
      annualFreeCashFlow: 1260000,
    });
  });

  it('can be negative', () => {
    const r = calculateCashFlow([{ amount: 10000, frequency: 'monthly' }], [{ amount: 15000, frequency: 'monthly' }], today);
    expect(r.monthlyFreeCashFlow).toBe(-5000);
  });

  it('family-member income', () => {
    expect(incomeByMember(['A', 'B', 'C'], incomes, today)).toEqual([
      { memberId: 'A', monthly: 110000, annual: 1320000 },
      { memberId: 'B', monthly: 20000, annual: 240000 },
      { memberId: 'C', monthly: 0, annual: 0 },
    ]);
  });

  it('expenses by category, and helpers', () => {
    expect(monthlyByKey(expenses, (e) => e.category, today)).toEqual([
      { key: 'Grocery', monthly: 20000 },
      { key: 'Insurance', monthly: 5000 },
    ]);
    expect(annualAmount({ amount: 50000, frequency: 'monthly' })).toBe(600000);
    expect(annualAmount({ amount: 25000, frequency: 'half-yearly' })).toBe(50000);
    expect(totalMonthly([], today)).toBe(0);
  });
});
