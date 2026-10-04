import { projectContributionByYear, sumYearRows, type DatedContribution, type SIPYearRow } from './sip';

type RatedContribution = DatedContribution & { id: string; linkedAssetId?: string; expectedReturn?: number };
type RatedAsset = { id: string; baseGrowthRate?: number };

export type RateSource = 'own' | 'asset' | 'none';

/**
 * The annual return a contribution grows at: its own expected return, otherwise the linked
 * asset's Base rate. With neither, it is undefined and contributions are added at 0% growth.
 */
export function resolveContributionRate(
  c: RatedContribution,
  assetsById: Map<string, RatedAsset>,
): { rate: number | undefined; source: RateSource } {
  if (c.expectedReturn !== undefined) return { rate: c.expectedReturn, source: 'own' };
  const assetRate = c.linkedAssetId ? assetsById.get(c.linkedAssetId)?.baseGrowthRate : undefined;
  if (assetRate !== undefined) return { rate: assetRate, source: 'asset' };
  return { rate: undefined, source: 'none' };
}

/** Future contributions only (from today), summed per year, each at its own rate. */
export function projectContributions<C extends RatedContribution>(
  contributions: C[],
  assetsById: Map<string, RatedAsset>,
  years: number,
  today: string,
): { rows: SIPYearRow[]; byContribution: { contribution: C; rate: number | undefined; rows: SIPYearRow[] }[] } {
  const byContribution = contributions.map((contribution) => {
    const { rate } = resolveContributionRate(contribution, assetsById);
    return { contribution, rate, rows: projectContributionByYear(contribution, rate ?? 0, years, today) };
  });
  return { rows: sumYearRows(byContribution.map((b) => b.rows), years), byContribution };
}
