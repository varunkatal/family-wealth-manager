import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../app/SettingsContext';
import { useSavesToGoogle } from '../app/SyncContext';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { BarList } from '../components/charts/BarList';
import { SliceTable } from '../components/charts/SliceTable';
import { StackedBar } from '../components/charts/StackedBar';
import { useChartTooltip } from '../components/charts/useChartTooltip';
import { classColors, colourSlices, LIQUIDITY_COLORS } from '../features/dashboard/chartColors';
import { recentChanges } from '../features/dashboard/recentChanges';
import { DemoDataBanner } from '../features/demo/DemoDataBanner';
import { useWealthData } from '../hooks/useWealthData';
import { liquidityLabel } from '../models/asset';
import { getAssetClassOptions } from '../models/assetCategories';
import {
  calculateAssetAllocation,
  calculateLiquidityBreakdown,
  calculateMemberAllocation,
  calculateTopAssets,
} from '../services/finance/allocation';
import { formatINR, formatShare } from '../utils/currency';

export function DashboardPage() {
  const { members, assets, ownerships, liabilities, wealth, loading, error, run } = useWealthData();
  const { settings } = useSettings();
  const google = useSavesToGoogle();
  const fmt = (n: number) => formatINR(n, settings.numberFormat);
  const unowned = wealth.unownedAssetIds.length;
  const demoCount = [...members, ...assets, ...liabilities].filter((r) => r.isDemo).length;
  const hasData = assets.length > 0 || liabilities.length > 0;

  return (
    <>
      <PageHeader title="Dashboard" description="An overview of your family's wealth." />

      <DemoDataBanner demoCount={demoCount} run={run} />

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <Card>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Net worth</p>
        <p
          data-testid="net-worth"
          className={`mt-1 text-4xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-5xl ${loading ? 'text-slate-300 dark:text-slate-600' : wealth.netWorth < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
        >
          {loading ? '—' : fmt(wealth.netWorth)}
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Total assets</dt>
            <dd data-testid="total-assets" className="text-lg font-semibold">
              {loading ? '—' : fmt(wealth.totalAssets)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Total liabilities</dt>
            <dd data-testid="total-liabilities" className="text-lg font-semibold">
              {loading ? '—' : fmt(wealth.totalLiabilities)}
            </dd>
          </div>
        </dl>
      </Card>

      {!loading && unowned > 0 && (
        <p role="status" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {unowned} {unowned === 1 ? 'asset has' : 'assets have'} no owner and {unowned === 1 ? "isn't" : "aren't"} included
          in these figures.{' '}
          <Link to="/assets" className="font-medium underline">
            Assign owners
          </Link>
        </p>
      )}

      {!loading && !hasData && (
        <Card className="mt-6">
          <h2 className="font-medium">No data yet</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {members.length === 0 ? (
              <>
                Start by adding your{' '}
                <Link to="/family" className="font-medium text-teal-700 underline dark:text-teal-400">
                  family members
                </Link>
                , then their assets.
              </>
            ) : (
              <>
                Add{' '}
                <Link to="/assets" className="font-medium text-teal-700 underline dark:text-teal-400">
                  assets
                </Link>{' '}
                and{' '}
                <Link to="/liabilities" className="font-medium text-teal-700 underline dark:text-teal-400">
                  liabilities
                </Link>{' '}
                to see your net worth.
              </>
            )}{' '}
            {google ? 'Everything you enter is saved to your own Google Sheet.' : 'Everything you enter stays in this browser on this device.'}
          </p>
        </Card>
      )}

      {!loading && hasData && <DashboardCharts fmt={fmt} data={{ members, assets, ownerships, liabilities, wealth }} />}
    </>
  );
}

type Data = Pick<ReturnType<typeof useWealthData>, 'members' | 'assets' | 'ownerships' | 'liabilities' | 'wealth'>;

function DashboardCharts({ data, fmt }: { data: Data; fmt: (n: number) => string }) {
  const { members, assets, ownerships, liabilities, wealth } = data;
  const colors = classColors(getAssetClassOptions(assets));
  const allocation = colourSlices(calculateAssetAllocation(assets, ownerships), colors);
  const liquidity = calculateLiquidityBreakdown(assets, ownerships).map((s) => ({
    ...s,
    label: liquidityLabel(s.key),
    color: LIQUIDITY_COLORS[s.key],
  }));
  const liquidShare = liquidity.find((s) => s.key === 'liquid')?.percentage ?? 0;

  const wealthById = new Map(wealth.byMember.map((w) => [w.memberId, w]));
  // Members who hold something, plus active members with nothing yet.
  const shownMembers = members.filter((m) => {
    const w = wealthById.get(m.id);
    return m.isActive || (w && (w.assets !== 0 || w.liabilities !== 0));
  });
  const memberMix = shownMembers.map((m) => ({
    member: m,
    slices: colourSlices(calculateMemberAllocation(m.id, assets, ownerships), colors),
    total: wealthById.get(m.id)?.assets ?? 0,
  }));
  const maxMemberAssets = Math.max(...memberMix.map((m) => m.total), 0);
  const mixTooltip = useChartTooltip();

  const top = calculateTopAssets(assets, ownerships, 5);
  const changes = recentChanges([
    { kind: 'Asset', records: assets },
    { kind: 'Liability', records: liabilities },
    { kind: 'Family member', records: members },
  ]);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <ChartCard title="Asset allocation" subtitle="Family-owned value by asset class">
        {allocation.length === 0 ? (
          <Empty>No owned assets yet.</Empty>
        ) : (
          <>
            <StackedBar
              label="Asset allocation by class"
              format={fmt}
              segments={allocation.map((s) => ({ ...s, label: s.key }))}
            />
            <div className="mt-4">
              <SliceTable
                caption="Asset allocation by class"
                format={fmt}
                rows={allocation.map((s) => ({
                  key: s.key,
                  label: s.key,
                  value: s.value,
                  percentage: s.percentage,
                  color: s.color,
                  note: s.folded?.length ? `Includes ${s.folded.join(', ')}` : undefined,
                }))}
                total={{ label: 'Total assets', value: wealth.totalAssets }}
              />
            </div>
          </>
        )}
      </ChartCard>

      <ChartCard title="Liquid vs illiquid" subtitle={allocation.length ? `${formatShare(liquidShare)} of assets can be turned into cash within days` : undefined}>
        {liquidity.length === 0 ? (
          <Empty>No owned assets yet.</Empty>
        ) : (
          <>
            <StackedBar label="Assets by liquidity" format={fmt} segments={liquidity} />
            <div className="mt-4">
              <SliceTable
                caption="Assets by liquidity"
                format={fmt}
                rows={liquidity.map((s) => ({ key: s.key, label: s.label, value: s.value, percentage: s.percentage, color: s.color }))}
              />
            </div>
          </>
        )}
      </ChartCard>

      <ChartCard title="Net worth by family member" subtitle="Each person's share of assets, minus what they owe">
        {shownMembers.length === 0 ? (
          <Empty>No family members yet.</Empty>
        ) : (
          <>
            <BarList
              label="Net worth by family member"
              format={fmt}
              color="var(--series-1)"
              items={shownMembers.map((m) => ({ key: m.id, label: m.name, value: wealthById.get(m.id)?.netWorth ?? 0 }))}
            />
            <div className="relative mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Wealth by family member</caption>
                <thead className="text-xs text-slate-500 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="pb-1 text-left font-normal">Member</th>
                    <th scope="col" className="pb-1 text-right font-normal">Assets</th>
                    <th scope="col" className="hidden pb-1 text-right font-normal sm:table-cell">Liabilities</th>
                    <th scope="col" className="pb-1 text-right font-normal">Net worth</th>
                  </tr>
                </thead>
                <tbody>
                  {shownMembers.map((m) => {
                    const w = wealthById.get(m.id);
                    return (
                      <tr key={m.id} className="border-t border-slate-100 dark:border-slate-800">
                        <th scope="row" className="py-1.5 pr-2 text-left font-normal">{m.name}</th>
                        <td className="py-1.5 text-right tabular-nums">{fmt(w?.assets ?? 0)}</td>
                        <td className="hidden py-1.5 text-right tabular-nums sm:table-cell">{fmt(w?.liabilities ?? 0)}</td>
                        <td className={`py-1.5 text-right font-medium tabular-nums ${(w?.netWorth ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                          {fmt(w?.netWorth ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ChartCard>

      <ChartCard title="Asset class distribution" subtitle="What each person owns, by asset class (bars on one scale)">
        {maxMemberAssets === 0 ? (
          <Empty>No owned assets yet.</Empty>
        ) : (
          <div ref={mixTooltip.containerRef} className="relative">
            <ul className="space-y-3" aria-label="Asset class distribution by member">
              {memberMix.map(({ member, slices, total }) => (
                <li key={member.id}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="truncate text-slate-700 dark:text-slate-200">{member.name}</span>
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">{fmt(total)}</span>
                  </div>
                  {total > 0 ? (
                    <StackedBar
                      label={`${member.name} by asset class`}
                      format={fmt}
                      tooltip={mixTooltip}
                      lengthPercent={(total / maxMemberAssets) * 100}
                      segments={slices.map((s) => ({ ...s, label: s.key }))}
                    />
                  ) : (
                    <div className="h-6 rounded-[4px] bg-[var(--chart-track)]" aria-label={`${member.name} owns no assets`} />
                  )}
                </li>
              ))}
            </ul>
            {mixTooltip.tooltip}
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300" aria-label="Legend">
              {allocation.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: s.color }} aria-hidden="true" />
                  {s.key}
                </li>
              ))}
            </ul>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Top assets" subtitle="Largest holdings by family-owned value">
        {top.length === 0 ? (
          <Empty>No owned assets yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Top assets</caption>
            <thead className="text-xs text-slate-500 dark:text-slate-400">
              <tr>
                <th scope="col" className="pb-1 text-left font-normal">Asset</th>
                <th scope="col" className="pb-1 text-right font-normal">Value</th>
                <th scope="col" className="w-16 pb-1 text-right font-normal">Share</th>
              </tr>
            </thead>
            <tbody>
              {top.map(({ asset, familyValue, percentage }) => (
                <tr key={asset.id} className="border-t border-slate-100 dark:border-slate-800">
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: colors.get(asset.assetClass) ?? colors.get('Other') }} aria-hidden="true" />
                      <span className="min-w-0">
                        {asset.name}
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{asset.assetClass}</span>
                      </span>
                    </span>
                  </th>
                  <td className="py-1.5 text-right tabular-nums">{fmt(familyValue)}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{formatShare(percentage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ChartCard>

      <ChartCard title="Recent changes" subtitle="Latest additions and edits">
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {changes.map((c) => (
            <li key={c.key} className="flex items-baseline justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="font-medium">{c.name}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {c.action} · {c.kind}
                </span>
              </span>
              <time dateTime={c.at} className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {new Date(c.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </time>
            </li>
          ))}
        </ul>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>;
}
