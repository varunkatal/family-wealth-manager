import { classColors, colourSlices } from './chartColors';

const slice = (key: string, value: number) => ({ key, value, percentage: value });

describe('chart colours', () => {
  it('keeps a class colour fixed regardless of rank or which classes are present', () => {
    const colors = classColors(['Equity', 'Fixed Income', 'Precious Metals', 'Real Estate', 'Cash', 'Other']);
    const a = colourSlices([slice('Real Estate', 90), slice('Equity', 10)], colors);
    const b = colourSlices([slice('Equity', 90)], colors);
    expect(a.find((s) => s.key === 'Equity')!.color).toBe('var(--series-1)');
    expect(b[0]!.color).toBe('var(--series-1)');
    expect(a.map((s) => s.key)).toEqual(['Equity', 'Real Estate']); // class order, not size
  });

  it('folds classes beyond eight colour slots into Other instead of inventing colours', () => {
    const order = ['Equity', 'Fixed Income', 'Precious Metals', 'Real Estate', 'Cash', 'Other', 'Art', 'Crypto', 'Wine', 'Watches'];
    const colors = classColors(order);
    expect(colors.size).toBe(8);
    const result = colourSlices([slice('Wine', 5), slice('Watches', 3), slice('Other', 2), slice('Equity', 90)], colors);
    expect(result).toEqual([
      { key: 'Equity', value: 90, percentage: 90, color: 'var(--series-1)' },
      { key: 'Other', value: 10, percentage: 10, color: 'var(--series-6)', folded: ['Wine', 'Watches'] },
    ]);
  });
});
