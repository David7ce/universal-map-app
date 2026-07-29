import { describe, expect, it } from 'vitest';
import {
  addJulianUnit,
  gregorianIsoToJulianParts,
  julianPartsToGregorianIso,
  monthNameFromNumbers,
} from './julian-calendar';

describe('gregorianIsoToJulianParts', () => {
  it('applies the current 13-day Julian-behind-Gregorian offset', () => {
    expect(gregorianIsoToJulianParts('2026-07-29')).toEqual({ year: 2026, month: 7, day: 16 });
  });

  it('matches the historical Gregorian calendar-reform boundary', () => {
    // The day after Julian 4 Oct 1582 was declared Gregorian 15 Oct 1582 (a 10-day
    // skip). The proleptic-Julian equivalent of that same day is Julian 5 Oct 1582.
    expect(gregorianIsoToJulianParts('1582-10-15')).toEqual({ year: 1582, month: 10, day: 5 });
  });

  it('handles a Gregorian leap day', () => {
    expect(gregorianIsoToJulianParts('2024-02-29')).toEqual({ year: 2024, month: 2, day: 16 });
  });
});

describe('julianPartsToGregorianIso', () => {
  it('round-trips with gregorianIsoToJulianParts', () => {
    const iso = '2026-07-29';
    expect(julianPartsToGregorianIso(gregorianIsoToJulianParts(iso))).toBe(iso);
  });

  it('round-trips a Julian-calendar leap day', () => {
    expect(julianPartsToGregorianIso({ year: 2024, month: 2, day: 16 })).toBe('2024-02-29');
  });
});

describe('addJulianUnit', () => {
  it('rolls a month over into the next year', () => {
    expect(addJulianUnit({ year: 2026, month: 12, day: 20 }, 'month', 1)).toEqual({
      year: 2027,
      month: 1,
      day: 20,
    });
  });

  it('rolls a month back into the previous year', () => {
    expect(addJulianUnit({ year: 2026, month: 1, day: 15 }, 'month', -1)).toEqual({
      year: 2025,
      month: 12,
      day: 15,
    });
  });

  it('clamps the day when a year delta lands on a shorter February', () => {
    // Julian year 2020 is a leap year (2020 % 4 === 0), so 29 Feb 2020 exists.
    // Julian year 2021 is not (2021 % 4 !== 0), so Feb only has 28 days.
    expect(addJulianUnit({ year: 2020, month: 2, day: 29 }, 'year', 1)).toEqual({
      year: 2021,
      month: 2,
      day: 28,
    });
  });
});

describe('monthNameFromNumbers', () => {
  it('returns the English month name for a given month number', () => {
    expect(monthNameFromNumbers(2026, 7, 'en')).toBe('July');
    expect(monthNameFromNumbers(2026, 12, 'en')).toBe('December');
  });
});
