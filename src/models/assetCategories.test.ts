import { DEFAULT_ASSET_CATEGORIES, getAssetClassOptions, getSubcategoryOptions } from './assetCategories';

describe('asset categories', () => {
  it('includes every default class from the spec', () => {
    expect(DEFAULT_ASSET_CATEGORIES.map((c) => c.assetClass)).toEqual([
      'Equity',
      'Fixed Income',
      'Precious Metals',
      'Real Estate',
      'Cash',
      'Other',
    ]);
  });

  it('adds custom classes and subcategories from existing assets', () => {
    const assets = [
      { assetClass: 'Crypto', subcategory: 'Bitcoin' },
      { assetClass: 'Equity', subcategory: 'Unlisted Shares' },
      { assetClass: 'Equity', subcategory: 'ETFs' },
    ];
    expect(getAssetClassOptions(assets).at(-1)).toBe('Crypto');
    expect(getSubcategoryOptions('Equity', assets)).toEqual([
      'Direct Stocks',
      'Equity Mutual Funds',
      'Index Funds',
      'ETFs',
      'Unlisted Shares',
    ]);
    expect(getSubcategoryOptions('Crypto', assets)).toEqual(['Bitcoin']);
  });
});
