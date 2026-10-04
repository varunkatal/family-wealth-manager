import { useState } from 'react';
import { useSettings } from '../app/SettingsContext';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { ContributionForm } from '../features/contributions/ContributionForm';
import { SipCalculator } from '../features/contributions/SipCalculator';
import { useWealthData } from '../hooks/useWealthData';
import type { Contribution } from '../models/contribution';
import { resolveContributionRate } from '../services/finance/contributionProjection';
import { FREQUENCY_LABELS, isActiveOn, monthlyEquivalent } from '../services/finance/sip';
import {
  createContribution,
  deleteContribution,
  updateContribution,
} from '../services/storage/contributionRepository';
import { formatINR } from '../utils/currency';
import { formatISODate, todayISODate } from '../utils/date';

type Dialog = { kind: 'add' } | { kind: 'edit'; contribution: Contribution } | { kind: 'delete'; contribution: Contribution } | null;

export function ContributionsPage() {
  const { members, assets, contributions, memberById, loading, error, run } = useWealthData();
  const { settings } = useSettings();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fmt = (n: number) => formatINR(n, settings.numberFormat);
  const close = () => setDialog(null);
  const today = todayISODate();
  const assetsById = new Map(assets.map((a) => [a.id, a]));
  const monthlyTotal = contributions
    .filter((c) => isActiveOn(c, today))
    .reduce((s, c) => s + monthlyEquivalent(c.amount, c.frequency), 0);

  const status = (c: Contribution) =>
    c.startDate > today ? `Starts ${formatISODate(c.startDate)}` : c.endDate && c.endDate < today ? 'Ended' : null;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Investments" description="Regular investments such as SIPs, RDs and yearly PPF deposits." />
        {contributions.length > 0 && (
          <Button className="shrink-0" onClick={() => setDialog({ kind: 'add' })}>
            Add investment
          </Button>
        )}
      </div>

      {(error || actionError) && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error ?? actionError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : contributions.length === 0 ? (
        <Card className="py-10 text-center">
          <h2 className="font-medium">No regular investments</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-400">
            Add SIPs and other recurring contributions to include them in projections.
          </p>
          <Button className="mt-5" onClick={() => setDialog({ kind: 'add' })}>
            Add an investment
          </Button>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
            {contributions.length} {contributions.length === 1 ? 'investment' : 'investments'} · Currently investing{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100" data-testid="monthly-contributions">
              {fmt(monthlyTotal)}
            </span>{' '}
            a month
          </p>
          <Card padded={false} className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Regular investments</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Investment</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">By</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                  <th scope="col" className="hidden px-4 py-3 text-right font-medium sm:table-cell">Return</th>
                  <th scope="col" className="w-0 px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {contributions.map((c) => {
                  const { rate, source } = resolveContributionRate(c, assetsById);
                  const linked = c.linkedAssetId ? assetsById.get(c.linkedAssetId) : undefined;
                  const label = status(c);
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-3">
                        <span className="font-medium">{c.name}</span>
                        {label && (
                          <span className="ml-2">
                            <Badge tone="notice">{label}</Badge>
                          </span>
                        )}
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {linked ? `Into ${linked.name}` : 'Not linked to an asset'}
                          <span className="md:hidden"> · {memberById.get(c.ownerId)?.name ?? 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 md:table-cell dark:text-slate-300">
                        {memberById.get(c.ownerId)?.name ?? 'Unknown'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <span className="font-medium tabular-nums">{fmt(c.amount)}</span>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {FREQUENCY_LABELS[c.frequency]}
                          {c.annualIncrease ? ` · +${c.annualIncrease}%/yr` : ''}
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular-nums sm:table-cell">
                        {rate === undefined ? (
                          <Badge tone="notice">No rate</Badge>
                        ) : (
                          <>
                            {rate}%
                            {source === 'asset' && <div className="text-xs text-slate-500 dark:text-slate-400">asset's rate</div>}
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        <Button variant="ghost" onClick={() => setDialog({ kind: 'edit', contribution: c })} aria-label={`Edit ${c.name}`}>
                          Edit
                        </Button>
                        <Button
                          variant="danger-ghost"
                          onClick={() => setDialog({ kind: 'delete', contribution: c })}
                          aria-label={`Delete ${c.name}`}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Only future contributions are projected; money already invested is part of the linked asset's current value.
          </p>
        </>
      )}

      <div className="mt-8">
        <SipCalculator fmt={fmt} />
      </div>

      {dialog?.kind === 'add' && (
        <Modal title="Add investment" onClose={close} size="lg">
          <ContributionForm
            members={members}
            assets={assets}
            onCancel={close}
            onSubmit={async (input) => {
              await run(() => createContribution(input));
              close();
            }}
          />
        </Modal>
      )}

      {dialog?.kind === 'edit' && (
        <Modal title="Edit investment" onClose={close} size="lg">
          <ContributionForm
            contribution={dialog.contribution}
            members={members}
            assets={assets}
            onCancel={close}
            onSubmit={async (input) => {
              await run(() => updateContribution(dialog.contribution.id, input));
              close();
            }}
          />
        </Modal>
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete investment?"
          message={
            <p>
              <strong className="text-slate-900 dark:text-slate-100">{dialog.contribution.name}</strong> will be
              permanently removed. The linked asset is not affected. This can't be undone.
            </p>
          }
          confirmLabel="Delete"
          onCancel={close}
          onConfirm={async () => {
            try {
              await run(() => deleteContribution(dialog.contribution.id));
              setActionError(null);
            } catch {
              setActionError('Could not delete the investment.');
            }
            close();
          }}
        />
      )}
    </>
  );
}
