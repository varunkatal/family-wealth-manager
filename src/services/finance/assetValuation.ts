/** Value of a holding valued as quantity × unit price, rounded to paise. */
export function calculateQuantityValue(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

/** Sum of current values (full asset values; ownership shares come in Phase 4). */
export function sumCurrentValues(assets: { currentValue: number }[]): number {
  return Math.round(assets.reduce((total, a) => total + a.currentValue, 0) * 100) / 100;
}
