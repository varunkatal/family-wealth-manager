import {
  contributionInputSchema,
  contributionSchema,
  type Contribution,
  type ContributionInput,
} from '../../models/contribution';
import { getDb } from './db';

/** All valid stored contributions, by name. */
export async function listContributions(): Promise<Contribution[]> {
  const db = await getDb();
  const rows = await db.getAll('contributions');
  return rows
    .map((row) => contributionSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt));
}

async function save(id: string | null, input: ContributionInput): Promise<Contribution> {
  const fields = contributionInputSchema.parse(input);
  const db = await getDb();
  const tx = db.transaction(['contributions', 'familyMembers', 'assets'], 'readwrite');
  try {
    if (!(await tx.objectStore('familyMembers').get(fields.ownerId))) throw new Error('Owner not found');
    if (fields.linkedAssetId && !(await tx.objectStore('assets').get(fields.linkedAssetId))) {
      throw new Error('Linked asset not found');
    }
    const store = tx.objectStore('contributions');
    const now = new Date().toISOString();
    let contribution: Contribution;
    if (id === null) {
      contribution = { id: crypto.randomUUID(), ...fields, createdAt: now, updatedAt: now };
      await store.add(contribution);
    } else {
      const existing = await store.get(id);
      if (!existing) throw new Error('Contribution not found');
      contribution = { id, ...fields, ...(existing.isDemo && { isDemo: true }), createdAt: existing.createdAt, updatedAt: now };
      await store.put(contribution);
    }
    await tx.done;
    return contribution;
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

export const createContribution = (input: ContributionInput) => save(null, input);
export const updateContribution = (id: string, input: ContributionInput) => save(id, input);

export async function deleteContribution(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('contributions', id);
}
