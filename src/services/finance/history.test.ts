import { calculateChange, monthOverMonth, withChanges } from './history';

const snap = (date: string, netWorth: number, createdAt = '') => ({ date, netWorth, createdAt });

describe('wealth history (spec §18)', () => {
  it('change and percentage change', () => {
    expect(calculateChange(1000000, 1100000)).toEqual({ change: 100000, percentage: 10 });
    expect(calculateChange(1000000, 950000)).toEqual({ change: -50000, percentage: -5 });
    expect(calculateChange(0, 5000)).toEqual({ change: 5000, percentage: null });
    // From a negative net worth, an improvement is a positive %
    expect(calculateChange(-200000, -100000)).toEqual({ change: 100000, percentage: 50 });
  });

  it('changes between snapshots, oldest first', () => {
    const rows = withChanges([snap('2026-03-01', 1210000), snap('2026-01-01', 1000000), snap('2026-02-01', 1100000)], (s) => s.netWorth);
    expect(rows.map((r) => [r.item.date, r.change, r.percentage])).toEqual([
      ['2026-01-01', null, null],
      ['2026-02-01', 100000, 10],
      ['2026-03-01', 110000, 10],
    ]);
  });

  it('month-over-month uses the latest snapshot in each month', () => {
    const rows = monthOverMonth(
      [snap('2026-01-05', 1000000), snap('2026-01-28', 1050000), snap('2026-03-10', 1260000), snap('2026-03-10', 1155000, 'a')],
      (s) => s.netWorth,
    );
    // 10 Mar: two snapshots on the same day, the later-saved one wins ('' < 'a')
    expect(rows.map((r) => [r.month, r.item.netWorth, r.change])).toEqual([
      ['2026-01', 1050000, null],
      ['2026-03', 1155000, 105000],
    ]);
    expect(rows[1]!.percentage).toBeCloseTo(10, 10);
  });
});
