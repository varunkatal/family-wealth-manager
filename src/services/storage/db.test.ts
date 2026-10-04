import { openDB } from 'idb';
import { closeDb, DB_NAME, getDb } from './db';
import { getSettings } from './settingsRepository';

describe('database upgrade', () => {
  it('upgrades a Phase 1 (v1) database without losing settings', async () => {
    const v1 = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('settings');
      },
    });
    await v1.put('settings', { theme: 'dark' }, 'app');
    v1.close();

    await closeDb();
    const db = await getDb();
    expect([...db.objectStoreNames]).toEqual(expect.arrayContaining(['settings', 'familyMembers', 'assets', 'assetOwnerships', 'liabilities']));
    expect(await getSettings()).toEqual({ theme: 'dark', numberFormat: 'exact' });
  });
});
