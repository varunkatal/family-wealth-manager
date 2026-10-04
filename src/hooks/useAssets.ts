import { useCallback, useEffect, useState } from 'react';
import type { Asset, AssetInput } from '../models/asset';
import { buildDemoAssets } from '../services/demo/demoAssets';
import {
  addDemoAssets,
  createAsset,
  deleteAsset,
  deleteDemoAssets,
  listAssets,
  updateAsset,
} from '../services/storage/assetRepository';

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setAssets(await listAssets());
      setError(null);
    } catch {
      setError('Could not load assets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Each action reloads afterwards so the list always reflects what is stored.
  const run = useCallback(
    <A extends unknown[]>(action: (...args: A) => Promise<unknown>) =>
      async (...args: A) => {
        await action(...args);
        await reload();
      },
    [reload],
  );

  return {
    assets,
    loading,
    error,
    create: run((input: AssetInput) => createAsset(input)),
    update: run((id: string, input: AssetInput) => updateAsset(id, input)),
    remove: run((id: string) => deleteAsset(id)),
    loadDemo: run(() => addDemoAssets(buildDemoAssets())),
    clearDemo: run(() => deleteDemoAssets()),
  };
}
