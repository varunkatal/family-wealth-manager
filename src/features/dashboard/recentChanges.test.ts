import { recentChanges } from './recentChanges';

const rec = (id: string, createdAt: string, updatedAt = createdAt) => ({ id, name: id, createdAt, updatedAt });

describe('recentChanges', () => {
  it('merges sources newest first, marking added vs updated, with a limit', () => {
    const list = recentChanges(
      [
        { kind: 'Asset', records: [rec('fd', '2026-01-01T00:00:00Z', '2026-03-01T00:00:00Z'), rec('gold', '2026-02-01T00:00:00Z')] },
        { kind: 'Liability', records: [rec('loan', '2026-02-15T00:00:00Z')] },
      ],
      2,
    );
    expect(list.map((c) => [c.kind, c.name, c.action])).toEqual([
      ['Asset', 'fd', 'Updated'],
      ['Liability', 'loan', 'Added'],
    ]);
  });
});
