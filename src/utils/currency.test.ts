import { formatINR, formatINRCompact, formatINRExact, parseAmountInput } from './currency';

describe('currency formatting', () => {
  it('uses Indian digit grouping (spec §26)', () => {
    expect(formatINRExact(1000)).toBe('₹1,000');
    expect(formatINRExact(10000)).toBe('₹10,000');
    expect(formatINRExact(100000)).toBe('₹1,00,000');
    expect(formatINRExact(1000000)).toBe('₹10,00,000');
    expect(formatINRExact(10000000)).toBe('₹1,00,00,000');
  });

  it('keeps paise when present', () => {
    expect(formatINRExact(2500.5)).toBe('₹2,500.5');
    expect(formatINRExact(2500.25)).toBe('₹2,500.25');
  });

  it('formats lakh / crore (spec §26)', () => {
    expect(formatINRCompact(250000)).toBe('₹2.5 Lakh');
    expect(formatINRCompact(8000000)).toBe('₹80 Lakh');
    expect(formatINRCompact(12000000)).toBe('₹1.2 Crore');
    expect(formatINRCompact(99999)).toBe('₹99,999');
    expect(formatINRCompact(-250000)).toBe('-₹2.5 Lakh');
  });

  it('switches on the number format setting', () => {
    expect(formatINR(250000, 'exact')).toBe('₹2,50,000');
    expect(formatINR(250000, 'compact')).toBe('₹2.5 Lakh');
  });

  it('parses typed amounts', () => {
    expect(parseAmountInput('10,00,000')).toBe(1000000);
    expect(parseAmountInput(' ₹ 2,500.50 ')).toBe(2500.5);
    expect(parseAmountInput('')).toBeUndefined();
    expect(parseAmountInput('12abc')).toBeNaN();
    expect(parseAmountInput('1.2.3')).toBeNaN();
  });
});
