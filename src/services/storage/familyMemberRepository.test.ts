import { closeDb, getDb } from './db';
import {
  createFamilyMember,
  deleteFamilyMember,
  listFamilyMembers,
  updateFamilyMember,
} from './familyMemberRepository';

const base = { relationship: '', isActive: true };

describe('familyMemberRepository', () => {
  it('starts empty', async () => {
    expect(await listFamilyMembers()).toEqual([]);
  });

  it('creates members with unique IDs and timestamps', async () => {
    const a = await createFamilyMember({ ...base, name: 'Person A' });
    const b = await createFamilyMember({ ...base, name: 'Person B' });
    expect(a.id).not.toBe(b.id);
    expect(a.createdAt).toBe(a.updatedAt);
    expect((await listFamilyMembers()).map((m) => m.name)).toEqual(['Person A', 'Person B']);
  });

  it('trims input and drops empty optional fields', async () => {
    const m = await createFamilyMember({ ...base, name: '  Person A  ', dateOfBirth: '', notes: '   ' });
    expect(m.name).toBe('Person A');
    expect(m.dateOfBirth).toBeUndefined();
    expect(m.notes).toBeUndefined();
  });

  it('requires a name', async () => {
    await expect(createFamilyMember({ ...base, name: '   ' })).rejects.toThrow(/Name is required/);
    expect(await listFamilyMembers()).toEqual([]);
  });

  it('rejects a future date of birth', async () => {
    await expect(createFamilyMember({ ...base, name: 'Person A', dateOfBirth: '2999-01-01' })).rejects.toThrow(
      /future/,
    );
  });

  it('never overwrites an existing ID on create', async () => {
    const a = await createFamilyMember({ ...base, name: 'Person A' });
    const db = await getDb();
    await expect(db.add('familyMembers', { ...a, name: 'Impostor' })).rejects.toThrow();
    expect((await listFamilyMembers())[0]?.name).toBe('Person A');
  });

  it('updates fields, keeps createdAt and bumps updatedAt', async () => {
    const a = await createFamilyMember({ ...base, name: 'Person A' });
    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateFamilyMember(a.id, { ...base, name: 'Person A (edited)', isActive: false });
    expect(updated.id).toBe(a.id);
    expect(updated.createdAt).toBe(a.createdAt);
    expect(updated.updatedAt > a.updatedAt).toBe(true);
    expect(updated.isActive).toBe(false);
  });

  it('refuses to update a member that does not exist', async () => {
    await expect(updateFamilyMember('missing', { ...base, name: 'X' })).rejects.toThrow(/not found/);
    expect(await listFamilyMembers()).toEqual([]);
  });

  it('deletes only the chosen member', async () => {
    const a = await createFamilyMember({ ...base, name: 'Person A' });
    const b = await createFamilyMember({ ...base, name: 'Person B' });
    await deleteFamilyMember(b.id);
    expect((await listFamilyMembers()).map((m) => m.id)).toEqual([a.id]);
  });

  it('persists across a database reopen (refresh)', async () => {
    await createFamilyMember({ ...base, name: 'Person A' });
    await closeDb();
    expect((await listFamilyMembers()).map((m) => m.name)).toEqual(['Person A']);
  });

  it('lists active members before inactive ones', async () => {
    await createFamilyMember({ ...base, name: 'Inactive', isActive: false });
    await createFamilyMember({ ...base, name: 'Active' });
    expect((await listFamilyMembers()).map((m) => m.name)).toEqual(['Active', 'Inactive']);
  });
});

describe('deleting a member who owns things', () => {
  it('is refused while they own an asset share or a liability, and allowed once reassigned', async () => {
    const { createAsset, deleteAsset } = await import('./assetRepository');
    const { createLiability, deleteLiability } = await import('./liabilityRepository');
    const { MemberHasHoldingsError, countMemberHoldings } = await import('./familyMemberRepository');
    const a = await createFamilyMember({ ...base, name: 'Person A' });
    const asset = await createAsset({
      name: 'Example FD',
      assetClass: 'Fixed Income',
      valuationMethod: 'manual',
      currentValue: 100,
      valuationDate: '2026-01-01',
      liquidity: 'liquid',
      owners: [{ familyMemberId: a.id, percentage: 100 }],
    });
    const loan = await createLiability({ name: 'Loan', type: 'Other', ownerId: a.id, currentOutstanding: 50 });
    const { createContribution, deleteContribution } = await import('./contributionRepository');
    const sip = await createContribution({ name: 'SIP', ownerId: a.id, amount: 1000, frequency: 'monthly', startDate: '2026-01-01' });

    expect(await countMemberHoldings(a.id)).toEqual({ assets: 1, liabilities: 1, contributions: 1 });
    const err = await deleteFamilyMember(a.id).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MemberHasHoldingsError);
    expect(err).toMatchObject({ holdings: { assets: 1, liabilities: 1, contributions: 1 } });
    expect(await listFamilyMembers()).toHaveLength(1);

    await deleteAsset(asset.id);
    await deleteLiability(loan.id);
    await expect(deleteFamilyMember(a.id)).rejects.toBeInstanceOf(MemberHasHoldingsError);
    await deleteContribution(sip.id);
    await deleteFamilyMember(a.id);
    expect(await listFamilyMembers()).toEqual([]);
  });

  it('keeps the demo flag when a demo member is edited', async () => {
    const { loadDemoData } = await import('./demoRepository');
    const { buildDemoData } = await import('../demo/demoData');
    await loadDemoData(buildDemoData());
    const demo = (await listFamilyMembers())[0]!;
    const updated = await updateFamilyMember(demo.id, { ...base, name: 'Renamed' });
    expect(updated.isDemo).toBe(true);
  });
});
