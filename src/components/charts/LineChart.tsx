import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

export type LineSeries = { key: string; label: string; color: string; values: number[] };

type LineChartProps = {
  series: LineSeries[];
  /** One label per x position, e.g. "Today", "Year 1". */
  xLabels: string[];
  /** Full value format for the tooltip. */
  format: (n: number) => string;
  /** Short value format for the y-axis. */
  formatAxis: (n: number) => string;
  /** Accessible name. */
  label: string;
  height?: number;
};

const PAD = { top: 12, right: 16, bottom: 28, left: 64 };

/** Rounds a step up to 1, 2, 2.5 or 5 × 10^n so ticks land on clean numbers. */
function niceStep(range: number, count: number): number {
  const raw = range / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

export function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) return [min];
  const step = niceStep(max - min, count);
  const ticks: number[] = [];
  for (let t = Math.floor(min / step) * step; t <= max + step * 0.5; t += step) ticks.push(Math.round(t * 100) / 100);
  if (ticks.at(-1)! < max) ticks.push(ticks.at(-1)! + step);
  return ticks;
}

/**
 * Multi-series line chart: 2px lines, end dots with a surface ring, hairline grid,
 * a crosshair that snaps to the nearest year with one tooltip for every series,
 * and arrow-key navigation. Every value is also in a table on the page.
 */
export function LineChart({ series, xLabels, format, formatAxis, label, height = 240 }: LineChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => entry && entry.contentRect.width > 0 && setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = xLabels.length;
  const all = series.flatMap((s) => s.values);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all));
  const yMin = ticks[0]!;
  const yMax = ticks.at(-1)!;
  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
  const xTickEvery = Math.max(1, Math.ceil((n - 1) / Math.max(1, Math.floor(plotW / 70))));

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * width;
    setActive(Math.min(n - 1, Math.max(0, Math.round(((px - PAD.left) / plotW) * (n - 1)))));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? n) - 1));
    else return;
    e.preventDefault();
  };

  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active), 90), width - 90);

  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300" aria-label="Legend">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label}. Use the left and right arrow keys to read values; all values are also in the table.`}
          tabIndex={0}
          className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[11px] dark:fill-slate-400">
                {formatAxis(t)}
              </text>
            </g>
          ))}
          {xLabels.map((l, i) =>
            i % xTickEvery === 0 || i === n - 1 ? (
              <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[11px] dark:fill-slate-400">
                {l}
              </text>
            ) : null,
          )}
          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth={1} />
          )}
          {series.map((s) => (
            <g key={s.key}>
              <polyline
                points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {[active ?? n - 1].map((i) => (
                <circle key={i} cx={x(i)} cy={y(s.values[i]!)} r={4} fill={s.color} stroke="var(--chart-surface)" strokeWidth={2} />
              ))}
            </g>
          ))}
        </svg>
        {active !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-lg dark:border-slate-700 dark:bg-slate-800"
            style={{ left: tipLeft }}
          >
            <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">{xLabels[active]}</div>
            {series.map((s) => (
              <div key={s.key} className="flex items-center gap-2 whitespace-nowrap text-xs">
                <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">{format(s.values[active]!)}</span>
                <span className="text-slate-500 dark:text-slate-400">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
