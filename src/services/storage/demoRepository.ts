import { assetInputSchema } from '../../models/asset';
import { familyMemberInputSchema, type FamilyMember } from '../../models/familyMember';
import { liabilityInputSchema } from '../../models/liability';
import type { DemoData } from '../demo/demoData';
import { unlinkContributions } from './assetRepository';
import { getDb } from './db';

const DEMO_STORES = ['familyMembers', 'assets', 'assetOwnerships', 'liabilities', 'contributions'] as const;

/** Adds demo members, assets (with owners) and liabilities in one transaction, all marked as demo. */
export async function loadDemoData(data: DemoData): Promise<void> {
  const now = new Date().toISOString();
  const stamp = { isDemo: true as const, createdAt: now, updatedAt: now };

  // Validate everything before writing anything.
  const members = {} as Record<'A' | 'B', FamilyMember>;
  for (const key of ['A', 'B'] as const) {
    members[key] = { id: crypto.randomUUID(), ...familyMemberInputSchema.parse(data.members[key]), ...stamp };
  }
  const assets = data.assets.map(({ owners, ...rest }) => {
    const parsed = assetInputSchema.parse({
      ...rest,
      owners: owners.map((o) => ({ familyMemberId: members[o.member].id, percentage: o.percentage })),
    });
    const { owners: parsedOwners, ...fields } = parsed;
    return { asset: { id: crypto.randomUUID(), ...fields, ...stamp }, owners: parsedOwners };
  });
  const liabilities = data.liabilities.map(({ owner, ...rest }) => ({
    id: crypto.randomUUID(),
    ...liabilityInputSchema.parse({ ...rest, ownerId: members[owner].id }),
    ...stamp,
  }));

  const db = await getDb();
  const tx = db.transaction([...DEMO_STORES], 'readwrite');
  await Promise.all([
    ...Object.values(members).map((m) => tx.objectStore('familyMembers').add(m)),
    ...assets.flatMap(({ asset, owners }) => [
      tx.objectStore('assets').add(asset),
      ...owners.map((o) => tx.objectStore('assetOwnerships').add({ id: crypto.randomUUID(), assetId: asset.id, ...o })),
    ]),
    ...liabilities.map((l) => tx.objectStore('liabilities').add(l)),
    tx.done,
  ]);
}

export type ClearDemoResult = { assets: number; liabilities: number; members: number; keptMembers: string[] };

/**
 * Removes demo assets (and their ownership records), demo liabilities, and demo members.
 * A demo member who now owns one of the user's own assets, liabilities or contributions is kept and becomes a
 * regular member (the demo label is removed), so real data is never orphaned. The caller reports this.
 */
export async function clearDemoData(): Promise<ClearDemoResult> {
  const db = await getDb();
  const tx = db.transaction([...DEMO_STORES], 'readwrite');
  const assetStore = tx.objectStore('assets');
  const ownershipStore = tx.objectStore('assetOwnerships');
  const liabilityStore = tx.objectStore('liabilities');
  const memberStore = tx.objectStore('familyMembers');
  const contributionStore = tx.objectStore('contributions');

  const demoAssets = (await assetStore.getAll()).filter((a) => a.isDemo === true);
  for (const asset of demoAssets) {
    for (const key of await ownershipStore.index('by-asset').getAllKeys(asset.id)) await ownershipStore.delete(key);
    await unlinkContributions(contributionStore, asset.id);
    await assetStore.delete(asset.id);
  }
  const demoLiabilities = (await liabilityStore.getAll()).filter((l) => l.isDemo === true);
  for (const l of demoLiabilities) await liabilityStore.delete(l.id);

  let removedMembers = 0;
  const keptMembers: string[] = [];
  for (const member of (await memberStore.getAll()).filter((m) => m.isDemo === true)) {
    const stillOwns =
      (await ownershipStore.index('by-member').count(member.id)) +
      (await liabilityStore.index('by-owner').count(member.id)) +
      (await contributionStore.index('by-owner').count(member.id));
    if (stillOwns > 0) {
      const { isDemo: _dropped, ...regular } = member;
      await memberStore.put({ ...regular, updatedAt: new Date().toISOString() });
      keptMembers.push(member.name);
    } else {
      await memberStore.delete(member.id);
      removedMembers += 1;
    }
  }
  await tx.done;
  return { assets: demoAssets.length, liabilities: demoLiabilities.length, members: removedMembers, keptMembers };
}
