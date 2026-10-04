import type { Slice } from '../../services/finance/allocation';

export const MAX_SERIES = 8;
const OTHER = 'Other';

/**
 * Colour per asset class, from its position in the fixed class order (defaults, then custom).
 * Colour follows the class itself, so filtering or re-ranking never repaints a class.
 */
export function classColors(classOrder: string[]): Map<string, string> {
  const map = new Map<string, string>();
  classOrder.slice(0, MAX_SERIES).forEach((c, i) => map.set(c, `var(--series-${i + 1})`));
  return map;
}

/**
 * Classes beyond the 8 colour slots are folded into "Other" (never a generated 9th colour).
 * Returns slices with a colour and the names of any folded classes, in the fixed class order,
 * so every bar and legend reads in the same sequence and neighbouring colours are the
 * palette's validated adjacent pairs.
 */
export function colourSlices(slices: Slice[], colors: Map<string, string>): (Slice & { color: string; folded?: string[] })[] {
  const kept: (Slice & { color: string; folded?: string[] })[] = [];
  let other: (Slice & { color: string; folded: string[] }) | null = null;
  for (const s of slices) {
    const color = colors.get(s.key);
    if (color && s.key !== OTHER) {
      kept.push({ ...s, color });
      continue;
    }
    other ??= { key: OTHER, value: 0, percentage: 0, color: colors.get(OTHER) ?? 'var(--series-6)', folded: [] };
    other.value += s.value;
    other.percentage += s.percentage;
    if (s.key !== OTHER) other.folded.push(s.key);
  }
  if (other) kept.push({ ...other, value: Math.round(other.value * 100) / 100 });
  const order = [...colors.keys()];
  return kept.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

export const LIQUIDITY_COLORS = {
  liquid: 'var(--liq-liquid)',
  'semi-liquid': 'var(--liq-semi)',
  illiquid: 'var(--liq-illiquid)',
} as const;
