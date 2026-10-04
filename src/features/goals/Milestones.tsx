import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/Card';
import { inputClass } from '../../components/FormField';
import { calculateMilestoneDate, MILESTONES, type MilestoneEstimate } from '../../services/finance/goals';
import { SCENARIO_LABELS, SCENARIOS, type Scenario } from '../../services/finance/scenarios';
import { formatINRCompact, parseAmountInput } from '../../utils/currency';
import { formatMonth, monthAfter } from '../../utils/date';
import { amountHint } from '../../utils/formInput';

type MilestonesProps = {
  /** Projected net worth by year (0 = today) for each scenario. */
  netWorthByScenario: Record<Scenario, number[]>;
  today: string;
  /** Number of assets with no rate in at least one scenario (they are held flat). */
  assetsMissingRates: number;
};

/** When family net worth could reach ₹25 lakh, ₹1 crore and so on, under each scenario (spec §17). */
export function Milestones({ netWorthByScenario, today, assetsMissingRates }: MilestonesProps) {
  const [custom, setCustom] = useState('');
  const customAmount = parseAmountInput(custom);
  const customValid = customAmount !== undefined && !Number.isNaN(customAmount) && customAmount > 0;
  const amounts = [...new Set([...MILESTONES, ...(customValid ? [customAmount] : [])])].sort((a, b) => a - b);
  const years = netWorthByScenario.base.length - 1;

  const describe = (e: MilestoneEstimate) =>
    e.kind === 'reached' ? 'Reached' : e.kind === 'estimate' ? `~${formatMonth(monthAfter(today, e.months))}` : `Not within ${e.years} years`;

  return (
    <Card>
      <h2 className="font-semibold">Wealth milestones</h2>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        When projected net worth (assets, future investments, minus loans) could reach each amount. Dates are estimates
        between yearly projections.
      </p>
      {assetsMissingRates > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {assetsMissingRates} {assetsMissingRates === 1 ? 'asset is' : 'assets are'} missing a growth rate in some scenarios
          and held at today's value.{' '}
          <Link to="/projections" className="font-medium underline">
            See projections
          </Link>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="custom-milestone" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Custom milestone (₹)
          </label>
          <input
            id="custom-milestone"
            inputMode="decimal"
            className={`${inputClass} w-44`}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-invalid={custom.trim() !== '' && !customValid}
          />
        </div>
        <p className="pb-2 text-xs text-slate-500 dark:text-slate-400">
          {custom.trim() === '' ? 'Optional' : customValid ? amountHint(custom) : 'Enter an amount more than 0'}
        </p>
      </div>

      <div className="relative mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Wealth milestones</caption>
          <thead className="text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th scope="col" className="pb-1 text-left font-normal">Milestone</th>
              {SCENARIOS.map((s) => (
                <th key={s} scope="col" className="pb-1 pl-2 text-right font-normal">
                  {SCENARIO_LABELS[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {amounts.map((amount) => (
              <tr key={amount} className="border-t border-slate-100 dark:border-slate-800">
                <th scope="row" className="whitespace-nowrap py-1.5 text-left font-medium">
                  {formatINRCompact(amount)}
                </th>
                {SCENARIOS.map((s) => (
                  <td key={s} className="whitespace-nowrap py-1.5 pl-2 text-right tabular-nums">
                    {describe(calculateMilestoneDate(netWorthByScenario[s], amount))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Projected up to {years} years ahead.</p>
    </Card>
  );
}
