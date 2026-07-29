# Multi-Calendar Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an app manifest declare `calendar.system: 'gregorian' | 'julian' | 'islamic' | 'hebrew'` so dates render in that calendar system throughout the UI, while storage and all temporal computation (`isActiveOn`, RRULE, `store.selectedDate`) stay Gregorian ISO 8601, unchanged.

**Architecture:** A new conversion layer (`src/engine/time/calendar-conversion.ts` + `src/engine/time/julian-calendar.ts`) sits strictly between storage and rendering. It never writes back to the store — it only reads a Gregorian ISO string and produces display values, or reads a Gregorian ISO string plus a calendar-aware delta and produces a new Gregorian ISO string. Three UI call sites (`CalendarBar.ts`, `temporal-status.ts`/`SelectionCard.ts`) consume it; nothing else in the engine changes.

**Tech Stack:** TypeScript, Vite, Vitest. New dependency: `@js-temporal/polyfill` (TC39 Temporal proposal polyfill) for islamic/hebrew calendar arithmetic and formatting. Julian is hand-rolled (Fliegel & Van Flandern Julian Day Number algorithm) since it isn't in the Unicode/ICU calendar registry Temporal/Intl draw from.

## Global Constraints

- Storage stays Gregorian ISO 8601 everywhere it is today: `properties.temporal`, `isActiveOn()`, `rrule-subset.ts`, `store.selectedDate`, and `app-manifest.json`'s `calendar.min`/`calendar.max`/`calendar.default`. None of these change in this plan.
- `calendar.system` is optional in the manifest, default `'gregorian'`. Omitting it must produce byte-for-byte the same rendered output as before this plan (verified by the existing test suite passing unchanged).
- Curated calendar list only: `'gregorian' | 'julian' | 'islamic' | 'hebrew'`. Do not add more systems — the spec explicitly scoped this down to avoid building support nobody asked for.
- Locale for month names/formatting is a fixed `'en'` default, never `navigator.language` — confirmed during planning that `navigator.language` reflects the OS locale even under Node/Vitest, which would make tests non-deterministic across machines. Do not reintroduce it.
- The native `<input type="date">` picker popup stays Gregorian — no custom calendar-grid widget in this plan (documented deviation, see Task 6).
- Run `npx tsc --noEmit` and `npm test` after every task; both must be clean before moving on.
- Spec: `docs/superpowers/specs/2026-07-29-multi-calendar-design.md`.

---

### Task 1: `CalendarSystem` type + manifest validation

**Files:**
- Create: `src/engine/time/calendar-systems.ts`
- Modify: `src/engine/manifests/app-manifest.ts`
- Test: `src/engine/manifests/manifests.test.ts`

**Interfaces:**
- Produces: `export type CalendarSystem = 'gregorian' | 'julian' | 'islamic' | 'hebrew';` and `export const CALENDAR_SYSTEMS: CalendarSystem[]` from `calendar-systems.ts` — every later task imports `CalendarSystem` from here, and `app-manifest.ts`/`CALENDAR_SYSTEMS` for validation.

- [ ] **Step 1: Create the `CalendarSystem` type file**

```ts
// src/engine/time/calendar-systems.ts
export type CalendarSystem = 'gregorian' | 'julian' | 'islamic' | 'hebrew';

export const CALENDAR_SYSTEMS: CalendarSystem[] = ['gregorian', 'julian', 'islamic', 'hebrew'];
```

- [ ] **Step 2: Write the failing tests for manifest validation**

Add to `src/engine/manifests/manifests.test.ts`, inside the existing `describe('validateAppManifest', ...)` block (after the `'rejects a missing calendar.min'` test):

```ts
  it('accepts a valid calendar.system', () => {
    const withSystem = { ...valid, calendar: { ...valid.calendar, system: 'islamic' } };
    expect(validateAppManifest(withSystem)).toEqual(withSystem);
  });

  it('rejects an invalid calendar.system', () => {
    const invalid = { ...valid, calendar: { ...valid.calendar, system: 'martian' } };
    expect(() => validateAppManifest(invalid)).toThrow(/calendar\.system/);
  });
```

- [ ] **Step 3: Run the tests and confirm the second one fails**

Run: `npx vitest run src/engine/manifests/manifests.test.ts`
Expected: `rejects an invalid calendar.system` FAILS (nothing throws yet — `validateAppManifest` doesn't look at `calendar.system` at all). The `accepts a valid calendar.system` test passes trivially either way since nothing rejects it yet; that's expected, it becomes meaningful once Step 4 adds real validation.

- [ ] **Step 4: Add `calendar.system` to the type and validate it**

In `src/engine/manifests/app-manifest.ts`, add the import and update the `AppManifest` interface:

```ts
import { CALENDAR_SYSTEMS, type CalendarSystem } from '../time/calendar-systems';
```

Change:

```ts
  calendar: { default: 'today' | string; min: string; max: string };
```

to:

```ts
  calendar: { system?: CalendarSystem; default: 'today' | string; min: string; max: string };
```

Then add this validation block right after the existing `calendar.default` check (after the block that throws for an invalid `calendar.default`, before `return json as AppManifest;`):

```ts
  if (calendar.system !== undefined && !CALENDAR_SYSTEMS.includes(calendar.system as CalendarSystem)) {
    throw new Error(`App manifest "${obj.id}" has invalid "calendar.system": ${String(calendar.system)}`);
  }
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run src/engine/manifests/manifests.test.ts`
Expected: PASS, both new tests green.

Also run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/time/calendar-systems.ts src/engine/manifests/app-manifest.ts src/engine/manifests/manifests.test.ts
git commit -m "feat: add calendar.system manifest field with validation"
```

---

### Task 2: Julian calendar conversion (hand-rolled)

**Files:**
- Create: `src/engine/time/julian-calendar.ts`
- Test: `src/engine/time/julian-calendar.test.ts`

**Interfaces:**
- Consumes: nothing (pure math, no dependency on Task 1).
- Produces: `DateParts { year: number; month: number; day: number }`, `gregorianIsoToJulianParts(isoDate: string): DateParts`, `julianPartsToGregorianIso(parts: DateParts): string`, `addJulianUnit(parts: DateParts, unit: 'month' | 'year', delta: number): DateParts`, `monthNameFromNumbers(year: number, month: number, locale: string): string` — Task 3 imports all five from this file.

Reference values used below were verified independently during planning (JDN algorithm fuzz-tested against a full daily roundtrip over 1900–2100, plus two known-correct historical facts: the 1582 Julian/Gregorian calendar-reform boundary, and the current 13-day Julian-behind-Gregorian offset that holds for all dates 1900-03-01 through 2100-02-28).

- [ ] **Step 1: Write the failing tests**

```ts
// src/engine/time/julian-calendar.test.ts
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/engine/time/julian-calendar.test.ts`
Expected: FAIL with "Cannot find module './julian-calendar'" (the file doesn't exist yet).

- [ ] **Step 3: Implement `julian-calendar.ts`**

```ts
// src/engine/time/julian-calendar.ts
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

function daysInJulianMonth(year: number, month: number): number {
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
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/engine/time/julian-calendar.test.ts`
Expected: PASS, all 9 tests green.

Also run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/time/julian-calendar.ts src/engine/time/julian-calendar.test.ts
git commit -m "feat: add hand-rolled Julian calendar conversion"
```

---

### Task 3: Unified calendar conversion API

**Files:**
- Modify: `package.json`, `package-lock.json` (new dependency)
- Create: `src/engine/time/calendar-conversion.ts`
- Test: `src/engine/time/calendar-conversion.test.ts`

**Interfaces:**
- Consumes: `CalendarSystem` from `./calendar-systems` (Task 1); `gregorianIsoToJulianParts`, `julianPartsToGregorianIso`, `addJulianUnit`, `monthNameFromNumbers` from `./julian-calendar` (Task 2); `Temporal` from `@js-temporal/polyfill`.
- Produces: `CalendarDateParts { year: number; month: number; day: number; monthName: string }`, `toCalendarParts(isoDate: string, system: CalendarSystem, locale?: string): CalendarDateParts`, `addCalendarUnit(isoDate: string, system: CalendarSystem, unit: 'month' | 'year', delta: number): string`, `formatCalendarDate(isoDate: string, system: CalendarSystem, locale?: string): string` — Task 4 and Task 5 import `addCalendarUnit` and `formatCalendarDate`.

Reference values below (islamic/hebrew) were verified directly against the installed package during planning.

- [ ] **Step 1: Install the dependency**

```bash
npm install @js-temporal/polyfill
```

Confirm `package.json`'s `dependencies` gained `"@js-temporal/polyfill": "^0.5.1"` (or newer) and `package-lock.json` updated.

- [ ] **Step 2: Write the failing tests**

```ts
// src/engine/time/calendar-conversion.test.ts
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
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npx vitest run src/engine/time/calendar-conversion.test.ts`
Expected: FAIL with "Cannot find module './calendar-conversion'" (the file doesn't exist yet).

- [ ] **Step 4: Implement `calendar-conversion.ts`**

```ts
// src/engine/time/calendar-conversion.ts
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
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run src/engine/time/calendar-conversion.test.ts`
Expected: PASS, all 12 tests green.

Also run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/engine/time/calendar-conversion.ts src/engine/time/calendar-conversion.test.ts
git commit -m "feat: add unified calendar conversion API (gregorian/julian/islamic/hebrew)"
```

---

### Task 4: Calendar-aware stepping and label in `CalendarBar.ts`

**Files:**
- Modify: `src/ui/panels/CalendarBar.ts`
- Modify: `src/styles.css`
- Test: `src/ui/panels/CalendarBar.test.ts` (new)

**Interfaces:**
- Consumes: `CalendarSystem` from `../../engine/time/calendar-systems` (Task 1); `addCalendarUnit`, `formatCalendarDate` from `../../engine/time/calendar-conversion` (Task 3).
- Produces: `export type Granularity = 'day' | 'week' | 'month' | 'year';`, `export function nextSelectedDate(currentIso: string, granularity: Granularity, direction: 1 | -1, system: CalendarSystem): string`, `export function calendarSystemLabel(dateIso: string, system: CalendarSystem): string` — both newly exported and unit-tested directly (no DOM needed to test them, since merely importing `CalendarBar.ts` doesn't touch the DOM — only calling `mountCalendarBar()` does).

- [ ] **Step 1: Write the failing tests**

```ts
// src/ui/panels/CalendarBar.test.ts
import { describe, expect, it } from 'vitest';
import { calendarSystemLabel, nextSelectedDate } from './CalendarBar';

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

describe('calendarSystemLabel', () => {
  it('is empty for gregorian (the native input already shows it)', () => {
    expect(calendarSystemLabel('2026-07-29', 'gregorian')).toBe('');
  });

  it('formats the date in the target system otherwise', () => {
    expect(calendarSystemLabel('2026-07-29', 'islamic')).toBe('Safar 15, 1448 AH');
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/ui/panels/CalendarBar.test.ts`
Expected: FAIL — `nextSelectedDate` and `calendarSystemLabel` are not exported yet (only `mountCalendarBar` is).

- [ ] **Step 3: Extract and export the pure logic, wire up the label**

In `src/ui/panels/CalendarBar.ts`, add imports:

```ts
import type { CalendarSystem } from '../../engine/time/calendar-systems';
import { addCalendarUnit, formatCalendarDate } from '../../engine/time/calendar-conversion';
```

Change `type Granularity = 'day' | 'week' | 'month' | 'year';` to `export type Granularity = 'day' | 'week' | 'month' | 'year';`.

Update `CalendarConfig` to include the new optional field:

```ts
export interface CalendarConfig {
  system?: CalendarSystem;
  default: string;
  min: string;
  max: string;
}
```

Add these two exported functions above `mountCalendarBar` (after `clamp`):

```ts
export function nextSelectedDate(
  currentIso: string,
  granularity: Granularity,
  direction: 1 | -1,
  system: CalendarSystem
): string {
  if (system !== 'gregorian' && (granularity === 'month' || granularity === 'year')) {
    return addCalendarUnit(currentIso, system, granularity, direction);
  }
  const date = new Date(`${currentIso}T00:00:00Z`);
  switch (granularity) {
    case 'day':
      date.setUTCDate(date.getUTCDate() + direction);
      break;
    case 'week':
      date.setUTCDate(date.getUTCDate() + direction * 7);
      break;
    case 'month':
      date.setUTCMonth(date.getUTCMonth() + direction);
      break;
    case 'year':
      date.setUTCFullYear(date.getUTCFullYear() + direction);
      break;
  }
  return date.toISOString().slice(0, 10);
}

export function calendarSystemLabel(dateIso: string, system: CalendarSystem): string {
  return system === 'gregorian' ? '' : formatCalendarDate(dateIso, system);
}
```

Replace the existing `stepDate` function body with:

```ts
  function stepDate(direction: 1 | -1): void {
    const system = config.system ?? 'gregorian';
    const granularity = granularitySelect.value as Granularity;
    store.set({ selectedDate: nextSelectedDate(store.get().selectedDate, granularity, direction, system) });
  }
```

Add the label element to the template — change:

```ts
    <input type="date" data-role="date-input" min="${config.min}" max="${config.max}" />
    <button type="button" data-action="next">&rarr;</button>
```

to:

```ts
    <input type="date" data-role="date-input" min="${config.min}" max="${config.max}" />
    <span class="calendar-bar__system-label" data-role="system-label"></span>
    <button type="button" data-action="next">&rarr;</button>
```

Add the label wiring right after `const dateSlider = ...` line:

```ts
  const systemLabel = container.querySelector<HTMLElement>('[data-role="system-label"]')!;

  function renderSystemLabel(dateIso: string): void {
    systemLabel.textContent = calendarSystemLabel(dateIso, config.system ?? 'gregorian');
  }
```

Update the initial-render block (currently `dateInput.value = ...; dateSlider.value = ...;`) to also call it:

```ts
  dateInput.value = store.get().selectedDate;
  dateSlider.value = sliderOffsetFor(store.get().selectedDate);
  renderSystemLabel(store.get().selectedDate);
```

And update the `store.subscribe` callback at the bottom to also call it:

```ts
  store.subscribe((state) => {
    if (dateInput.value !== state.selectedDate) dateInput.value = state.selectedDate;
    const offset = sliderOffsetFor(state.selectedDate);
    if (dateSlider.value !== offset) dateSlider.value = offset;
    renderSystemLabel(state.selectedDate);
  });
```

Add the label's styling to `src/styles.css`, right after the existing `#calendar-bar input[type='range']` rule:

```css
.calendar-bar__system-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-light);
  white-space: nowrap;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/ui/panels/CalendarBar.test.ts`
Expected: PASS, all 6 tests green.

Also run: `npx tsc --noEmit` and `npm test` (full suite, confirm nothing else broke).
Expected: no errors, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/panels/CalendarBar.ts src/ui/panels/CalendarBar.test.ts src/styles.css
git commit -m "feat: calendar-aware stepping and system label in CalendarBar"
```

---

### Task 5: Thread `calendar.system` through `temporal-status.ts` and `SelectionCard.ts`

**Files:**
- Modify: `src/ui/panels/temporal-status.ts`
- Modify: `src/ui/panels/SelectionCard.ts`
- Modify: `src/main.ts`
- Test: `src/ui/panels/temporal-status.test.ts`

**Interfaces:**
- Consumes: `CalendarSystem` from `../../engine/time/calendar-systems`; `formatCalendarDate` from `../../engine/time/calendar-conversion` (both Task 1/3).
- Produces: `describeTemporalStatus(feature, date, strings, system?: CalendarSystem)` (4th param, defaults to `'gregorian'`) and `mountSelectionCard(container, store, layers, strings, calendarSystem?: CalendarSystem)` (5th param, defaults to `'gregorian'`) — both backward compatible with existing call sites that don't pass the new argument.

- [ ] **Step 1: Write the failing tests**

Add to `src/ui/panels/temporal-status.test.ts`, inside the existing `describe('describeTemporalStatus', ...)` block (after the last existing test):

```ts
  it('formats an instant date in a non-gregorian calendar system when provided', () => {
    const f = feature({ instant: '2026-03-14' });
    expect(describeTemporalStatus(f, new Date('2026-03-14T00:00:00Z'), enStrings, 'julian')).toBe(
      'Active on March 1, 2026'
    );
  });

  it('formats range bounds in a non-gregorian calendar system when provided', () => {
    const f = feature({ range: { from: '2020-01-01', to: '2023-06-30' } });
    expect(describeTemporalStatus(f, new Date('2021-01-01T00:00:00Z'), enStrings, 'julian')).toBe(
      'Active (since December 19, 2019 until June 17, 2023)'
    );
  });

  it('defaults to gregorian (raw ISO strings) when no system is given', () => {
    const f = feature({ instant: '2026-03-14' });
    expect(describeTemporalStatus(f, new Date('2026-03-14T00:00:00Z'), enStrings)).toBe(
      'Active on 2026-03-14'
    );
  });
```

- [ ] **Step 2: Run the tests and confirm the first two fail**

Run: `npx vitest run src/ui/panels/temporal-status.test.ts`
Expected: the two new non-gregorian tests FAIL — `describeTemporalStatus` doesn't accept a 4th argument yet, so dates are always shown as raw ISO strings, not "March 1, 2026" / "December 19, 2019". The third test passes already (matches current behavior).

- [ ] **Step 3: Implement the `system` parameter**

In `src/ui/panels/temporal-status.ts`, add the import:

```ts
import type { CalendarSystem } from '../../engine/time/calendar-systems';
import { formatCalendarDate } from '../../engine/time/calendar-conversion';
```

Replace the function signature and body:

```ts
export function describeTemporalStatus(
  feature: GeoFeature,
  date: Date,
  strings: Record<string, string>,
  system: CalendarSystem = 'gregorian'
): string {
  const temporal = feature.properties.temporal;
  const active = isActiveOn(feature, date);
  const formatDate = (iso: string) => (system === 'gregorian' ? iso : formatCalendarDate(iso, system));

  if (!temporal) return t('temporalStatus.alwaysActive', strings);

  if (temporal.instant) {
    return active
      ? t('temporalStatus.activeOn', strings, { date: formatDate(temporal.instant) })
      : t('temporalStatus.occurredOn', strings, { date: formatDate(temporal.instant) });
  }

  if (temporal.recurrence) {
    const status = active
      ? t('temporalStatus.activeToday', strings)
      : t('temporalStatus.notActiveOnSelectedDate', strings);
    const recurs = t('temporalStatus.recurs', strings, { rule: temporal.recurrence.rule });
    return `${status} (${recurs})`;
  }

  if (temporal.range) {
    const from = temporal.range.from
      ? t('temporalStatus.since', strings, { date: formatDate(temporal.range.from) })
      : '';
    const to = temporal.range.to ? t('temporalStatus.until', strings, { date: formatDate(temporal.range.to) }) : '';
    const status = active ? t('temporalStatus.active', strings) : t('temporalStatus.notActiveOnSelectedDate', strings);
    const bounds = [from, to].filter(Boolean).join(' ');
    return bounds ? `${status} (${bounds})` : status;
  }

  return active ? t('temporalStatus.active', strings) : t('temporalStatus.notActive', strings);
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/ui/panels/temporal-status.test.ts`
Expected: PASS, all tests green (13 total: 10 existing + 3 new).

- [ ] **Step 5: Thread `system` through `SelectionCard.ts` and `main.ts`**

In `src/ui/panels/SelectionCard.ts`, add the import:

```ts
import type { CalendarSystem } from '../../engine/time/calendar-systems';
```

Change the `mountSelectionCard` signature from:

```ts
export function mountSelectionCard(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>
): void {
```

to:

```ts
export function mountSelectionCard(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>,
  calendarSystem: CalendarSystem = 'gregorian'
): void {
```

Change the `contentEl.innerHTML` line from:

```ts
    contentEl.innerHTML = `<p>${describeTemporalStatus(feature, date, strings)}</p>${regionLine}${coordinatesLine}${infoFieldLines}`;
```

to:

```ts
    contentEl.innerHTML = `<p>${describeTemporalStatus(feature, date, strings, calendarSystem)}</p>${regionLine}${coordinatesLine}${infoFieldLines}`;
```

In `src/main.ts`, change the `mountSelectionCard` call from:

```ts
  mountSelectionCard(document.querySelector('#selection-card')!, store, loadedLayers, strings);
```

to:

```ts
  mountSelectionCard(
    document.querySelector('#selection-card')!,
    store,
    loadedLayers,
    strings,
    appManifest.calendar.system ?? 'gregorian'
  );
```

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: all tests pass (existing count plus the 3 new `temporal-status` tests).

- [ ] **Step 7: Commit**

```bash
git add src/ui/panels/temporal-status.ts src/ui/panels/temporal-status.test.ts src/ui/panels/SelectionCard.ts src/main.ts
git commit -m "feat: render temporal-status dates in the app's configured calendar system"
```

---

### Task 6: Docs, demo opt-in example, and manual verification

**Files:**
- Modify: `README.md`
- Modify: `docs/json-reference.md`
- Modify: `CHANGELOG.md`
- Modify: `ROADMAP.md`
- No change (verified, not committed): `apps/demo/app-manifest.json`, `apps/demo/data/poi.geojson` — used only for a temporary, reverted manual check in Step 6.

**Interfaces:** none (docs + manual verification only).

- [ ] **Step 1: Document `calendar.system` in `docs/json-reference.md`**

Find the row describing `calendar.min`/`calendar.max`/`calendar.default` (the app-manifest section) and add a new row directly after it:

```markdown
| `calendar.system` | `"gregorian" \| "julian" \| "islamic" \| "hebrew"` | no | Calendar system used for *display* only (default `"gregorian"`). Storage and all temporal computation (`isActiveOn`, RRULE) always stay Gregorian ISO 8601 regardless of this field — `calendar.min`/`calendar.max`/`calendar.default` are still authored as Gregorian ISO even when `system` is set to something else. Affects `CalendarBar.ts`'s stepping math and system label, and the dates shown in `temporal-status.ts`. See `src/engine/time/calendar-conversion.ts`. |
```

- [ ] **Step 2: Document the known deviation in `README.md`**

In the "Known v1 deviations from the design spec" section, add a new paragraph:

```markdown
`calendar.system` (`docs/json-reference.md`) renders dates in Julian/Islamic/Hebrew calendars throughout the UI (calendar bar stepping and label, temporal-status text), but the native `<input type="date">` picker popup itself always stays Gregorian — browsers don't expose a way to force it into a different calendar system from JS. A fully calendar-aware picker would need a custom-built widget, out of scope for now.
```

- [ ] **Step 3: Add the CHANGELOG entry**

Add to the top of `CHANGELOG.md` (or in the same style/position as the most recent entries — check the file's current top section and prepend there):

```markdown
## Calendario multi-sistema (display): gregoriano, juliano, islámico, hebreo

`app-manifest.json` acepta un `calendar.system` opcional (`"gregorian"` por defecto, o `"julian" | "islamic" | "hebrew"`). El almacenamiento y todo el cómputo temporal (`isActiveOn`, RRULE, `calendar.min`/`max`/`default`) siguen siendo 100% gregoriano/ISO 8601 — la conversión ocurre solo en la capa de presentación (`src/engine/time/calendar-conversion.ts`), nunca hacia el store. `islamic`/`hebrew` usan `@js-temporal/polyfill` (dependencia nueva); `julian` no está en el registro de calendarios Unicode/ICU que usan Temporal/Intl, así que se implementó a mano (algoritmo de número de día juliano de Fliegel & Van Flandern). El selector de fecha nativo (`<input type="date">`) sigue siendo siempre gregoriano — no hay widget de calendario propio (ver "Known v1 deviations" en `README.md`).
```

- [ ] **Step 4: Remove the completed item from `ROADMAP.md`**

The "Futuro" section currently has two subsections, "Multi-calendario" and "Multi-proyección". Remove the entire "Multi-calendario" subsection (its heading and paragraph) now that it's implemented, leaving "Multi-proyección" as the sole remaining "Futuro" item.

- [ ] **Step 5: Leave the live demo's default behavior unchanged**

Do not set `calendar.system` in `apps/demo/app-manifest.json` — the demo should keep rendering exactly as it does today (implicit `gregorian` default). Step 1's new row in `docs/json-reference.md` is the only documentation needed for the field; the manual check in Step 6 below uses a temporary, reverted edit instead of a permanent demo change.

- [ ] **Step 6: Manual verification in the browser**

Temporarily edit `apps/demo/app-manifest.json`'s `calendar` object to add `"system": "islamic"`, then:

```bash
npm run dev
```

Open the printed local URL and confirm:
- The calendar bar shows a small Islamic-calendar label (e.g. "Safar 15, 1448 AH") next to the native (still-Gregorian) date input.
- Clicking the month/year granularity's `→`/`←` buttons steps by an Islamic month/year (the native date input's value jumps by roughly 29-30 days for a month step, not exactly one Gregorian month).
- Selecting a feature (e.g. "Ayuntamiento" via search) shows its temporal-status text unaffected (it has no `temporal` property, so it just says "Always active" regardless of calendar system — for a stronger check, temporarily add `"instant": "2026-03-14"` to one feature's `properties.temporal` in `apps/demo/data/poi.geojson` and confirm the card shows an Islamic-calendar date, not the raw ISO string).

Revert both temporary edits (`apps/demo/app-manifest.json` and, if made, `apps/demo/data/poi.geojson`) afterward — `git diff` should show no changes to either file before committing this task.

- [ ] **Step 7: Full test suite and typecheck one more time**

Run: `npx tsc --noEmit && npm test`
Expected: no errors, all tests pass.

Run: `git status --short`
Expected: only the doc files from Steps 1-4 are modified; `apps/demo/*` shows no changes (confirms Step 6's temporary edits were reverted).

- [ ] **Step 8: Commit**

```bash
git add README.md docs/json-reference.md CHANGELOG.md ROADMAP.md
git commit -m "docs: document calendar.system and close out the multi-calendar roadmap item"
```

---

## Self-Review Notes

- **Spec coverage:** Section 2 (display-only, storage untouched) → Tasks 2-5 never touch `store.selectedDate` writes except via already-ISO strings from `addCalendarUnit`/`nextSelectedDate`. Section 3 (manifest field) → Task 1. Section 4 (conversion module, three functions, Julian split out) → Tasks 2-3. Section 5 (UI changes: CalendarBar label/stepping, temporal-status formatting, threading) → Tasks 4-5. Section 6 (known deviation documented) → Task 6 Step 2. Section 7 (testing approach) → every task has its own test file/cases; Section 8 (non-goals) → respected throughout (no picker widget, no extra calendar systems, no storage-format change).
- **Type consistency checked:** `CalendarSystem` (Task 1) is the single source of truth imported by every later file — `app-manifest.ts`, `calendar-conversion.ts`, `CalendarBar.ts`, `temporal-status.ts`, `SelectionCard.ts` all import it from `calendar-systems.ts`, never redefine it. `addCalendarUnit`/`formatCalendarDate` signatures are identical everywhere they're called. `DateParts` (Task 2) and `CalendarDateParts` (Task 3) are intentionally different shapes — the former is julian-internal, the latter is the public cross-system result — not a naming inconsistency.
- **No placeholders:** every task's code blocks are complete, runnable TypeScript verified against the actual installed package and hand-checked arithmetic during planning (see the reference-value provenance note in Task 2 and Task 3's intro).
