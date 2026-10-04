import { buildDemoData } from '../demo/demoData';
import { clearDemoData, loadDemoData } from './demoRepository';
import { createFamilyMember, deleteFamilyMember, listFamilyMembers, MemberHasHoldingsError } from './familyMemberRepository';
import { createGoal, deleteGoal, listGoals, updateGoal } from './goalRepository';

let A = '';
beforeEach(async () => {
  A = (await createFamilyMember({ name: 'Person A', relationship: 'Self', isActive: true })).id;
});

const goal = (o: Record<string, unknown> = {}) => ({
  name: 'Example Car',
  type: 'Car' as const,
  targetAmount: 1000000,
  savedAmount: 200000,
  targetDate: '2030-01-01',
  priority: 'medium' as const,
  ...o,
});

describe('goal repository', () => {
  it('creates, updates and deletes, persisting across reads', async () => {
    const g = await createGoal(goal({ ownerId: '' }));
    expect(g.ownerId).toBeUndefined();
    await updateGoal(g.id, goal({ savedAmount: 300000, ownerId: A, expectedReturn: 7 }));
    expect((await listGoals())[0]).toMatchObject({ savedAmount: 300000, ownerId: A, expectedReturn: 7, createdAt: g.createdAt });
    await deleteGoal(g.id);
    expect(await listGoals()).toEqual([]);
  });

  it('lists high priority first, then the soonest target date', async () => {
    await createGoal(goal({ name: 'Later low', priority: 'low', targetDate: '2027-01-01' }));
    await createGoal(goal({ name: 'High late', priority: 'high', targetDate: '2040-01-01' }));
    await createGoal(goal({ name: 'High soon', priority: 'high', targetDate: '2028-01-01' }));
    expect((await listGoals()).map((g) => g.name)).toEqual(['High soon', 'High late', 'Later low']);
  });

  it('validates input', async () => {
    await expect(createGoal(goal({ name: ' ' }))).rejects.toThrow('Name is required');
    await expect(createGoal(goal({ targetAmount: 0 }))).rejects.toThrow('Target amount must be more than 0');
    await expect(createGoal(goal({ savedAmount: -1 }))).rejects.toThrow('Saved amount cannot be negative');
    await expect(createGoal(goal({ ownerId: 'missing' }))).rejects.toThrow('Owner not found');
    expect(await listGoals()).toEqual([]);
  });

  it("a member who owns a goal can't be deleted; demo clearing keeps them", async () => {
    const g = await createGoal(goal({ ownerId: A }));
    await expect(deleteFamilyMember(A)).rejects.toBeInstanceOf(MemberHasHoldingsError);
    await deleteGoal(g.id);

    await loadDemoData(buildDemoData());
    const personB = (await listFamilyMembers()).find((m) => m.name === 'Person B' && m.isDemo)!;
    await createGoal(goal({ ownerId: personB.id }));
    expect((await clearDemoData()).keptMembers).toEqual(['Person B']);
  });
});
