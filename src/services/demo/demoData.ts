import type { AssetInput } from '../../models/asset';
import type { FamilyMemberInput } from '../../models/familyMember';
import type { LiabilityInput } from '../../models/liability';
import { todayISODate } from '../../utils/date';

/**
 * Clearly fake sample data for trying out the app (CLAUDE.md "Demo data").
 * Owners refer to members by key ('A' / 'B'); real IDs are assigned when loaded.
 * Growth rates are left blank on purpose; this app never invents financial assumptions.
 */
export type DemoData = {
  members: Record<'A' | 'B', FamilyMemberInput>;
  assets: (Omit<AssetInput, 'owners'> & { owners: { member: 'A' | 'B'; percentage: number }[] })[];
  liabilities: (Omit<LiabilityInput, 'ownerId'> & { owner: 'A' | 'B' })[];
  /** Fake past snapshots, so the history chart has something to show. */
  snapshots: { monthsAgo: number; totalAssets: number; totalLiabilities: number }[];
};

export function buildDemoData(): DemoData {
  const today = todayISODate();
  return {
    members: {
      A: { name: 'Person A', relationship: 'Self', isActive: true, notes: 'Demo data' },
      B: { name: 'Person B', relationship: 'Spouse', isActive: true, notes: 'Demo data' },
    },
    assets: [
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
        owners: [
          { member: 'A', percentage: 50 },
          { member: 'B', percentage: 50 },
        ],
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
        owners: [{ member: 'A', percentage: 100 }],
      },
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
        owners: [{ member: 'B', percentage: 100 }],
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
        owners: [
          { member: 'A', percentage: 60 },
          { member: 'B', percentage: 40 },
        ],
      },
    ],
    liabilities: [{ name: 'Example Home Loan', type: 'Home Loan', currentOutstanding: 200000, notes: 'Demo data', owner: 'A' }],
    snapshots: [
      { monthsAgo: 6, totalAssets: 4000000, totalLiabilities: 300000 },
      { monthsAgo: 5, totalAssets: 4100000, totalLiabilities: 280000 },
      { monthsAgo: 4, totalAssets: 4050000, totalLiabilities: 260000 },
      { monthsAgo: 3, totalAssets: 4250000, totalLiabilities: 240000 },
      { monthsAgo: 2, totalAssets: 4300000, totalLiabilities: 220000 },
      { monthsAgo: 1, totalAssets: 4400000, totalLiabilities: 210000 },
    ],
  };
}
