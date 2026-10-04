import { useState } from 'react';
import { useSettings } from '../app/SettingsContext';
import { DemoBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { DemoDataBanner } from '../features/demo/DemoDataBanner';
import { LiabilityForm } from '../features/liabilities/LiabilityForm';
import { useWealthData } from '../hooks/useWealthData';
import type { Liability } from '../models/liability';
import { createLiability, deleteLiability, updateLiability } from '../services/storage/liabilityRepository';
import { formatINR } from '../utils/currency';

type Dialog = { kind: 'add' } | { kind: 'edit'; liability: Liability } | { kind: 'delete'; liability: Liability } | null;

export function LiabilitiesPage() {
  const { members, assets, liabilities, memberById, wealth, loading, error, run } = useWealthData();
  const { settings } = useSettings();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fmt = (n: number) => formatINR(n, settings.numberFormat);
  const close = () => setDialog(null);
  const demoCount = [...members, ...assets, ...liabilities].filter((r) => r.isDemo).length;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Liabilities" description="Loans and other amounts the family owes." />
        {liabilities.length > 0 && (
          <Button className="shrink-0" onClick={() => setDialog({ kind: 'add' })}>
            Add liability
          </Button>
        )}
      </div>

      <DemoDataBanner demoCount={demoCount} run={run} />

      {(error || actionError) && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error ?? actionError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : liabilities.length === 0 ? (
        <Card className="py-10 text-center">
          <h2 className="font-medium">No liabilities</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-400">
            Add home loans, car loans, credit card balances and anything else the family owes.
          </p>
          <Button className="mt-5" onClick={() => setDialog({ kind: 'add' })}>
            Add a liability
          </Button>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
            {liabilities.length} {liabilities.length === 1 ? 'liability' : 'liabilities'} · Total outstanding{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100" data-testid="liabilities-total">
              {fmt(wealth.totalLiabilities)}
            </span>
          </p>
          <Card padded={false} className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Liability</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">Owed by</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Outstanding</th>
                  <th scope="col" className="w-0 px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {liabilities.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{l.name}</span>
                      {l.isDemo && (
                        <span className="ml-2">
                          <DemoBadge />
                        </span>
                      )}
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {l.type}
                        <span className="sm:hidden"> · {memberById.get(l.ownerId)?.name ?? 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 sm:table-cell dark:text-slate-300">
                      {memberById.get(l.ownerId)?.name ?? 'Unknown'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{fmt(l.currentOutstanding)}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <Button variant="ghost" onClick={() => setDialog({ kind: 'edit', liability: l })} aria-label={`Edit ${l.name}`}>
                        Edit
                      </Button>
                      <Button variant="danger-ghost" onClick={() => setDialog({ kind: 'delete', liability: l })} aria-label={`Delete ${l.name}`}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {dialog?.kind === 'add' && (
        <Modal title="Add liability" onClose={close}>
          <LiabilityForm
            members={members}
            onCancel={close}
            onSubmit={async (input) => {
              await run(() => createLiability(input));
              close();
            }}
          />
        </Modal>
      )}

      {dialog?.kind === 'edit' && (
        <Modal title="Edit liability" onClose={close}>
          <LiabilityForm
            liability={dialog.liability}
            members={members}
            onCancel={close}
            onSubmit={async (input) => {
              await run(() => updateLiability(dialog.liability.id, input));
              close();
            }}
          />
        </Modal>
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete liability?"
          message={
            <p>
              <strong className="text-slate-900 dark:text-slate-100">{dialog.liability.name}</strong> will be
              permanently removed. This can't be undone.
            </p>
          }
          confirmLabel="Delete"
          onCancel={close}
          onConfirm={async () => {
            try {
              await run(() => deleteLiability(dialog.liability.id));
              setActionError(null);
            } catch {
              setActionError('Could not delete the liability.');
            }
            close();
          }}
        />
      )}
    </>
  );
}
