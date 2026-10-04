import type { Asset } from '../../models/asset';
import { EMPTY_FILTERS, filterAssets, hasActiveFilters } from './filterAssets';

const asset = (o: Partial<Asset>): Asset => ({
  id: o.name ?? 'x',
  name: 'x',
  assetClass: 'Equity',
  valuationMethod: 'manual',
  currentValue: 0,
  valuationDate: '2026-01-01',
  liquidity: 'liquid',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...o,
});

const assets = [
  asset({ name: 'Example Equity Fund', subcategory: 'Equity Mutual Funds', institution: 'Example AMC', currentValue: 500000 }),
  asset({ name: 'Example FD', assetClass: 'Fixed Income', subcategory: 'FD', institution: 'Example Bank', liquidity: 'semi-liquid', currentValue: 300000, updatedAt: '2026-03-01T00:00:00.000Z' }),
  asset({ name: 'Example Property', assetClass: 'Real Estate', liquidity: 'illiquid', currentValue: 2500000, notes: 'Rented out' }),
];
const names = (list: Asset[]) => list.map((a) => a.name);

describe('filterAssets', () => {
  it('sorts by value (highest first) by default', () => {
    expect(names(filterAssets(assets, EMPTY_FILTERS))).toEqual(['Example Property', 'Example Equity Fund', 'Example FD']);
  });

  it('searches name, category, institution and notes, case-insensitively', () => {
    expect(names(filterAssets(assets, { ...EMPTY_FILTERS, search: 'BANK' }))).toEqual(['Example FD']);
    expect(names(filterAssets(assets, { ...EMPTY_FILTERS, search: 'mutual' }))).toEqual(['Example Equity Fund']);
    expect(names(filterAssets(assets, { ...EMPTY_FILTERS, search: 'rented' }))).toEqual(['Example Property']);
    expect(names(filterAssets(assets, { ...EMPTY_FILTERS, search: 'example fd' }))).toEqual(['Example FD']);
  });

  it('filters by class and liquidity', () => {
    expect(names(filterAssets(assets, { ...EMPTY_FILTERS, assetClass: 'Real Estate' }))).toEqual(['Example Property']);
    expect(names(filterAssets(assets, { ...EMPTY_FILTERS, liquidity: 'semi-liquid' }))).toEqual(['Example FD']);
    expect(filterAssets(assets, { ...EMPTY_FILTERS, assetClass: 'Equity', liquidity: 'illiquid' })).toEqual([]);
  });

  it('supports other sort orders without changing the input', () => {
    const copy = [...assets];
    expect(names(filterAssets(assets, { ...EMPTY_FILTERS, sort: 'name' }))[0]).toBe('Example Equity Fund');
    expect(names(filterAssets(assets, { ...EMPTY_FILTERS, sort: 'value-asc' }))[0]).toBe('Example FD');
    expect(names(filterAssets(assets, { ...EMPTY_FILTERS, sort: 'updated' }))[0]).toBe('Example FD');
    expect(assets).toEqual(copy);
  });

  it('reports whether filters are active', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, sort: 'name' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: 'x' })).toBe(true);
  });
});
