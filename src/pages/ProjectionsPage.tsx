import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../app/SettingsContext';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LineChart } from '../components/charts/LineChart';
import { inputClass } from '../components/FormField';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { useWealthData } from '../hooks/useWealthData';
import type { Asset } from '../models/asset';
import { projectFamilyWealth, type ProjectedAsset } from '../services/finance/familyProjection';
import { analyseLoan } from '../services/finance/loans';
import { calculateImpliedAnnualRate, projectByYear, roundRowsToRupees, type ProjectionRow } from '../services/finance/projection';
import {
  calculateInflationAdjustedValue,
  SCENARIO_LABELS,
  SCENARIOS,
  type Scenario,
} from '../services/finance/scenarios';
import { formatINR, formatINRCompact } from '../utils/currency';
import { todayISODate } from '../utils/date';

const PRESETS = ['1', '3', '5', '10', '15', '20', '25'] as const;
type PeriodChoice = (typeof PRESETS)[number] | 'custom';
const MAX_YEARS = 50;

const PERIOD_OPTIONS: { value: PeriodChoice; label: string }[] = [
  ...PRESETS.map((p) => ({ value: p, label: `${p}Y` })),
  { value: 'custom', label: 'Custom' },
];
const SCENARIO_OPTIONS = SCENARIOS.map((s) => ({ value: s, label: SCENARIO_LABELS[s] }));
type ValueMode = 'nominal' | 'real';
const MODE_OPTIONS: { value: ValueMode; label: string }[] = [
  { value: 'nominal', label: 'Nominal' },
  { value: 'real', label: "Today's money" },
];
/** Milestones in the scenario comparison table (spec §15). */
const COMPARISON_YEARS = [0, 5, 10, 20];
/** Fixed colour per scenario (validated adjacent pairs of the chart palette). */
const SCENARIO_COLORS: Record<Scenario, string> = {
  conservative: 'var(--series-1)',
  base: 'var(--series-2)',
  optimistic: 'var(--series-3)',
};

export function ProjectionsPage() {
  const { assets, ownerships, contributions, liabilities, wealth, loading, error } = useWealthData();
  const { settings } = useSettings();
  // Projections are estimates: shown in whole rupees.
  const fmt = (n: number) => formatINR(Math.round(n), settings.numberFormat);
  const [choice, setChoice] = useState<PeriodChoice>('10');
  const [customText, setCustomText] = useState('30');
  const [scenario, setScenario] = useState<Scenario>('base');
  const [mode, setMode] = useState<ValueMode>('nominal');
  const [detail, setDetail] = useState<ProjectedAsset<Asset> | null>(null);

  const customYears = Number(customText);
  const customValid = Number.isInteger(customYears) && customYears >= 1 && customYears <= MAX_YEARS;
  const years = choice === 'custom' ? (customValid ? customYears : null) : Number(choice);
  const inflation = settings.inflationRate;
  /** A year-`y` amount in the chosen mode: as is, or in today's money. */
  const adj = (v: number, y: number) => (mode === 'real' ? calculateInflationAdjustedValue(v, inflation, y) : v);

  // One projection per scenario, long enough for both the chosen period and the comparison table.
  const horizon = Math.max(years ?? 0, ...COMPARISON_YEARS);
  const input = { assets, ownerships, contributions, liabilities, classDefaults: settings.classDefaults, today: todayISODate() };
  const byScenario = Object.fromEntries(SCENARIOS.map((s) => [s, projectFamilyWealth(input, s, horizon)])) as Record<
    Scenario,
    ReturnType<typeof projectFamilyWealth<Asset, (typeof contributions)[number]>>
  >;
  const p = byScenario[scenario];
  const hasContributions = contributions.length > 0;
  const assetsWithoutRate = p.assets.filter((a) => a.rate === undefined);
  const contributionsWithoutRate = p.contributions.filter((c) => c.rate === undefined);
  const unplannedLoans = liabilities.filter((l) => analyseLoan(l).kind !== 'schedule');

  const rows: ProjectionRow[] =
    years === null
      ? []
      : roundRowsToRupees(p.totalAssets.slice(0, years + 1).map((v, y) => ({ year: y, value: adj(v, y), growth: null })));
  const final = rows.at(-1);
  const nominalFinal = years === null ? 0 : Math.round(p.totalAssets[years]!);
  const realFinal = years === null ? 0 : Math.round(calculateInflationAdjustedValue(p.totalAssets[years]!, inflation, years));
  const projectedAssets =
    years === null
      ? []
      : [...p.assets].sort((a, b) => b.values[years]! - a.values[years]! || a.asset.name.localeCompare(b.asset.name));
  // A single "overall rate" is only meaningful without new money coming in.
  const implied =
    years && !hasContributions ? calculateImpliedAnnualRate(p.totalAssets[0]!, p.totalAssets[years]!, years) : null;
  const currentYear = new Date().getFullYear();
  const comparisonYears = [...new Set([...COMPARISON_YEARS, ...(years ? [years] : [])])].sort((a, b) => a - b);
  const yearLabel = (y: number) => (y === 0 ? 'Today' : `${y} ${y === 1 ? 'year' : 'years'}`);
  const scenarioName = SCENARIO_LABELS[scenario];

  return (
    <>
      <PageHeader
        title="Projections"
        description="How family wealth could grow, using each asset's own growth rate under each scenario."
      />

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : p.assets.length === 0 && !hasContributions ? (
        <Card className="py-10 text-center">
          <h2 className="font-medium">Nothing to project yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
            Add{' '}
            <Link to="/assets" className="font-medium text-teal-700 underline dark:text-teal-400">
              assets
            </Link>{' '}
            with owners and an expected growth rate to see how they could grow.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <SegmentedControl name="period" label="Projection period" options={PERIOD_OPTIONS} value={choice} onChange={setChoice} />
            {choice === 'custom' && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  aria-label="Custom number of years"
                  inputMode="numeric"
                  className={`${inputClass} w-20`}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value.trim())}
                  aria-invalid={!customValid}
                  aria-describedby="custom-years-hint"
                />
                <span id="custom-years-hint" className={customValid ? 'text-slate-500 dark:text-slate-400' : 'text-red-600 dark:text-red-400'}>
                  {customValid ? 'years' : `Enter whole years from 1 to ${MAX_YEARS}`}
                </span>
              </label>
            )}
          </div>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <SegmentedControl name="scenario" label="Scenario" options={SCENARIO_OPTIONS} value={scenario} onChange={setScenario} />
            <SegmentedControl name="mode" label="Show values" options={MODE_OPTIONS} value={mode} onChange={setMode} />
          </div>

          {assetsWithoutRate.length > 0 && (
            <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <strong>
                {assetsWithoutRate.length} {assetsWithoutRate.length === 1 ? 'asset has' : 'assets have'} no {scenarioName}{' '}
                growth rate
              </strong>{' '}
              and {assetsWithoutRate.length === 1 ? 'is' : 'are'} held at today's value:{' '}
              {assetsWithoutRate.map((a) => a.asset.name).join(', ')}.{' '}
              <Link to="/assets" className="font-medium underline">
                Add rates on the Assets page
              </Link>{' '}
              or set class defaults in{' '}
              <Link to="/settings" className="font-medium underline">
                Settings
              </Link>
            </div>
          )}
          {contributionsWithoutRate.length > 0 && (
            <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <strong>
                {contributionsWithoutRate.length} regular{' '}
                {contributionsWithoutRate.length === 1 ? 'investment has' : 'investments have'} no expected return
              </strong>{' '}
              and {contributionsWithoutRate.length === 1 ? 'is' : 'are'} added without growth:{' '}
              {contributionsWithoutRate.map((b) => b.contribution.name).join(', ')}.{' '}
              <Link to="/investments" className="font-medium underline">
                Add a rate on the Investments page
              </Link>
            </div>
          )}
          {wealth.unownedAssetIds.length > 0 && (
            <p role="status" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {wealth.unownedAssetIds.length} {wealth.unownedAssetIds.length === 1 ? 'asset has' : 'assets have'} no owner and{' '}
              {wealth.unownedAssetIds.length === 1 ? "isn't" : "aren't"} projected.
            </p>
          )}

          {years !== null && final && (
            <>
              <Card>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Family assets in {years} {years === 1 ? 'year' : 'years'} ({currentYear + years}) · {scenarioName}
                </p>
                <p data-testid="projected-total" className="mt-1 text-5xl font-semibold tracking-tight">
                  {fmt(nominalFinal)}
                </p>
                <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
                  <Stat label="Today" value={fmt(p.totalAssets[0]!)} />
                  <Stat
                    label="In today's money"
                    value={<span data-testid="projected-real">{fmt(realFinal)}</span>}
                  />
                  {implied !== null && <Stat label="Overall rate" value={`${implied.toFixed(2)}% a year`} />}
                  {hasContributions && (
                    <>
                      <Stat label="Existing assets grow to" value={fmt(p.assetTotals[years]!)} />
                      <Stat
                        label="Future investments"
                        value={
                          <span data-testid="projected-contributions">
                            {fmt(p.contributionTotals[years]!.value)}
                            <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                              from {fmt(p.contributionTotals[years]!.invested)} invested
                            </span>
                          </span>
                        }
                      />
                    </>
                  )}
                </dl>
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Family's share of each asset, compounded yearly at that asset's {scenarioName} rate
                  {hasContributions && ', plus regular investments made from today at their expected return'}. "Today's
                  money" divides by {inflation}% inflation a year (change it in Settings). Rounded to the nearest rupee.
                </p>
              </Card>

              <Card className="mt-6">
                <h2 className="font-semibold">Scenarios compared</h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Projected net worth (assets, future investments, minus loans)
                  {mode === 'real' ? " in today's money" : ''}.
                </p>
                {years > 0 && (
                  <div className="mt-4">
                    <LineChart
                      label={`Projected net worth by scenario over ${years} years`}
                      series={SCENARIOS.map((s) => ({
                        key: s,
                        label: SCENARIO_LABELS[s],
                        color: SCENARIO_COLORS[s],
                        values: byScenario[s].netWorth.slice(0, years + 1).map((v, y) => Math.round(adj(v, y))),
                      }))}
                      xLabels={Array.from({ length: years + 1 }, (_, y) => (y === 0 ? 'Today' : `${currentYear + y}`))}
                      format={fmt}
                      formatAxis={(n) => formatINRCompact(n).replace(' Lakh', 'L').replace(' Crore', 'Cr')}
                    />
                  </div>
                )}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Scenario comparison</caption>
                    <thead className="text-xs text-slate-500 dark:text-slate-400">
                      <tr>
                        <th scope="col" className="pb-1 text-left font-normal">Period</th>
                        {SCENARIOS.map((s) => (
                          <th key={s} scope="col" className="pb-1 text-right font-normal">
                            {SCENARIO_LABELS[s]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonYears.map((y) => (
                        <tr key={y} className="border-t border-slate-100 dark:border-slate-800">
                          <th scope="row" className="whitespace-nowrap py-1.5 text-left font-normal">
                            {yearLabel(y)}
                          </th>
                          {SCENARIOS.map((s) => (
                            <td
                              key={s}
                              className={`whitespace-nowrap py-1.5 pl-2 text-right tabular-nums ${s === scenario ? 'font-semibold' : ''}`}
                            >
                              {fmt(adj(byScenario[s].netWorth[y]!, y))}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {liabilities.length > 0 && (
                <Card className="mt-6">
                  <h2 className="font-semibold">Net worth and loans</h2>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    Loans fall as EMIs are paid. EMIs are paid from income, so they don't reduce the assets above.
                  </p>
                  {unplannedLoans.length > 0 && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      Held at today's balance (no repayment plan): {unplannedLoans.map((l) => l.name).join(', ')}.{' '}
                      <Link to="/liabilities" className="font-medium underline">
                        Add EMI details
                      </Link>
                    </p>
                  )}
                  <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                    <Stat label={`Loans in ${years}Y`} value={<span data-testid="projected-debt">{fmt(adj(p.debt[years]!, years))}</span>} />
                    <Stat
                      label={`Net worth in ${years}Y`}
                      value={<span data-testid="projected-net-worth">{fmt(adj(p.netWorth[years]!, years))}</span>}
                    />
                  </dl>
                  <table className="mt-4 w-full text-sm">
                    <caption className="sr-only">Net worth by year</caption>
                    <thead className="text-xs text-slate-500 dark:text-slate-400">
                      <tr>
                        <th scope="col" className="pb-1 text-left font-normal">Year</th>
                        <th scope="col" className="hidden pb-1 text-right font-normal sm:table-cell">Assets</th>
                        <th scope="col" className="pb-1 text-right font-normal">Loans</th>
                        <th scope="col" className="pb-1 text-right font-normal">Net worth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.year} className="border-t border-slate-100 dark:border-slate-800">
                          <th scope="row" className="py-1.5 text-left font-normal">
                            {r.year === 0 ? 'Today' : `Year ${r.year}`}
                          </th>
                          <td className="hidden py-1.5 text-right tabular-nums sm:table-cell">{fmt(adj(p.totalAssets[r.year]!, r.year))}</td>
                          <td className="py-1.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{fmt(adj(p.debt[r.year]!, r.year))}</td>
                          <td className="py-1.5 text-right font-medium tabular-nums">{fmt(adj(p.netWorth[r.year]!, r.year))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <Card>
                  <h2 className="font-semibold">Family total by year</h2>
                  {mode === 'real' && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">In today's money</p>}
                  <div className="mt-3">
                    <ProjectionTable
                      rows={rows}
                      fmt={fmt}
                      currentYear={currentYear}
                      caption="Family total by year"
                      changeHeader={hasContributions ? 'Change' : 'Growth'}
                    />
                  </div>
                </Card>

                {projectedAssets.length > 0 && (
                  <Card padded={false} className="overflow-hidden">
                    <div className="px-5 pt-5">
                      <h2 className="font-semibold">By asset</h2>
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Select an asset for its year-by-year projection.</p>
                    </div>
                    <table className="mt-3 w-full text-sm">
                      <caption className="sr-only">Projection by asset</caption>
                      <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                        <tr>
                          <th scope="col" className="px-4 py-2.5 text-left font-medium">Asset</th>
                          <th scope="col" className="px-2 py-2.5 text-right font-medium">Rate</th>
                          <th scope="col" className="hidden px-2 py-2.5 text-right font-medium sm:table-cell">Today</th>
                          <th scope="col" className="px-4 py-2.5 text-right font-medium">In {years}Y</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {projectedAssets.map((a) => (
                          <tr key={a.asset.id}>
                            <th scope="row" className="px-4 py-2.5 text-left font-normal">
                              <button
                                type="button"
                                onClick={() => setDetail(a)}
                                className="text-left font-medium hover:text-teal-700 hover:underline dark:hover:text-teal-400"
                              >
                                {a.asset.name}
                              </button>
                              <span className="block text-xs text-slate-500 dark:text-slate-400">{a.asset.assetClass}</span>
                            </th>
                            <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">
                              {a.rate === undefined ? <Badge tone="notice">No rate</Badge> : `${a.rate}%`}
                              {a.source === 'default' && (
                                <span className="block text-xs text-slate-500 dark:text-slate-400">class default</span>
                              )}
                            </td>
                            <td className="hidden whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-slate-500 sm:table-cell dark:text-slate-400">
                              {fmt(a.today)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">
                              {fmt(adj(a.values[years]!, years))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
              </div>

              {p.contributions.length > 0 && (
                <Card padded={false} className="mt-6 overflow-hidden">
                  <div className="px-5 pt-5">
                    <h2 className="font-semibold">Regular investments</h2>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                      Contributions made from today, and what they could be worth in {years} {years === 1 ? 'year' : 'years'}.
                    </p>
                  </div>
                  <table className="mt-3 w-full text-sm">
                    <caption className="sr-only">Projection by regular investment</caption>
                    <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 text-left font-medium">Investment</th>
                        <th scope="col" className="px-2 py-2.5 text-right font-medium">Rate</th>
                        <th scope="col" className="hidden px-2 py-2.5 text-right font-medium sm:table-cell">Invested</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">In {years}Y</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {p.contributions.map(({ contribution: c, rate, rows: r }) => (
                        <tr key={c.id}>
                          <th scope="row" className="px-4 py-2.5 text-left font-medium">{c.name}</th>
                          <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">
                            {rate === undefined ? <Badge tone="notice">No rate</Badge> : `${rate}%`}
                          </td>
                          <td className="hidden whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-slate-500 sm:table-cell dark:text-slate-400">
                            {fmt(r[years]!.invested)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">{fmt(adj(r[years]!.value, years))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {detail && years !== null && (
        <Modal title={detail.asset.name} onClose={() => setDetail(null)}>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            {detail.rate === undefined ? (
              <>No {scenarioName} growth rate set, so the value is held flat. Edit the asset to add one.</>
            ) : (
              <>
                Family's share of {fmt(detail.today)}, growing at {detail.rate}% a year ({scenarioName}
                {detail.source === 'default' ? ', class default from Settings' : ''}).
              </>
            )}
          </p>
          <ProjectionTable
            rows={roundRowsToRupees(projectByYear(detail.today, detail.rate ?? 0, years))}
            fmt={fmt}
            currentYear={currentYear}
            caption={`${detail.asset.name} projection`}
            valueHeader="Asset value"
          />
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => setDetail(null)}>
              Close
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}

function ProjectionTable({
  rows,
  fmt,
  currentYear,
  caption,
  valueHeader = 'Value',
  changeHeader = 'Growth',
}: {
  rows: ProjectionRow[];
  fmt: (n: number) => string;
  currentYear: number;
  caption: string;
  valueHeader?: string;
  changeHeader?: string;
}) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="text-xs text-slate-500 dark:text-slate-400">
        <tr>
          <th scope="col" className="pb-1 text-left font-normal">Year</th>
          <th scope="col" className="pb-1 text-right font-normal">{valueHeader}</th>
          <th scope="col" className="pb-1 text-right font-normal">{changeHeader}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.year} className="border-t border-slate-100 dark:border-slate-800">
            <th scope="row" className="py-1.5 text-left font-normal">
              {r.year === 0 ? 'Today' : `Year ${r.year}`}
              {r.year > 0 && <span className="ml-1.5 text-xs text-slate-400">{currentYear + r.year}</span>}
            </th>
            <td className="py-1.5 text-right tabular-nums">{fmt(r.value)}</td>
            <td className="py-1.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
              {r.growth === null ? '—' : `${r.growth >= 0 ? '+' : ''}${fmt(r.growth)}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
