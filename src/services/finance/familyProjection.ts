import { calculateFamilyOwnedValue } from './allocation';
import { projectContributions } from './contributionProjection';
import { projectTotalDebtByYear, type LoanTerms } from './loans';
import { projectByYear } from './projection';
import { resolveAssetRate, type ClassDefaults, type RateSource, type Scenario } from './scenarios';
import type { SIPYearRow } from './sip';
import { roundToPaise } from './rounding';

type ProjAsset = Parameters<typeof resolveAssetRate>[0] & { id: string; name: string; currentValue: number };
type ProjContribution = Parameters<typeof projectContributions>[0][number];
type Ownership = { assetId: string; familyMemberId: string; percentage: number };

export type FamilyProjectionInput<A extends ProjAsset, C extends ProjContribution> = {
  assets: A[];
  ownerships: Ownership[];
  contributions: C[];
  liabilities: LoanTerms[];
  classDefaults: ClassDefaults;
  today: string;
};

export type ProjectedAsset<A> = {
  asset: A;
  /** Family-owned value today. */
  today: number;
  rate: number | undefined;
  source: RateSource;
  /** Value at the end of each year, 0 = today. */
  values: number[];
};

export type FamilyProjection<A, C> = {
  scenario: Scenario;
  years: number;
  assets: ProjectedAsset<A>[];
  contributions: { contribution: C; rate: number | undefined; rows: SIPYearRow[] }[];
  /** Existing assets per year. */
  assetTotals: number[];
  /** Future contributions per year (value and amount invested). */
  contributionTotals: SIPYearRow[];
  /** Existing assets + future contributions per year. */
  totalAssets: number[];
  debt: number[];
  netWorth: number[];
};


/**
 * Projects family wealth under one scenario: each family-owned asset compounds at its own
 * scenario rate, future contributions are added at theirs, and loans follow their schedules.
 * The totals are sums of the individual projections, so they always reconcile.
 */
export function projectFamilyWealth<A extends ProjAsset, C extends ProjContribution>(
  input: FamilyProjectionInput<A, C>,
  scenario: Scenario,
  years: number,
): FamilyProjection<A, C> {
  const assets = input.assets
    .map((asset) => {
      const today = calculateFamilyOwnedValue(asset, input.ownerships);
      const { rate, source } = resolveAssetRate(asset, scenario, input.classDefaults);
      return { asset, today, rate, source, values: projectByYear(today, rate ?? 0, years).map((r) => r.value) };
    })
    .filter((a) => a.today > 0);
  const assetsById = new Map(input.assets.map((a) => [a.id, a]));
  const contributed = projectContributions(input.contributions, assetsById, years, input.today, scenario, input.classDefaults);
  const assetTotals = Array.from({ length: years + 1 }, (_, y) => roundToPaise(assets.reduce((s, a) => s + a.values[y]!, 0)));
  const totalAssets = assetTotals.map((v, y) => roundToPaise(v + contributed.rows[y]!.value));
  const debt = projectTotalDebtByYear(input.liabilities, years);
  return {
    scenario,
    years,
    assets,
    contributions: contributed.byContribution,
    assetTotals,
    contributionTotals: contributed.rows,
    totalAssets,
    debt,
    netWorth: totalAssets.map((v, y) => roundToPaise(v - debt[y]!)),
  };
}
