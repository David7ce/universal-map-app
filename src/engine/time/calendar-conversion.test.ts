import { describe, expect, it } from 'vitest';
import { addCalendarUnit, formatCalendarDate, toCalendarParts } from './calendar-conversion';

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
