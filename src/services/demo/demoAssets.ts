import type { AssetInput } from '../../models/asset';
import { todayISODate } from '../../utils/date';

/**
 * Clearly fake sample assets for trying out the app (see CLAUDE.md "Demo data").
 * Growth rates are left blank on purpose; this app never invents financial assumptions.
 */
export function buildDemoAssets(): AssetInput[] {
  const today = todayISODate();
  return [
    {
      name: 'Example Equity Fund',
      assetClass: 'Equity',
      subcategory: 'Equity Mutual Funds',
      institution: 'Example AMC',
      valuationMethod: 'manual',
      purchaseValue: 400000,
      currentValue: 500000,
      valuationDate: today,
      liquidity: 'liquid',
      notes: 'Demo data',
    },
    {
      name: 'Example Property',
      assetClass: 'Real Estate',
      subcategory: 'Residential Property',
      valuationMethod: 'manual',
      purchaseValue: 2000000,
      currentValue: 2500000,
      valuationDate: today,
      liquidity: 'illiquid',
      notes: 'Demo data',
    },
    {
      name: 'Example Gold',
      assetClass: 'Precious Metals',
      subcategory: 'Physical Gold',
      valuationMethod: 'quantity_x_price',
      quantity: 100,
      unit: 'g',
      unitPrice: 10000,
      valuationDate: today,
      liquidity: 'semi-liquid',
      notes: 'Demo data',
    },
    {
      name: 'Example FD',
      assetClass: 'Fixed Income',
      subcategory: 'FD',
      institution: 'Example Bank',
      valuationMethod: 'manual',
      purchaseValue: 500000,
      currentValue: 500000,
      valuationDate: today,
      liquidity: 'semi-liquid',
      notes: 'Demo data',
    },
  ];
}
