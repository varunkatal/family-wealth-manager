import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LIQUIDITY_OPTIONS, type Asset } from '../../models/asset';
import type { AssetOwnership } from '../../models/ownership';
import { calculateFamilyOwnedValue } from '../../services/finance/allocation';
import { resolveAssetRate, type ClassDefaults } from '../../services/finance/scenarios';

type AssetPickerProps = {
  assets: Asset[];
  ownerships: AssetOwnership[];
  classDefaults: ClassDefaults;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  format: (n: number) => string;
};

/** Checkboxes for the assets that count toward the target, grouped by liquidity. */
export function AssetPicker({ assets, ownerships, classDefaults, selectedIds, onChange, format }: AssetPickerProps) {
  const selected = new Set(selectedIds);
  const valueOf = (a: Asset) => calculateFamilyOwnedValue(a, ownerships);
  const total = assets.filter((a) => selected.has(a.id)).reduce((s, a) => s + valueOf(a), 0);
  const toggle = (id: string) => onChange(selected.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Investments that count</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Tick the assets you would use toward the target.</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" onClick={() => onChange(assets.map((a) => a.id))}>
            All
          </Button>
          <Button variant="ghost" onClick={() => onChange([])}>
            None
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-4">
        {LIQUIDITY_OPTIONS.map((group) => {
          const items = assets.filter((a) => a.liquidity === group.value);
          if (items.length === 0) return null;
          return (
            <fieldset key={group.value}>
              <legend className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{group.label}</legend>
              <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((a) => {
                  const rate = resolveAssetRate(a, 'base', classDefaults).rate;
                  const value = valueOf(a);
                  return (
                    <li key={a.id}>
                      <label className="flex cursor-pointer items-center gap-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-teal-700"
                          checked={selected.has(a.id)}
                          onChange={() => toggle(a.id)}
                          aria-label={a.name}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {a.name} {a.isDemo && <Badge tone="demo">Demo</Badge>}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {a.assetClass} · {rate === undefined ? 'No growth rate' : `${rate}% a year`}
                            {value === 0 && ' · No family owner'}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums">{format(value)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}
      </div>

      <p className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
        <span className="text-slate-600 dark:text-slate-400">Starting amount</span>
        <span data-testid="starting-corpus" className="font-semibold tabular-nums">
          {format(Math.round(total * 100) / 100)}
        </span>
      </p>
    </Card>
  );
}
