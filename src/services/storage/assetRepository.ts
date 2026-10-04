import { assetInputSchema, assetSchema, type Asset, type AssetInput } from '../../models/asset';
import { assetOwnershipSchema, type AssetOwnership } from '../../models/ownership';
import type { IDBPObjectStore, IDBPTransaction, StoreNames } from 'idb';
import { getDb, type WealthDB } from './db';

/** All valid stored assets, highest current value first. */
export async function listAssets(): Promise<Asset[]> {
  const db = await getDb();
  const rows = await db.getAll('assets');
  return rows
    .map((row) => assetSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => b.currentValue - a.currentValue || a.name.localeCompare(b.name));
}

/** All valid ownership records. */
export async function listOwnerships(): Promise<AssetOwnership[]> {
  const db = await getDb();
  const rows = await db.getAll('assetOwnerships');
  return rows
    .map((row) => assetOwnershipSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data);
}

type ParsedAsset = ReturnType<typeof assetInputSchema.parse>;

function splitInput(input: AssetInput): { fields: Omit<ParsedAsset, 'owners'>; owners: ParsedAsset['owners'] } {
  const { owners, ...fields } = assetInputSchema.parse(input);
  return { fields, owners };
}

const TX_STORES = ['assets', 'assetOwnerships', 'familyMembers', 'contributions', 'assetValuations'] as const;
type AssetTx = IDBPTransaction<WealthDB, typeof TX_STORES extends readonly (infer S)[] ? S[] : never, 'readwrite'>;

/** Writes the asset and replaces its ownership records, inside one transaction. */
async function writeAssetWithOwners(tx: AssetTx, asset: Asset, owners: ParsedAsset['owners'], isNew: boolean) {
  const members = tx.objectStore('familyMembers');
  const ownerships = tx.objectStore('assetOwnerships');
  for (const o of owners) {
    if (!(await members.get(o.familyMemberId))) throw new Error('Owner not found');
  }
  if (isNew) await tx.objectStore('assets').add(asset);
  else await tx.objectStore('assets').put(asset);
  for (const key of await ownerships.index('by-asset').getAllKeys(asset.id)) await ownerships.delete(key);
  for (const o of owners) {
    await ownerships.add({ id: crypto.randomUUID(), assetId: asset.id, ...o });
  }
}

async function inTransaction<T>(work: (tx: AssetTx) => Promise<T>): Promise<T> {
  const db = await getDb();
  const tx = db.transaction([...TX_STORES], 'readwrite');
  try {
    const result = await work(tx);
    await tx.done;
    return result;
  } catch (err) {
    // Roll back everything written so far; nothing is half-saved.
    try {
      tx.abort();
    } catch {
      // already finished
    }
    await tx.done.catch(() => undefined);
    throw err;
  }
}

export async function createAsset(input: AssetInput): Promise<Asset> {
  const { fields, owners } = splitInput(input);
  const now = new Date().toISOString();
  const asset: Asset = { id: crypto.randomUUID(), ...fields, createdAt: now, updatedAt: now };
  // `add` fails rather than overwrite if the ID already exists.
  return inTransaction(async (tx) => {
    await writeAssetWithOwners(tx, asset, owners, true);
    await recordValuation(tx.objectStore('assetValuations'), asset);
    return asset;
  });
}

export async function updateAsset(id: string, input: AssetInput): Promise<Asset> {
  const { fields, owners } = splitInput(input);
  return inTransaction(async (tx) => {
    const existing = await tx.objectStore('assets').get(id);
    if (!existing) throw new Error('Asset not found');
    const updated: Asset = {
      id,
      ...fields,
      ...(existing.isDemo && { isDemo: true }),
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await writeAssetWithOwners(tx, updated, owners, false);
    if (existing.currentValue !== updated.currentValue || existing.valuationDate !== updated.valuationDate) {
      await recordValuation(tx.objectStore('assetValuations'), updated);
    }
    return updated;
  });
}

/**
 * Deletes an asset together with its ownership records and valuation history. Contributions linked to it are kept
 * but unlinked (the confirmation tells the user), so no investment record is lost.
 */
export async function deleteAsset(id: string): Promise<void> {
  await inTransaction(async (tx) => {
    const ownerships = tx.objectStore('assetOwnerships');
    for (const key of await ownerships.index('by-asset').getAllKeys(id)) await ownerships.delete(key);
    await unlinkContributions(tx.objectStore('contributions'), id);
    await deleteValuationsOf(tx.objectStore('assetValuations'), id);
    await tx.objectStore('assets').delete(id);
  });
}

type ValuationStore = IDBPObjectStore<WealthDB, StoreNames<WealthDB>[], 'assetValuations', 'readwrite'>;

/** Adds the asset's current value to its valuation history (spec §18). */
export async function recordValuation(store: ValuationStore, asset: Asset): Promise<void> {
  await store.add({
    id: crypto.randomUUID(),
    assetId: asset.id,
    date: asset.valuationDate,
    value: asset.currentValue,
    source: 'asset-update',
    ...(asset.isDemo && { isDemo: true }),
    createdAt: new Date().toISOString(),
  });
}

/** Removes an asset's valuation history (only when the asset itself is deleted). */
export async function deleteValuationsOf(store: ValuationStore, assetId: string): Promise<void> {
  for (const key of await store.index('by-asset').getAllKeys(assetId)) await store.delete(key);
}

type ContributionStore = IDBPObjectStore<WealthDB, StoreNames<WealthDB>[], 'contributions', 'readwrite'>;

/** Removes the link from every contribution that points at an asset. */
export async function unlinkContributions(store: ContributionStore, assetId: string): Promise<void> {
  const now = new Date().toISOString();
  for (const c of await store.index('by-asset').getAll(assetId)) {
    const { linkedAssetId: _unlinked, ...rest } = c;
    await store.put({ ...rest, updatedAt: now });
  }
}
