import { beforeAll, describe, expect, it } from 'vitest';
import { ensureCalendarSystemLoaded } from '../../engine/time/calendar-conversion';
import { getVisibleGranularityOptions, nextSelectedDate } from './CalendarBar';

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
