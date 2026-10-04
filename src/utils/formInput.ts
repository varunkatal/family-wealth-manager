import { formatINRCompact, formatINRExact, parseAmountInput } from './currency';

/** Parses "12", "12.5" or "12%". Blank → undefined, invalid → NaN. */
export const parsePercent = (text: string) => parseAmountInput(text.replace('%', ''));

/** "₹10,00,000 · ₹10 Lakh" under an amount field, so large numbers are easy to check. */
export function amountHint(text: string): string | undefined {
  const n = parseAmountInput(text);
  if (n === undefined || Number.isNaN(n)) return undefined;
  const exact = formatINRExact(n);
  const compact = formatINRCompact(n);
  return exact === compact ? exact : `${exact} · ${compact}`;
}

/** Text for a number input: blank when undefined. */
export const numberText = (n: number | undefined) => (n === undefined ? '' : String(n));

/** Maps zod issues to the first message per top-level field. */
export function fieldErrors<K extends string>(issues: { path: PropertyKey[]; message: string }[]): Partial<Record<K, string>> {
  const errors: Partial<Record<K, string>> = {};
  for (const issue of issues) errors[issue.path[0] as K] ??= issue.message;
  return errors;
}
