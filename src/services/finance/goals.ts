/**
 * Goals and wealth milestones (spec §17, §22). Pure functions.
 * Uses the same conventions as SIPs: monthly contributions at the end of each month at
 * annual rate / 12, and money already saved compounding yearly like an asset.
 */
import { calculateFutureValue } from './projection';

const roundToPaise = (n: number) => Math.round(n * 100) / 100;

/** Remaining Amount = Target Amount − Current Saved Amount (never below 0). */
export function calculateRemainingAmount(target: number, saved: number): number {
  return Math.max(0, roundToPaise(target - saved));
}

/** Whole months from today until a target date (0 if the date has passed or is this month). */
export function monthsUntil(today: string, targetDate: string): number {
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  const [gy, gm, gd] = targetDate.split('-').map(Number) as [number, number, number];
  const months = (gy - ty) * 12 + (gm - tm) - (gd < td ? 1 : 0);
  return Math.max(0, months);
}

/**
 * Monthly amount needed to reach the target in `months`, given what is already saved:
 * P = (Target − Saved × (1+r)^(months/12)) × i / ((1+i)^months − 1), i = r / 12.
 * 0 when savings alone are enough; null when there is no time left and money is still short.
 */
export function calculateRequiredMonthlyContribution(
  target: number,
  saved: number,
  annualRatePct: number,
  months: number,
): number | null {
  const savedGrown = months > 0 ? calculateFutureValue(saved, annualRatePct, months / 12) : saved;
  const shortfall = target - savedGrown;
  if (shortfall <= 0) return 0;
  if (months <= 0) return null;
  const i = annualRatePct / 100 / 12;
  if (i === 0) return roundToPaise(shortfall / months);
  return roundToPaise((shortfall * i) / ((1 + i) ** months - 1));
}

export const MILESTONES = [2500000, 5000000, 7500000, 10000000, 20000000, 50000000];

export type MilestoneEstimate =
  | { kind: 'reached' }
  /** Months from today, estimated between the yearly projection points. */
  | { kind: 'estimate'; months: number }
  | { kind: 'not-within'; years: number };

/**
 * When a projected value first reaches `target`. `valuesByYear[0]` is today.
 * Between two yearly points the value is assumed to move in a straight line.
 */
export function calculateMilestoneDate(valuesByYear: number[], target: number): MilestoneEstimate {
  if (valuesByYear[0]! >= target) return { kind: 'reached' };
  for (let y = 1; y < valuesByYear.length; y++) {
    const prev = valuesByYear[y - 1]!;
    const curr = valuesByYear[y]!;
    if (curr >= target) {
      const fraction = (target - prev) / (curr - prev);
      return { kind: 'estimate', months: Math.max(1, Math.ceil((y - 1 + fraction) * 12)) };
    }
  }
  return { kind: 'not-within', years: valuesByYear.length - 1 };
}
