import { Temporal } from '@js-temporal/polyfill';
import type { CalendarSystem } from './calendar-systems';
import {
  addJulianUnit,
  gregorianIsoToJulianParts,
  julianPartsToGregorianIso,
  monthNameFromNumbers,
} from './julian-calendar';

export interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
  monthName: string;
}

const TEMPORAL_CALENDAR_ID = { islamic: 'islamic', hebrew: 'hebrew' } as const satisfies Record<
  Exclude<CalendarSystem, 'gregorian' | 'julian'>,
  string
>;

// No production call site uses this today (both current UI needs — the
// CalendarBar label and temporal-status text — only need a formatted
// string, via formatCalendarDate). Kept as public API for a future
// consumer that needs the individual year/month/day/monthName parts
// rather than a pre-formatted string (e.g. a custom calendar-grid picker).
export function toCalendarParts(isoDate: string, system: CalendarSystem, locale = 'en'): CalendarDateParts {
  if (system === 'gregorian') {
    const [year, month, day] = isoDate.split('-').map(Number);
    return { year, month, day, monthName: monthNameFromNumbers(year, month, locale) };
  }
  if (system === 'julian') {
    const parts = gregorianIsoToJulianParts(isoDate);
    return { ...parts, monthName: monthNameFromNumbers(parts.year, parts.month, locale) };
  }
  const plainDate = Temporal.PlainDate.from(isoDate).withCalendar(TEMPORAL_CALENDAR_ID[system]);
  return {
    year: plainDate.year,
    month: plainDate.month,
    day: plainDate.day,
    monthName: plainDate.toLocaleString(`${locale}-u-ca-${TEMPORAL_CALENDAR_ID[system]}`, { month: 'long' }),
  };
}

export function addCalendarUnit(
  isoDate: string,
  system: CalendarSystem,
  unit: 'month' | 'year',
  delta: number
): string {
  if (system === 'gregorian') {
    const date = new Date(`${isoDate}T00:00:00Z`);
    if (unit === 'month') date.setUTCMonth(date.getUTCMonth() + delta);
    else date.setUTCFullYear(date.getUTCFullYear() + delta);
    return date.toISOString().slice(0, 10);
  }
  if (system === 'julian') {
    const parts = gregorianIsoToJulianParts(isoDate);
    return julianPartsToGregorianIso(addJulianUnit(parts, unit, delta));
  }
  const plainDate = Temporal.PlainDate.from(isoDate).withCalendar(TEMPORAL_CALENDAR_ID[system]);
  const advanced = unit === 'month' ? plainDate.add({ months: delta }) : plainDate.add({ years: delta });
  return advanced.withCalendar('iso8601').toString();
}

export function formatCalendarDate(isoDate: string, system: CalendarSystem, locale = 'en'): string {
  if (system === 'gregorian') {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(
      Date.UTC(year, month - 1, day)
    );
  }
  if (system === 'julian') {
    const parts = gregorianIsoToJulianParts(isoDate);
    return `${monthNameFromNumbers(parts.year, parts.month, locale)} ${parts.day}, ${parts.year}`;
  }
  const plainDate = Temporal.PlainDate.from(isoDate).withCalendar(TEMPORAL_CALENDAR_ID[system]);
  return plainDate.toLocaleString(`${locale}-u-ca-${TEMPORAL_CALENDAR_ID[system]}`, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
