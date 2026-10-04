import { monthAfter } from '../../utils/date';
import { roundToPaise } from './rounding';

/**
 * Loans and amortization (spec §14, §22). Pure functions.
 * Interest is charged monthly at annual rate / 12 on the outstanding balance (reducing balance),
 * and each EMI pays that month's interest first, then principal.
 */

const monthlyRate = (annualRatePct: number) => annualRatePct / 100 / 12;

/** Safety cap so a schedule always ends: 100 years of payments. */
export const MAX_LOAN_MONTHS = 1200;

/** EMI = P × r × (1+r)^n / ((1+r)^n − 1), r = annual rate / 12. Rounded to paise. */
export function calculateLoanPayment(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0) return roundToPaise(principal);
  const r = monthlyRate(annualRatePct);
  if (r === 0) return roundToPaise(principal / months);
  const f = (1 + r) ** months;
  return roundToPaise((principal * r * f) / (f - 1));
}

/** Balance after `monthsPaid` EMIs: B = P(1+r)^n − E × ((1+r)^n − 1) / r. Never below 0. */
export function calculateLoanBalance(principal: number, annualRatePct: number, emi: number, monthsPaid: number): number {
  const r = monthlyRate(annualRatePct);
  const balance =
    r === 0 ? principal - emi * monthsPaid : principal * (1 + r) ** monthsPaid - (emi * ((1 + r) ** monthsPaid - 1)) / r;
  // Under ₹1 is rounding left from the EMI and is paid with the last EMI (as in the schedule).
  return balance < 1 ? 0 : roundToPaise(balance);
}

/** One month's interest on a balance. */
export function calculateMonthlyInterest(balance: number, annualRatePct: number): number {
  return roundToPaise(balance * monthlyRate(annualRatePct));
}

/**
 * Number of EMIs left to clear a balance, or null when the EMI doesn't cover the monthly
 * interest (the loan would never be repaid).
 */
export function calculateRemainingMonths(balance: number, annualRatePct: number, emi: number): number | null {
  if (balance <= 0) return 0;
  if (emi <= 0) return null;
  const r = monthlyRate(annualRatePct);
  // The small tolerance absorbs paise left over from rounding the EMI.
  if (r === 0) return Math.ceil(balance / emi - 1e-3);
  if (emi <= balance * r) return null;
  const n = -Math.log(1 - (r * balance) / emi) / Math.log(1 + r);
  return Math.min(Math.ceil(n - 1e-3), MAX_LOAN_MONTHS);
}

export type AmortizationRow = {
  /** 1 = next payment */
  month: number;
  payment: number;
  interest: number;
  principal: number;
  /** Balance after this payment. */
  balance: number;
};

/** Month-by-month schedule from today's balance until it is repaid (the last EMI is only what is owed). */
export function buildAmortizationSchedule(balance: number, annualRatePct: number, emi: number): AmortizationRow[] {
  if (calculateRemainingMonths(balance, annualRatePct, emi) === null) return [];
  const rows: AmortizationRow[] = [];
  let remaining = roundToPaise(balance);
  for (let month = 1; remaining > 0 && month <= MAX_LOAN_MONTHS; month++) {
    const interest = calculateMonthlyInterest(remaining, annualRatePct);
    const owed = roundToPaise(remaining + interest);
    // A remainder under ₹1 (from rounding the EMI to paise) is paid with this EMI, not a month later.
    const payment = owed - emi < 1 ? owed : emi;
    const principal = roundToPaise(payment - interest);
    remaining = roundToPaise(remaining - principal);
    rows.push({ month, payment, interest, principal, balance: remaining });
  }
  return rows;
}

export type YearlyAmortizationRow = { year: number; payment: number; interest: number; principal: number; balance: number };

/** Groups a monthly schedule into 12-month years from today. */
export function summariseScheduleByYear(rows: AmortizationRow[]): YearlyAmortizationRow[] {
  const years: YearlyAmortizationRow[] = [];
  for (const r of rows) {
    const year = Math.ceil(r.month / 12);
    let y = years[year - 1];
    if (!y) {
      y = { year, payment: 0, interest: 0, principal: 0, balance: 0 };
      years.push(y);
    }
    y.payment = roundToPaise(y.payment + r.payment);
    y.interest = roundToPaise(y.interest + r.interest);
    y.principal = roundToPaise(y.principal + r.principal);
    y.balance = r.balance;
  }
  return years;
}

// ---------------------------------------------------------------------------
// Saved loans

export type LoanTerms = {
  currentOutstanding: number;
  interestRate?: number;
  monthlyEMI?: number;
  remainingMonths?: number;
};

export type LoanAnalysis =
  | { kind: 'no-plan'; reason: 'no-rate' | 'no-emi' }
  | { kind: 'never-repaid'; monthlyInterest: number }
  | {
      kind: 'schedule';
      emi: number;
      /** True when the EMI was worked out from the remaining months rather than entered. */
      emiCalculated: boolean;
      schedule: AmortizationRow[];
      months: number;
      totalInterest: number;
    };

/**
 * What can be worked out for a loan: its schedule when the rate and either the EMI or the
 * remaining months are known. An entered EMI is used as-is; otherwise it is calculated.
 */
export function analyseLoan(l: LoanTerms): LoanAnalysis {
  if (l.currentOutstanding <= 0) return { kind: 'schedule', emi: 0, emiCalculated: false, schedule: [], months: 0, totalInterest: 0 };
  if (l.interestRate === undefined) return { kind: 'no-plan', reason: 'no-rate' };
  let emi = l.monthlyEMI;
  const emiCalculated = emi === undefined;
  if (emi === undefined) {
    if (!l.remainingMonths) return { kind: 'no-plan', reason: 'no-emi' };
    emi = calculateLoanPayment(l.currentOutstanding, l.interestRate, l.remainingMonths);
  }
  const schedule = buildAmortizationSchedule(l.currentOutstanding, l.interestRate, emi);
  if (schedule.length === 0) {
    return { kind: 'never-repaid', monthlyInterest: calculateMonthlyInterest(l.currentOutstanding, l.interestRate) };
  }
  return {
    kind: 'schedule',
    emi,
    emiCalculated,
    schedule,
    months: schedule.length,
    totalInterest: roundToPaise(schedule.reduce((s, r) => s + r.interest, 0)),
  };
}

/** Outstanding balance at the end of each year from today. Loans without a schedule stay flat. */
export function projectLoanBalanceByYear(l: LoanTerms, years: number): number[] {
  const a = analyseLoan(l);
  return Array.from({ length: years + 1 }, (_, y) => {
    if (y === 0 || a.kind !== 'schedule') return l.currentOutstanding;
    return a.schedule[Math.min(12 * y, a.schedule.length) - 1]?.balance ?? 0;
  });
}

/** Total outstanding across loans at the end of each year. */
export function projectTotalDebtByYear(loans: LoanTerms[], years: number): number[] {
  const each = loans.map((l) => projectLoanBalanceByYear(l, years));
  return Array.from({ length: years + 1 }, (_, y) => roundToPaise(each.reduce((s, b) => s + b[y]!, 0)));
}

/** YYYY-MM of the last EMI, counting the next EMI as next month. */
export const debtFreeMonth = (months: number, today: string) => monthAfter(today, months);
