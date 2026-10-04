import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../app/SettingsContext';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LineChart } from '../components/charts/LineChart';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { inputClass } from '../components/FormField';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { ManualSnapshotForm, ManualValuationForm } from '../features/history/HistoryForms';
import { useWealthData } from '../hooks/useWealthData';
import { VALUATION_SOURCES } from '../models/history';
import { calculateChange, monthOverMonth, withChanges } from '../services/finance/history';
import {
  addManualSnapshot,
  addManualValuation,
  deleteSnapshot,
  deleteValuation,
  saveWealthSnapshot,
} from '../services/storage/historyRepository';
import { formatINR, formatINRCompact } from '../utils/currency';
import { formatISODate, formatMonth } from '../utils/date';

type Dialog =
  | { kind: 'add-snapshot' }
  | { kind: 'add-valuation'; assetId: string; assetName: string }
  | { kind: 'delete'; title: string; label: string; remove: () => Promise<void> }
  | null;

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / 86400000;
};
const pct = (p: number | null) => (p === null ? '—' : `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`);
const axis = (n: number) => formatINRCompact(n).replace(' Lakh', 'L').replace(' Crore', 'Cr');

export function HistoryPage() {
  const { assets, snapshots, valuations, wealth, loading, error, run } = useWealthData();
  const { settings } = useSettings();
  const fmt = (n: number) => formatINR(n, settings.numberFormat);
  const signed = (n: number | null) => (n === null ? '—' : `${n >= 0 ? '+' : ''}${fmt(n)}`);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState('');
  const close = () => setDialog(null);

  const rows = withChanges(snapshots, (s) => s.netWorth);
  const latest = rows.at(-1);
  const monthly = monthOverMonth(snapshots, (s) => s.netWorth);
  const sinceLatest = latest ? calculateChange(latest.item.netWorth, wealth.netWorth) : null;

  const selectedAsset = assets.find((a) => a.id === assetId) ?? assets[0];
  const assetRows = selectedAsset ? withChanges(valuations.filter((v) => v.assetId === selectedAsset.id), (v) => v.value) : [];

  const save = async () => {
    try {
      const s = await run(() => saveWealthSnapshot());
      setActionError(null);
      setMessage(`Snapshot saved: net worth ${fmt(s.netWorth)} on ${formatISODate(s.date)}.`);
    } catch {
      setActionError('Could not save the snapshot.');
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="History" description="How family wealth has changed over time." />
        <div className="mb-6 flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setDialog({ kind: 'add-snapshot' })}>
            Add past snapshot
          </Button>
          <Button onClick={() => void save()}>Save wealth snapshot</Button>
        </div>
      </div>

      {message && (
        <p role="status" className="mb-4 rounded-lg bg-teal-50 px-4 py-2 text-sm text-teal-900 dark:bg-teal-950 dark:text-teal-100">
          {message}
        </p>
      )}
      {(error || actionError) && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error ?? actionError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          {!latest ? (
            <Card className="py-10 text-center">
              <h2 className="font-medium">No snapshots yet</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
                Save a wealth snapshot now and then (for example, once a month) to track how your net worth changes. Each
                snapshot keeps the totals as they were on that day.
              </p>
            </Card>
          ) : (
            <>
              <Card>
                <dl className="flex flex-wrap gap-x-10 gap-y-3 text-sm">
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Latest snapshot · {formatISODate(latest.item.date)}</dt>
                    <dd className="text-3xl font-semibold tabular-nums" data-testid="latest-net-worth">
                      {fmt(latest.item.netWorth)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Change from previous</dt>
                    <dd className="text-lg font-semibold tabular-nums" data-testid="latest-change">
                      {signed(latest.change)} <span className="text-sm font-normal text-slate-500">{pct(latest.percentage)}</span>
                    </dd>
                  </div>
                  {sinceLatest && (
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Now vs latest snapshot</dt>
                      <dd className="text-lg font-semibold tabular-nums">
                        {signed(sinceLatest.change)}{' '}
                        <span className="text-sm font-normal text-slate-500">{pct(sinceLatest.percentage)}</span>
                      </dd>
                    </div>
                  )}
                </dl>
              </Card>

              {rows.length > 1 && (
                <Card className="mt-6">
                  <h2 className="font-semibold">Net worth history</h2>
                  <div className="mt-3">
                    <LineChart
                      label={`Net worth across ${rows.length} snapshots`}
                      series={[{ key: 'nw', label: 'Net worth', color: 'var(--series-1)', values: rows.map((r) => r.item.netWorth) }]}
                      xLabels={rows.map((r) => formatISODate(r.item.date))}
                      xValues={rows.map((r) => dayNumber(r.item.date))}
                      format={fmt}
                      formatAxis={axis}
                    />
                  </div>
                </Card>
              )}

              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <Card padded={false} className="overflow-hidden">
                  <h2 className="px-5 pt-5 font-semibold">Snapshots</h2>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">Snapshots</caption>
                      <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                        <tr>
                          <th scope="col" className="px-4 py-2.5 text-left font-medium">Date</th>
                          <th scope="col" className="hidden px-2 py-2.5 text-right font-medium md:table-cell">Assets</th>
                          <th scope="col" className="hidden px-2 py-2.5 text-right font-medium md:table-cell">Liabilities</th>
                          <th scope="col" className="px-2 py-2.5 text-right font-medium">Net worth</th>
                          <th scope="col" className="hidden px-2 py-2.5 text-right font-medium sm:table-cell">Change</th>
                          <th scope="col" className="w-0 px-2 py-2.5">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {[...rows].reverse().map(({ item: s, change, percentage }) => (
                          <tr key={s.id}>
                            <th scope="row" className="whitespace-nowrap px-4 py-2.5 text-left font-medium">
                              {formatISODate(s.date)}
                              <div className="mt-0.5 flex gap-1">
                                {s.source === 'manual' && <Badge tone="notice">Entered</Badge>}
                                {s.isDemo && <Badge tone="demo">Demo</Badge>}
                              </div>
                            </th>
                            <td className="hidden whitespace-nowrap px-2 py-2.5 text-right tabular-nums md:table-cell">{fmt(s.totalAssets)}</td>
                            <td className="hidden whitespace-nowrap px-2 py-2.5 text-right tabular-nums md:table-cell">{fmt(s.totalLiabilities)}</td>
                            <td className="whitespace-nowrap px-2 py-2.5 text-right font-medium tabular-nums">{fmt(s.netWorth)}</td>
                            <td className="hidden whitespace-nowrap px-2 py-2.5 text-right tabular-nums sm:table-cell">
                              {signed(change)}
                              <div className="text-xs text-slate-500 dark:text-slate-400">{pct(percentage)}</div>
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-right">
                              <Button
                                variant="danger-ghost"
                                aria-label={`Delete snapshot of ${formatISODate(s.date)}`}
                                onClick={() =>
                                  setDialog({
                                    kind: 'delete',
                                    title: 'Delete snapshot?',
                                    label: `The snapshot of ${formatISODate(s.date)}`,
                                    remove: () => deleteSnapshot(s.id),
                                  })
                                }
                              >
                                Delete
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card>
                  <h2 className="font-semibold">Month over month</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Latest snapshot in each month.</p>
                  <table className="mt-3 w-full text-sm">
                    <caption className="sr-only">Month over month</caption>
                    <thead className="text-xs text-slate-500 dark:text-slate-400">
                      <tr>
                        <th scope="col" className="pb-1 text-left font-normal">Month</th>
                        <th scope="col" className="pb-1 text-right font-normal">Net worth</th>
                        <th scope="col" className="pb-1 text-right font-normal">Change</th>
                        <th scope="col" className="pb-1 text-right font-normal">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...monthly].reverse().map((m) => (
                        <tr key={m.month} className="border-t border-slate-100 dark:border-slate-800">
                          <th scope="row" className="whitespace-nowrap py-1.5 text-left font-normal">{formatMonth(m.month)}</th>
                          <td className="py-1.5 text-right tabular-nums">{fmt(m.item.netWorth)}</td>
                          <td className="py-1.5 text-right tabular-nums">{signed(m.change)}</td>
                          <td className="py-1.5 pl-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{pct(m.percentage)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            </>
          )}

          <Card className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold">Asset value history</h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Recorded automatically whenever an asset's value or valuation date changes.
                </p>
              </div>
              {selectedAsset && (
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="history-asset" className="sr-only">
                    Asset
                  </label>
                  <select id="history-asset" className={`${inputClass} w-auto`} value={selectedAsset.id} onChange={(e) => setAssetId(e.target.value)}>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={() => setDialog({ kind: 'add-valuation', assetId: selectedAsset.id, assetName: selectedAsset.name })}>
                    Add past value
                  </Button>
                </div>
              )}
            </div>

            {!selectedAsset ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                <Link to="/assets" className="font-medium text-teal-700 underline dark:text-teal-400">
                  Add assets
                </Link>{' '}
                to see their value history.
              </p>
            ) : assetRows.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No values recorded for this asset yet.</p>
            ) : (
              <>
                {assetRows.length > 1 && (
                  <div className="mt-4">
                    <LineChart
                      label={`${selectedAsset.name} value history`}
                      series={[{ key: 'v', label: selectedAsset.name, color: 'var(--series-1)', values: assetRows.map((r) => r.item.value) }]}
                      xLabels={assetRows.map((r) => formatISODate(r.item.date))}
                      xValues={assetRows.map((r) => dayNumber(r.item.date))}
                      format={fmt}
                      formatAxis={axis}
                      height={200}
                    />
                  </div>
                )}
                <table className="mt-4 w-full text-sm">
                  <caption className="sr-only">{selectedAsset.name} value history</caption>
                  <thead className="text-xs text-slate-500 dark:text-slate-400">
                    <tr>
                      <th scope="col" className="pb-1 text-left font-normal">Date</th>
                      <th scope="col" className="pb-1 text-right font-normal">Value</th>
                      <th scope="col" className="pb-1 text-right font-normal">Change</th>
                      <th scope="col" className="hidden pb-1 pl-3 text-left font-normal sm:table-cell">Source</th>
                      <th scope="col" className="w-0 pb-1">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...assetRows].reverse().map(({ item: v, change, percentage }) => (
                      <tr key={v.id} className="border-t border-slate-100 dark:border-slate-800">
                        <th scope="row" className="whitespace-nowrap py-1.5 text-left font-normal">{formatISODate(v.date)}</th>
                        <td className="whitespace-nowrap py-1.5 text-right tabular-nums">{fmt(v.value)}</td>
                        <td className="whitespace-nowrap py-1.5 text-right tabular-nums">
                          {signed(change)} <span className="text-xs text-slate-500 dark:text-slate-400">{pct(percentage)}</span>
                        </td>
                        <td className="hidden py-1.5 pl-3 text-slate-600 sm:table-cell dark:text-slate-300">
                          {VALUATION_SOURCES[v.source]}
                          {v.notes && <span className="block text-xs text-slate-500 dark:text-slate-400">{v.notes}</span>}
                        </td>
                        <td className="whitespace-nowrap py-1 text-right">
                          {v.source === 'manual' && (
                            <Button
                              variant="danger-ghost"
                              aria-label={`Delete value of ${formatISODate(v.date)}`}
                              onClick={() =>
                                setDialog({ kind: 'delete', title: 'Delete value?', label: `The value recorded for ${formatISODate(v.date)}`, remove: () => deleteValuation(v.id) })
                              }
                            >
                              Delete
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Card>
        </>
      )}

      {dialog?.kind === 'add-snapshot' && (
        <Modal title="Add past snapshot" onClose={close}>
          <ManualSnapshotForm
            onCancel={close}
            onSubmit={async (input) => {
              await run(() => addManualSnapshot(input));
              close();
            }}
          />
        </Modal>
      )}

      {dialog?.kind === 'add-valuation' && (
        <Modal title={`Add past value: ${dialog.assetName}`} onClose={close}>
          <ManualValuationForm
            onCancel={close}
            onSubmit={async (input) => {
              await run(() => addManualValuation(dialog.assetId, input));
              close();
            }}
          />
        </Modal>
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={dialog.title}
          message={<p>{dialog.label} will be permanently removed. This can't be undone.</p>}
          confirmLabel="Delete"
          onCancel={close}
          onConfirm={async () => {
            try {
              await run(dialog.remove);
              setActionError(null);
            } catch {
              setActionError('Could not delete.');
            }
            close();
          }}
        />
      )}
    </>
  );
}
