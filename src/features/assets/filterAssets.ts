import type { Asset, Liquidity } from '../../models/asset';

export type AssetSort = 'value-desc' | 'value-asc' | 'name' | 'updated';

export type AssetFilters = {
  search: string;
  assetClass: string; // '' = all
  liquidity: Liquidity | ''; // '' = all
  sort: AssetSort;
};

export const EMPTY_FILTERS: AssetFilters = { search: '', assetClass: '', liquidity: '', sort: 'value-desc' };

/** Search (name, category, institution, notes), filter and sort. Does not modify the input. */
export function filterAssets(assets: Asset[], f: AssetFilters): Asset[] {
  const terms = f.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const result = assets.filter((a) => {
    if (f.assetClass && a.assetClass !== f.assetClass) return false;
    if (f.liquidity && a.liquidity !== f.liquidity) return false;
    if (terms.length === 0) return true;
    const haystack = [a.name, a.assetClass, a.subcategory, a.institution, a.notes].join(' ').toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
  const compare: Record<AssetSort, (a: Asset, b: Asset) => number> = {
    'value-desc': (a, b) => b.currentValue - a.currentValue,
    'value-asc': (a, b) => a.currentValue - b.currentValue,
    name: (a, b) => a.name.localeCompare(b.name),
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  };
  return result.sort((a, b) => compare[f.sort](a, b) || a.name.localeCompare(b.name));
}

export function hasActiveFilters(f: AssetFilters): boolean {
  return f.search.trim() !== '' || f.assetClass !== '' || f.liquidity !== '';
}
