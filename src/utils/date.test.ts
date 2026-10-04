import { ageFromDateOfBirth, todayISODate } from './date';

describe('date utils', () => {
  it('formats today as YYYY-MM-DD in local time', () => {
    expect(todayISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('calculates age around the birthday', () => {
    expect(ageFromDateOfBirth('1990-06-15', new Date(2026, 5, 14))).toBe(35);
    expect(ageFromDateOfBirth('1990-06-15', new Date(2026, 5, 15))).toBe(36);
  });
});
