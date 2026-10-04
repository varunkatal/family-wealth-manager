import type { AssetInput } from '../../models/asset';
import { buildDemoAssets } from '../demo/demoAssets';
import {
  addDemoAssets,
  createAsset,
  deleteAsset,
  deleteDemoAssets,
  listAssets,
  updateAsset,
} from './assetRepository';
import { closeDb } from './db';

const fd = (overrides: Partial<AssetInput> = {}): AssetInput => ({
  name: 'Example FD',
  assetClass: 'Fixed Income',
  subcategory: 'FD',
  valuationMethod: 'manual',
  currentValue: 500000,
  valuationDate: '2026-01-01',
  liquidity: 'semi-liquid',
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
    const [demo] = await addDemoAssets([fd()]);
    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateAsset(demo!.id, fd({ currentValue: 600000 }));
    expect(updated.currentValue).toBe(600000);
    expect(updated.isDemo).toBe(true);
    expect(updated.createdAt).toBe(demo!.createdAt);
    expect(updated.updatedAt > demo!.updatedAt).toBe(true);
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

  it('loads demo assets marked as demo, and clearing removes only those', async () => {
    const mine = await createAsset(fd({ name: 'My asset' }));
    const demo = await addDemoAssets(buildDemoAssets());
    expect(demo.every((a) => a.isDemo)).toBe(true);
    expect(demo.every((a) => a.name.startsWith('Example'))).toBe(true);
    expect(await listAssets()).toHaveLength(demo.length + 1);

    expect(await deleteDemoAssets()).toBe(demo.length);
    expect((await listAssets()).map((a) => a.id)).toEqual([mine.id]);
  });

  it('persists across a database reopen (refresh)', async () => {
    await createAsset(fd());
    await closeDb();
    expect((await listAssets()).map((a) => a.name)).toEqual(['Example FD']);
  });
});
