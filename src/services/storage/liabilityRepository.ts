import { liabilityInputSchema, liabilitySchema, type Liability, type LiabilityInput } from '../../models/liability';
import { getDb } from './db';

/** All valid stored liabilities, largest outstanding first. */
export async function listLiabilities(): Promise<Liability[]> {
  const db = await getDb();
  const rows = await db.getAll('liabilities');
  return rows
    .map((row) => liabilitySchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => b.currentOutstanding - a.currentOutstanding);
}

async function save(id: string | null, input: LiabilityInput): Promise<Liability> {
  const fields = liabilityInputSchema.parse(input);
  const db = await getDb();
  const tx = db.transaction(['liabilities', 'familyMembers'], 'readwrite');
  try {
    if (!(await tx.objectStore('familyMembers').get(fields.ownerId))) throw new Error('Owner not found');
    const store = tx.objectStore('liabilities');
    const now = new Date().toISOString();
    let liability: Liability;
    if (id === null) {
      liability = { id: crypto.randomUUID(), ...fields, createdAt: now, updatedAt: now };
      await store.add(liability);
    } else {
      const existing = await store.get(id);
      if (!existing) throw new Error('Liability not found');
      liability = { id, ...fields, ...(existing.isDemo && { isDemo: true }), createdAt: existing.createdAt, updatedAt: now };
      await store.put(liability);
    }
    await tx.done;
    return liability;
  } catch (err) {
    try {
      tx.abort();
    } catch {
      // already finished
    }
    await tx.done.catch(() => undefined);
    throw err;
  }
}

export const createLiability = (input: LiabilityInput) => save(null, input);
export const updateLiability = (id: string, input: LiabilityInput) => save(id, input);

export async function deleteLiability(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('liabilities', id);
}
