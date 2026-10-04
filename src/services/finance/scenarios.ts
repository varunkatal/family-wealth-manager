/**
 * Scenarios and inflation (spec §15, §22). Pure functions.
 */

export const SCENARIOS = ['conservative', 'base', 'optimistic'] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const SCENARIO_LABELS: Record<Scenario, string> = {
  conservative: 'Conservative',
  base: 'Base',
  optimistic: 'Optimistic',
};

type ScenarioRates = { conservative?: number; base?: number; optimistic?: number };
export type ClassDefaults = Record<string, ScenarioRates>;

type RatedAsset = {
  assetClass: string;
  conservativeGrowthRate?: number;
  baseGrowthRate?: number;
  optimisticGrowthRate?: number;
};

export type RateSource = 'asset' | 'default' | 'none';

const ASSET_RATE_FIELD = {
  conservative: 'conservativeGrowthRate',
  base: 'baseGrowthRate',
  optimistic: 'optimisticGrowthRate',
} as const;

/**
 * An asset's growth % under a scenario: its own rate, else the Settings default for its
 * class, else none (the asset is then held at today's value and flagged).
 */
export function resolveAssetRate(
  asset: RatedAsset,
  scenario: Scenario,
  classDefaults: ClassDefaults = {},
): { rate: number | undefined; source: RateSource } {
  const own = asset[ASSET_RATE_FIELD[scenario]];
  if (own !== undefined) return { rate: own, source: 'asset' };
  const fallback = classDefaults[asset.assetClass]?.[scenario];
  if (fallback !== undefined) return { rate: fallback, source: 'default' };
  return { rate: undefined, source: 'none' };
}

/** Real FV = Nominal FV / (1 + inflation)^n: what a future amount is worth in today's money. */
export function calculateInflationAdjustedValue(nominal: number, inflationPct: number, years: number): number {
  return Math.round((nominal / (1 + inflationPct / 100) ** years) * 100) / 100;
}
