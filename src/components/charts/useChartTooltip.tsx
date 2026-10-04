import { useCallback, useRef, useState, type FocusEvent, type PointerEvent } from 'react';

type TipContent = { label: string; value: string; detail?: string; color: string };
type Tip = TipContent & { x: number; y: number };

/**
 * One tooltip per chart. Marks call `bind(content)` to show it on hover and on keyboard focus.
 * Tooltips only enhance: every value is also shown as text in the chart's table.
 */
export function useChartTooltip() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const show = useCallback((el: Element, content: TipContent) => {
    const box = containerRef.current?.getBoundingClientRect();
    const mark = el.getBoundingClientRect();
    if (!box) return;
    // Keep the tooltip inside the chart horizontally.
    const x = Math.min(Math.max(mark.left - box.left + mark.width / 2, 80), Math.max(box.width - 80, 80));
    setTip({ ...content, x, y: mark.top - box.top });
  }, []);

  const hide = useCallback(() => setTip(null), []);

  const bind = (content: TipContent) => ({
    onPointerEnter: (e: PointerEvent) => show(e.currentTarget, content),
    onPointerLeave: hide,
    onFocus: (e: FocusEvent) => show(e.currentTarget, content),
    onBlur: hide,
  });

  const tooltip = tip && (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-lg dark:border-slate-700 dark:bg-slate-800"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{tip.value}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
        <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: tip.color }} aria-hidden="true" />
        {tip.label}
        {tip.detail && <span className="text-slate-400"> · {tip.detail}</span>}
      </div>
    </div>
  );

  return { containerRef, bind, tooltip };
}
