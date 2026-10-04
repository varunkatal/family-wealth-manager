import { appSettingsSchema, DEFAULT_SETTINGS, type AppSettings } from '../../models/settings';
import { getDb } from './db';

const SETTINGS_KEY = 'app';

/**
 * Returns stored settings, or defaults if none are stored.
 * Invalid stored data is not overwritten; defaults are used in memory only.
 */
export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const stored = await db.get('settings', SETTINGS_KEY);
  if (stored === undefined) return DEFAULT_SETTINGS;
  const parsed = appSettingsSchema.safeParse(stored);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const valid = appSettingsSchema.parse(settings);
  const db = await getDb();
  await db.put('settings', valid, SETTINGS_KEY);
  return valid;
}
