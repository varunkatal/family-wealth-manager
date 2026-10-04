/**
 * Recurring investments / SIP (spec §13, §22). Pure functions.
 *
 * Conventions:
 * - Contributions are made at the end of each period (the spec formula is an ordinary annuity).
 * - The per-period rate is the annual rate divided by the number of periods a year
 *   (i = r / 12 for monthly), as in the spec formula FV = P × [((1+i)^n − 1) / i].
 * - A step-up ("annual increase") raises the contribution once every 12 months.
 * - An initial lump sum compounds yearly at the annual rate, the same as an asset (spec §12).
 */
import { calculateFutureValue } from './projection';

export const FREQUENCIES = ['monthly', 'quarterly', 'half-yearly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const PERIODS_PER_YEAR: Record<Frequency, number> = { monthly: 12, quarterly: 4, 'half-yearly': 2, yearly: 1 };
const MONTHS_PER_PERIOD: Record<Frequency, number> = { monthly: 1, quarterly: 3, 'half-yearly': 6, yearly: 12 };

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  'half-yearly': 'Half-yearly',
  yearly: 'Yearly',
};

const roundToPaise = (n: number) => Math.round(n * 100) / 100;

/** FV = P × [((1+i)^n − 1) / i], with i = annual rate / periods per year. Rounded to paise. */
export function calculateSIPFutureValue(
  payment: number,
  annualRatePct: number,
  periods: number,
  periodsPerYear = 12,
): number {
  const i = annualRatePct / 100 / periodsPerYear;
  if (i === 0) return roundToPaise(payment * periods);
  return roundToPaise(payment * (((1 + i) ** periods - 1) / i));
}

export type GrowingSIPInput = {
  /** Contribution per period in the first year. */
  payment: number;
  frequency: Frequency;
  annualRatePct: number;
  years: number;
  /** % the contribution rises every 12 months. 0 for a flat SIP. */
  annualIncrease?: number;
  /** Lump sum invested today. */
  initialAmount?: number;
};

export type SIPYearRow = {
  /** 0 = today */
  year: number;
  /** Total put in so far, including the lump sum. */
  invested: number;
  /** Value at the end of the year. */
  value: number;
};

/** Year-by-year value of a (possibly growing) SIP with an optional lump sum. */
export function projectGrowingSIPByYear(input: GrowingSIPInput): SIPYearRow[] {
  const { payment, frequency, annualRatePct, years, annualIncrease = 0, initialAmount = 0 } = input;
  const perYear = PERIODS_PER_YEAR[frequency];
  const i = annualRatePct / 100 / perYear;
  const rows: SIPYearRow[] = [{ year: 0, invested: roundToPaise(initialAmount), value: roundToPaise(initialAmount) }];
  let sipBalance = 0;
  let invested = initialAmount;
  for (let year = 1; year <= years; year++) {
    const thisYearPayment = payment * (1 + annualIncrease / 100) ** (year - 1);
    for (let p = 0; p < perYear; p++) {
      sipBalance = sipBalance * (1 + i) + thisYearPayment;
      invested += thisYearPayment;
    }
    const lump = calculateFutureValue(initialAmount, annualRatePct, year);
    rows.push({ year, invested: roundToPaise(invested), value: roundToPaise(sipBalance + lump) });
  }
  return rows;
}

export type SIPResult = { invested: number; futureValue: number; gains: number };

/** Final value of a growing SIP. With no step-up this equals calculateSIPFutureValue (plus any lump sum). */
export function calculateGrowingSIPFutureValue(input: GrowingSIPInput): SIPResult {
  const last = projectGrowingSIPByYear(input).at(-1)!;
  return { invested: last.invested, futureValue: last.value, gains: roundToPaise(last.value - last.invested) };
}

// ---------------------------------------------------------------------------
// Dated contributions (saved recurring investments) projected from today.

export type DatedContribution = {
  amount: number;
  frequency: Frequency;
  /** YYYY-MM-DD of the first contribution. */
  startDate: string;
  /** YYYY-MM-DD; no contributions after this date. */
  endDate?: string;
  /** % the amount rises every 12 months from the start date. */
  annualIncrease?: number;
};

const monthIndex = (iso: string) => {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  return y * 12 + (m - 1);
};
const dayOf = (iso: string) => Number(iso.slice(8, 10));
const daysInMonth = (idx: number) => new Date(Math.floor(idx / 12), (idx % 12) + 1, 0).getDate();
const isoFromIndex = (idx: number, day: number) =>
  `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}-${String(Math.min(day, daysInMonth(idx))).padStart(2, '0')}`;

/**
 * Value of a saved contribution at the end of each year from today, counting only contributions
 * made after today (earlier ones are already in the linked asset's current value).
 * Contribution k is made on startDate + k periods, and is amount × (1 + increase)^(whole years since start).
 */
export function projectContributionByYear(
  c: DatedContribution,
  annualRatePct: number,
  years: number,
  today: string,
): SIPYearRow[] {
  const step = MONTHS_PER_PERIOD[c.frequency];
  const i = annualRatePct / 100 / PERIODS_PER_YEAR[c.frequency];
  const startIdx = monthIndex(c.startDate);
  const startDay = dayOf(c.startDate);
  const todayIdx = monthIndex(today);
  const horizons = Array.from({ length: years + 1 }, (_, y) => ({
    idx: todayIdx + 12 * y,
    iso: isoFromIndex(todayIdx + 12 * y, dayOf(today)),
  }));
  const value = new Array<number>(years + 1).fill(0);
  const invested = new Array<number>(years + 1).fill(0);
  const lastHorizon = horizons.at(-1)!;

  for (let k = 0; ; k++) {
    const idx = startIdx + k * step;
    const date = isoFromIndex(idx, startDay);
    if (date > lastHorizon.iso || (c.endDate && date > c.endDate)) break;
    if (date <= today) continue;
    const amount = c.amount * (1 + (c.annualIncrease ?? 0) / 100) ** Math.floor((k * step) / 12);
    for (let y = 1; y <= years; y++) {
      const h = horizons[y]!;
      if (date > h.iso) continue;
      // Grows for the time between the contribution and the horizon, in periods.
      const months = h.idx - idx + (dayOf(h.iso) - dayOf(date)) / 30;
      value[y]! += amount * (1 + i) ** (months / step);
      invested[y]! += amount;
    }
  }
  return value.map((v, year) => ({ year, invested: roundToPaise(invested[year]!), value: roundToPaise(v) }));
}

/** Sums several year-by-year projections of the same length. */
export function sumYearRows(projections: SIPYearRow[][], years: number): SIPYearRow[] {
  return Array.from({ length: years + 1 }, (_, year) => ({
    year,
    invested: roundToPaise(projections.reduce((s, p) => s + (p[year]?.invested ?? 0), 0)),
    value: roundToPaise(projections.reduce((s, p) => s + (p[year]?.value ?? 0), 0)),
  }));
}

/** Whether a dated recurring item (contribution, income, expense) applies on a given day. */
export const isActiveOn = (c: { startDate?: string; endDate?: string }, today: string) =>
  (!c.startDate || c.startDate <= today) && (!c.endDate || c.endDate >= today);

/** Monthly equivalent of a recurring amount, e.g. ₹30,000 quarterly → ₹10,000 a month. */
export function monthlyEquivalent(amount: number, frequency: Frequency): number {
  return roundToPaise((amount * PERIODS_PER_YEAR[frequency]) / 12);
}
