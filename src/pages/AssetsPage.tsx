import { useState } from 'react';
import { useSettings } from '../app/SettingsContext';
import { DemoBadge, Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { inputClass } from '../components/FormField';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { AssetDetails } from '../features/assets/AssetDetails';
import { AssetForm } from '../features/assets/AssetForm';
import { DemoDataBanner } from '../features/demo/DemoDataBanner';
import { EMPTY_FILTERS, filterAssets, hasActiveFilters, type AssetFilters, type AssetSort } from '../features/assets/filterAssets';
import { useWealthData } from '../hooks/useWealthData';
import { LIQUIDITY_OPTIONS, liquidityLabel, type Asset, type Liquidity } from '../models/asset';
import { getAssetClassOptions } from '../models/assetCategories';
import { sumCurrentValues } from '../services/finance/assetValuation';
import { buildDemoData } from '../services/demo/demoData';
import { createAsset, deleteAsset, updateAsset } from '../services/storage/assetRepository';
import { loadDemoData } from '../services/storage/demoRepository';
import { formatINR } from '../utils/currency';
import { formatISODate } from '../utils/date';

type Dialog =
  | { kind: 'add' }
  | { kind: 'view'; asset: Asset }
  | { kind: 'edit'; asset: Asset }
  | { kind: 'delete'; asset: Asset }
  | null;

const SORT_OPTIONS: { value: AssetSort; label: string }[] = [
  { value: 'value-desc', label: 'Highest value' },
  { value: 'value-asc', label: 'Lowest value' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'updated', label: 'Recently updated' },
];

export function AssetsPage() {
  const { assets, ownerships, members, liabilities, contributions, memberById, wealth, loading, error, run } = useWealthData();
  const linkedCount = (assetId: string) => contributions.filter((c) => c.linkedAssetId === assetId).length;
  const { settings } = useSettings();
  const [filters, setFilters] = useState<AssetFilters>(EMPTY_FILTERS);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const visible = filterAssets(assets, filters);
  const demoCount = [...members, ...assets, ...liabilities].filter((r) => r.isDemo).length;
  const unowned = new Set(wealth.unownedAssetIds);
  // Stable display order: largest share first, then by name.
  const ownersOf = (assetId: string) =>
    ownerships
      .filter((o) => o.assetId === assetId)
      .sort(
        (a, b) =>
          b.percentage - a.percentage ||
          (memberById.get(a.familyMemberId)?.name ?? '').localeCompare(memberById.get(b.familyMemberId)?.name ?? ''),
      );
  const classOptions = getAssetClassOptions(assets);
  const fmt = (n: number) => formatINR(n, settings.numberFormat);
  const close = () => setDialog(null);
  const setFilter = <K extends keyof AssetFilters>(key: K, value: AssetFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const attempt = async (action: () => Promise<unknown>, message: string) => {
    try {
      await run(action);
      setActionError(null);
    } catch {
      setActionError(message);
    }
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Assets" description="Everything the family owns, at its current value." />
        {assets.length > 0 && (
          <Button className="shrink-0" onClick={() => setDialog({ kind: 'add' })}>
            Add asset
          </Button>
        )}
      </div>

      {(error || actionError) && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error ?? actionError}
        </p>
      )}

      <DemoDataBanner demoCount={demoCount} run={run} />

      {unowned.size > 0 && (
        <p role="status" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <strong>
            {unowned.size} {unowned.size === 1 ? 'asset has' : 'assets have'} no owner
          </strong>{' '}
          and {unowned.size === 1 ? "isn't" : "aren't"} counted in net worth. Open {unowned.size === 1 ? 'it' : 'each one'}{' '}
          and assign an owner.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : assets.length === 0 ? (
        <Card className="py-10 text-center">
          <h2 className="font-medium">No assets yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
            Add investments, property, gold, deposits and cash. You can also load clearly labelled demo data (two demo
            family members with assets and a loan) to try things out, then clear it in one click.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={() => setDialog({ kind: 'add' })}>Add your first asset</Button>
            <Button variant="secondary" onClick={() => void attempt(() => loadDemoData(buildDemoData()), 'Could not load demo data.')}>
              Load demo data
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
            <input
              type="search"
              aria-label="Search assets"
              placeholder="Search name, category, institution…"
              className={`${inputClass} sm:col-span-2 lg:col-span-1`}
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
            />
            <select
              aria-label="Filter by asset class"
              className={inputClass}
              value={filters.assetClass}
              onChange={(e) => setFilter('assetClass', e.target.value)}
            >
              <option value="">All classes</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by liquidity"
              className={inputClass}
              value={filters.liquidity}
              onChange={(e) => setFilter('liquidity', e.target.value as Liquidity | '')}
            >
              <option value="">Any liquidity</option>
              {LIQUIDITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort assets"
              className={inputClass}
              value={filters.sort}
              onChange={(e) => setFilter('sort', e.target.value as AssetSort)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400" aria-live="polite">
            {visible.length === assets.length
              ? `${assets.length} ${assets.length === 1 ? 'asset' : 'assets'}`
              : `Showing ${visible.length} of ${assets.length} assets`}{' '}
            · Total value{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100" data-testid="visible-total">
              {fmt(sumCurrentValues(visible))}
            </span>
          </p>

          {visible.length === 0 ? (
            <Card className="text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">No assets match your search or filters.</p>
              {hasActiveFilters(filters) && (
                <Button variant="secondary" className="mt-3" onClick={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })}>
                  Clear filters
                </Button>
              )}
            </Card>
          ) : (
            <Card padded={false} className="overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Asset</th>
                    <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">Owners</th>
                    <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Liquidity</th>
                    <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Valued on</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Current value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visible.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: 'view', asset: a })}
                          className="text-left font-medium hover:text-teal-700 hover:underline dark:hover:text-teal-400"
                        >
                          {a.name}
                        </button>
                        {a.isDemo && (
                          <span className="ml-2">
                            <DemoBadge />
                          </span>
                        )}
                        {unowned.has(a.id) && (
                          <span className="ml-2">
                            <Badge tone="warning">No owner</Badge>
                          </span>
                        )}
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {[a.assetClass, a.subcategory, a.institution].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 sm:table-cell dark:text-slate-300">
                        {ownersOf(a.id)
                          .map((o) => `${memberById.get(o.familyMemberId)?.name ?? 'Unknown'} ${o.percentage}%`)
                          .join(', ') || '—'}
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 md:table-cell dark:text-slate-300">
                        {liquidityLabel(a.liquidity)}
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 lg:table-cell dark:text-slate-300">
                        {formatISODate(a.valuationDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{fmt(a.currentValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {dialog?.kind === 'add' && (
        <Modal title="Add asset" onClose={close} size="lg">
          <AssetForm
            existingAssets={assets}
            members={members}
            onCancel={close}
            onSubmit={async (input) => {
              await run(() => createAsset(input));
              close();
            }}
          />
        </Modal>
      )}

      {dialog?.kind === 'view' && (
        <Modal title={dialog.asset.name} onClose={close} size="lg">
          <AssetDetails
            asset={dialog.asset}
            ownerships={ownersOf(dialog.asset.id)}
            memberById={memberById}
            onEdit={() => setDialog({ kind: 'edit', asset: dialog.asset })}
            onDelete={() => setDialog({ kind: 'delete', asset: dialog.asset })}
          />
        </Modal>
      )}

      {dialog?.kind === 'edit' && (
        <Modal title="Edit asset" onClose={close} size="lg">
          <AssetForm
            asset={dialog.asset}
            existingAssets={assets}
            members={members}
            ownerships={ownersOf(dialog.asset.id)}
            onCancel={close}
            onSubmit={async (input) => {
              await run(() => updateAsset(dialog.asset.id, input));
              close();
            }}
          />
        </Modal>
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete asset?"
          message={
            <p>
              <strong className="text-slate-900 dark:text-slate-100">{dialog.asset.name}</strong> will be permanently
              removed. This can't be undone.
              {linkedCount(dialog.asset.id) > 0 && (
                <>
                  {' '}
                  {linkedCount(dialog.asset.id)} regular{' '}
                  {linkedCount(dialog.asset.id) === 1 ? 'investment is' : 'investments are'} linked to it; they will be
                  kept but no longer linked.
                </>
              )}
            </p>
          }
          confirmLabel="Delete"
          onCancel={close}
          onConfirm={async () => {
            await attempt(() => deleteAsset(dialog.asset.id), 'Could not delete the asset.');
            close();
          }}
        />
      )}

    </>
  );
}
