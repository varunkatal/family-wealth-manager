import type { AssetInput } from '../../models/asset';
import { buildDemoData } from '../demo/demoData';
import { createAsset, deleteAsset, listAssets, listOwnerships, updateAsset } from './assetRepository';
import { closeDb } from './db';
import { loadDemoData } from './demoRepository';
import { createFamilyMember } from './familyMemberRepository';

let A = '';
let B = '';
beforeEach(async () => {
  A = (await createFamilyMember({ name: 'Person A', relationship: '', isActive: true })).id;
  B = (await createFamilyMember({ name: 'Person B', relationship: '', isActive: true })).id;
});

const fd = (overrides: Partial<AssetInput> = {}): AssetInput => ({
  name: 'Example FD',
  assetClass: 'Fixed Income',
  subcategory: 'FD',
  valuationMethod: 'manual',
  currentValue: 500000,
  valuationDate: '2026-01-01',
  liquidity: 'semi-liquid',
  owners: [{ familyMemberId: A, percentage: 100 }],
  ...overrides,
});

describe('assetRepository', () => {
  it('creates a manually valued asset', async () => {
    const a = await createAsset(fd({ institution: '  Example Bank  ', notes: '' }));
    expect(a).toMatchObject({ name: 'Example FD', currentValue: 500000, institution: 'Example Bank' });
    expect(a.notes).toBeUndefined();
    expect(a.isDemo).toBeUndefined();
    expect(await listAssets()).toHaveLength(1);
  });

  it('calculates current value for quantity × price', async () => {
    const a = await createAsset(
      fd({ name: 'Example Gold', valuationMethod: 'quantity_x_price', quantity: 12.5, unit: 'g', unitPrice: 7123.45, currentValue: 1 }),
    );
    expect(a.currentValue).toBe(89043.13); // 12.5 × 7123.45 = 89043.125, rounded to paise
  });

  it('drops quantity fields when valued manually', async () => {
    const a = await createAsset(fd({ quantity: 5, unit: 'g', unitPrice: 100 }));
    expect(a.quantity).toBeUndefined();
    expect(a.unitPrice).toBeUndefined();
  });

  it.each([
    [{ name: '  ' }, /Asset name is required/],
    [{ assetClass: '' }, /Choose an asset class/],
    [{ currentValue: undefined }, /Current value is required/],
    [{ currentValue: -1 }, /cannot be negative/],
    [{ currentValue: Number.NaN }, /valid current value/],
    [{ valuationDate: '2999-01-01' }, /cannot be in the future/],
    [{ valuationMethod: 'quantity_x_price', quantity: undefined, unitPrice: 10 }, /Quantity is required/],
    [{ conservativeGrowthRate: 12, baseGrowthRate: 10 }, /Conservative should not exceed Base/],
    [{ baseGrowthRate: 10, optimisticGrowthRate: 8 }, /Optimistic should not be below Base/],
    [{ baseGrowthRate: 150 }, /between -100% and 100%/],
    [{ liquidity: undefined }, /Choose a liquidity level/],
  ] as [Partial<AssetInput>, RegExp][])('rejects invalid input %#', async (overrides, message) => {
    await expect(createAsset(fd(overrides))).rejects.toThrow(message);
    expect(await listAssets()).toEqual([]);
  });

  it('accepts growth rates in order, and leaves blank rates unset', async () => {
    const a = await createAsset(fd({ conservativeGrowthRate: 6, baseGrowthRate: 7, optimisticGrowthRate: 7.5 }));
    expect([a.conservativeGrowthRate, a.baseGrowthRate, a.optimisticGrowthRate]).toEqual([6, 7, 7.5]);
    const b = await createAsset(fd());
    expect(b.baseGrowthRate).toBeUndefined();
  });

  it('allows custom categories', async () => {
    const a = await createAsset(fd({ assetClass: 'Crypto', subcategory: 'Bitcoin', liquidity: 'liquid' }));
    expect(a.assetClass).toBe('Crypto');
  });

  it('updates an asset, keeping createdAt and the demo flag', async () => {
    await loadDemoData(buildDemoData());
    const demo = (await listAssets()).find((a) => a.name === 'Example FD')!;
    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateAsset(demo.id, fd({ currentValue: 600000 }));
    expect(updated.currentValue).toBe(600000);
    expect(updated.isDemo).toBe(true);
    expect(updated.createdAt).toBe(demo.createdAt);
    expect(updated.updatedAt > demo.updatedAt).toBe(true);
  });

  it('refuses to update a missing asset', async () => {
    await expect(updateAsset('missing', fd())).rejects.toThrow(/not found/);
  });

  it('deletes only the chosen asset', async () => {
    const a = await createAsset(fd({ name: 'A' }));
    const b = await createAsset(fd({ name: 'B' }));
    await deleteAsset(a.id);
    expect((await listAssets()).map((x) => x.id)).toEqual([b.id]);
  });

  it('persists across a database reopen (refresh)', async () => {
    await createAsset(fd());
    await closeDb();
    expect((await listAssets()).map((a) => a.name)).toEqual(['Example FD']);
  });
});

describe('asset ownership', () => {
  const fdWith = (owners: AssetInput['owners']): AssetInput => ({
    name: 'Example FD',
    assetClass: 'Fixed Income',
    valuationMethod: 'manual',
    currentValue: 1000000,
    valuationDate: '2026-01-01',
    liquidity: 'semi-liquid',
    owners,
  });

  it('stores one ownership record per owner', async () => {
    const asset = await createAsset(fdWith([{ familyMemberId: A, percentage: 60 }, { familyMemberId: B, percentage: 40 }]));
    const owners = await listOwnerships();
    expect(owners.map(({ assetId, familyMemberId, percentage }) => ({ assetId, familyMemberId, percentage }))).toEqual(
      expect.arrayContaining([
        { assetId: asset.id, familyMemberId: A, percentage: 60 },
        { assetId: asset.id, familyMemberId: B, percentage: 40 },
      ]),
    );
    expect(new Set(owners.map((o) => o.id)).size).toBe(2);
  });

  it('allows shares below 100% (rest owned outside the family)', async () => {
    await createAsset(fdWith([{ familyMemberId: A, percentage: 50 }]));
    expect((await listOwnerships())[0]!.percentage).toBe(50);
  });

  it.each([
    [[], /Add at least one owner/],
    [[{ familyMemberId: '', percentage: 100 }], /Choose a family member/],
    [[{ familyMemberId: 'A', percentage: 0 }], /more than 0%/],
    [[{ familyMemberId: 'A', percentage: 70 }, { familyMemberId: 'B', percentage: 40 }], /110%, which is more than 100%/],
    [[{ familyMemberId: 'A', percentage: 50 }, { familyMemberId: 'A', percentage: 50 }], /only be listed once/],
  ])('rejects invalid owners %#', async (owners, message) => {
    const resolved = owners.map((o) => ({ ...o, familyMemberId: o.familyMemberId === 'A' ? A : o.familyMemberId === 'B' ? B : o.familyMemberId }));
    await expect(createAsset(fdWith(resolved))).rejects.toThrow(message);
    expect(await listAssets()).toEqual([]);
  });

  it('accepts thirds that add to 100% with rounding', async () => {
    const C = (await createFamilyMember({ name: 'Person C', relationship: '', isActive: true })).id;
    await createAsset(
      fdWith([
        { familyMemberId: A, percentage: 33.33 },
        { familyMemberId: B, percentage: 33.33 },
        { familyMemberId: C, percentage: 33.34 },
      ]),
    );
    expect(await listOwnerships()).toHaveLength(3);
  });

  it('rejects an owner who is not a family member, saving nothing', async () => {
    await expect(createAsset(fdWith([{ familyMemberId: 'ghost', percentage: 100 }]))).rejects.toThrow(/Owner not found/);
    expect(await listAssets()).toEqual([]);
    expect(await listOwnerships()).toEqual([]);
  });

  it('replaces owners on update', async () => {
    const asset = await createAsset(fdWith([{ familyMemberId: A, percentage: 100 }]));
    await updateAsset(asset.id, fdWith([{ familyMemberId: B, percentage: 100 }]));
    const owners = await listOwnerships();
    expect(owners).toHaveLength(1);
    expect(owners[0]!.familyMemberId).toBe(B);
  });

  it('keeps the old owners if an update fails', async () => {
    const asset = await createAsset(fdWith([{ familyMemberId: A, percentage: 100 }]));
    await expect(updateAsset(asset.id, fdWith([{ familyMemberId: 'ghost', percentage: 100 }]))).rejects.toThrow();
    expect((await listOwnerships()).map((o) => o.familyMemberId)).toEqual([A]);
  });

  it('deletes ownership records with the asset', async () => {
    const keep = await createAsset(fdWith([{ familyMemberId: A, percentage: 100 }]));
    const gone = await createAsset(fdWith([{ familyMemberId: A, percentage: 50 }, { familyMemberId: B, percentage: 50 }]));
    await deleteAsset(gone.id);
    expect((await listOwnerships()).map((o) => o.assetId)).toEqual([keep.id]);
  });
});
