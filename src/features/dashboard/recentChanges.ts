type Record_ = { id: string; name: string; createdAt: string; updatedAt: string };

export type RecentChange = {
  key: string;
  kind: 'Family member' | 'Asset' | 'Liability';
  name: string;
  action: 'Added' | 'Updated';
  at: string;
};

/** The most recently added or edited records across the app, newest first. */
export function recentChanges(
  sources: { kind: RecentChange['kind']; records: Record_[] }[],
  limit = 6,
): RecentChange[] {
  return sources
    .flatMap(({ kind, records }) =>
      records.map((r) => ({
        key: `${kind}:${r.id}`,
        kind,
        name: r.name,
        action: r.updatedAt > r.createdAt ? ('Updated' as const) : ('Added' as const),
        at: r.updatedAt,
      })),
    )
    .sort((a, b) => b.at.localeCompare(a.at) || a.name.localeCompare(b.name))
    .slice(0, limit);
}
