import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../app/SettingsContext';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { inputClass } from '../components/FormField';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { useWealthData } from '../hooks/useWealthData';
import type { Asset } from '../models/asset';
import { calculateFamilyOwnedValue } from '../services/finance/allocation';
import { projectContributions } from '../services/finance/contributionProjection';
import { analyseLoan, projectTotalDebtByYear } from '../services/finance/loans';
import {
  calculateFamilyProjection,
  calculateFutureValue,
  calculateImpliedAnnualRate,
  projectByYear,
  roundRowsToRupees,
  type ProjectionRow,
} from '../services/finance/projection';
import { formatINR } from '../utils/currency';
import { todayISODate } from '../utils/date';

const PRESETS = ['1', '3', '5', '10', '15', '20', '25'] as const;
type PeriodChoice = (typeof PRESETS)[number] | 'custom';
const MAX_YEARS = 50;

const PERIOD_OPTIONS: { value: PeriodChoice; label: string }[] = [
  ...PRESETS.map((p) => ({ value: p, label: `${p}Y` })),
  { value: 'custom', label: 'Custom' },
];

type Projected = { asset: Asset; today: number; future: number; rate: number | undefined };

export function ProjectionsPage() {
  const { assets, ownerships, contributions, liabilities, wealth, loading, error } = useWealthData();
  const { settings } = useSettings();
  // Projections are estimates: shown in whole rupees.
  const fmt = (n: number) => formatINR(Math.round(n), settings.numberFormat);
  const [choice, setChoice] = useState<PeriodChoice>('10');
  const [customText, setCustomText] = useState('30');
  const [detail, setDetail] = useState<Projected | null>(null);

  const customYears = Number(customText);
  const customValid = Number.isInteger(customYears) && customYears >= 1 && customYears <= MAX_YEARS;
  const years = choice === 'custom' ? (customValid ? customYears : null) : Number(choice);

  // Project the family-owned value of every owned asset at its own Base rate.
  const owned = assets
    .map((asset) => ({ asset, today: calculateFamilyOwnedValue(asset, ownerships), rate: asset.baseGrowthRate }))
    .filter((a) => a.today > 0);
  const projected: Projected[] = owned
    .map((a) => ({ ...a, future: years === null ? a.today : calculateFutureValue(a.today, a.rate ?? 0, years) }))
    .sort((a, b) => b.future - a.future || a.asset.name.localeCompare(b.asset.name));
  const withoutRate = owned.filter((a) => a.rate === undefined);
  const assetRows =
    years === null
      ? []
      : calculateFamilyProjection(
          owned.map((a) => ({ id: a.asset.id, presentValue: a.today, annualRatePct: a.rate })),
          years,
        );
  // Future regular investments (only those made after today), each at its own rate.
  const assetsById = new Map(assets.map((a) => [a.id, a]));
  const contributed = years === null ? null : projectContributions(contributions, assetsById, years, todayISODate());
  const contributionsWithoutRate = contributed?.byContribution.filter((b) => b.rate === undefined) ?? [];
  const hasContributions = contributions.length > 0;
  const rows = roundRowsToRupees(
    assetRows.map((r, y) => ({ year: r.year, value: r.value + (contributed?.rows[y]?.value ?? 0), growth: null })),
  );
  const final = rows.at(-1);
  // Loans reduce along their repayment schedules; loans without one are held flat.
  const debt = years === null ? [] : projectTotalDebtByYear(liabilities, years).map(Math.round);
  const unplannedLoans = liabilities.filter((l) => analyseLoan(l).kind !== 'schedule');
  const assetsFinal = assetRows.at(-1)?.value ?? 0;
  const contributedFinal = contributed?.rows.at(-1);
  // A single "overall rate" is only meaningful without new money coming in.
  const implied =
    final && years && !hasContributions ? calculateImpliedAnnualRate(rows[0]!.value, final.value, years) : null;
  const currentYear = new Date().getFullYear();

  return (
    <>
      <PageHeader
        title="Projections"
        description="How the family's assets could grow, using each asset's own Base growth rate."
      />

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : owned.length === 0 && !hasContributions ? (
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

          {withoutRate.length > 0 && (
            <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <strong>
                {withoutRate.length} {withoutRate.length === 1 ? 'asset has' : 'assets have'} no Base growth rate
              </strong>{' '}
              and {withoutRate.length === 1 ? 'is' : 'are'} held at today's value: {withoutRate.map((a) => a.asset.name).join(', ')}.{' '}
              <Link to="/assets" className="font-medium underline">
                Add rates on the Assets page
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
                  Family assets in {years} {years === 1 ? 'year' : 'years'} ({currentYear + years})
                </p>
                <p data-testid="projected-total" className="mt-1 text-5xl font-semibold tracking-tight">
                  {fmt(final.value)}
                </p>
                <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
                  <Stat label="Today" value={fmt(rows[0]!.value)} />
                  <Stat label={hasContributions ? 'Change' : 'Growth'} value={`${final.value - rows[0]!.value >= 0 ? '+' : ''}${fmt(final.value - rows[0]!.value)}`} />
                  {implied !== null && <Stat label="Overall rate" value={`${implied.toFixed(2)}% a year`} />}
                  {hasContributions && contributedFinal && (
                    <>
                      <Stat label="Existing assets grow to" value={fmt(assetsFinal)} />
                      <Stat
                        label="Future investments"
                        value={
                          <span data-testid="projected-contributions">
                            {fmt(contributedFinal.value)}
                            <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                              from {fmt(contributedFinal.invested)} invested
                            </span>
                          </span>
                        }
                      />
                    </>
                  )}
                </dl>
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Family's share of each asset, compounded yearly at that asset's Base rate
                  {hasContributions && ', plus regular investments made from today at their expected return'}, rounded
                  to the nearest rupee.
                </p>
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
                    <Stat label={`Loans in ${years}Y`} value={<span data-testid="projected-debt">{fmt(debt.at(-1)!)}</span>} />
                    <Stat label={`Net worth in ${years}Y`} value={<span data-testid="projected-net-worth">{fmt(final.value - debt.at(-1)!)}</span>} />
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
                          <td className="hidden py-1.5 text-right tabular-nums sm:table-cell">{fmt(r.value)}</td>
                          <td className="py-1.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{fmt(debt[r.year]!)}</td>
                          <td className="py-1.5 text-right font-medium tabular-nums">{fmt(r.value - debt[r.year]!)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <Card>
                  <h2 className="font-semibold">Family total by year</h2>
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

                {projected.length > 0 && (
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
                        {projected.map((p) => (
                          <tr key={p.asset.id}>
                            <th scope="row" className="px-4 py-2.5 text-left font-normal">
                              <button
                                type="button"
                                onClick={() => setDetail(p)}
                                className="text-left font-medium hover:text-teal-700 hover:underline dark:hover:text-teal-400"
                              >
                                {p.asset.name}
                              </button>
                              <span className="block text-xs text-slate-500 dark:text-slate-400">{p.asset.assetClass}</span>
                            </th>
                            <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">
                              {p.rate === undefined ? <Badge tone="notice">No rate</Badge> : `${p.rate}%`}
                            </td>
                            <td className="hidden whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-slate-500 sm:table-cell dark:text-slate-400">
                              {fmt(p.today)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">{fmt(p.future)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
              </div>

              {contributed && contributed.byContribution.length > 0 && (
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
                      {contributed.byContribution.map(({ contribution: c, rate, rows: r }) => (
                        <tr key={c.id}>
                          <th scope="row" className="px-4 py-2.5 text-left font-medium">{c.name}</th>
                          <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">
                            {rate === undefined ? <Badge tone="notice">No rate</Badge> : `${rate}%`}
                          </td>
                          <td className="hidden whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-slate-500 sm:table-cell dark:text-slate-400">
                            {fmt(r.at(-1)!.invested)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">{fmt(r.at(-1)!.value)}</td>
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
              <>No Base growth rate set, so the value is held flat. Edit the asset to add one.</>
            ) : (
              <>
                Family's share of {fmt(detail.today)}, growing at {detail.rate}% a year.
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
