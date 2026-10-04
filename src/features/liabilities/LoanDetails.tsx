import { useState } from 'react';
import { SegmentedControl } from '../../components/SegmentedControl';
import type { Liability } from '../../models/liability';
import { analyseLoan, debtFreeMonth, summariseScheduleByYear } from '../../services/finance/loans';
import { formatISODate, formatMonth, todayISODate } from '../../utils/date';

type View = 'yearly' | 'monthly';
const VIEW_OPTIONS = [
  { value: 'yearly', label: 'By year' },
  { value: 'monthly', label: 'By month' },
] as const;

/** Loan summary and amortization schedule. */
export function LoanDetails({ liability, fmt, ownerName }: { liability: Liability; fmt: (n: number) => string; ownerName: string }) {
  const [view, setView] = useState<View>('yearly');
  const analysis = analyseLoan(liability);
  const today = todayISODate();
  const repaid =
    liability.originalAmount !== undefined && liability.originalAmount > liability.currentOutstanding
      ? liability.originalAmount - liability.currentOutstanding
      : null;

  const facts: [string, string][] = [
    ['Type', liability.type],
    ['Owed by', ownerName],
    ['Outstanding', fmt(liability.currentOutstanding)],
  ];
  if (liability.originalAmount !== undefined) facts.push(['Original amount', fmt(liability.originalAmount)]);
  if (repaid !== null) facts.push(['Repaid so far', fmt(repaid)]);
  if (liability.interestRate !== undefined) facts.push(['Interest rate', `${liability.interestRate}% a year`]);
  if (liability.startDate) facts.push(['Started', formatISODate(liability.startDate)]);
  if (analysis.kind === 'schedule' && analysis.months > 0) {
    facts.push(
      ['Monthly EMI', `${fmt(analysis.emi)}${analysis.emiCalculated ? ' (calculated)' : ''}`],
      ['This month', `${fmt(analysis.schedule[0]!.interest)} interest · ${fmt(analysis.schedule[0]!.principal)} principal`],
      ['Remaining', `${analysis.months} months`],
      ['Debt-free by', formatMonth(debtFreeMonth(analysis.months, today))],
      ['Interest still to pay', fmt(analysis.totalInterest)],
    );
  }

  return (
    <div className="text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
            <dd className="font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {liability.notes && <p className="mt-3 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{liability.notes}</p>}

      {analysis.kind === 'no-plan' && (
        <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {analysis.reason === 'no-rate'
            ? 'Add the interest rate and the EMI (or months left) to see the repayment schedule.'
            : 'Add the EMI or the number of months left to see the repayment schedule.'}{' '}
          Until then this balance is held flat in projections.
        </p>
      )}
      {analysis.kind === 'never-repaid' && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-red-800 dark:bg-red-950 dark:text-red-200">
          The EMI does not cover the monthly interest of {fmt(analysis.monthlyInterest)}, so this loan would never be repaid.
        </p>
      )}

      {analysis.kind === 'schedule' && analysis.months > 0 && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Repayment schedule</h3>
            <SegmentedControl name="schedule-view" label="Schedule view" options={VIEW_OPTIONS} value={view} onChange={setView} />
          </div>
          <div className="mt-2 max-h-80 overflow-y-auto">
            <table className="w-full">
              <caption className="sr-only">Repayment schedule</caption>
              <thead className="sticky top-0 bg-white text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th scope="col" className="py-1 text-left font-normal">{view === 'yearly' ? 'Year' : 'Month'}</th>
                  <th scope="col" className="py-1 text-right font-normal">Interest</th>
                  <th scope="col" className="py-1 text-right font-normal">Principal</th>
                  <th scope="col" className="py-1 text-right font-normal">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(view === 'yearly'
                  ? summariseScheduleByYear(analysis.schedule).map((r) => ({ key: r.year, label: `Year ${r.year}`, ...r }))
                  : analysis.schedule.map((r) => ({ key: r.month, label: formatMonth(debtFreeMonth(r.month, today)), ...r }))
                ).map((r) => (
                  <tr key={r.key} className="border-t border-slate-100 dark:border-slate-800">
                    <th scope="row" className="py-1.5 text-left font-normal">{r.label}</th>
                    <td className="py-1.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{fmt(r.interest)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(r.principal)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Interest at {liability.interestRate}% ÷ 12 each month on the remaining balance, assuming the next EMI is next month.
          </p>
        </div>
      )}
    </div>
  );
}
