import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { closeDb, DB_NAME } from '../services/storage/db';

// Start every test with an empty database.
afterEach(async () => {
  await closeDb();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});
