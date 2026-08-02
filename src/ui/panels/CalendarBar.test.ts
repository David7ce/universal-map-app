import { beforeAll, describe, expect, it } from 'vitest';
import { ensureCalendarSystemLoaded } from '../../engine/time/calendar-conversion';
import { calendarSystemLabel, getVisibleGranularityOptions, nextSelectedDate, stepDatePart } from './CalendarBar';

beforeAll(async () => {
  await ensureCalendarSystemLoaded('islamic');
  await ensureCalendarSystemLoaded('hebrew');
});

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
  it('offers day/week/month/year for every calendar system', () => {
    expect(getVisibleGranularityOptions('gregorian')).toEqual(['day', 'week', 'month', 'year']);
    expect(getVisibleGranularityOptions('islamic')).toEqual(['day', 'week', 'month', 'year']);
  });
});

describe('stepDatePart', () => {
  it('steps day, month, and year values within the allowed range', () => {
    expect(stepDatePart('2026-07-29', 'day', 1, '2026-01-01', '2026-12-31')).toBe('2026-07-30');
    expect(stepDatePart('2026-07-29', 'month', 1, '2026-01-01', '2026-12-31')).toBe('2026-08-29');
    expect(stepDatePart('2026-07-29', 'year', -1, '2024-01-01', '2028-12-31')).toBe('2025-07-29');
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
