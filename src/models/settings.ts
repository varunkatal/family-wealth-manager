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

// Each field has a default so settings saved by older versions still load.
export const appSettingsSchema = z.object({
  theme: themePreferenceSchema.default('system'),
  numberFormat: numberFormatSchema.default('exact'),
  /** Annual inflation %, used for "today's purchasing power" (spec §15). */
  inflationRate: z.number().min(0).max(50).default(DEFAULT_INFLATION_RATE),
  /** Asset class → default growth rates, used when an asset has no rate of its own. */
  classDefaults: z.record(z.string(), scenarioRatesSchema).default({}),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  numberFormat: 'exact',
  inflationRate: DEFAULT_INFLATION_RATE,
  classDefaults: {},
};
