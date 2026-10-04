import { assetInputSchema, assetSchema, type Asset, type AssetInput } from '../../models/asset';
import { getDb } from './db';

/** All valid stored assets, highest current value first. */
export async function listAssets(): Promise<Asset[]> {
  const db = await getDb();
  const rows = await db.getAll('assets');
  return rows
    .map((row) => assetSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => b.currentValue - a.currentValue);
}

function buildAsset(input: AssetInput, isDemo: boolean): Asset {
  const fields = assetInputSchema.parse(input);
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), ...fields, ...(isDemo && { isDemo: true }), createdAt: now, updatedAt: now };
}

export async function createAsset(input: AssetInput): Promise<Asset> {
  const asset = buildAsset(input, false);
  const db = await getDb();
  await db.add('assets', asset); // `add` fails rather than overwrite if the ID already exists
  return asset;
}

export async function updateAsset(id: string, input: AssetInput): Promise<Asset> {
  const fields = assetInputSchema.parse(input);
  const db = await getDb();
  const tx = db.transaction('assets', 'readwrite');
  const existing = await tx.store.get(id);
  if (!existing) throw new Error('Asset not found');
  const updated: Asset = {
    id,
    ...fields,
    ...(existing.isDemo && { isDemo: true }),
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('assets', id);
}

/** Adds the given demo assets, all marked as demo data, in one transaction. */
export async function addDemoAssets(inputs: AssetInput[]): Promise<Asset[]> {
  const assets = inputs.map((input) => buildAsset(input, true));
  const db = await getDb();
  const tx = db.transaction('assets', 'readwrite');
  await Promise.all([...assets.map((a) => tx.store.add(a)), tx.done]);
  return assets;
}

/** Deletes every asset marked as demo data and nothing else. Returns how many were removed. */
export async function deleteDemoAssets(): Promise<number> {
  const db = await getDb();
  const tx = db.transaction('assets', 'readwrite');
  const demoIds = (await tx.store.getAll()).filter((a) => a.isDemo === true).map((a) => a.id);
  await Promise.all([...demoIds.map((id) => tx.store.delete(id)), tx.done]);
  return demoIds.length;
}
