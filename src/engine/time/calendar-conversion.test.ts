import { beforeAll, describe, expect, it } from 'vitest';
import {
  addCalendarUnit,
  calendarPartsToIso,
  daysInCalendarMonth,
  ensureCalendarSystemLoaded,
  formatCalendarDate,
  monthsInCalendarYear,
  toCalendarParts,
} from './calendar-conversion';

beforeAll(async () => {
  await ensureCalendarSystemLoaded('islamic');
  await ensureCalendarSystemLoaded('hebrew');
});

describe('toCalendarParts', () => {
  it('is an identity pass-through for gregorian', () => {
    expect(toCalendarParts('2026-07-29', 'gregorian')).toEqual({
      year: 2026,
      month: 7,
      day: 29,
      monthName: 'July',
    });
  });

  it('converts to julian', () => {
    expect(toCalendarParts('2026-07-29', 'julian')).toEqual({
      year: 2026,
      month: 7,
      day: 16,
      monthName: 'July',
    });
  });

  it('converts to islamic', () => {
    expect(toCalendarParts('2026-07-29', 'islamic')).toEqual({
      year: 1448,
      month: 2,
      day: 15,
      monthName: 'Safar',
    });
  });

  it('converts to hebrew', () => {
    expect(toCalendarParts('2026-07-29', 'hebrew')).toEqual({
      year: 5786,
      month: 11,
      day: 15,
      monthName: 'Av',
    });
  });
});

describe('calendarPartsToIso', () => {
  it('round-trips gregorian parts back to the same ISO date', () => {
    expect(calendarPartsToIso({ year: 2026, month: 7, day: 29 }, 'gregorian')).toBe('2026-07-29');
  });

  it('rejects an impossible gregorian date', () => {
    expect(() => calendarPartsToIso({ year: 2026, month: 2, day: 30 }, 'gregorian')).toThrow(RangeError);
  });

  it('round-trips julian parts back to the equivalent Gregorian ISO date', () => {
    // 2026-07-29 Gregorian = 2026-07-16 Julian (see julian-calendar.test.ts).
    expect(calendarPartsToIso({ year: 2026, month: 7, day: 16 }, 'julian')).toBe('2026-07-29');
  });

  it('round-trips islamic parts back to the equivalent Gregorian ISO date', () => {
    // toCalendarParts('2026-07-29', 'islamic') = { year: 1448, month: 2, day: 15 }.
    expect(calendarPartsToIso({ year: 1448, month: 2, day: 15 }, 'islamic')).toBe('2026-07-29');
  });

  it('round-trips hebrew parts back to the equivalent Gregorian ISO date', () => {
    // toCalendarParts('2026-07-29', 'hebrew') = { year: 5786, month: 11, day: 15 }.
    expect(calendarPartsToIso({ year: 5786, month: 11, day: 15 }, 'hebrew')).toBe('2026-07-29');
  });

  it('rejects a hebrew day past the end of its month', () => {
    const lastDay = daysInCalendarMonth(5786, 11, 'hebrew');
    expect(() => calendarPartsToIso({ year: 5786, month: 11, day: lastDay + 1 }, 'hebrew')).toThrow();
  });
});

describe('daysInCalendarMonth', () => {
  it('returns 29 for a non-leap gregorian February', () => {
    expect(daysInCalendarMonth(2026, 2, 'gregorian')).toBe(28);
  });

  it('returns 29 for a leap gregorian February', () => {
    expect(daysInCalendarMonth(2024, 2, 'gregorian')).toBe(29);
  });

  it('returns 28 for a non-leap julian February', () => {
    expect(daysInCalendarMonth(2021, 2, 'julian')).toBe(28);
  });

  it('returns a real day count for an islamic month (29 or 30)', () => {
    const days = daysInCalendarMonth(1448, 2, 'islamic');
    expect([29, 30]).toContain(days);
  });
});

describe('monthsInCalendarYear', () => {
  it('is always 12 for gregorian, julian, and islamic', () => {
    expect(monthsInCalendarYear(2026, 'gregorian')).toBe(12);
    expect(monthsInCalendarYear(2026, 'julian')).toBe(12);
    expect(monthsInCalendarYear(1448, 'islamic')).toBe(12);
  });

  it('is 12 or 13 for hebrew, depending on leap years', () => {
    expect([12, 13]).toContain(monthsInCalendarYear(5786, 'hebrew'));
  });
});

describe('addCalendarUnit', () => {
  it('adds a gregorian month, returning a Gregorian ISO string', () => {
    expect(addCalendarUnit('2026-07-29', 'gregorian', 'month', 1)).toBe('2026-08-29');
  });

  it('adds an islamic month, returning the equivalent Gregorian ISO string', () => {
    expect(addCalendarUnit('2026-07-29', 'islamic', 'month', 1)).toBe('2026-08-27');
  });

  it('adds an islamic year, returning the equivalent Gregorian ISO string', () => {
    expect(addCalendarUnit('2026-07-29', 'islamic', 'year', 1)).toBe('2027-07-19');
  });

  it('subtracts a julian month, returning the equivalent Gregorian ISO string', () => {
    // 2026-07-29 Gregorian = 2026-07-16 Julian; one Julian month back = 2026-06-16
    // Julian, which converts back to 2026-06-29 Gregorian.
    expect(addCalendarUnit('2026-07-29', 'julian', 'month', -1)).toBe('2026-06-29');
  });
});

describe('formatCalendarDate', () => {
  it('formats a gregorian date', () => {
    expect(formatCalendarDate('2026-07-29', 'gregorian')).toBe('July 29, 2026');
  });

  it('formats a julian date', () => {
    expect(formatCalendarDate('2026-07-29', 'julian')).toBe('July 16, 2026');
  });

  it('formats an islamic date', () => {
    expect(formatCalendarDate('2026-07-29', 'islamic')).toBe('Safar 15, 1448 AH');
  });

  it('formats a hebrew date', () => {
    expect(formatCalendarDate('2026-07-29', 'hebrew')).toBe('15 Av 5786');
  });
});
