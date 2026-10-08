import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSettings } from '../app/SettingsContext';
import { DemoBadge } from '../components/Badge';
import { Card } from '../components/Card';
import { SliceTable } from '../components/charts/SliceTable';
import { StackedBar } from '../components/charts/StackedBar';
import { classColors, colourSlices } from '../features/dashboard/chartColors';
import { useWealthData } from '../hooks/useWealthData';
import { liquidityLabel } from '../models/asset';
import { getAssetClassOptions } from '../models/assetCategories';
import { calculateMemberAllocation, calculateMemberHoldings } from '../services/finance/allocation';
import { analyseLoan } from '../services/finance/loans';
import { FREQUENCY_LABELS, isActiveOn, monthlyEquivalent } from '../services/finance/sip';
import { formatINR } from '../utils/currency';
import { ageFromDateOfBirth, formatISODate, todayISODate } from '../utils/date';

const th = 'px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400';
const thNum = 'px-3 py-2 text-right font-medium text-slate-500 dark:text-slate-400';
const td = 'px-3 py-2.5 align-top';
const tdNum = 'px-3 py-2.5 text-right align-top tabular-nums whitespace-nowrap';

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="min-w-0">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/** An ownership share as entered: 50%, 33.33%. */
const sharePct = (p: number) => `${Number(p.toFixed(2))}%`;

const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>;

/** One family member: their net worth, what they own (with shares), what they owe and what they invest regularly. */
export function MemberDetailPage() {
  const { memberId } = useParams();
  const { members, assets, ownerships, liabilities, contributions, wealth, memberById, loading, error } = useWealthData();
  const { settings } = useSettings();
  const fmt = (n: number) => formatINR(n, settings.numberFormat);

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  const member = members.find((m) => m.id === memberId);
  if (!member) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Family member not found</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">They may have been deleted.</p>
        <Link to="/family" className="mt-4 inline-block font-medium text-teal-700 underline dark:text-teal-400">
          Back to Family
        </Link>
      </Card>
    );
  }

  const today = todayISODate();
  const totals = wealth.byMember.find((w) => w.memberId === member.id) ?? { assets: 0, liabilities: 0, netWorth: 0 };
  const holdings = calculateMemberHoldings(member.id, assets, ownerships);
  const colors = classColors(getAssetClassOptions(assets));
  const allocation = colourSlices(calculateMemberAllocation(member.id, assets, ownerships), colors);
  const loans = liabilities.filter((l) => l.ownerId === member.id).sort((a, b) => b.currentOutstanding - a.currentOutstanding);
  const investments = contributions.filter((c) => c.ownerId === member.id);
  const activeInvestments = investments.filter((c) => isActiveOn(c, today));
  const monthlyInvesting = activeInvestments.reduce((s, c) => s + monthlyEquivalent(c.amount, c.frequency), 0);
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const details = [
    member.relationship,
    member.dateOfBirth && `Born ${formatISODate(member.dateOfBirth)} (age ${ageFromDateOfBirth(member.dateOfBirth)})`,
    !member.isActive && 'Inactive',
  ].filter(Boolean);

  return (
    <>
      <Link to="/family" className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400">
        ← Family
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight">{member.name}</h1>
        {member.isDemo && <DemoBadge />}
      </div>
      {details.length > 0 && <p className="-mt-5 mb-6 text-sm text-slate-600 dark:text-slate-400">{details.join(' · ')}</p>}

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <Card className="mb-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Net worth</p>
        <p className={`mt-1 break-words text-3xl font-semibold tabular-nums sm:text-4xl ${totals.netWorth < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
          {fmt(totals.netWorth)}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3 dark:border-slate-800">
          <div className="min-w-0">
            <dt className="text-sm text-slate-500 dark:text-slate-400">Assets (their share)</dt>
            <dd className="text-lg font-semibold tabular-nums">{fmt(totals.assets)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm text-slate-500 dark:text-slate-400">Liabilities</dt>
            <dd className="text-lg font-semibold tabular-nums">{fmt(totals.liabilities)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm text-slate-500 dark:text-slate-400">Investing per month</dt>
            <dd className="text-lg font-semibold tabular-nums">{fmt(monthlyInvesting)}</dd>
          </div>
        </dl>
        {member.notes && <p className="mt-4 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{member.notes}</p>}
      </Card>

      <div className="grid gap-6">
        <Section title="By asset class" subtitle={`What ${member.name} owns in each asset class (their share only)`}>
          {allocation.length === 0 ? (
            <Empty>No assets owned yet.</Empty>
          ) : (
            <>
              <StackedBar label={`${member.name} by asset class`} format={fmt} segments={allocation.map((s) => ({ ...s, label: s.key }))} />
              <div className="mt-4">
                <SliceTable
                  caption={`${member.name} by asset class`}
                  format={fmt}
                  rows={allocation.map((s) => ({ key: s.key, label: s.key, value: s.value, percentage: s.percentage, color: s.color, note: s.folded?.join(', ') }))}
                  total={{ label: 'Total assets', value: totals.assets }}
                />
              </div>
            </>
          )}
        </Section>

        <Section title="Assets and investments" subtitle="Each holding with this person’s ownership share. Jointly owned assets count only their share.">
          {holdings.length === 0 ? (
            <Empty>
              {member.name} doesn’t own any assets yet. Add owners on the{' '}
              <Link to="/assets" className="font-medium text-teal-700 underline dark:text-teal-400">
                Assets
              </Link>{' '}
              page.
            </Empty>
          ) : (
            <div className="-mx-3 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Assets owned by {member.name}</caption>
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th scope="col" className={th}>Asset</th>
                    <th scope="col" className={thNum}>Share</th>
                    <th scope="col" className={thNum}>Their value</th>
                    <th scope="col" className={`${thNum} hidden sm:table-cell`}>Full value</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(({ asset, percentage, value, coOwners }) => (
                    <tr key={asset.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className={td}>
                        <div className="flex flex-wrap items-center gap-1.5 font-medium">
                          {asset.name}
                          {asset.isDemo && <DemoBadge />}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {[asset.subcategory ?? asset.assetClass, asset.institution, liquidityLabel(asset.liquidity)].filter(Boolean).join(' · ')}
                        </div>
                        {/* On phones the full-value column is hidden; show it here instead. */}
                        <div className="text-xs text-slate-500 sm:hidden dark:text-slate-400">Full value {fmt(asset.currentValue)}</div>
                        {coOwners.length > 0 && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Shared with {coOwners.map((o) => `${memberById.get(o.familyMemberId)?.name ?? 'Unknown'} ${sharePct(o.percentage)}`).join(', ')}
                          </div>
                        )}
                      </td>
                      <td className={tdNum}>{sharePct(percentage)}</td>
                      <td className={`${tdNum} font-medium`}>{fmt(value)}</td>
                      <td className={`${tdNum} hidden text-slate-500 sm:table-cell dark:text-slate-400`}>{fmt(asset.currentValue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 font-semibold dark:border-slate-700">
                    <td className={td} colSpan={2}>
                      Total
                    </td>
                    <td className={tdNum}>{fmt(totals.assets)}</td>
                    <td className="hidden sm:table-cell" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Regular investments (SIPs)" subtitle={activeInvestments.length > 0 ? `${fmt(monthlyInvesting)} a month in active investments` : undefined}>
            {investments.length === 0 ? (
              <Empty>No regular investments.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {investments.map((c) => {
                  const linked = c.linkedAssetId ? assetById.get(c.linkedAssetId) : undefined;
                  const active = isActiveOn(c, today);
                  return (
                    <li key={c.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {[linked && `Into ${linked.name}`, c.annualIncrease ? `+${c.annualIncrease}% a year` : null, !active && 'Not active today']
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <div className="font-medium">{fmt(c.amount)}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{FREQUENCY_LABELS[c.frequency]}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Liabilities" subtitle={loans.length > 0 ? `${fmt(totals.liabilities)} outstanding` : undefined}>
            {loans.length === 0 ? (
              <Empty>No loans or other liabilities.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {loans.map((l) => {
                  const plan = analyseLoan(l);
                  return (
                    <li key={l.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 font-medium">
                          {l.name}
                          {l.isDemo && <DemoBadge />}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {[l.type, l.interestRate !== undefined && `${l.interestRate}% interest`, plan.kind === 'schedule' && plan.emi > 0 && `EMI ${fmt(plan.emi)}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <div className="shrink-0 text-right font-medium tabular-nums">{fmt(l.currentOutstanding)}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
