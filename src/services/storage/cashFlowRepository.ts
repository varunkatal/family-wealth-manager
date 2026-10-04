import {
  expenseInputSchema,
  expenseSchema,
  incomeInputSchema,
  incomeSchema,
  type Expense,
  type ExpenseInput,
  type Income,
  type IncomeInput,
} from '../../models/cashFlow';
import { getDb } from './db';

type Store = 'incomes' | 'expenses';

async function list<T extends { amount: number; createdAt: string }>(store: Store, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): Promise<T[]> {
  const db = await getDb();
  return (await db.getAll(store))
    .map((row) => schema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data as T)
    .sort((a, b) => b.amount - a.amount || a.createdAt.localeCompare(b.createdAt));
}

/** Validates the member (if any), then adds or replaces the record, keeping createdAt and the demo flag. */
async function save<T extends Income | Expense>(store: Store, id: string | null, fields: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
  const db = await getDb();
  const tx = db.transaction([store, 'familyMembers'], 'readwrite');
  try {
    if (fields.memberId && !(await tx.objectStore('familyMembers').get(fields.memberId))) throw new Error('Family member not found');
    const os = tx.objectStore(store);
    const now = new Date().toISOString();
    let record: T;
    if (id === null) {
      record = { id: crypto.randomUUID(), ...fields, createdAt: now, updatedAt: now } as T;
      await os.add(record as never);
    } else {
      const existing = await os.get(id);
      if (!existing) throw new Error('Record not found');
      record = { id, ...fields, ...(existing.isDemo && { isDemo: true }), createdAt: existing.createdAt, updatedAt: now } as T;
      await os.put(record as never);
    }
    await tx.done;
    return record;
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

export const listIncomes = () => list<Income>('incomes', incomeSchema);
export const listExpenses = () => list<Expense>('expenses', expenseSchema);

export const createIncome = async (input: IncomeInput) => save<Income>('incomes', null, incomeInputSchema.parse(input));
export const updateIncome = async (id: string, input: IncomeInput) => save<Income>('incomes', id, incomeInputSchema.parse(input));
export const createExpense = async (input: ExpenseInput) => save<Expense>('expenses', null, expenseInputSchema.parse(input));
export const updateExpense = async (id: string, input: ExpenseInput) =>
  save<Expense>('expenses', id, expenseInputSchema.parse(input));

export async function deleteIncome(id: string): Promise<void> {
  await (await getDb()).delete('incomes', id);
}
export async function deleteExpense(id: string): Promise<void> {
  await (await getDb()).delete('expenses', id);
}
