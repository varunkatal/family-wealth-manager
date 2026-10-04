import { buildDemoData } from '../demo/demoData';
import { createExpense, createIncome, deleteExpense, deleteIncome, listExpenses, listIncomes, updateExpense, updateIncome } from './cashFlowRepository';
import { clearDemoData, loadDemoData } from './demoRepository';
import { createFamilyMember, deleteFamilyMember, listFamilyMembers, MemberHasHoldingsError } from './familyMemberRepository';

let A = '';
beforeEach(async () => {
  A = (await createFamilyMember({ name: 'Person A', relationship: 'Self', isActive: true })).id;
});

describe('cash flow repository', () => {
  it('creates, updates and deletes income, persisting across reads', async () => {
    const i = await createIncome({ memberId: A, type: 'Salary', amount: 100000, frequency: 'monthly', growthRate: 8, startDate: '' });
    expect(i.startDate).toBeUndefined();
    await updateIncome(i.id, { memberId: A, type: 'Salary', amount: 120000, frequency: 'monthly' });
    const [stored] = await listIncomes();
    expect(stored).toMatchObject({ amount: 120000, createdAt: i.createdAt });
    expect(stored!.growthRate).toBeUndefined();
    await deleteIncome(i.id);
    expect(await listIncomes()).toEqual([]);
  });

  it('expenses may be family-wide or belong to a member', async () => {
    const e = await createExpense({ category: 'Grocery', amount: 15000, frequency: 'monthly', memberId: '' });
    expect(e.memberId).toBeUndefined();
    await updateExpense(e.id, { category: 'Medical', amount: 2000, frequency: 'monthly', memberId: A });
    expect((await listExpenses())[0]).toMatchObject({ category: 'Medical', memberId: A });
    await deleteExpense(e.id);
    expect(await listExpenses()).toEqual([]);
  });

  it('validates input', async () => {
    await expect(createIncome({ memberId: A, type: 'Salary', amount: 0, frequency: 'monthly' })).rejects.toThrow('Amount must be more than 0');
    await expect(createIncome({ memberId: 'missing', type: 'Salary', amount: 1, frequency: 'monthly' })).rejects.toThrow('Family member not found');
    await expect(
      createExpense({ category: 'Travel', amount: 1, frequency: 'monthly', startDate: '2026-05-01', endDate: '2026-01-01' }),
    ).rejects.toThrow('End date must be on or after the start date');
    await expect(createExpense({ category: 'Bills' as never, amount: 1, frequency: 'monthly' })).rejects.toThrow('Choose a category');
  });

  it('a member with income or expenses cannot be deleted', async () => {
    const i = await createIncome({ memberId: A, type: 'Pension', amount: 20000, frequency: 'monthly' });
    await expect(deleteFamilyMember(A)).rejects.toBeInstanceOf(MemberHasHoldingsError);
    await deleteIncome(i.id);
    await deleteFamilyMember(A);
    expect(await listFamilyMembers()).toEqual([]);
  });

  it('clearing demo data keeps a demo member who has the user’s income', async () => {
    await loadDemoData(buildDemoData());
    const personB = (await listFamilyMembers()).find((m) => m.name === 'Person B' && m.isDemo)!;
    await createIncome({ memberId: personB.id, type: 'Salary', amount: 50000, frequency: 'monthly' });
    expect((await clearDemoData()).keptMembers).toEqual(['Person B']);
    expect(await listIncomes()).toHaveLength(1);
  });
});
