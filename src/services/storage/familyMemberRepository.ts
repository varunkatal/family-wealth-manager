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
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.createdAt.localeCompare(b.createdAt));
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
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export async function deleteFamilyMember(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('familyMembers', id);
}
