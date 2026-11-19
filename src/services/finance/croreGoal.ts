/**
 * ₹1 Crore planner. Pure functions.
 *
 * A plan is a starting amount (the ticked assets) plus a monthly investment that can rise every
 * 12 months, all growing at one return % the user chooses. Given two of years, monthly investment
 * and return, the third is solved for. Conventions match the rest of the app: monthly payments at
 * the end of each month at annual rate / 12, and the starting amount compounding yearly.
 * Loans are not subtracted: this tracks an investment corpus, not net worth.
 */
import { calculateFutureValue } from './projection';
import { roundToPaise } from './rounding';
import { calculateGrowingSIPValueAfterMonths } from './sip';

type Liquidity = 'liquid' | 'semi-liquid' | 'illiquid';

/** How far ahead "how long" is searched: 50 years. */
export const MAX_PLAN_MONTHS = 600;
/** Upper bound when solving for the return. */
export const MAX_SOLVED_RATE = 100;
/** Plan lengths compared in the "faster options" table. */
export const OPTION_YEARS = [3, 5, 7, 10, 15, 20];

export type Plan = {
  start: number;
  monthly: number;
  ratePct: number;
  /** % the monthly investment rises every 12 months. */
  stepUpPct: number;
};

export type PlanRow = { months: number; value: number; invested: number; growth: number };

/** Assets counted when nothing has been chosen yet: everything liquid or semi-liquid. */
export function defaultSelectedAssetIds(assets: { id: string; liquidity: Liquidity }[]): string[] {
  return assets.filter((a) => a.liquidity !== 'illiquid').map((a) => a.id);
}

/** The chosen assets and the saved SIPs linked to them. SIPs not linked to a chosen asset are left out. */
export function selectCorpus<A extends { id: string }, C extends { linkedAssetId?: string }>(
  assets: A[],
  contributions: C[],
  selectedIds: string[],
): { assets: A[]; contributions: C[] } {
  const chosen = new Set(selectedIds);
  return {
    assets: assets.filter((a) => chosen.has(a.id)),
    contributions: contributions.filter((c) => c.linkedAssetId !== undefined && chosen.has(c.linkedAssetId)),
  };
}

/** Average growth rate weighted by today's value, over assets that have a rate. Undefined when none do. */
export function weightedRate(assets: { today: number; rate: number | undefined }[]): number | undefined {
  const rated = assets.filter((a) => a.rate !== undefined && a.today > 0);
  const total = rated.reduce((s, a) => s + a.today, 0);
  if (total === 0) return undefined;
  return Math.round((rated.reduce((s, a) => s + a.today * a.rate!, 0) / total) * 100) / 100;
}

/** The target in future rupees after `months`: unchanged, or grown by inflation when it is in today's money. */
export function nominalTarget(target: number, months: number, inflationPct?: number): number {
  return inflationPct === undefined ? target : roundToPaise(target * (1 + inflationPct / 100) ** (months / 12));
}

/** Value of a plan after `months`. */
export function planValueAfterMonths(plan: Plan, months: number): number {
  return roundToPaise(
    calculateFutureValue(plan.start, plan.ratePct, months / 12) +
      calculateGrowingSIPValueAfterMonths(plan.monthly, plan.ratePct, months, plan.stepUpPct),
  );
}

/**
 * Monthly investment (rising by `stepUpPct` every 12 months) needed to reach `targetAtDate` in `months`.
 * 0 when the starting amount alone is enough; null when there is no time left and money is still short.
 */
export function requiredMonthly(
  start: number,
  targetAtDate: number,
  ratePct: number,
  months: number,
  stepUpPct = 0,
): number | null {
  const shortfall = targetAtDate - (months > 0 ? calculateFutureValue(start, ratePct, months / 12) : start);
  if (shortfall <= 0) return 0;
  if (months <= 0) return null;
  const unit = 100000;
  const perUnit = calculateGrowingSIPValueAfterMonths(unit, ratePct, months, stepUpPct);
  return roundToPaise((shortfall / perUnit) * unit);
}

/**
 * First whole month at which the plan reaches the target (0 if it already has), or null if it
 * doesn't within `maxMonths`. With an inflation rate the target is in today's money and rises.
 */
export function monthsToTarget(
  plan: Plan,
  target: number,
  inflationPct?: number,
  maxMonths = MAX_PLAN_MONTHS,
): number | null {
  const i = plan.ratePct / 100 / 12;
  let sip = 0;
  for (let m = 0; m <= maxMonths; m++) {
    const value = calculateFutureValue(plan.start, plan.ratePct, m / 12) + sip;
    if (value >= nominalTarget(target, m, inflationPct)) return m;
    sip = sip * (1 + i) + plan.monthly * (1 + plan.stepUpPct / 100) ** Math.floor(m / 12);
  }
  return null;
}

/**
 * Lowest yearly return (to 0.01%) at which the plan reaches `targetAtDate` in `months`.
 * 0 when no growth is needed; null when even MAX_SOLVED_RATE % falls short or there is no time.
 */
export function requiredRate(
  plan: Omit<Plan, 'ratePct'>,
  targetAtDate: number,
  months: number,
): number | null {
  const valueAt = (ratePct: number) => planValueAfterMonths({ ...plan, ratePct }, months);
  if (valueAt(0) >= targetAtDate) return 0;
  if (months <= 0 || valueAt(MAX_SOLVED_RATE) < targetAtDate) return null;
  let lo = 0;
  let hi = MAX_SOLVED_RATE;
  while (hi - lo > 0.001) {
    const mid = (lo + hi) / 2;
    if (valueAt(mid) >= targetAtDate) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi * 100) / 100;
}

/** Value, amount invested and growth at the end of every 12 months, plus the final month if it isn't one. */
export function projectPlan(plan: Plan, months: number): PlanRow[] {
  const i = plan.ratePct / 100 / 12;
  const rows: PlanRow[] = [];
  let sip = 0;
  let paid = 0;
  for (let m = 0; m <= months; m++) {
    if (m % 12 === 0 || m === months) {
      const value = roundToPaise(calculateFutureValue(plan.start, plan.ratePct, m / 12) + sip);
      const invested = roundToPaise(plan.start + paid);
      rows.push({ months: m, value, invested, growth: roundToPaise(value - invested) });
    }
    const payment = plan.monthly * (1 + plan.stepUpPct / 100) ** Math.floor(m / 12);
    sip = sip * (1 + i) + payment;
    paid += payment;
  }
  return rows;
}
