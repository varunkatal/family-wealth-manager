import { useChartTooltip } from './useChartTooltip';
import { formatShare } from '../../utils/currency';

export type BarSegment = { key: string; label: string; value: number; percentage: number; color: string };

type StackedBarProps = {
  segments: BarSegment[];
  /** Accessible name for the whole bar, e.g. "Asset allocation". */
  label: string;
  format: (value: number) => string;
  /** Bar length as % of the available width (for comparing several bars on one scale). Default 100. */
  lengthPercent?: number;
  /** Optional tooltip from a parent chart, so several bars share one tooltip. */
  tooltip?: ReturnType<typeof useChartTooltip>;
};

// Whole % on bars (1 decimal under 1%); tiny non-zero shares use the shared "<0.1%" form.
const pct = (n: number) => (n > 0 && n < 0.05 ? formatShare(n) : `${n.toFixed(n > 0 && n < 1 ? 1 : 0)}%`);

/**
 * One horizontal bar split into segments (≤ 24px thick, 2px surface gaps,
 * square at the baseline, 4px rounded data end). Each segment is focusable.
 */
export function StackedBar({ segments, label, format, lengthPercent = 100, tooltip }: StackedBarProps) {
  const own = useChartTooltip();
  const tip = tooltip ?? own;
  const visible = segments.filter((s) => s.value > 0);

  const bar = (
    <div className="flex h-6 gap-[2px]" style={{ width: `${Math.max(lengthPercent, 0.5)}%` }} role="list" aria-label={label}>
      {visible.map((s, i) => (
        <div
          key={s.key}
          role="listitem"
          tabIndex={0}
          aria-label={`${s.label}: ${format(s.value)}, ${pct(s.percentage)}`}
          className={`h-full min-w-[3px] outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-white dark:focus-visible:ring-offset-slate-900 ${
            i === visible.length - 1 ? 'rounded-r-[4px]' : ''
          }`}
          style={{ flexGrow: s.value, flexBasis: 0, background: s.color }}
          {...tip.bind({ label: s.label, value: format(s.value), detail: pct(s.percentage), color: s.color })}
        />
      ))}
    </div>
  );

  if (tooltip) return bar;
  return (
    <div ref={own.containerRef} className="relative">
      {bar}
      {own.tooltip}
    </div>
  );
}
