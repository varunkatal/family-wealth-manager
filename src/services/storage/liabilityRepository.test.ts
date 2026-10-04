import type { LiabilityInput } from '../../models/liability';
import { closeDb } from './db';
import { createFamilyMember } from './familyMemberRepository';
import { createLiability, deleteLiability, listLiabilities, updateLiability } from './liabilityRepository';

let A = '';
beforeEach(async () => {
  A = (await createFamilyMember({ name: 'Person A', relationship: '', isActive: true })).id;
});

const loan = (o: Partial<LiabilityInput> = {}): LiabilityInput => ({
  name: 'Example Home Loan',
  type: 'Home Loan',
  ownerId: A,
  currentOutstanding: 200000,
  ...o,
});

describe('liabilityRepository', () => {
  it('creates, lists, updates and deletes', async () => {
    const l = await createLiability(loan());
    expect(await listLiabilities()).toEqual([l]);
    const updated = await updateLiability(l.id, loan({ currentOutstanding: 150000 }));
    expect(updated.currentOutstanding).toBe(150000);
    expect(updated.createdAt).toBe(l.createdAt);
    await deleteLiability(l.id);
    expect(await listLiabilities()).toEqual([]);
  });

  it.each([
    [{ name: '' }, /Name is required/],
    [{ type: 'Mortgage' as LiabilityInput['type'] }, /Choose a type/],
    [{ ownerId: '' }, /Choose who owes this/],
    [{ currentOutstanding: -5 }, /cannot be negative/],
  ])('rejects invalid input %#', async (o, message) => {
    await expect(createLiability(loan(o))).rejects.toThrow(message);
    expect(await listLiabilities()).toEqual([]);
  });

  it('requires the owner to be a family member', async () => {
    await expect(createLiability(loan({ ownerId: 'ghost' }))).rejects.toThrow(/Owner not found/);
    expect(await listLiabilities()).toEqual([]);
  });

  it('persists across a database reopen', async () => {
    await createLiability(loan());
    await closeDb();
    expect(await listLiabilities()).toHaveLength(1);
  });
});
