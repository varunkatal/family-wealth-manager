/**
 * Future value projections (spec §12, §22). Pure functions.
 * Each asset compounds at its own annual rate; one rate is never applied to the whole portfolio.
 */

import { roundToPaise } from './rounding';


/** FV = PV × (1 + r)^n, with r as a percentage (10 means 10%). Rounded to paise. */
export function calculateFutureValue(presentValue: number, annualRatePct: number, years: number): number {
  return roundToPaise(presentValue * (1 + annualRatePct / 100) ** years);
}

export type ProjectionRow = {
  /** 0 = today */
  year: number;
  value: number;
  /** Change from the previous row; null for today. */
  growth: number | null;
};

/** Value at the end of each year from today (year 0) to `years`, for one rate. */
export function projectByYear(presentValue: number, annualRatePct: number, years: number): ProjectionRow[] {
  return toRows(Array.from({ length: years + 1 }, (_, y) => presentValue * (1 + annualRatePct / 100) ** y));
}

/** Rounds each year's value to paise; growth is the difference of the rounded values, so columns reconcile. */
function toRows(values: number[]): ProjectionRow[] {
  const rounded = values.map(roundToPaise);
  return rounded.map((value, year) => ({
    year,
    value,
    growth: year === 0 ? null : roundToPaise(value - rounded[year - 1]!),
  }));
}

/**
 * Projection rows for display in whole rupees (projections are estimates, so paise are noise).
 * Growth is recomputed from the rounded values so the column still adds up exactly.
 */
export function roundRowsToRupees(rows: ProjectionRow[]): ProjectionRow[] {
  const values = rows.map((r) => Math.round(r.value));
  return values.map((value, year) => ({ year, value, growth: year === 0 ? null : value - values[year - 1]! }));
}

/** The constant annual rate that turns `start` into `end` over `years` (for describing a mixed portfolio). */
export function calculateImpliedAnnualRate(start: number, end: number, years: number): number | null {
  if (start <= 0 || end < 0 || years <= 0) return null;
  return ((end / start) ** (1 / years) - 1) * 100;
}
