import type { ReactNode } from 'react';
import { Button } from '../../components/Button';
import { liquidityLabel, type Asset } from '../../models/asset';
import type { FamilyMember } from '../../models/familyMember';
import type { AssetOwnership } from '../../models/ownership';
import { calculateFamilySharePercentage, calculateOwnershipValue } from '../../services/finance/netWorth';
import { formatINRCompact, formatINRExact } from '../../utils/currency';
import { formatISODate } from '../../utils/date';

const amount = (n: number) => (
  <>
    {formatINRExact(n)}
    {n >= 1e5 && <span className="text-slate-500 dark:text-slate-400"> ({formatINRCompact(n)})</span>}
  </>
);

const rate = (n: number | undefined) => (n === undefined ? 'Not set' : `${n}%`);

type AssetDetailsProps = {
  asset: Asset;
  ownerships: AssetOwnership[];
  memberById: Map<string, FamilyMember>;
  onEdit: () => void;
  onDelete: () => void;
};

export function AssetDetails({ asset, ownerships, memberById, onEdit, onDelete }: AssetDetailsProps) {
  const familyShare = calculateFamilySharePercentage(asset.id, ownerships);
  const ownership: ReactNode =
    ownerships.length === 0 ? (
      <span className="font-medium text-red-700 dark:text-red-400">No owner. Not counted in net worth until one is assigned.</span>
    ) : (
      <ul className="space-y-0.5">
        {ownerships.map((o) => (
          <li key={o.id}>
            {memberById.get(o.familyMemberId)?.name ?? 'Unknown member'} · {o.percentage}% ·{' '}
            <span className="tabular-nums">{formatINRExact(calculateOwnershipValue(asset.currentValue, o.percentage))}</span>
          </li>
        ))}
        {familyShare < 100 && (
          <li className="text-slate-500 dark:text-slate-400">
            Family share {familyShare}% · {Math.round((100 - familyShare) * 100) / 100}% owned outside the family
          </li>
        )}
      </ul>
    );

  const rows: [string, ReactNode][] = [
    ['Category', [asset.assetClass, asset.subcategory].filter(Boolean).join(' › ')],
    ['Institution', asset.institution ?? '—'],
    ['Current value', <strong key="v">{amount(asset.currentValue)}</strong>],
    ['Owners', ownership],
    [
      'Valuation',
      asset.valuationMethod === 'quantity_x_price'
        ? `${asset.quantity} ${asset.unit ?? 'units'} × ${formatINRExact(asset.unitPrice ?? 0)}`
        : 'Entered manually',
    ],
    ['Valuation date', formatISODate(asset.valuationDate)],
    ['Purchase value', asset.purchaseValue === undefined ? '—' : amount(asset.purchaseValue)],
    ['Liquidity', liquidityLabel(asset.liquidity)],
    [
      'Expected growth',
      `Conservative ${rate(asset.conservativeGrowthRate)} · Base ${rate(asset.baseGrowthRate)} · Optimistic ${rate(asset.optimisticGrowthRate)}`,
    ],
    ['Notes', asset.notes ? <span className="whitespace-pre-line">{asset.notes}</span> : '—'],
    ['Last updated', new Date(asset.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })],
  ];

  return (
    <>
      {asset.isDemo && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          This is demo data, not real financial information.
        </p>
      )}
      <dl className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-2.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="danger-ghost" onClick={onDelete}>
          Delete
        </Button>
        <Button onClick={onEdit}>Edit</Button>
      </div>
    </>
  );
}
