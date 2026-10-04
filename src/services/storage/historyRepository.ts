import {
  assetValuationSchema,
  manualSnapshotInputSchema,
  manualValuationInputSchema,
  snapshotSchema,
  type AssetValuation,
  type ManualSnapshotInput,
  type ManualValuationInput,
  type Snapshot,
} from '../../models/history';
import { todayISODate } from '../../utils/date';
import { calculateFamilyWealth } from '../finance/netWorth';
import { getDb } from './db';

const parsed = <T>(rows: unknown[], schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): T[] =>
  rows
    .map((r) => schema.safeParse(r))
    .filter((r) => r.success)
    .map((r) => r.data as T);

/** All snapshots, oldest first. */
export async function listSnapshots(): Promise<Snapshot[]> {
  const db = await getDb();
  return parsed<Snapshot>(await db.getAll('snapshots'), snapshotSchema).sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
}

/** Saves today's totals, calculated from what is stored, in one transaction. */
export async function saveWealthSnapshot(notes?: string): Promise<Snapshot> {
  const db = await getDb();
  const tx = db.transaction(['snapshots', 'familyMembers', 'assets', 'assetOwnerships', 'liabilities'], 'readwrite');
  const [members, assets, ownerships, liabilities] = await Promise.all([
    tx.objectStore('familyMembers').getAll(),
    tx.objectStore('assets').getAll(),
    tx.objectStore('assetOwnerships').getAll(),
    tx.objectStore('liabilities').getAll(),
  ]);
  const w = calculateFamilyWealth(members.map((m) => m.id), assets, ownerships, liabilities);
  const snapshot: Snapshot = {
    id: crypto.randomUUID(),
    date: todayISODate(),
    totalAssets: w.totalAssets,
    totalLiabilities: w.totalLiabilities,
    netWorth: w.netWorth,
    source: 'captured',
    ...(notes?.trim() && { notes: notes.trim() }),
    createdAt: new Date().toISOString(),
  };
  await tx.objectStore('snapshots').add(snapshot);
  await tx.done;
  return snapshot;
}

/** Adds a snapshot for a past date with figures the user enters. */
export async function addManualSnapshot(input: ManualSnapshotInput): Promise<Snapshot> {
  const f = manualSnapshotInputSchema.parse(input);
  const snapshot: Snapshot = {
    id: crypto.randomUUID(),
    date: f.date,
    totalAssets: f.totalAssets,
    totalLiabilities: f.totalLiabilities,
    netWorth: Math.round((f.totalAssets - f.totalLiabilities) * 100) / 100,
    source: 'manual',
    ...(f.notes && { notes: f.notes }),
    createdAt: new Date().toISOString(),
  };
  await (await getDb()).add('snapshots', snapshot);
  return snapshot;
}

export async function deleteSnapshot(id: string): Promise<void> {
  await (await getDb()).delete('snapshots', id);
}

/** All valuation records, oldest first. */
export async function listValuations(): Promise<AssetValuation[]> {
  const db = await getDb();
  return parsed<AssetValuation>(await db.getAll('assetValuations'), assetValuationSchema).sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
}

/** Adds a past value for an asset, typed in by the user. */
export async function addManualValuation(assetId: string, input: ManualValuationInput): Promise<AssetValuation> {
  const f = manualValuationInputSchema.parse(input);
  const db = await getDb();
  const tx = db.transaction(['assets', 'assetValuations'], 'readwrite');
  if (!(await tx.objectStore('assets').get(assetId))) {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw new Error('Asset not found');
  }
  const valuation: AssetValuation = {
    id: crypto.randomUUID(),
    assetId,
    date: f.date,
    value: f.value,
    source: 'manual',
    ...(f.notes && { notes: f.notes }),
    createdAt: new Date().toISOString(),
  };
  await tx.objectStore('assetValuations').add(valuation);
  await tx.done;
  return valuation;
}

export async function deleteValuation(id: string): Promise<void> {
  await (await getDb()).delete('assetValuations', id);
}
