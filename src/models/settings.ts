import { z } from 'zod';

export const themePreferenceSchema = z.enum(['system', 'light', 'dark']);
export type ThemePreference = z.infer<typeof themePreferenceSchema>;

export const numberFormatSchema = z.enum(['exact', 'compact']);
export type NumberFormat = z.infer<typeof numberFormatSchema>;

// Each field has a default so settings saved by older versions still load.
export const appSettingsSchema = z.object({
  theme: themePreferenceSchema.default('system'),
  numberFormat: numberFormatSchema.default('exact'),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  numberFormat: 'exact',
};
