import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings } from '../../models/settings';

export const DB_NAME = 'family-wealth-calculator';
export const DB_VERSION = 1;

export interface WealthDB extends DBSchema {
  settings: {
    key: string;
    value: AppSettings;
  };
}

let dbPromise: Promise<IDBPDatabase<WealthDB>> | null = null;

/** Opens (or reuses) the app database. All stores are created/migrated here. */
export function getDb(): Promise<IDBPDatabase<WealthDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WealthDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

/** Closes the connection so the database can be deleted or reopened (used in tests). */
export async function closeDb(): Promise<void> {
  if (dbPromise) {
    (await dbPromise).close();
    dbPromise = null;
  }
}
