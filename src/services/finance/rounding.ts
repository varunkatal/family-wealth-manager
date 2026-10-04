/** Rounds a rupee amount (or a percentage) to 2 decimal places, e.g. paise. */
export const roundToPaise = (n: number) => Math.round(n * 100) / 100;
