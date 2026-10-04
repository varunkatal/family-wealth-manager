import { useState, type ReactNode } from 'react';
import { useSettings } from '../app/SettingsContext';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { CashFlowItemForm } from '../features/cashFlow/CashFlowItemForm';
import { useWealthData } from '../hooks/useWealthData';
import type { Expense, Income } from '../models/cashFlow';
import { annualAmount, calculateCashFlow, incomeByMember, totalMonthly } from '../services/finance/cashFlow';
import { analyseLoan } from '../services/finance/loans';
import { FREQUENCY_LABELS, isActiveOn, monthlyEquivalent } from '../services/finance/sip';
import {
  createExpense,
  createIncome,
  deleteExpense,
  deleteIncome,
  updateExpense,
  updateIncome,
} from '../services/storage/cashFlowRepository';
import { formatINR } from '../utils/currency';
import { formatISODate, todayISODate } from '../utils/date';

type Dialog =
  | { kind: 'add-income' }
  | { kind: 'edit-income'; item: Income }
  | { kind: 'add-expense' }
  | { kind: 'edit-expense'; item: Expense }
  | { kind: 'delete'; label: string; remove: () => Promise<void> }
  | null;

export function CashFlowPage() {
  const { members, incomes, expenses, contributions, liabilities, memberById, loading, error, run } = useWealthData();
  const { settings } = useSettings();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fmt = (n: number) => formatINR(n, settings.numberFormat);
  const close = () => setDialog(null);
  const today = todayISODate();

  const summary = calculateCashFlow(incomes, expenses, today);
  // Not expenses (spec §25): shown separately as money set aside from free cash flow.
  const monthlyInvestments = totalMonthly(contributions, today);
  const monthlyEMIs = liabilities.reduce((s, l) => {
    const a = analyseLoan(l);
    return s + (a.kind === 'schedule' && a.months > 0 ? a.emi : 0);
  }, 0);
  const leftOver = summary.monthlyFreeCashFlow - monthlyInvestments - monthlyEMIs;
  const byMember = incomeByMember(members.map((m) => m.id), incomes, today).filter((m) => m.monthly > 0);
  const memberName = (id?: string) => (id ? (memberById.get(id)?.name ?? 'Unknown') : 'Whole family');
  const status = (i: { startDate?: string; endDate?: string }) =>
    isActiveOn(i, today) ? null : i.startDate && i.startDate > today ? `Starts ${formatISODate(i.startDate)}` : 'Ended';
  const signed = (n: number) => <span className={n < 0 ? 'text-red-600 dark:text-red-400' : ''}>{fmt(n)}</span>;

  const confirmDelete = (label: string, remove: () => Promise<void>) => setDialog({ kind: 'delete', label, remove });

  return (
    <>
      <PageHeader title="Cash flow" description="Regular income and spending, and what is left each month." />

      {(error || actionError) && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error ?? actionError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card>
              <table className="w-full text-sm">
                <caption className="sr-only">Cash flow summary</caption>
                <thead className="text-xs text-slate-500 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="pb-1 text-left font-normal">
                      <span className="sr-only">Item</span>
                    </th>
                    <th scope="col" className="pb-1 text-right font-normal">Monthly</th>
                    <th scope="col" className="pb-1 text-right font-normal">Annual</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  <SummaryRow label="Income" monthly={fmt(summary.monthlyIncome)} annual={fmt(summary.annualIncome)} testId="income" />
                  <SummaryRow label="− Expenses" monthly={fmt(summary.monthlyExpenses)} annual={fmt(summary.annualExpenses)} testId="expenses" />
                  <SummaryRow
                    label="= Free cash flow"
                    monthly={signed(summary.monthlyFreeCashFlow)}
                    annual={signed(summary.annualFreeCashFlow)}
                    testId="free-cash-flow"
                    strong
                  />
                </tbody>
              </table>
              {(monthlyInvestments > 0 || monthlyEMIs > 0) && (
                <dl className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Set aside from free cash flow (not expenses):</p>
                  {monthlyInvestments > 0 && <Line label="Regular investments" value={`${fmt(monthlyInvestments)} a month`} />}
                  {monthlyEMIs > 0 && <Line label="Loan EMIs" value={`${fmt(Math.round(monthlyEMIs * 100) / 100)} a month`} />}
                  <Line
                    label="Left after investments and EMIs"
                    value={<span data-testid="left-over">{signed(Math.round(leftOver * 100) / 100)} a month</span>}
                  />
                </dl>
              )}
            </Card>

            <Card>
              <h2 className="font-semibold">Income by family member</h2>
              {byMember.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No current income yet.</p>
              ) : (
                <table className="mt-2 w-full text-sm">
                  <caption className="sr-only">Income by family member</caption>
                  <thead className="text-xs text-slate-500 dark:text-slate-400">
                    <tr>
                      <th scope="col" className="pb-1 text-left font-normal">Member</th>
                      <th scope="col" className="pb-1 text-right font-normal">Monthly</th>
                      <th scope="col" className="pb-1 text-right font-normal">Annual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byMember.map((m) => (
                      <tr key={m.memberId} className="border-t border-slate-100 dark:border-slate-800">
                        <th scope="row" className="py-1.5 text-left font-normal">{memberName(m.memberId)}</th>
                        <td className="py-1.5 text-right tabular-nums">{fmt(m.monthly)}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmt(m.annual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          <ItemSection
            title="Income"
            addLabel="Add income"
            emptyText="No income added yet. Add salaries, pensions, rent and other regular income."
            onAdd={() => setDialog({ kind: 'add-income' })}
            rows={incomes.map((i) => ({
              id: i.id,
              name: i.description ? `${i.type}: ${i.description}` : i.type,
              who: memberName(i.memberId),
              amount: i.amount,
              frequency: i.frequency,
              extra: i.growthRate ? `+${i.growthRate}%/yr` : undefined,
              status: status(i),
              isDemo: i.isDemo,
              onEdit: () => setDialog({ kind: 'edit-income', item: i }),
              onDelete: () => confirmDelete(i.description ?? i.type, () => deleteIncome(i.id)),
            }))}
            fmt={fmt}
          />

          <ItemSection
            title="Expenses"
            addLabel="Add expense"
            emptyText="No expenses added yet. Add household, grocery, medical and other regular spending."
            onAdd={() => setDialog({ kind: 'add-expense' })}
            rows={expenses.map((e) => ({
              id: e.id,
              name: e.description ? `${e.category}: ${e.description}` : e.category,
              who: memberName(e.memberId),
              amount: e.amount,
              frequency: e.frequency,
              status: status(e),
              isDemo: e.isDemo,
              onEdit: () => setDialog({ kind: 'edit-expense', item: e }),
              onDelete: () => confirmDelete(e.description ?? e.category, () => deleteExpense(e.id)),
            }))}
            fmt={fmt}
          />
        </>
      )}

      {(dialog?.kind === 'add-income' || dialog?.kind === 'edit-income') && (
        <Modal title={dialog.kind === 'add-income' ? 'Add income' : 'Edit income'} onClose={close} size="lg">
          <CashFlowItemForm
            kind="income"
            item={dialog.kind === 'edit-income' ? dialog.item : undefined}
            members={members}
            onCancel={close}
            onSubmit={async (input) => {
              await run(() => (dialog.kind === 'edit-income' ? updateIncome(dialog.item.id, input) : createIncome(input)));
              close();
            }}
          />
        </Modal>
      )}

      {(dialog?.kind === 'add-expense' || dialog?.kind === 'edit-expense') && (
        <Modal title={dialog.kind === 'add-expense' ? 'Add expense' : 'Edit expense'} onClose={close} size="lg">
          <CashFlowItemForm
            kind="expense"
            item={dialog.kind === 'edit-expense' ? dialog.item : undefined}
            members={members}
            onCancel={close}
            onSubmit={async (input) => {
              await run(() => (dialog.kind === 'edit-expense' ? updateExpense(dialog.item.id, input) : createExpense(input)));
              close();
            }}
          />
        </Modal>
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete?"
          message={
            <p>
              <strong className="text-slate-900 dark:text-slate-100">{dialog.label}</strong> will be permanently removed.
              This can't be undone.
            </p>
          }
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

function SummaryRow({ label, monthly, annual, testId, strong }: { label: string; monthly: ReactNode; annual: ReactNode; testId: string; strong?: boolean }) {
  return (
    <tr className={`border-t border-slate-100 dark:border-slate-800 ${strong ? 'text-base font-semibold' : ''}`}>
      <th scope="row" className="py-2 text-left font-normal">{label}</th>
      <td data-testid={`monthly-${testId}`} className="py-2 text-right">{monthly}</td>
      <td data-testid={`annual-${testId}`} className="py-2 text-right">{annual}</td>
    </tr>
  );
}

function Line({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

type ItemRow = {
  id: string;
  name: string;
  who: string;
  amount: number;
  frequency: keyof typeof FREQUENCY_LABELS;
  extra?: string;
  status: string | null;
  isDemo?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

function ItemSection({
  title,
  addLabel,
  emptyText,
  onAdd,
  rows,
  fmt,
}: {
  title: string;
  addLabel: string;
  emptyText: string;
  onAdd: () => void;
  rows: ItemRow[];
  fmt: (n: number) => string;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button onClick={onAdd}>{addLabel}</Button>
      </div>
      {rows.length === 0 ? (
        <Card className="py-6 text-center text-sm text-slate-600 dark:text-slate-400">{emptyText}</Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{title === 'Income' ? 'Income' : 'Expense'}</th>
                <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">{title === 'Income' ? 'Earned by' : 'For'}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                <th scope="col" className="hidden px-4 py-3 text-right font-medium sm:table-cell">Monthly</th>
                <th scope="col" className="hidden px-4 py-3 text-right font-medium sm:table-cell">Annual</th>
                <th scope="col" className="w-0 px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr key={r.id} className={r.status ? 'text-slate-400 dark:text-slate-500' : ''}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{r.name}</span>
                    {r.status && (
                      <span className="ml-2">
                        <Badge tone="notice">{r.status}</Badge>
                      </span>
                    )}
                    {r.isDemo && (
                      <span className="ml-2">
                        <Badge tone="demo">Demo</Badge>
                      </span>
                    )}
                    <div className="text-xs text-slate-500 md:hidden dark:text-slate-400">{r.who}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell dark:text-slate-300">{r.who}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <span className="tabular-nums">{fmt(r.amount)}</span>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {FREQUENCY_LABELS[r.frequency]}
                      {r.extra ? ` · ${r.extra}` : ''}
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular-nums sm:table-cell">
                    {fmt(monthlyEquivalent(r.amount, r.frequency))}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular-nums sm:table-cell">
                    {fmt(annualAmount(r))}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <Button variant="ghost" onClick={r.onEdit} aria-label={`Edit ${r.name}`}>
                      Edit
                    </Button>
                    <Button variant="danger-ghost" onClick={r.onDelete} aria-label={`Delete ${r.name}`}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {rows.some((r) => r.status) && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Greyed-out items are not active today and are not counted.</p>
      )}
    </section>
  );
}
