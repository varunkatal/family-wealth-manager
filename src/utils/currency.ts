import type { NumberFormat } from '../models/settings';

const wholeRupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const withPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactNumber = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** ₹10,00,000 (Indian digit grouping). Amounts with paise always show two decimals: ₹2,500.50. */
export function formatINRExact(value: number): string {
  return Number.isInteger(Math.round(value * 100) / 100) ? wholeRupees.format(value) : withPaise.format(value);
}

/** ₹2.5 Lakh, ₹1.2 Crore. Amounts under one lakh use the exact format. */
export function formatINRCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${compactNumber.format(abs / 1e7)} Crore`;
  if (abs >= 1e5) return `${sign}₹${compactNumber.format(abs / 1e5)} Lakh`;
  return formatINRExact(value);
}

export function formatINR(value: number, format: NumberFormat = 'exact'): string {
  return format === 'compact' ? formatINRCompact(value) : formatINRExact(value);
}

/**
 * Parses a typed amount such as "10,00,000" or "₹ 2500.50".
 * Returns undefined for blank input and NaN for anything that isn't a number.
 */
export function parseAmountInput(text: string): number | undefined {
  const cleaned = text.replace(/[₹,\s]/g, '');
  if (cleaned === '') return undefined;
  return /^-?\d*\.?\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}
