import { buildDemoData } from '../demo/demoData';
import { createAsset, deleteAsset, listAssets } from './assetRepository';
import {
  createContribution,
  deleteContribution,
  listContributions,
  updateContribution,
} from './contributionRepository';
import { clearDemoData, loadDemoData } from './demoRepository';
import { createFamilyMember, listFamilyMembers } from './familyMemberRepository';

let A = '';
beforeEach(async () => {
  A = (await createFamilyMember({ name: 'Person A', relationship: 'Self', isActive: true })).id;
});

const fund = () =>
  createAsset({
    name: 'Example Equity Fund',
    assetClass: 'Equity',
    valuationMethod: 'manual',
    currentValue: 500000,
    valuationDate: '2026-01-01',
    liquidity: 'liquid',
    owners: [{ familyMemberId: A, percentage: 100 }],
  });

const sip = (o: Record<string, unknown> = {}) => ({
  name: 'Example SIP',
  ownerId: A,
  amount: 10000,
  frequency: 'monthly' as const,
  startDate: '2026-01-01',
  ...o,
});

describe('contribution repository', () => {
  it('creates, updates and deletes, persisting across reads', async () => {
    const asset = await fund();
    const c = await createContribution(sip({ linkedAssetId: asset.id, expectedReturn: 12, annualIncrease: 10, endDate: '' }));
    expect(c).toMatchObject({ amount: 10000, linkedAssetId: asset.id, expectedReturn: 12, annualIncrease: 10 });
    expect(c.endDate).toBeUndefined();

    await updateContribution(c.id, sip({ amount: 15000, frequency: 'quarterly' }));
    const [stored] = await listContributions();
    expect(stored).toMatchObject({ amount: 15000, frequency: 'quarterly', createdAt: c.createdAt });
    expect(stored!.linkedAssetId).toBeUndefined();

    await deleteContribution(c.id);
    expect(await listContributions()).toEqual([]);
  });

  it('validates input', async () => {
    await expect(createContribution(sip({ amount: 0 }))).rejects.toThrow('Amount must be more than 0');
    await expect(createContribution(sip({ endDate: '2025-01-01' }))).rejects.toThrow('End date must be on or after');
    await expect(createContribution(sip({ ownerId: 'missing' }))).rejects.toThrow('Owner not found');
    await expect(createContribution(sip({ linkedAssetId: 'missing' }))).rejects.toThrow('Linked asset not found');
    await expect(createContribution(sip({ annualIncrease: -5 }))).rejects.toThrow('cannot be negative');
    expect(await listContributions()).toEqual([]);
  });

  it('deleting an asset keeps its contributions but unlinks them', async () => {
    const asset = await fund();
    await createContribution(sip({ linkedAssetId: asset.id }));
    await deleteAsset(asset.id);
    const [c] = await listContributions();
    expect(c!.name).toBe('Example SIP');
    expect(c!.linkedAssetId).toBeUndefined();
  });

  it('clearing demo data keeps the user’s contributions and the demo member who makes them', async () => {
    await loadDemoData(buildDemoData());
    const personB = (await listFamilyMembers()).find((m) => m.name === 'Person B' && m.isDemo)!;
    const demoFund = (await listAssets()).find((a) => a.name === 'Example Equity Fund')!;
    await createContribution(sip({ ownerId: personB.id, linkedAssetId: demoFund.id }));

    const result = await clearDemoData();
    expect(result.keptMembers).toEqual(['Person B']);
    const [c] = await listContributions();
    expect(c!.ownerId).toBe(personB.id);
    expect(c!.linkedAssetId).toBeUndefined();
  });
});
