import type { CalendarSystem } from '../../engine/time/calendar-systems';
import {
  calendarPartsToIso,
  daysInCalendarMonth,
  monthsInCalendarYear,
  toCalendarParts,
} from '../../engine/time/calendar-conversion';
import { clampDateToRange } from './CalendarBar';

// One calendar month forward/back in the given system, keeping the day of
// month where possible (Jan 31 + 1 -> Feb 28/29) and clamping to the world's
// date range. Unlike `nextSelectedDate`, never overflows into the month after.
export function stepMonth(iso: string, system: CalendarSystem, direction: 1 | -1, min: string, max: string): string {
  const { year, month, day } = toCalendarParts(iso, system);
  let nextYear = year;
  let nextMonth = month + direction;
  if (nextMonth < 1) {
    nextYear -= 1;
    nextMonth = monthsInCalendarYear(nextYear, system);
  } else if (nextMonth > monthsInCalendarYear(year, system)) {
    nextYear += 1;
    nextMonth = 1;
  }
  const nextDay = Math.min(day, daysInCalendarMonth(nextYear, nextMonth, system));
  const next = calendarPartsToIso({ year: nextYear, month: nextMonth, day: nextDay }, system);
  return clampDateToRange(next, min, max);
}
