import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Asset } from '../../models/asset';
import type { FamilyMember } from '../../models/familyMember';
import type { Liability } from '../../models/liability';
import type { AssetOwnership } from '../../models/ownership';
import type { AppSettings } from '../../models/settings';

export const DB_NAME = 'family-wealth-calculator';
export const DB_VERSION = 4;

export interface WealthDB extends DBSchema {
  settings: {
    key: string;
    value: AppSettings;
  };
  familyMembers: {
    key: string;
    value: FamilyMember;
  };
  assets: {
    key: string;
    value: Asset;
  };
  assetOwnerships: {
    key: string;
    value: AssetOwnership;
    indexes: { 'by-asset': string; 'by-member': string };
  };
  liabilities: {
    key: string;
    value: Liability;
    indexes: { 'by-owner': string };
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
        if (oldVersion < 2) {
          db.createObjectStore('familyMembers', { keyPath: 'id' });
        }
        if (oldVersion < 3) {
          db.createObjectStore('assets', { keyPath: 'id' });
        }
        if (oldVersion < 4) {
          const ownerships = db.createObjectStore('assetOwnerships', { keyPath: 'id' });
          ownerships.createIndex('by-asset', 'assetId');
          ownerships.createIndex('by-member', 'familyMemberId');
          const liabilities = db.createObjectStore('liabilities', { keyPath: 'id' });
          liabilities.createIndex('by-owner', 'ownerId');
        }
      },
      // Another tab is upgrading the database: release our connection so it can proceed.
      blocking() {
        void closeDb();
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
