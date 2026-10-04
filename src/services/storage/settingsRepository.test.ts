import { DEFAULT_SETTINGS, type AppSettings } from '../../models/settings';
import { closeDb, getDb } from './db';
import { getSettings, saveSettings } from './settingsRepository';

describe('settingsRepository', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('saves settings and reads them back after reopening the database', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, theme: 'dark', numberFormat: 'compact', inflationRate: 5.5, classDefaults: { Equity: { base: 11 } } });
    await closeDb(); // simulates a page refresh
    expect(await getSettings()).toEqual({ theme: 'dark', numberFormat: 'compact', inflationRate: 5.5, classDefaults: { Equity: { base: 11 } } });
  });

  it('loads settings saved before a field existed, keeping stored values', async () => {
    const db = await getDb();
    await db.put('settings', { theme: 'dark' } as unknown as AppSettings, 'app');
    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark' }); // older settings gain the new defaults
  });

  it('rejects invalid settings without writing them', async () => {
    await expect(saveSettings({ theme: 'purple' } as unknown as AppSettings)).rejects.toThrow();
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to defaults for corrupted data but does not overwrite it', async () => {
    const db = await getDb();
    await db.put('settings', { theme: 123 } as unknown as AppSettings, 'app');
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await db.get('settings', 'app')).toEqual({ theme: 123 });
  });
});
