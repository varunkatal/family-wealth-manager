import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Asset } from '../models/asset';
import type { Contribution } from '../models/contribution';
import type { FamilyMember } from '../models/familyMember';
import type { Liability } from '../models/liability';
import type { AssetOwnership } from '../models/ownership';
import { calculateFamilyWealth, type FamilyWealth } from '../services/finance/netWorth';
import { listAssets, listOwnerships } from '../services/storage/assetRepository';
import { listContributions } from '../services/storage/contributionRepository';
import { listFamilyMembers } from '../services/storage/familyMemberRepository';
import { listLiabilities } from '../services/storage/liabilityRepository';

type WealthData = {
  members: FamilyMember[];
  assets: Asset[];
  ownerships: AssetOwnership[];
  liabilities: Liability[];
  contributions: Contribution[];
};

const EMPTY: WealthData = { members: [], assets: [], ownerships: [], liabilities: [], contributions: [] };

/**
 * Loads all wealth records together and derives totals from them,
 * so every page shows numbers computed from the same data.
 */
export function useWealthData() {
  const [data, setData] = useState<WealthData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [members, assets, ownerships, liabilities, contributions] = await Promise.all([
        listFamilyMembers(),
        listAssets(),
        listOwnerships(),
        listLiabilities(),
        listContributions(),
      ]);
      setData({ members, assets, ownerships, liabilities, contributions });
      setError(null);
    } catch {
      setError('Could not load your data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Runs a storage action, then reloads so the UI reflects what is actually stored. */
  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      try {
        return await action();
      } finally {
        await reload();
      }
    },
    [reload],
  );

  const wealth: FamilyWealth = useMemo(
    () => calculateFamilyWealth(data.members.map((m) => m.id), data.assets, data.ownerships, data.liabilities),
    [data],
  );

  const memberById = useMemo(() => new Map(data.members.map((m) => [m.id, m])), [data.members]);

  return { ...data, wealth, memberById, loading, error, run };
}
