import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { inputClass } from '../../components/FormField';
import type { FamilyMember } from '../../models/familyMember';
import { calculateOwnershipValue } from '../../services/finance/netWorth';
import { formatINRExact } from '../../utils/currency';
import { parsePercent } from '../../utils/formInput';

export type OwnerRow = { memberId: string; percentage: string };

type OwnershipFieldsProps = {
  rows: OwnerRow[];
  onChange: (rows: OwnerRow[]) => void;
  members: FamilyMember[];
  /** Current asset value, to preview each owner's share; undefined while not yet entered. */
  assetValue: number | undefined;
  error?: string;
};

export { parsePercent };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Equal shares that add up to exactly 100, e.g. 33.33 / 33.33 / 33.34. */
export function equalShares(count: number): string[] {
  const base = Math.floor(10000 / count) / 100;
  return Array.from({ length: count }, (_, i) => String(i === count - 1 ? round2(100 - base * (count - 1)) : base));
}

/** Initial owner rows for a new asset: the only active member at 100%, else one blank row. */
export function defaultOwnerRows(members: FamilyMember[]): OwnerRow[] {
  const active = members.filter((m) => m.isActive);
  return [{ memberId: active.length === 1 ? active[0]!.id : '', percentage: '100' }];
}

export function OwnershipFields({ rows, onChange, members, assetValue, error }: OwnershipFieldsProps) {
  const selectedIds = new Set(rows.map((r) => r.memberId));
  // Active members, plus inactive ones already selected on this asset.
  const options = members.filter((m) => m.isActive || selectedIds.has(m.id));

  const total = rows.reduce((sum, r) => {
    const p = parsePercent(r.percentage);
    return p === undefined || Number.isNaN(p) ? sum : sum + p;
  }, 0);

  const update = (i: number, patch: Partial<OwnerRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addOwner = () => {
    const next = options.find((m) => !selectedIds.has(m.id));
    onChange([...rows, { memberId: next?.id ?? '', percentage: String(Math.max(round2(100 - total), 0)) }]);
  };

  if (members.length === 0) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Every asset needs an owner.{' '}
        <Link to="/family" className="font-medium underline">
          Add a family member
        </Link>{' '}
        first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {rows.map((row, i) => {
          const pct = parsePercent(row.percentage);
          const share =
            assetValue !== undefined && pct !== undefined && !Number.isNaN(pct)
              ? formatINRExact(calculateOwnershipValue(assetValue, pct))
              : null;
          return (
            <li key={i} className="flex items-center gap-2">
              <select
                aria-label={`Owner ${i + 1}`}
                className={`${inputClass} min-w-0 flex-1`}
                value={row.memberId}
                onChange={(e) => update(i, { memberId: e.target.value })}
              >
                <option value="">Choose member…</option>
                {options.map((m) => (
                  <option key={m.id} value={m.id} disabled={m.id !== row.memberId && selectedIds.has(m.id)}>
                    {m.name}
                    {m.isActive ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
              <div className="relative w-24 shrink-0">
                <input
                  aria-label={`Owner ${i + 1} share %`}
                  inputMode="decimal"
                  className={`${inputClass} pr-7`}
                  value={row.percentage}
                  onChange={(e) => update(i, { percentage: e.target.value })}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">%</span>
              </div>
              <span className="hidden w-28 shrink-0 text-right text-xs tabular-nums text-slate-500 sm:block dark:text-slate-400">
                {share}
              </span>
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                disabled={rows.length === 1}
                aria-label={`Remove owner ${i + 1}`}
                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:invisible dark:hover:bg-slate-800"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={addOwner} disabled={rows.length >= options.length}>
          Add owner
        </Button>
        {rows.length > 1 && (
          <Button variant="ghost" onClick={() => onChange(rows.map((r, i) => ({ ...r, percentage: equalShares(rows.length)[i]! })))}>
            Split equally
          </Button>
        )}
        <span className="ml-auto text-sm" aria-live="polite">
          Family share{' '}
          <strong className={total > 100.001 ? 'text-red-600 dark:text-red-400' : ''}>{round2(total)}%</strong>
          {total > 0 && total < 99.999 && (
            <span className="text-slate-500 dark:text-slate-400"> · {round2(100 - total)}% owned outside the family</span>
          )}
        </span>
      </div>

      {error && (
        <p id="asset-owners-error" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
