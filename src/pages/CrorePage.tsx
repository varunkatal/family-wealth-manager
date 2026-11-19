import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../app/SettingsContext';
import { Card } from '../components/Card';
import { LineChart } from '../components/charts/LineChart';
import { Disclaimer } from '../components/Disclaimer';
import { PageHeader } from '../components/PageHeader';
import { AssetPicker } from '../features/crore/AssetPicker';
import { PlanInputs, SavedSips } from '../features/crore/PlannerInputs';
import { FasterOptions, formatDuration, PlanResult, type Outcome } from '../features/crore/PlanResult';
import { useWealthData } from '../hooks/useWealthData';
import type { CrorePlannerSettings, SolveFor } from '../models/settings';
import { calculateFamilyOwnedValue } from '../services/finance/allocation';
import {
  defaultSelectedAssetIds,
  MAX_PLAN_MONTHS,
  monthsToTarget,
  nominalTarget,
  OPTION_YEARS,
  projectPlan,
  requiredMonthly,
  requiredRate,
  selectCorpus,
  weightedRate,
} from '../services/finance/croreGoal';
import { calculateInflationAdjustedValue, resolveAssetRate } from '../services/finance/scenarios';
import { monthlyEquivalent } from '../services/finance/sip';
import { formatINR, formatINRCompact } from '../utils/currency';
import { formatMonth, monthAfter, todayISODate } from '../utils/date';

const SAVE_DELAY_MS = 400;
/** Return used when no ticked asset has a growth rate and none has been typed. */
const FALLBACK_RATE = 12;
const PLAN_COLOR = 'var(--series-1)';
const TARGET_COLOR = 'var(--color-slate-400)';
const axis = (n: number) => formatINRCompact(n).replace(' Lakh', 'L').replace(' Crore', 'Cr');

export function CrorePage() {
  const data = useWealthData();
  const { loading } = useSettings();
  return (
    <>
      <PageHeader title="₹1 Cr Planner" description="Choose your years, monthly investment and return, and see the fastest way to your target." />
      {data.error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {data.error}
        </p>
      )}
      {data.loading || loading ? <p className="text-sm text-slate-500">Loading…</p> : <Planner data={data} />}
      <div className="mt-8">
        <Disclaimer />
      </div>
    </>
  );
}

function Planner({ data }: { data: ReturnType<typeof useWealthData> }) {
  const { assets, ownerships, contributions } = data;
  const { settings, updateSettings } = useSettings();
  const [plan, setPlan] = useState<CrorePlannerSettings>(settings.crorePlanner);
  const fmt = (n: number) => formatINR(n, settings.numberFormat);
  const today = todayISODate();
  const inflation = settings.inflationRate;

  // Save shortly after the last change, and on leaving the page.
  const pending = useRef<CrorePlannerSettings | null>(null);
  const save = useRef(updateSettings);
  save.current = updateSettings;
  useEffect(() => {
    if (plan === settings.crorePlanner) return;
    pending.current = plan;
    const t = setTimeout(() => {
      pending.current = null;
      void save.current({ crorePlanner: plan });
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [plan]);
  useEffect(
    () => () => {
      if (pending.current) void save.current({ crorePlanner: pending.current });
    },
    [],
  );
  const patch = (p: Partial<CrorePlannerSettings>) => setPlan((prev) => ({ ...prev, ...p }));

  // Starting amount: family-owned value of the ticked assets (deleted assets are ignored).
  const assetIds = new Set(assets.map((a) => a.id));
  const selectedIds = (plan.selectedAssetIds ?? defaultSelectedAssetIds(assets)).filter((id) => assetIds.has(id));
  const chosen = selectCorpus(assets, contributions, selectedIds);
  const valued = chosen.assets.map((a) => ({ today: calculateFamilyOwnedValue(a, ownerships), rate: resolveAssetRate(a, 'base', settings.classDefaults).rate }));
  const start = Math.round(valued.reduce((s, a) => s + a.today, 0) * 100) / 100;

  const sips = chosen.contributions
    .filter((c) => !c.endDate || c.endDate >= today)
    .map((c) => ({ id: c.id, name: c.name, monthly: monthlyEquivalent(c.amount, c.frequency) }));
  const defaultMonthly = Math.round(sips.reduce((s, x) => s + x.monthly, 0));
  const defaultRate = weightedRate(valued) ?? FALLBACK_RATE;

  const monthly = plan.monthly ?? defaultMonthly;
  const ratePct = plan.ratePct ?? defaultRate;
  const infl = plan.todaysMoney ? inflation : undefined;
  const planMonths = Math.round(plan.years * 12);
  const targetLabel = formatINRCompact(plan.target);
  const forYears = formatDuration(planMonths);

  // Work out the missing value: a full plan, or why there is none.
  let solved: { months: number; monthly: number; ratePct: number } | string | 'reached';
  if (start >= plan.target) solved = 'reached';
  else if (plan.solveFor === 'monthly') {
    const needed = requiredMonthly(start, nominalTarget(plan.target, planMonths, infl), ratePct, planMonths, plan.stepUpPct);
    solved = needed === null ? 'Choose a plan length of at least one month.' : { months: planMonths, monthly: needed, ratePct };
  } else if (plan.solveFor === 'years') {
    const months = monthsToTarget({ start, monthly, ratePct, stepUpPct: plan.stepUpPct }, plan.target, infl);
    solved =
      months === null
        ? `Not reachable within ${MAX_PLAN_MONTHS / 12} years at this amount and return. Invest more each month or raise the return.`
        : { months, monthly, ratePct };
  } else {
    const rate = requiredRate({ start, monthly, stepUpPct: plan.stepUpPct }, nominalTarget(plan.target, planMonths, infl), planMonths);
    solved =
      rate === null
        ? `Not reachable in ${forYears} even at 100% a year. Invest more each month or give it more time.`
        : { months: planMonths, monthly, ratePct: rate };
  }

  const rows = typeof solved === 'object' ? projectPlan({ start, ...solved, stepUpPct: plan.stepUpPct }, solved.months) : [];
  const outcome: Outcome =
    typeof solved === 'object'
      ? { kind: 'plan', ...solved, last: rows.at(-1)! }
      : solved === 'reached'
        ? { kind: 'reached' }
        : { kind: 'unreachable', message: solved };

  const solvedText =
    outcome.kind !== 'plan'
      ? '—'
      : plan.solveFor === 'monthly'
        ? fmt(Math.ceil(outcome.monthly))
        : plan.solveFor === 'years'
          ? formatDuration(outcome.months)
          : `${Number(outcome.ratePct.toFixed(2))}%`;
  const otherTermsValue =
    outcome.kind === 'plan'
      ? plan.todaysMoney
        ? nominalTarget(plan.target, outcome.months, inflation)
        : calculateInflationAdjustedValue(plan.target, inflation, outcome.months / 12)
      : undefined;

  const optionRate = outcome.kind === 'plan' ? outcome.ratePct : ratePct;
  const options = OPTION_YEARS.map((years) => ({
    years,
    monthly: requiredMonthly(start, nominalTarget(plan.target, years * 12, infl), optionRate, years * 12, plan.stepUpPct),
  }));

  // When switching what to solve for, the value just worked out becomes an input.
  const onSolveForChange = (next: SolveFor) => {
    const carry: Partial<CrorePlannerSettings> = {};
    if (outcome.kind === 'plan') {
      if (plan.solveFor === 'monthly') carry.monthly = Math.ceil(outcome.monthly);
      if (plan.solveFor === 'years') carry.years = Math.max(0.5, Math.round((outcome.months / 12) * 2) / 2);
      if (plan.solveFor === 'return') carry.ratePct = outcome.ratePct;
    }
    patch({ ...carry, solveFor: next });
  };

  const currentYear = Number(today.slice(0, 4));
  const rowLabel = (m: number) => (m === 0 ? 'Today' : m % 12 === 0 ? `${currentYear + m / 12}` : formatMonth(monthAfter(today, m)));
  const targetLine = rows.map((r) => nominalTarget(plan.target, r.months, infl));

  return (
    <div className="space-y-6">
      {assets.length === 0 && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          No assets yet, so the plan starts from ₹0.{' '}
          <Link to="/assets" className="font-medium underline">
            Add your investments
          </Link>{' '}
          to start from what you already have.
        </p>
      )}
      <PlanResult
        solveFor={plan.solveFor}
        outcome={outcome}
        targetLabel={targetLabel}
        today={today}
        otherTermsValue={otherTermsValue}
        todaysMoney={plan.todaysMoney}
        format={fmt}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <PlanInputs
            plan={plan}
            onChange={patch}
            onSolveForChange={onSolveForChange}
            solvedText={solvedText}
            defaultMonthly={defaultMonthly}
            defaultRate={defaultRate}
            inflationRate={inflation}
          />
          <SavedSips sips={sips} format={fmt} />
        </div>
        <div className="space-y-6">
          {assets.length > 0 && (
            <AssetPicker
              assets={assets}
              ownerships={ownerships}
              classDefaults={settings.classDefaults}
              selectedIds={selectedIds}
              onChange={(ids) => patch({ selectedAssetIds: ids })}
              format={fmt}
            />
          )}
          <FasterOptions ratePct={optionRate} options={options} planYears={outcome.kind === 'plan' ? outcome.months / 12 : undefined} format={fmt} />
        </div>
      </div>

      {rows.length > 1 && (
        <Card>
          <h2 className="font-semibold">Your plan year by year</h2>
          <p className="mb-3 mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            In future rupees, at {Number(optionRate.toFixed(2))}% a year on everything.{plan.todaysMoney && ' The target line rises with inflation.'}
          </p>
          <LineChart
            label={`Your plan against the ${targetLabel} target`}
            series={[
              { key: 'plan', label: 'Your plan', color: PLAN_COLOR, values: rows.map((r) => Math.round(r.value)) },
              { key: 'target', label: 'Target', color: TARGET_COLOR, values: targetLine.map(Math.round) },
            ]}
            xLabels={rows.map((r) => rowLabel(r.months))}
            xValues={rows.map((r) => r.months)}
            format={fmt}
            formatAxis={axis}
          />
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Your plan year by year</caption>
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="pb-1 text-left font-normal">Year</th>
                  <th scope="col" className="pb-1 pl-2 text-right font-normal">Value</th>
                  <th scope="col" className="pb-1 pl-2 text-right font-normal">Invested</th>
                  <th scope="col" className="pb-1 pl-2 text-right font-normal">Growth</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const hit = r.value >= targetLine[idx]!;
                  return (
                    <tr key={r.months} className="border-t border-slate-100 dark:border-slate-800">
                      <th scope="row" className="whitespace-nowrap py-1.5 text-left font-medium">
                        {rowLabel(r.months)}
                      </th>
                      <td className={`whitespace-nowrap py-1.5 pl-2 text-right tabular-nums ${hit ? 'font-semibold text-teal-700 dark:text-teal-400' : ''}`}>
                        {fmt(Math.round(r.value))}
                      </td>
                      <td className="whitespace-nowrap py-1.5 pl-2 text-right tabular-nums">{fmt(Math.round(r.invested))}</td>
                      <td className="whitespace-nowrap py-1.5 pl-2 text-right tabular-nums">{fmt(Math.round(r.growth))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Loans are not subtracted. This page uses one return for everything; other pages use each asset's own rates.
          </p>
        </Card>
      )}
    </div>
  );
}
