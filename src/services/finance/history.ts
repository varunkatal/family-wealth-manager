/**
 * Wealth history (spec §18). Pure functions over stored snapshots; nothing is recalculated
 * from current data, so historical values stay as they were.
 */

type Dated = { date: string; createdAt?: string };

const roundToPaise = (n: number) => Math.round(n * 100) / 100;

/** Change from `previous` to `current`, and as a % of the previous value (null when previous is 0). */
export function calculateChange(previous: number, current: number): { change: number; percentage: number | null } {
  return {
    change: roundToPaise(current - previous),
    percentage: previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100,
  };
}

/** Oldest first; same-day entries in the order they were saved. */
export function sortByDate<T extends Dated>(items: T[]): T[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
}

export type ChangeRow<T> = { item: T; change: number | null; percentage: number | null };

/** Each item (oldest first) with its change from the item before it. */
export function withChanges<T extends Dated>(items: T[], value: (item: T) => number): ChangeRow<T>[] {
  const sorted = sortByDate(items);
  return sorted.map((item, i) => {
    if (i === 0) return { item, change: null, percentage: null };
    const { change, percentage } = calculateChange(value(sorted[i - 1]!), value(item));
    return { item, change, percentage };
  });
}

/**
 * Month-over-month: the latest entry in each month (oldest month first), with the change from
 * the previous month that has an entry.
 */
export function monthOverMonth<T extends Dated>(items: T[], value: (item: T) => number): (ChangeRow<T> & { month: string })[] {
  const latestByMonth = new Map<string, T>();
  for (const item of sortByDate(items)) latestByMonth.set(item.date.slice(0, 7), item);
  return withChanges([...latestByMonth.values()], value).map((r) => ({ ...r, month: r.item.date.slice(0, 7) }));
}
