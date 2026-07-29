import { describe, expect, it } from 'vitest';
import { calendarSystemLabel, getVisibleGranularityOptions, nextSelectedDate } from './CalendarBar';

describe('nextSelectedDate', () => {
  it('steps by day the same way regardless of calendar system', () => {
    expect(nextSelectedDate('2026-07-29', 'day', 1, 'gregorian')).toBe('2026-07-30');
    expect(nextSelectedDate('2026-07-29', 'day', 1, 'islamic')).toBe('2026-07-30');
  });

  it('steps by week the same way regardless of calendar system', () => {
    expect(nextSelectedDate('2026-07-29', 'week', 1, 'hebrew')).toBe('2026-08-05');
  });

  it('steps by gregorian month/year when system is gregorian', () => {
    expect(nextSelectedDate('2026-07-29', 'month', 1, 'gregorian')).toBe('2026-08-29');
    expect(nextSelectedDate('2026-07-29', 'year', -1, 'gregorian')).toBe('2025-07-29');
  });

  it('steps by a calendar-aware month when system is non-gregorian', () => {
    expect(nextSelectedDate('2026-07-29', 'month', 1, 'islamic')).toBe('2026-08-27');
  });
});

describe('getVisibleGranularityOptions', () => {
  it('offers a compact set of UI granularity choices', () => {
    expect(getVisibleGranularityOptions('gregorian')).toEqual(['day', 'week', 'month']);
    expect(getVisibleGranularityOptions('islamic')).toEqual(['day', 'week', 'month']);
  });
});

describe('calendarSystemLabel', () => {
  it('is empty for gregorian (the native input already shows it)', () => {
    expect(calendarSystemLabel('2026-07-29', 'gregorian')).toBe('');
  });

  it('formats the date in the target system otherwise', () => {
    expect(calendarSystemLabel('2026-07-29', 'islamic')).toBe('Safar 15, 1448 AH');
  });
});
