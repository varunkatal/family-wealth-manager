import { resolveAssetRate, type ClassDefaults, type Scenario } from './scenarios';
import { projectContributionByYear, sumYearRows, type DatedContribution, type SIPYearRow } from './sip';

type RatedContribution = DatedContribution & { id: string; linkedAssetId?: string; expectedReturn?: number };
type RatedAsset = Parameters<typeof resolveAssetRate>[0] & { id: string };

export type ContributionRateSource = 'own' | 'asset' | 'none';

/**
 * The annual return a contribution grows at: its own expected return (in every scenario),
 * otherwise the linked asset's rate for the scenario. With neither, it is undefined and
 * contributions are added at 0% growth.
 */
export function resolveContributionRate(
  c: RatedContribution,
  assetsById: Map<string, RatedAsset>,
  scenario: Scenario = 'base',
  classDefaults: ClassDefaults = {},
): { rate: number | undefined; source: ContributionRateSource } {
  if (c.expectedReturn !== undefined) return { rate: c.expectedReturn, source: 'own' };
  const asset = c.linkedAssetId ? assetsById.get(c.linkedAssetId) : undefined;
  const assetRate = asset ? resolveAssetRate(asset, scenario, classDefaults).rate : undefined;
  if (assetRate !== undefined) return { rate: assetRate, source: 'asset' };
  return { rate: undefined, source: 'none' };
}

/** Future contributions only (from today), summed per year, each at its own rate. */
export function projectContributions<C extends RatedContribution>(
  contributions: C[],
  assetsById: Map<string, RatedAsset>,
  years: number,
  today: string,
  scenario: Scenario = 'base',
  classDefaults: ClassDefaults = {},
): { rows: SIPYearRow[]; byContribution: { contribution: C; rate: number | undefined; rows: SIPYearRow[] }[] } {
  const byContribution = contributions.map((contribution) => {
    const { rate } = resolveContributionRate(contribution, assetsById, scenario, classDefaults);
    return { contribution, rate, rows: projectContributionByYear(contribution, rate ?? 0, years, today) };
  });
  return { rows: sumYearRows(byContribution.map((b) => b.rows), years), byContribution };
}
