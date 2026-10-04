import { useChartTooltip } from './useChartTooltip';

export type BarItem = { key: string; label: string; value: number };

type BarListProps = {
  items: BarItem[];
  label: string;
  format: (value: number) => string;
  color: string;
};

/**
 * Horizontal bars from a shared zero baseline; negative values extend left.
 * Bars are ≤ 20px thick, square at the baseline, rounded 4px at the data end.
 */
export function BarList({ items, label, format, color }: BarListProps) {
  const { containerRef, bind, tooltip } = useChartTooltip();
  const min = Math.min(0, ...items.map((i) => i.value));
  const max = Math.max(0, ...items.map((i) => i.value));
  const span = max - min || 1;
  const zero = (-min / span) * 100;

  return (
    <div ref={containerRef} className="relative">
      <ul aria-label={label} className="space-y-3">
        {items.map((item) => {
          const width = (Math.abs(item.value) / span) * 100;
          const negative = item.value < 0;
          return (
            <li key={item.key} className="grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,9rem)_1fr]">
              <span className="truncate text-sm text-slate-700 dark:text-slate-200" title={item.label}>
                {item.label}
              </span>
              <div className="relative h-5">
                {min < 0 && <div className="absolute inset-y-[-4px] w-px bg-slate-300 dark:bg-slate-600" style={{ left: `${zero}%` }} />}
                <div
                  tabIndex={0}
                  aria-label={`${item.label}: ${format(item.value)}`}
                  className={`absolute inset-y-0 min-w-[2px] outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-white dark:focus-visible:ring-offset-slate-900 ${
                    negative ? 'rounded-l-[4px]' : 'rounded-r-[4px]'
                  }`}
                  style={{
                    background: color,
                    width: `${width}%`,
                    left: negative ? `${zero - width}%` : `${zero}%`,
                  }}
                  {...bind({ label: item.label, value: format(item.value), color })}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {tooltip}
    </div>
  );
}
