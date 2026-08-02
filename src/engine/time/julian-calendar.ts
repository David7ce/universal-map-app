export interface DateParts {
  year: number;
  month: number;
  day: number;
}

// Fliegel & Van Flandern Julian Day Number algorithm. Julian isn't in the
// Unicode/ICU calendar registry that Temporal/Intl draw from, so this is
// hand-rolled regardless of which library covers islamic/hebrew.

function gregorianIsoToJdn(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function jdnToGregorianIso(jdn: number): string {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function julianPartsToJdn(parts: DateParts): number {
  const a = Math.floor((14 - parts.month) / 12);
  const y = parts.year + 4800 - a;
  const m = parts.month + 12 * a - 3;
  return parts.day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
}

function jdnToJulianParts(jdn: number): DateParts {
  const c = jdn + 32082;
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

export function gregorianIsoToJulianParts(isoDate: string): DateParts {
  return jdnToJulianParts(gregorianIsoToJdn(isoDate));
}

export function julianPartsToGregorianIso(parts: DateParts): string {
  return jdnToGregorianIso(julianPartsToJdn(parts));
}

const JULIAN_MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isJulianLeapYear(year: number): boolean {
  return year % 4 === 0;
}

export function daysInJulianMonth(year: number, month: number): number {
  return month === 2 && isJulianLeapYear(year) ? 29 : JULIAN_MONTH_LENGTHS[month - 1];
}

export function addJulianUnit(parts: DateParts, unit: 'month' | 'year', delta: number): DateParts {
  if (unit === 'year') {
    const year = parts.year + delta;
    return { year, month: parts.month, day: Math.min(parts.day, daysInJulianMonth(year, parts.month)) };
  }
  const totalMonths = parts.year * 12 + (parts.month - 1) + delta;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths - year * 12 + 1;
  return { year, month, day: Math.min(parts.day, daysInJulianMonth(year, month)) };
}

// Julian months share the Gregorian calendar's 12-month structure and names
// (only the leap-year rule and the resulting offset differ), so a real
// Gregorian Date built purely to extract a month label is a valid way to get
// a localized name for either calendar — only the `month` field is read.
export function monthNameFromNumbers(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(Date.UTC(year, month - 1, 1));
}
