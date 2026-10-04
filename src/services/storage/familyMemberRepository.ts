import {
  familyMemberInputSchema,
  familyMemberSchema,
  type FamilyMember,
  type FamilyMemberInput,
} from '../../models/familyMember';
import { getDb } from './db';

/** All valid stored members, active first, then oldest first. */
export async function listFamilyMembers(): Promise<FamilyMember[]> {
  const db = await getDb();
  const rows = await db.getAll('familyMembers');
  return rows
    .map((row) => familyMemberSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
}

export async function createFamilyMember(input: FamilyMemberInput): Promise<FamilyMember> {
  const fields = familyMemberInputSchema.parse(input);
  const now = new Date().toISOString();
  const member: FamilyMember = { id: crypto.randomUUID(), ...fields, createdAt: now, updatedAt: now };
  const db = await getDb();
  await db.add('familyMembers', member); // `add` fails rather than overwrite if the ID already exists
  return member;
}

export async function updateFamilyMember(id: string, input: FamilyMemberInput): Promise<FamilyMember> {
  const fields = familyMemberInputSchema.parse(input);
  const db = await getDb();
  const tx = db.transaction('familyMembers', 'readwrite');
  const existing = await tx.store.get(id);
  if (!existing) throw new Error('Family member not found');
  const updated: FamilyMember = {
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

/** Thrown when deleting a member who still owns assets or owes liabilities. */
export class MemberHasHoldingsError extends Error {
  constructor(
    readonly assetCount: number,
    readonly liabilityCount: number,
  ) {
    super('This family member still owns assets or liabilities');
    this.name = 'MemberHasHoldingsError';
  }
}

/** Number of assets a member co-owns and liabilities they owe. */
export async function countMemberHoldings(id: string): Promise<{ assets: number; liabilities: number }> {
  const db = await getDb();
  const [assets, liabilities] = await Promise.all([
    db.countFromIndex('assetOwnerships', 'by-member', id),
    db.countFromIndex('liabilities', 'by-owner', id),
  ]);
  return { assets, liabilities };
}

/**
 * Deletes a member. Refuses if they own any asset share or liability, so their share
 * can never silently drop out of net worth; those must be reassigned first.
 */
export async function deleteFamilyMember(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['familyMembers', 'assetOwnerships', 'liabilities'], 'readwrite');
  const [assets, liabilities] = await Promise.all([
    tx.objectStore('assetOwnerships').index('by-member').count(id),
    tx.objectStore('liabilities').index('by-owner').count(id),
  ]);
  if (assets > 0 || liabilities > 0) {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw new MemberHasHoldingsError(assets, liabilities);
  }
  await tx.objectStore('familyMembers').delete(id);
  await tx.done;
}
