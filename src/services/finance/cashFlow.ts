/**
 * Income, expenses and free cash flow (spec §16, §22). Pure functions.
 * Only items active today count. Investments and loan EMIs are not expenses (spec §25):
 * they are shown separately as money set aside after free cash flow.
 */
import { isActiveOn, PERIODS_PER_YEAR, type Frequency } from './sip';

type Flow = { amount: number; frequency: Frequency; startDate?: string; endDate?: string };
type MemberFlow = Flow & { memberId?: string };

const roundToPaise = (n: number) => Math.round(n * 100) / 100;

/** Annual amount of a recurring item, e.g. ₹50,000 a month → ₹6,00,000. Exact: no monthly rounding. */
const exactAnnual = (f: Flow) => f.amount * PERIODS_PER_YEAR[f.frequency];
export const annualAmount = (f: Flow) => roundToPaise(exactAnnual(f));

/** Total annual amount of the items active today. */
export function totalAnnual(items: Flow[], today: string): number {
  return roundToPaise(items.filter((i) => isActiveOn(i, today)).reduce((s, i) => s + exactAnnual(i), 0));
}

/** Monthly equivalent of the items active today (annual ÷ 12). */
export const totalMonthly = (items: Flow[], today: string) => roundToPaise(totalAnnual(items, today) / 12);

export type CashFlowSummary = {
  monthlyIncome: number;
  annualIncome: number;
  monthlyExpenses: number;
  annualExpenses: number;
  /** Income − Expenses. */
  monthlyFreeCashFlow: number;
  annualFreeCashFlow: number;
};

export function calculateCashFlow(incomes: Flow[], expenses: Flow[], today: string): CashFlowSummary {
  const annualIncome = totalAnnual(incomes, today);
  const annualExpenses = totalAnnual(expenses, today);
  return {
    monthlyIncome: roundToPaise(annualIncome / 12),
    annualIncome,
    monthlyExpenses: roundToPaise(annualExpenses / 12),
    annualExpenses,
    monthlyFreeCashFlow: roundToPaise((annualIncome - annualExpenses) / 12),
    annualFreeCashFlow: roundToPaise(annualIncome - annualExpenses),
  };
}

/** Monthly income per member (active items only), in the given member order. */
export function incomeByMember(memberIds: string[], incomes: MemberFlow[], today: string): { memberId: string; monthly: number; annual: number }[] {
  return memberIds.map((memberId) => {
    const annual = totalAnnual(incomes.filter((i) => i.memberId === memberId), today);
    return { memberId, monthly: roundToPaise(annual / 12), annual };
  });
}

/** Monthly totals per key (e.g. expense category), largest first, active items only. */
export function monthlyByKey<T extends Flow>(items: T[], key: (item: T) => string, today: string): { key: string; monthly: number }[] {
  const totals = new Map<string, number>();
  for (const i of items) {
    if (!isActiveOn(i, today)) continue;
    totals.set(key(i), (totals.get(key(i)) ?? 0) + exactAnnual(i));
  }
  return [...totals.entries()].map(([k, v]) => ({ key: k, monthly: roundToPaise(v / 12) })).sort((a, b) => b.monthly - a.monthly || a.key.localeCompare(b.key));
}
