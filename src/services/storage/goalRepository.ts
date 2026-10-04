import { GOAL_PRIORITIES, goalInputSchema, goalSchema, type Goal, type GoalInput } from '../../models/goal';
import { getDb } from './db';

/** All valid stored goals: highest priority first, then soonest target date. */
export async function listGoals(): Promise<Goal[]> {
  const db = await getDb();
  return (await db.getAll('goals'))
    .map((row) => goalSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort(
      (a, b) =>
        GOAL_PRIORITIES.indexOf(a.priority) - GOAL_PRIORITIES.indexOf(b.priority) ||
        a.targetDate.localeCompare(b.targetDate) ||
        a.name.localeCompare(b.name),
    );
}

async function save(id: string | null, input: GoalInput): Promise<Goal> {
  const fields = goalInputSchema.parse(input);
  const db = await getDb();
  const tx = db.transaction(['goals', 'familyMembers'], 'readwrite');
  try {
    if (fields.ownerId && !(await tx.objectStore('familyMembers').get(fields.ownerId))) throw new Error('Owner not found');
    const store = tx.objectStore('goals');
    const now = new Date().toISOString();
    let goal: Goal;
    if (id === null) {
      goal = { id: crypto.randomUUID(), ...fields, createdAt: now, updatedAt: now };
      await store.add(goal);
    } else {
      const existing = await store.get(id);
      if (!existing) throw new Error('Goal not found');
      goal = { id, ...fields, ...(existing.isDemo && { isDemo: true }), createdAt: existing.createdAt, updatedAt: now };
      await store.put(goal);
    }
    await tx.done;
    return goal;
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

export const createGoal = (input: GoalInput) => save(null, input);
export const updateGoal = (id: string, input: GoalInput) => save(id, input);

export async function deleteGoal(id: string): Promise<void> {
  await (await getDb()).delete('goals', id);
}
