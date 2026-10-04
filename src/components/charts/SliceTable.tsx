import { formatShare } from '../../utils/currency';

export type TableRow = { key: string; label: string; value: number; percentage?: number; color?: string; note?: string };

type SliceTableProps = {
  caption: string;
  rows: TableRow[];
  format: (value: number) => string;
  valueHeader?: string;
  total?: { label: string; value: number };
};

/** The table view (and legend) for a chart: every value is readable without hovering. */
export function SliceTable({ caption, rows, format, valueHeader = 'Value', total }: SliceTableProps) {
  const showPct = rows.some((r) => r.percentage !== undefined);
  // The table scrolls on its own (never the page) if amounts are extremely long.
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Category</th>
            <th scope="col">{valueHeader}</th>
            {showPct && <th scope="col">Share</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-2">
                  {r.color && <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: r.color }} aria-hidden="true" />}
                  <span className="min-w-0">
                    {r.label}
                    {r.note && <span className="block text-xs text-slate-500 dark:text-slate-400">{r.note}</span>}
                  </span>
                </span>
              </th>
              <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-slate-900 dark:text-slate-100">{format(r.value)}</td>
              {showPct && (
                <td className="w-16 whitespace-nowrap py-1.5 pl-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                  {r.percentage === undefined ? '' : formatShare(r.percentage)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold dark:border-slate-700">
              <th scope="row" className="pt-2 text-left">{total.label}</th>
              <td className="whitespace-nowrap pt-2 text-right tabular-nums">{format(total.value)}</td>
              {showPct && <td />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
