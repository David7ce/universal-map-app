import type { Temporal as TemporalNamespace } from '@js-temporal/polyfill';
import type { CalendarSystem } from './calendar-systems';
import {
  addJulianUnit,
  daysInJulianMonth,
  gregorianIsoToJulianParts,
  julianPartsToGregorianIso,
  monthNameFromNumbers,
  type DateParts,
} from './julian-calendar';

export type { DateParts };

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

// @js-temporal/polyfill is only needed for the islamic/hebrew calendar
// systems — most apps stay on gregorian (or julian, hand-implemented
// separately), so it's dynamically imported rather than paid for on every
// page load. Call and await this once, before the first islamic/hebrew
// conversion, e.g. right after the app manifest is known at bootstrap.
let temporalModule: typeof TemporalNamespace | undefined;

export async function ensureCalendarSystemLoaded(system: CalendarSystem): Promise<void> {
  if (system !== 'islamic' && system !== 'hebrew') return;
  if (!temporalModule) {
    temporalModule = (await import('@js-temporal/polyfill')).Temporal;
  }
}

function getTemporal(): typeof TemporalNamespace {
  if (!temporalModule) {
    throw new Error('Temporal polyfill not loaded — call ensureCalendarSystemLoaded() first');
  }
  return temporalModule;
}

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
  const plainDate = getTemporal().PlainDate.from(isoDate).withCalendar(TEMPORAL_CALENDAR_ID[system]);
  return {
    year: plainDate.year,
    month: plainDate.month,
    day: plainDate.day,
    monthName: plainDate.toLocaleString(`${locale}-u-ca-${TEMPORAL_CALENDAR_ID[system]}`, { month: 'long' }),
  };
}

// The reverse of toCalendarParts: given year/month/day already expressed in
// the target system (e.g. a Hijri year/month/day typed into a calendar-aware
// date field), returns the equivalent Gregorian ISO date for storage.
// Throws (RangeError) on a combination that isn't a real date in that
// system — e.g. day 30 in a 29-day Hebrew month — so callers can fall back
// to re-rendering the last-known-good value the same way they already do
// for an unparseable Gregorian entry.
export function calendarPartsToIso(parts: DateParts, system: CalendarSystem): string {
  if (system === 'gregorian') {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    if (
      date.getUTCFullYear() !== parts.year ||
      date.getUTCMonth() !== parts.month - 1 ||
      date.getUTCDate() !== parts.day
    ) {
      throw new RangeError(`Invalid gregorian date: ${JSON.stringify(parts)}`);
    }
    return date.toISOString().slice(0, 10);
  }
  if (system === 'julian') {
    if (
      parts.month < 1 ||
      parts.month > 12 ||
      parts.day < 1 ||
      parts.day > daysInJulianMonth(parts.year, parts.month)
    ) {
      throw new RangeError(`Invalid julian date: ${JSON.stringify(parts)}`);
    }
    return julianPartsToGregorianIso(parts);
  }
  // Temporal defaults to overflow: 'constrain' (silently clamps an
  // out-of-range day/month instead of rejecting it) — 'reject' is needed so
  // an impossible date (e.g. day 30 in a 29-day month) throws, matching the
  // gregorian/julian branches above instead of silently snapping to a
  // different date than what was typed.
  return getTemporal()
    .PlainDate.from(
      { year: parts.year, month: parts.month, day: parts.day, calendar: TEMPORAL_CALENDAR_ID[system] },
      { overflow: 'reject' },
    )
    .withCalendar('iso8601')
    .toString();
}

// Day count for a given year/month in the target system — islamic/hebrew
// months vary between 29-30 days depending on the year, unlike Gregorian's
// fixed lengths. Used to bound the day field's spinner/input when editing
// in a non-gregorian system.
export function daysInCalendarMonth(year: number, month: number, system: CalendarSystem): number {
  if (system === 'gregorian') return new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (system === 'julian') return daysInJulianMonth(year, month);
  return getTemporal().PlainDate.from({ year, month, day: 1, calendar: TEMPORAL_CALENDAR_ID[system] }).daysInMonth;
}

// Month count for a given year in the target system — the Hebrew calendar
// inserts a 13th month (Adar I) in leap years; every other system supported
// here always has 12.
export function monthsInCalendarYear(year: number, system: CalendarSystem): number {
  if (system !== 'hebrew') return 12;
  return getTemporal().PlainDate.from({ year, month: 1, day: 1, calendar: 'hebrew' }).monthsInYear;
}

export function addCalendarUnit(
  isoDate: string,
  system: CalendarSystem,
  unit: 'month' | 'year',
  delta: number,
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
  const plainDate = getTemporal().PlainDate.from(isoDate).withCalendar(TEMPORAL_CALENDAR_ID[system]);
  const advanced = unit === 'month' ? plainDate.add({ months: delta }) : plainDate.add({ years: delta });
  return advanced.withCalendar('iso8601').toString();
}

export function formatCalendarDate(isoDate: string, system: CalendarSystem, locale = 'en'): string {
  if (system === 'gregorian') {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(
      Date.UTC(year, month - 1, day),
    );
  }
  if (system === 'julian') {
    const parts = gregorianIsoToJulianParts(isoDate);
    return `${monthNameFromNumbers(parts.year, parts.month, locale)} ${parts.day}, ${parts.year}`;
  }
  const plainDate = getTemporal().PlainDate.from(isoDate).withCalendar(TEMPORAL_CALENDAR_ID[system]);
  return plainDate.toLocaleString(`${locale}-u-ca-${TEMPORAL_CALENDAR_ID[system]}`, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
