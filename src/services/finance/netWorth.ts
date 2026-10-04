/**
 * Ownership and net worth engine (spec §10, §22). Pure functions, no React or storage.
 *
 * Rules:
 * - An asset's family-owned value = current value × (sum of its owners' shares) / 100.
 *   Shares can total less than 100% when part of the asset is owned outside the family.
 * - Each owner is attributed value × their share, so an asset is never counted twice.
 * - An asset with no owners has a 0% family share: it is not counted, and is reported
 *   separately so the user can assign owners.
 */

type ValuedAsset = { id: string; currentValue: number };
type Ownership = { assetId: string; familyMemberId: string; percentage: number };
type OwedLiability = { ownerId: string; currentOutstanding: number };

const roundToPaise = (n: number) => Math.round(n * 100) / 100;

/** Value attributed to one owner: asset value × share %. */
export function calculateOwnershipValue(assetValue: number, percentage: number): number {
  return roundToPaise((assetValue * percentage) / 100);
}

function sharesByAsset(ownerships: Ownership[]): Map<string, Ownership[]> {
  const map = new Map<string, Ownership[]>();
  for (const o of ownerships) {
    const list = map.get(o.assetId);
    if (list) list.push(o);
    else map.set(o.assetId, [o]);
  }
  return map;
}

/** Family share of an asset in %, capped at 100. */
export function calculateFamilySharePercentage(assetId: string, ownerships: Ownership[]): number {
  const total = ownerships.filter((o) => o.assetId === assetId).reduce((sum, o) => sum + o.percentage, 0);
  return Math.min(total, 100);
}

/** Total Assets = sum of all family-owned asset values. */
export function calculateTotalAssets(assets: ValuedAsset[], ownerships: Ownership[]): number {
  const byAsset = sharesByAsset(ownerships);
  let total = 0;
  for (const asset of assets) {
    const share = Math.min((byAsset.get(asset.id) ?? []).reduce((sum, o) => sum + o.percentage, 0), 100);
    total += (asset.currentValue * share) / 100;
  }
  return roundToPaise(total);
}

/** Total Liabilities = sum of all outstanding liabilities. */
export function calculateTotalLiabilities(liabilities: OwedLiability[]): number {
  return roundToPaise(liabilities.reduce((sum, l) => sum + l.currentOutstanding, 0));
}

/** Net Worth = Total Assets − Total Liabilities. */
export function calculateNetWorth(totalAssets: number, totalLiabilities: number): number {
  return roundToPaise(totalAssets - totalLiabilities);
}

/** Assets with no owners. They are excluded from totals until owners are assigned. */
export function findUnownedAssets<A extends ValuedAsset>(assets: A[], ownerships: Ownership[]): A[] {
  const owned = new Set(ownerships.map((o) => o.assetId));
  return assets.filter((a) => !owned.has(a.id));
}

export type MemberWealth = {
  memberId: string;
  assets: number;
  liabilities: number;
  netWorth: number;
};

/** Each member's attributed assets, liabilities and net worth. */
export function calculateMemberWealth(
  memberIds: string[],
  assets: ValuedAsset[],
  ownerships: Ownership[],
  liabilities: OwedLiability[],
): MemberWealth[] {
  const valueById = new Map(assets.map((a) => [a.id, a.currentValue]));
  return memberIds.map((memberId) => {
    let assetTotal = 0;
    for (const o of ownerships) {
      if (o.familyMemberId !== memberId) continue;
      const value = valueById.get(o.assetId);
      if (value !== undefined) assetTotal += (value * o.percentage) / 100;
    }
    const owed = calculateTotalLiabilities(liabilities.filter((l) => l.ownerId === memberId));
    const assetsRounded = roundToPaise(assetTotal);
    return { memberId, assets: assetsRounded, liabilities: owed, netWorth: calculateNetWorth(assetsRounded, owed) };
  });
}

export type FamilyWealth = {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  byMember: MemberWealth[];
  unownedAssetIds: string[];
};

/** Everything the dashboard and family views need, from one call. */
export function calculateFamilyWealth(
  memberIds: string[],
  assets: ValuedAsset[],
  ownerships: Ownership[],
  liabilities: OwedLiability[],
): FamilyWealth {
  const totalAssets = calculateTotalAssets(assets, ownerships);
  const totalLiabilities = calculateTotalLiabilities(liabilities);
  return {
    totalAssets,
    totalLiabilities,
    netWorth: calculateNetWorth(totalAssets, totalLiabilities),
    byMember: calculateMemberWealth(memberIds, assets, ownerships, liabilities),
    unownedAssetIds: findUnownedAssets(assets, ownerships).map((a) => a.id),
  };
}
