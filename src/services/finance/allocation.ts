import { familyOwnedValueOf, sharesByAsset } from './netWorth';

/**
 * Allocation breakdowns for the dashboard (spec §11, §22). Pure functions.
 * All values are family-owned values: asset value × the family's ownership share,
 * so they always reconcile with calculateTotalAssets.
 */

type Liquidity = 'liquid' | 'semi-liquid' | 'illiquid';
type AllocAsset = { id: string; name: string; assetClass: string; liquidity: Liquidity; currentValue: number };
type Ownership = { assetId: string; familyMemberId: string; percentage: number };

export type Slice<K extends string = string> = { key: K; value: number; percentage: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

const ownershipIndex = sharesByAsset;
const familyValue = (asset: { currentValue: number }, owners: Ownership[]) => familyOwnedValueOf(asset.currentValue, owners);

/** The family-owned value of one asset (value × total family share, capped at 100%). */
export function calculateFamilyOwnedValue(asset: { id: string; currentValue: number }, ownerships: Ownership[]): number {
  return round2(familyValue(asset, ownerships.filter((o) => o.assetId === asset.id)));
}

/** Groups values by key, adds percentages of the total, largest first. Zero-value groups are dropped. */
function toSlices<K extends string>(entries: [K, number][]): Slice<K>[] {
  const totals = new Map<K, number>();
  for (const [key, value] of entries) totals.set(key, (totals.get(key) ?? 0) + value);
  const total = [...totals.values()].reduce((s, v) => s + v, 0);
  return [...totals.entries()]
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({ key, value: round2(value), percentage: total > 0 ? (value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
}

/** Family-owned value per asset class, with % of total assets. */
export function calculateAssetAllocation(assets: AllocAsset[], ownerships: Ownership[]): Slice[] {
  const byAsset = ownershipIndex(ownerships);
  return toSlices(assets.map((a) => [a.assetClass, familyValue(a, byAsset.get(a.id) ?? [])]));
}

/** Family-owned value per liquidity level, always in Liquid → Semi-liquid → Illiquid order. */
export function calculateLiquidityBreakdown(assets: AllocAsset[], ownerships: Ownership[]): Slice<Liquidity>[] {
  const byAsset = ownershipIndex(ownerships);
  const order: Liquidity[] = ['liquid', 'semi-liquid', 'illiquid'];
  return toSlices(assets.map((a) => [a.liquidity, familyValue(a, byAsset.get(a.id) ?? [])] as [Liquidity, number])).sort(
    (a, b) => order.indexOf(a.key) - order.indexOf(b.key),
  );
}

/** For one member: the value they own in each asset class. */
export function calculateMemberAllocation(memberId: string, assets: AllocAsset[], ownerships: Ownership[]): Slice[] {
  const valueById = new Map(assets.map((a) => [a.id, a]));
  const entries: [string, number][] = [];
  for (const o of ownerships) {
    if (o.familyMemberId !== memberId) continue;
    const asset = valueById.get(o.assetId);
    if (asset) entries.push([asset.assetClass, (asset.currentValue * o.percentage) / 100]);
  }
  return toSlices(entries);
}

export type RankedAsset<A> = { asset: A; familyValue: number; percentage: number };

/** The largest assets by family-owned value, with each one's % of total assets. */
export function calculateTopAssets<A extends AllocAsset>(assets: A[], ownerships: Ownership[], limit = 5): RankedAsset<A>[] {
  const byAsset = ownershipIndex(ownerships);
  const ranked = assets
    .map((asset) => ({ asset, familyValue: round2(familyValue(asset, byAsset.get(asset.id) ?? [])) }))
    .filter((r) => r.familyValue > 0);
  const total = ranked.reduce((s, r) => s + r.familyValue, 0);
  return ranked
    .sort((a, b) => b.familyValue - a.familyValue || a.asset.name.localeCompare(b.asset.name))
    .slice(0, limit)
    .map((r) => ({ ...r, percentage: total > 0 ? (r.familyValue / total) * 100 : 0 }));
}
