/** Today's date in local time as YYYY-MM-DD. */
export function todayISODate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole years between a YYYY-MM-DD date of birth and today. */
export function ageFromDateOfBirth(dob: string, now: Date = new Date()): number {
  const [y, m, d] = dob.split('-').map(Number) as [number, number, number];
  let age = now.getFullYear() - y;
  const beforeBirthday = now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/** Formats YYYY-MM-DD as e.g. "5 Mar 1990" without timezone shifts. */
export function formatISODate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
