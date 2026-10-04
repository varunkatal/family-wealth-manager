/** Default asset classes and their subcategories. Users can add their own. */
export const DEFAULT_ASSET_CATEGORIES: { assetClass: string; subcategories: string[] }[] = [
  { assetClass: 'Equity', subcategories: ['Direct Stocks', 'Equity Mutual Funds', 'Index Funds', 'ETFs'] },
  {
    assetClass: 'Fixed Income',
    subcategories: ['FD', 'RD', 'PPF', 'EPF', 'NPS', 'SCSS', 'Post Office', 'Bonds', 'Debt Mutual Funds'],
  },
  { assetClass: 'Precious Metals', subcategories: ['Physical Gold', 'Gold ETF', 'Physical Silver', 'Silver ETF'] },
  {
    assetClass: 'Real Estate',
    subcategories: [
      'Residential Property',
      'Agricultural Land',
      'Plot',
      'Commercial Property',
      'Shop',
      'Rental Property',
    ],
  },
  { assetClass: 'Cash', subcategories: ['Savings Account', 'Current Account', 'Cash'] },
  { assetClass: 'Other', subcategories: ['Business', 'Vehicle', 'Insurance', 'Other'] },
];

type Categorised = { assetClass: string; subcategory?: string };

const sortedUnique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

/** Default classes in their standard order, followed by custom classes used by existing assets. */
export function getAssetClassOptions(assets: Categorised[]): string[] {
  const defaults = DEFAULT_ASSET_CATEGORIES.map((c) => c.assetClass);
  const custom = assets.map((a) => a.assetClass).filter((c) => !defaults.includes(c));
  return [...defaults, ...sortedUnique(custom)];
}

/** Default subcategories for a class, followed by custom ones used by existing assets of that class. */
export function getSubcategoryOptions(assetClass: string, assets: Categorised[]): string[] {
  const defaults = DEFAULT_ASSET_CATEGORIES.find((c) => c.assetClass === assetClass)?.subcategories ?? [];
  const custom = assets
    .filter((a) => a.assetClass === assetClass && a.subcategory && !defaults.includes(a.subcategory))
    .map((a) => a.subcategory as string);
  return [...defaults, ...sortedUnique(custom)];
}
