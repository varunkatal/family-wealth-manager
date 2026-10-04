import {
  familyMemberInputSchema,
  familyMemberSchema,
  type FamilyMember,
  type FamilyMemberInput,
} from '../../models/familyMember';
import type { IDBPTransaction } from 'idb';
import { getDb, type WealthDB } from './db';

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

/** Records that belong to a member and would be orphaned if the member were deleted. */
export type MemberHoldings = { assets: number; liabilities: number; contributions: number; incomes: number; expenses: number; goals: number };

const HOLDING_STORES = ['assetOwnerships', 'liabilities', 'contributions', 'incomes', 'expenses', 'goals'] as const;

export const totalHoldings = (h: MemberHoldings) => Object.values(h).reduce((s, n) => s + n, 0);

/** Thrown when deleting a member who still owns assets, liabilities or other records. */
export class MemberHasHoldingsError extends Error {
  constructor(readonly holdings: MemberHoldings) {
    super('This family member still owns records');
    this.name = 'MemberHasHoldingsError';
  }
}

type HoldingsTx = IDBPTransaction<WealthDB, ('familyMembers' | (typeof HOLDING_STORES)[number])[], IDBTransactionMode>;

async function countIn(tx: HoldingsTx, id: string): Promise<MemberHoldings> {
  const [assets, liabilities, contributions, incomes, expenses, goals] = await Promise.all([
    tx.objectStore('assetOwnerships').index('by-member').count(id),
    tx.objectStore('liabilities').index('by-owner').count(id),
    tx.objectStore('contributions').index('by-owner').count(id),
    tx.objectStore('incomes').index('by-member').count(id),
    tx.objectStore('expenses').index('by-member').count(id),
    tx.objectStore('goals').index('by-owner').count(id),
  ]);
  return { assets, liabilities, contributions, incomes, expenses, goals };
}

/** Number of asset shares, liabilities and other records that belong to a member. */
export async function countMemberHoldings(id: string): Promise<MemberHoldings> {
  const db = await getDb();
  const tx = db.transaction([...HOLDING_STORES], 'readonly') as unknown as HoldingsTx;
  const holdings = await countIn(tx, id);
  await tx.done;
  return holdings;
}

/**
 * Deletes a member. Refuses if anything still belongs to them, so their share can never
 * silently drop out of net worth; those records must be reassigned first.
 */
export async function deleteFamilyMember(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['familyMembers', ...HOLDING_STORES], 'readwrite');
  const holdings = await countIn(tx, id);
  if (totalHoldings(holdings) > 0) {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw new MemberHasHoldingsError(holdings);
  }
  await tx.objectStore('familyMembers').delete(id);
  await tx.done;
}
