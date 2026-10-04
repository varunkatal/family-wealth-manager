/** CSV export (RFC 4180): comma-separated, quoted where needed, CRLF line ends. */

export type Cell = string | number | boolean | null | undefined;

/**
 * One CSV field. Text that a spreadsheet would run as a formula (starting with = + - @) is
 * prefixed with an apostrophe so opening the file can never execute anything.
 */
export function csvField(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}
