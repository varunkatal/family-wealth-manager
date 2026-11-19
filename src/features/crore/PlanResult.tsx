import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import type { SolveFor } from '../../models/settings';
import type { PlanRow } from '../../services/finance/croreGoal';
import { formatMonth, monthAfter } from '../../utils/date';

/** "6 yr 4 mo" */
export function formatDuration(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y > 0 ? `${y} yr` : '', m > 0 ? `${m} mo` : ''].filter(Boolean).join(' ') || '0 mo';
}

export type Outcome =
  /** A plan that reaches the target: the solved and given values, and the last row of the projection. */
  | { kind: 'plan'; months: number; monthly: number; ratePct: number; last: PlanRow }
  /** The starting amount already meets the target. */
  | { kind: 'reached' }
  /** No plan found within the limits. */
  | { kind: 'unreachable'; message: string };

type PlanResultProps = {
  solveFor: SolveFor;
  outcome: Outcome;
  targetLabel: string;
  today: string;
  /** Target in the other terms at the end of the plan: today's money, or future rupees in today's-money mode. */
  otherTermsValue?: number;
  todaysMoney: boolean;
  format: (n: number) => string;
};

const pct = (n: number) => `${Number(n.toFixed(2))}%`;

export function PlanResult({ solveFor, outcome, targetLabel, today, otherTermsValue, todaysMoney, format }: PlanResultProps) {
  let headline: string;
  if (outcome.kind === 'reached') headline = `Your starting amount already meets ${targetLabel}.`;
  else if (outcome.kind === 'unreachable') headline = outcome.message;
  else {
    const { months, monthly, ratePct } = outcome;
    const by = formatMonth(monthAfter(today, months));
    const per = `${format(Math.ceil(monthly))}/month`;
    if (solveFor === 'monthly')
      headline =
        monthly === 0
          ? `Your starting amount alone reaches ${targetLabel} in ${formatDuration(months)} at ${pct(ratePct)} (${by}).`
          : `Invest ${per} for ${formatDuration(months)} at ${pct(ratePct)} → ${targetLabel} by ${by}.`;
    else if (solveFor === 'years') headline = `${per} at ${pct(ratePct)} reaches ${targetLabel} in ${formatDuration(months)} (${by}).`;
    else
      headline =
        ratePct === 0
          ? `No growth needed: ${per} reaches ${targetLabel} in ${formatDuration(months)} even at 0%.`
          : `You need ${pct(ratePct)} a year to reach ${targetLabel} in ${formatDuration(months)} with ${per}.`;
  }

  return (
    <Card>
      <p className="text-sm font-medium text-teal-700 dark:text-teal-400">Your answer</p>
      <p data-testid="plan-headline" className="mt-1 text-xl font-semibold leading-snug sm:text-2xl">
        {headline}
      </p>
      {outcome.kind === 'plan' && (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total invested" value={format(Math.round(outcome.last.invested))} />
          <Stat label="Growth" value={format(Math.round(outcome.last.growth))} />
          <Stat label="Value at the end" value={format(Math.round(outcome.last.value))} />
          {otherTermsValue !== undefined && (
            <Stat
              label={todaysMoney ? 'Target in future rupees' : `${targetLabel} in today's money`}
              value={format(Math.round(otherTermsValue))}
            />
          )}
        </dl>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

type FasterOptionsProps = {
  ratePct: number;
  /** Monthly investment needed for each plan length; 0 = no monthly needed. */
  options: { years: number; monthly: number | null }[];
  /** Current plan length in years, highlighted when it matches a row. */
  planYears?: number;
  format: (n: number) => string;
};

/** Monthly investment needed for shorter and longer plans at the chosen return. */
export function FasterOptions({ ratePct, options, planYears, format }: FasterOptionsProps) {
  return (
    <Card>
      <h2 className="font-semibold">Faster options at {pct(ratePct)}</h2>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">How much a month it takes to get there sooner.</p>
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">Monthly investment needed by plan length</caption>
        <thead className="text-xs text-slate-500 dark:text-slate-400">
          <tr>
            <th scope="col" className="pb-1 text-left font-normal">Years</th>
            <th scope="col" className="pb-1 text-right font-normal">Monthly investment needed</th>
          </tr>
        </thead>
        <tbody>
          {options.map((o) => {
            const mine = planYears !== undefined && Math.abs(o.years - planYears) < 0.01;
            return (
              <tr key={o.years} className={`border-t border-slate-100 dark:border-slate-800 ${mine ? 'bg-teal-50 dark:bg-teal-950/40' : ''}`}>
                <th scope="row" className="py-1.5 text-left font-medium">
                  {o.years} yrs {mine && <Badge tone="notice">Your plan</Badge>}
                </th>
                <td className="py-1.5 text-right tabular-nums">
                  {o.monthly === null ? '—' : o.monthly === 0 ? 'Already enough' : format(Math.ceil(o.monthly))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
