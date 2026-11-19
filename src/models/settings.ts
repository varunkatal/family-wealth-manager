import { z } from 'zod';

export const themePreferenceSchema = z.enum(['system', 'light', 'dark']);
export type ThemePreference = z.infer<typeof themePreferenceSchema>;

export const numberFormatSchema = z.enum(['exact', 'compact']);
export type NumberFormat = z.infer<typeof numberFormatSchema>;

const rate = z.number().min(-100).max(100).optional();

/** Default Conservative / Base / Optimistic growth % for one asset class. Blank = no default. */
export const scenarioRatesSchema = z.object({ conservative: rate, base: rate, optimistic: rate });
export type ScenarioRates = z.infer<typeof scenarioRatesSchema>;

export const DEFAULT_INFLATION_RATE = 6;

/** Saved inputs of the ₹1 Crore planner. */
export const crorePlannerSchema = z.object({
  /** Assets counted toward the target. Not set yet: liquid and semi-liquid assets are used. */
  selectedAssetIds: z.array(z.string()).optional(),
  target: z.number().positive().default(10000000),
  /** Which of the three is worked out from the other two. */
  solveFor: z.enum(['monthly', 'years', 'return']).default('monthly'),
  years: z.number().positive().max(50).default(10),
  /** Monthly investment. Not set: the saved SIPs linked to the ticked assets. */
  monthly: z.number().min(0).optional(),
  /** Yearly return on everything in the plan. Not set: the value-weighted rate of the ticked assets. */
  ratePct: z.number().min(0).max(100).optional(),
  /** % the monthly investment rises every 12 months. */
  stepUpPct: z.number().min(0).max(100).default(0),
  /** Aim for the target in today's money (it rises with inflation) instead of future rupees. */
  todaysMoney: z.boolean().default(false),
});
export type CrorePlannerSettings = z.infer<typeof crorePlannerSchema>;
export type SolveFor = CrorePlannerSettings['solveFor'];
export const DEFAULT_CRORE_PLANNER: CrorePlannerSettings = { target: 10000000, solveFor: 'monthly', years: 10, stepUpPct: 0, todaysMoney: false };

// Each field has a default so settings saved by older versions still load.
export const appSettingsSchema = z.object({
  theme: themePreferenceSchema.default('system'),
  numberFormat: numberFormatSchema.default('exact'),
  /** Annual inflation %, used for "today's purchasing power" (spec §15). */
  inflationRate: z.number().min(0).max(50).default(DEFAULT_INFLATION_RATE),
  /** Asset class → default growth rates, used when an asset has no rate of its own. */
  classDefaults: z.record(z.string(), scenarioRatesSchema).default({}),
  crorePlanner: crorePlannerSchema.default(DEFAULT_CRORE_PLANNER),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  numberFormat: 'exact',
  inflationRate: DEFAULT_INFLATION_RATE,
  classDefaults: {},
  crorePlanner: DEFAULT_CRORE_PLANNER,
};
