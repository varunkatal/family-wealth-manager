/** Phase 14: large numbers, small shares and error states. */
import { screen } from '@testing-library/react';
import * as assetRepository from '../services/storage/assetRepository';
import { formatINRCompact, formatINRExact, formatShare } from '../utils/currency';
import { renderApp } from './renderApp';

describe('large numbers', () => {
  it('formats the largest allowed amount and large negatives', () => {
    expect(formatINRExact(9999999999999)).toBe('₹99,99,99,99,99,999');
    expect(formatINRCompact(9999999999999)).toBe('₹10,00,000 Crore');
    expect(formatINRExact(-123456789)).toBe('-₹12,34,56,789');
    expect(formatINRCompact(-123456789)).toBe('-₹12.35 Crore');
  });
});

describe('shares', () => {
  it('never shows a non-zero share as 0.0%', () => {
    expect(formatShare(0.00005)).toBe('<0.1%');
    expect(formatShare(0)).toBe('0.0%');
    expect(formatShare(12.345)).toBe('12.3%');
    expect(formatShare(100)).toBe('100.0%');
  });
});

describe('error states', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['/', '/assets', '/projections', '/history', '/cash-flow', '/goals'])('%s shows an error when data cannot be loaded', async (path) => {
    vi.spyOn(assetRepository, 'listAssets').mockRejectedValue(new Error('storage unavailable'));
    renderApp(path);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your data.');
  });
});
