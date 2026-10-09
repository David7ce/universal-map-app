# Week and Month Events (period view) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let visitors see a world's events by **day, week or month**: a Día | Semana | Mes selector next to the date control, prev/next that step by that period, an agenda grouped by day in the left panel, and the map (and filter counts) showing every event that falls inside the period.

**Architecture:** A new `period` field in the store (`'day' | 'week' | 'month'`) plus one pure selector, `selectionFromState`, that turns `{selectedDate, period, calendarSystem}` into a `DateSelection` (`Date` for a day, `{from, to}` for a range). The existing visibility checks (`isFeatureVisibleOn` → `filterActiveFeatures`, `computeTaxonomyDimensions`, `renderDataLayer`) are widened to accept a `DateSelection` instead of a bare `Date`, so every consumer (map, drawer counts, toolbar pills, plugin context) switches by changing one argument. The agenda reuses the existing `getFeaturesInRange`.

**Tech Stack:** TypeScript, Vite, Leaflet, Vitest (`environment: 'node'`, no DOM tests; Intl has full ICU), plain CSS.

**Design note (no separate spec file):** the user approved the design in chat and asked for "el plan recomendado"; this plan carries it. Choices made with the user's answers: the map shows the whole period; worlds with no time dimension (`systems.time: false` — world-leaders, paranormal-spain) show no selector.

## Global Constraints

- Periods: `day` (default), `week` (Monday–Sunday containing the selected date), `month` (the calendar month of the selected date **in the active calendar system**).
- The selected date stays the anchor; prev/next move it by one day / seven days / one calendar month, clamped to `calendar.min`/`calendar.max`.
- Static, browser-only; no new dependencies; `period` is UI state only (not persisted).
- The selector, the stepping and the range label exist only when the world has a time dimension (`showDate`).
- All new UI text goes into `public/strings/site.en.json` and `site.es.json` (key sets must stay identical — a test enforces it).
- Dates in labels use the UI language (`document.documentElement.lang`), fixing today's English-only chip text.
- Format only touched files: `pnpm prettier --write <paths>` (never repo-wide). Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Work on `feat/period-agenda` off `master`.

## Review Focus

- Week boundaries: Sunday belongs to the week that started the previous Monday; a week crossing a month or year boundary (Task 1 tests).
- Month in a non-Gregorian calendar uses that calendar's month length, and stepping from a long month to a short one clamps the day (Task 1/3 tests).
- A feature with a `temporal.recurrence` or `range` that overlaps only part of the period still shows (Task 1 test); an untimed feature is always visible.
- Stepping at `calendar.min`/`max` never leaves the range and the button disables (Task 3 test).
- Week label across a month and across a year, in `en` and `es` (Task 3 test).
- Switching period must not lose keyboard focus on the toggle and must keep the calendar popover working (Task 4 browser check).
- Selecting an event from a later day of the period moves the selected date to that day, so its info card says "active" (Task 5 browser check).
- Worlds without a time dimension show no selector and behave exactly as today (Task 4/6 browser check).

## File Structure

- Create `src/engine/time/period.ts` (+ test): `Period`, `DateRange`, `periodRange`, `isActiveInRange`.
- Create `src/engine/state/selection.ts` (+ test): `selectionFromState`.
- Create `src/ui/period-label.ts` (+ test): `formatPeriodLabel`.
- Create `src/ui/locale.ts`: `uiLocale()`.
- Modify `src/engine/taxonomy/compute-dimensions.ts` (+ `taxonomy.test.ts`): `DateSelection`.
- Modify `src/engine/state/store.ts`, `src/engine/space/map-adapter.ts`, `src/engine/space/leaflet/leaflet-map-adapter.ts`, `src/engine/space/leaflet/data-layer-renderer.ts`, `src/engine/plugins/context.ts`, `src/main.ts`, `src/ui/panels/PanelRight.ts`, `src/ui/panels/toolbar-pills.ts` (+ test), `src/ui/panels/toolbar-date.ts` (+ test), `src/ui/panels/MapToolbar.ts`, `src/ui/panels/SearchOverlay.ts`, `src/styles.css`.
- Modify `public/strings/site.{en,es}.json`, `CHANGELOG.md`, `docs/api-reference.md` (if it lists these functions), `README.md` (one line).

---

### Task 1: Period maths and range visibility (pure, engine)

**Files:** Create `src/engine/time/period.ts`, `src/engine/time/period.test.ts`, `src/engine/state/selection.ts`, `src/engine/state/selection.test.ts`. Modify `src/engine/taxonomy/compute-dimensions.ts`, `src/engine/taxonomy/taxonomy.test.ts`.

**Interfaces:**

- Produces:
  - `type Period = 'day' | 'week' | 'month'`; `interface DateRange { from: string; to: string }` (inclusive ISO dates)
  - `periodRange(iso: string, period: Period, system: CalendarSystem): DateRange`
  - `isActiveInRange(feature: GeoFeature, range: DateRange): boolean`
  - `type DateSelection = Date | { from: Date; to: Date } | null` (in `compute-dimensions.ts`)
  - `selectionFromState(state: { selectedDate: string; period: Period; calendarSystem: CalendarSystem }): DateSelection`
  - `isFeatureVisibleOn(selection: DateSelection, feature)`, `filterActiveFeatures(features, selection, manifest, filters)`, `computeTaxonomyDimensions(layers, selection)` now take a `DateSelection`.
- Consumes: `isActiveOn` (`engine/time/is-active-on.ts`), `toCalendarParts`, `calendarPartsToIso`, `daysInCalendarMonth` (`engine/time/calendar-conversion.ts`).

- [ ] **Step 1: Write the failing tests**

`src/engine/time/period.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureCalendarSystemLoaded } from './calendar-conversion';
import type { GeoFeature } from './temporal-types';
import { isActiveInRange, periodRange } from './period';

beforeAll(async () => {
  await ensureCalendarSystemLoaded('islamic');
});

describe('periodRange', () => {
  it('is the single day for day', () => {
    expect(periodRange('2026-10-08', 'day', 'gregorian')).toEqual({ from: '2026-10-08', to: '2026-10-08' });
  });

  it('is Monday to Sunday for week', () => {
    // 2026-10-08 is a Thursday
    expect(periodRange('2026-10-08', 'week', 'gregorian')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
  });

  it('keeps Sunday in the week that started the previous Monday, and Monday as its first day', () => {
    expect(periodRange('2026-10-11', 'week', 'gregorian')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(periodRange('2026-10-05', 'week', 'gregorian')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
  });

  it('lets a week cross a month and a year boundary', () => {
    expect(periodRange('2026-12-31', 'week', 'gregorian')).toEqual({ from: '2026-12-28', to: '2027-01-03' });
    expect(periodRange('2026-03-01', 'week', 'gregorian')).toEqual({ from: '2026-02-23', to: '2026-03-01' });
  });

  it('is the whole gregorian month for month, including leap February', () => {
    expect(periodRange('2026-10-08', 'month', 'gregorian')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodRange('2028-02-10', 'month', 'gregorian')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('uses the active calendar system for month', () => {
    const r = periodRange('2026-07-29', 'month', 'islamic');
    expect(r.from <= '2026-07-29' && '2026-07-29' <= r.to).toBe(true);
    const days = (Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000 + 1;
    expect([29, 30]).toContain(days);
  });
});

function feature(temporal?: GeoFeature['properties']['temporal']): GeoFeature {
  return {
    type: 'Feature',
    id: 'f',
    properties: temporal ? { temporal } : {},
    geometry: { type: 'Point', coordinates: [0, 0] },
  };
}
const WEEK = { from: '2026-10-05', to: '2026-10-11' };

describe('isActiveInRange', () => {
  it('is true for an untimed feature', () => {
    expect(isActiveInRange(feature(), WEEK)).toBe(true);
  });

  it('matches an instant anywhere inside the range, inclusive of both ends', () => {
    expect(isActiveInRange(feature({ instant: '2026-10-05' }), WEEK)).toBe(true);
    expect(isActiveInRange(feature({ instant: '2026-10-11' }), WEEK)).toBe(true);
    expect(isActiveInRange(feature({ instant: '2026-10-12' }), WEEK)).toBe(false);
    expect(isActiveInRange(feature({ instant: '2026-10-04' }), WEEK)).toBe(false);
  });

  it('matches a range that overlaps only part of the period', () => {
    expect(isActiveInRange(feature({ range: { from: '2026-10-10', to: '2026-10-20' } }), WEEK)).toBe(true);
    expect(isActiveInRange(feature({ range: { from: '2026-09-01', to: '2026-10-05' } }), WEEK)).toBe(true);
    expect(isActiveInRange(feature({ range: { from: '2026-10-12', to: '2026-10-20' } }), WEEK)).toBe(false);
  });

  it('matches a recurrence that falls on any day of the period', () => {
    const weeklyOnSaturday = { range: { from: '2026-01-01' }, recurrence: { rule: 'FREQ=WEEKLY;BYDAY=SA' } };
    expect(isActiveInRange(feature(weeklyOnSaturday), WEEK)).toBe(true);
    expect(
      isActiveInRange(
        feature({ ...weeklyOnSaturday, recurrence: { rule: 'FREQ=WEEKLY;BYDAY=SA', exceptions: ['2026-10-10'] } }),
        WEEK,
      ),
    ).toBe(false);
  });
});
```

`src/engine/state/selection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { selectionFromState } from './selection';

const base = { selectedDate: '2026-10-08', calendarSystem: 'gregorian' as const };

describe('selectionFromState', () => {
  it('is a single UTC date for day', () => {
    const s = selectionFromState({ ...base, period: 'day' });
    expect(s).toBeInstanceOf(Date);
    expect((s as Date).toISOString()).toBe('2026-10-08T00:00:00.000Z');
  });

  it('is a from/to pair of UTC dates for week and month', () => {
    const w = selectionFromState({ ...base, period: 'week' }) as { from: Date; to: Date };
    expect(w.from.toISOString().slice(0, 10)).toBe('2026-10-05');
    expect(w.to.toISOString().slice(0, 10)).toBe('2026-10-11');
    const m = selectionFromState({ ...base, period: 'month' }) as { from: Date; to: Date };
    expect([m.from, m.to].map((d) => d.toISOString().slice(0, 10))).toEqual(['2026-10-01', '2026-10-31']);
  });
});
```

Append to `src/engine/taxonomy/taxonomy.test.ts` (reuse its `layer()` fixture: shop x2 untimed, market instant 2020-01-01):

```ts
describe('DateSelection ranges', () => {
  it('counts values for features active anywhere in a range', () => {
    const dims = computeTaxonomyDimensions([layer()], {
      from: new Date('2019-12-30T00:00:00Z'),
      to: new Date('2020-01-05T00:00:00Z'),
    });
    expect(dims[0].values).toEqual([
      { value: 'shop', count: 2 },
      { value: 'market', count: 1 },
    ]);
  });

  it('excludes features outside the range', () => {
    const dims = computeTaxonomyDimensions([layer()], {
      from: new Date('2021-01-01T00:00:00Z'),
      to: new Date('2021-01-31T00:00:00Z'),
    });
    expect(dims[0].values).toEqual([{ value: 'shop', count: 2 }]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/engine/time/period.test.ts src/engine/state/selection.test.ts src/engine/taxonomy/taxonomy.test.ts`
Expected: FAIL — `./period` and `./selection` not found; the range tests fail (a range object is treated as a `Date`).

- [ ] **Step 3: Implement**

`src/engine/time/period.ts`:

```ts
import type { CalendarSystem } from './calendar-systems';
import { calendarPartsToIso, daysInCalendarMonth, toCalendarParts } from './calendar-conversion';
import { isActiveOn } from './is-active-on';
import type { GeoFeature } from './temporal-types';

export type Period = 'day' | 'week' | 'month';

// Inclusive ISO (YYYY-MM-DD) bounds.
export interface DateRange {
  from: string;
  to: string;
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// The days a period covers around `iso`: the day itself, the Monday–Sunday
// week containing it, or its calendar month in the active calendar system.
export function periodRange(iso: string, period: Period, system: CalendarSystem): DateRange {
  if (period === 'day') return { from: iso, to: iso };
  if (period === 'week') {
    const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
    const from = addDays(iso, -((weekday + 6) % 7));
    return { from, to: addDays(from, 6) };
  }
  const { year, month } = toCalendarParts(iso, system);
  return {
    from: calendarPartsToIso({ year, month, day: 1 }, system),
    to: calendarPartsToIso({ year, month, day: daysInCalendarMonth(year, month, system) }, system),
  };
}

// True when the feature is active on at least one day of the range. A
// day-by-day scan over `isActiveOn` — periods are at most a month, so this
// stays cheap and reuses the recurrence/exception logic exactly.
export function isActiveInRange(feature: GeoFeature, range: DateRange): boolean {
  let iso = range.from;
  while (iso <= range.to) {
    if (isActiveOn(feature, new Date(`${iso}T00:00:00Z`))) return true;
    iso = addDays(iso, 1);
  }
  return false;
}
```

In `src/engine/taxonomy/compute-dimensions.ts`: add `import { isActiveInRange } from '../time/period';` and replace the date handling:

```ts
// What the map, filters and counts are restricted to: one day, a span of days
// (week / month period), or nothing (every feature).
export type DateSelection = Date | { from: Date; to: Date } | null;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isFeatureVisibleOn(selection: DateSelection, feature: GeoFeature): boolean {
  if (selection === null) return true;
  if (selection instanceof Date) return isActiveOn(feature, selection);
  return isActiveInRange(feature, { from: isoDay(selection.from), to: isoDay(selection.to) });
}
```

and change the parameter type of `filterActiveFeatures(features, date, …)` and `computeTaxonomyDimensions(layers, date)` from `Date | null` to `DateSelection` (bodies already call `isFeatureVisibleOn(date, …)`).

`src/engine/state/selection.ts`:

```ts
import type { CalendarSystem } from '../time/calendar-systems';
import { periodRange, type Period } from '../time/period';
import type { DateSelection } from '../taxonomy/compute-dimensions';

// The one place that turns "selected date + period" into what the map,
// filters and counts are restricted to.
export function selectionFromState(state: {
  selectedDate: string;
  period: Period;
  calendarSystem: CalendarSystem;
}): DateSelection {
  if (state.period === 'day') return new Date(`${state.selectedDate}T00:00:00Z`);
  const { from, to } = periodRange(state.selectedDate, state.period, state.calendarSystem);
  return { from: new Date(`${from}T00:00:00Z`), to: new Date(`${to}T00:00:00Z`) };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/engine/time/period.test.ts src/engine/state/selection.test.ts src/engine/taxonomy/taxonomy.test.ts && pnpm typecheck`
Expected: PASS. (If the recurrence test's rule syntax is rejected, mirror an existing rule from `src/engine/time/rrule-subset.test.ts`; the intent is "weekly on Saturday".)

- [ ] **Step 5: Commit**

```bash
pnpm prettier --write src/engine/time/period.ts src/engine/time/period.test.ts src/engine/state/selection.ts src/engine/state/selection.test.ts src/engine/taxonomy/compute-dimensions.ts src/engine/taxonomy/taxonomy.test.ts
git add src/engine
git commit -m "feat: add period ranges and range-aware date selection

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `period` in the store and every consumer of the selected date

**Files:** Modify `src/engine/state/store.ts`, `src/engine/space/map-adapter.ts`, `src/engine/space/leaflet/leaflet-map-adapter.ts`, `src/engine/space/leaflet/data-layer-renderer.ts`, `src/engine/plugins/context.ts`, `src/main.ts`, `src/ui/panels/PanelRight.ts`, `src/ui/panels/toolbar-pills.ts`, `src/ui/panels/toolbar-pills.test.ts`, `src/ui/panels/MapToolbar.ts` (call site only).

**Interfaces:**

- Consumes: `Period`, `selectionFromState`, `DateSelection` (Task 1).
- Produces: `AppState.period: Period`; `renderDataLayer(..., date: DateSelection, ...)`; `buildToolbarPills(layers, selection: DateSelection, hiddenLayerIds)`.

- [ ] **Step 1: Add the failing test**

In `src/ui/panels/toolbar-pills.test.ts` add (reusing its `layer`/`feature` helpers) a test that a range selection counts a value active only mid-range:

```ts
it('counts a value as active when it falls anywhere inside a range selection', () => {
  const l = layer('poi', [feature('1', 'shop'), feature('3', 'market', '2026-06-04')]);
  const pills = buildToolbarPills(
    [l],
    { from: new Date('2026-06-01T00:00:00Z'), to: new Date('2026-06-07T00:00:00Z') },
    new Set(),
  );
  expect(pills.map((p) => [p.value, p.count])).toEqual([
    ['shop', 1],
    ['market', 1],
  ]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/ui/panels/toolbar-pills.test.ts`
Expected: FAIL (type error / market counted 0) until `buildToolbarPills` takes a `DateSelection`.

- [ ] **Step 3: Implement**

1. `src/engine/state/store.ts`: `import type { Period } from '../time/period';` and add to `AppState`: `period: Period;` with the comment "Whether the map, counts and agenda cover the selected day, its week or its month."
2. `src/engine/space/map-adapter.ts` and `leaflet-map-adapter.ts`: change every `date: Date | null` to `date: DateSelection` (import the type from `../taxonomy/compute-dimensions`); `data-layer-renderer.ts` likewise for its `date` parameter.
3. `src/engine/plugins/context.ts`: replace the local `new Date(...)` with `selectionFromState(state)` and pass it to `filterActiveFeatures`.
4. `src/main.ts`: initial store gets `period: 'day'`; in `renderMap` replace `const date = new Date(...)` with `const selection = selectionFromState(state);` and pass `selection` to `renderDataLayer`.
5. `src/ui/panels/PanelRight.ts` (line ~21): replace `new Date(`${store.get().selectedDate}T00:00:00Z`)` with `selectionFromState(store.get())`.
6. `src/ui/panels/toolbar-pills.ts`: change `date: Date | null` to `selection: DateSelection` (import from compute-dimensions) and pass it to `computeTaxonomyDimensions(shown, selection)`; in `MapToolbar.ts` `renderFilters` call it with `selectionFromState(state)`.
7. Fix any other type error `pnpm typecheck` reports (tests that build an `AppState` need `period: 'day'`).

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green (behaviour is unchanged because `period` is always `'day'`).

- [ ] **Step 5: Commit**

```bash
pnpm prettier --write <every file changed above>
git add -A src
git commit -m "feat: thread a date selection (day/week/month) through map, counts and plugins

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Stepping, labels, locale and strings

**Files:** Create `src/ui/period-label.ts`, `src/ui/period-label.test.ts`, `src/ui/locale.ts`. Modify `src/ui/panels/toolbar-date.ts`, `src/ui/panels/toolbar-date.test.ts`, `public/strings/site.en.json`, `public/strings/site.es.json`.

**Interfaces:**

- Produces:
  - `shiftPeriod(iso: string, period: Period, direction: 1 | -1, system: CalendarSystem, min: string, max: string): string`
  - `formatPeriodLabel(iso: string, period: Period, system: CalendarSystem, locale: string): string`
  - `uiLocale(): string`
  - strings: `period.group`, `period.day`, `period.week`, `period.month`, `toolbar.prev.day|week|month`, `toolbar.next.day|week|month` (the old `toolbar.prevMonth` / `toolbar.nextMonth` are removed).
- Consumes: `stepMonth` (`toolbar-date.ts`), `clampDateToRange` (`CalendarBar.ts`), `periodRange`, `formatCalendarDate`, `toCalendarParts`.

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/panels/toolbar-date.test.ts` (it already has `MIN`/`MAX` and loads `islamic`):

```ts
import { shiftPeriod } from './toolbar-date';

describe('shiftPeriod', () => {
  it('moves by one day or seven days', () => {
    expect(shiftPeriod('2026-10-08', 'day', 1, 'gregorian', MIN, MAX)).toBe('2026-10-09');
    expect(shiftPeriod('2026-10-08', 'week', -1, 'gregorian', MIN, MAX)).toBe('2026-10-01');
    expect(shiftPeriod('2026-12-30', 'week', 1, 'gregorian', MIN, MAX)).toBe('2027-01-06');
  });

  it('moves by a calendar month, keeping the day inside the target month', () => {
    expect(shiftPeriod('2026-01-31', 'month', 1, 'gregorian', MIN, MAX)).toBe('2026-02-28');
  });

  it('clamps to the world range for every period', () => {
    expect(shiftPeriod('2026-06-18', 'week', 1, 'gregorian', '2026-01-01', '2026-06-20')).toBe('2026-06-20');
    expect(shiftPeriod('2026-01-02', 'day', -1, 'gregorian', '2026-01-01', '2026-06-20')).toBe('2026-01-01');
    expect(shiftPeriod('2026-06-20', 'day', 1, 'gregorian', '2026-01-01', '2026-06-20')).toBe('2026-06-20');
  });
});
```

`src/ui/period-label.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureCalendarSystemLoaded } from '../engine/time/calendar-conversion';
import { formatPeriodLabel } from './period-label';

beforeAll(async () => {
  await ensureCalendarSystemLoaded('islamic');
});

describe('formatPeriodLabel', () => {
  it('formats a day in the UI language', () => {
    expect(formatPeriodLabel('2026-10-08', 'day', 'gregorian', 'en')).toBe('October 8, 2026');
    expect(formatPeriodLabel('2026-10-08', 'day', 'gregorian', 'es')).toMatch(/8 de octubre de 2026/);
  });

  it('formats a week inside one month compactly', () => {
    expect(formatPeriodLabel('2026-10-08', 'week', 'gregorian', 'en')).toBe('Oct 5 – 11, 2026');
    expect(formatPeriodLabel('2026-10-08', 'week', 'gregorian', 'es')).toMatch(/5.*11.*oct.*2026/i);
  });

  it('formats a week that crosses a month', () => {
    expect(formatPeriodLabel('2026-03-01', 'week', 'gregorian', 'en')).toBe('Feb 23 – Mar 1, 2026');
  });

  it('formats a week that crosses a year', () => {
    expect(formatPeriodLabel('2026-12-31', 'week', 'gregorian', 'en')).toBe('Dec 28, 2026 – Jan 3, 2027');
  });

  it('formats a month as month and year', () => {
    expect(formatPeriodLabel('2026-10-08', 'month', 'gregorian', 'en')).toBe('October 2026');
    expect(formatPeriodLabel('2026-10-08', 'month', 'gregorian', 'es')).toMatch(/octubre.*2026/i);
  });

  it('falls back to full dates for a non-gregorian week', () => {
    const label = formatPeriodLabel('2026-07-29', 'week', 'islamic', 'en');
    expect(label).toContain(' – ');
  });
});
```

Add to `src/ui/site-strings.test.ts` nothing: the existing key-parity test covers the new keys once both files define them.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/ui/panels/toolbar-date.test.ts src/ui/period-label.test.ts`
Expected: FAIL (`shiftPeriod` / `formatPeriodLabel` missing). If the exact `Intl` output differs from a literal above (ICU versions differ in `Oct 5 – 11, 2026` spacing), adjust the **expected string** to what `Intl.DateTimeFormat` produces on this Node and keep the test strict on content (month, days, year, en dash).

- [ ] **Step 3: Implement**

Add to `src/ui/panels/toolbar-date.ts`:

```ts
import { periodRange, type Period } from '../../engine/time/period';

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// The selected date moved by one period: a day, seven days, or a calendar month
// (keeping the day of month where possible), clamped to the world's range.
export function shiftPeriod(
  iso: string,
  period: Period,
  direction: 1 | -1,
  system: CalendarSystem,
  min: string,
  max: string,
): string {
  if (period === 'month') return stepMonth(iso, system, direction, min, max);
  return clampDateToRange(addDays(iso, direction * (period === 'week' ? 7 : 1)), min, max);
}
```

(Keep the `periodRange` import out if unused — only `Period` is needed here; import with `import type { Period }`.)

`src/ui/locale.ts`:

```ts
// The UI language set at bootstrap (`main.ts` writes it to <html lang>).
export function uiLocale(): string {
  return document.documentElement.lang || 'en';
}
```

`src/ui/period-label.ts`:

```ts
import type { CalendarSystem } from '../engine/time/calendar-systems';
import { formatCalendarDate, toCalendarParts } from '../engine/time/calendar-conversion';
import { periodRange, type Period } from '../engine/time/period';

const utc = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const fmt = (locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options });

// The text of the date control: the day, the week's span ("Oct 5 – 11, 2026"),
// or the month ("October 2026"), in the UI language and calendar system.
export function formatPeriodLabel(iso: string, period: Period, system: CalendarSystem, locale: string): string {
  if (period === 'day') return formatCalendarDate(iso, system, locale);
  const { from, to } = periodRange(iso, period, system);

  if (period === 'month') {
    if (system === 'gregorian') return fmt(locale, { month: 'long', year: 'numeric' }).format(utc(from));
    const parts = toCalendarParts(from, system, locale);
    return `${parts.monthName} ${parts.year}`;
  }

  // week
  if (system !== 'gregorian')
    return `${formatCalendarDate(from, system, locale)} – ${formatCalendarDate(to, system, locale)}`;
  const start = utc(from);
  const end = utc(to);
  const monthDay = fmt(locale, { month: 'short', day: 'numeric' });
  const year = fmt(locale, { year: 'numeric' });
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    return `${monthDay.format(start)}, ${year.format(start)} – ${monthDay.format(end)}, ${year.format(end)}`;
  }
  if (start.getUTCMonth() !== end.getUTCMonth()) {
    return `${monthDay.format(start)} – ${monthDay.format(end)}, ${year.format(end)}`;
  }
  return `${monthDay.format(start)} – ${fmt(locale, { day: 'numeric' }).format(end)}, ${year.format(end)}`;
}
```

Strings — add after `toolbar.moreLabel` in both files, and delete `toolbar.prevMonth` / `toolbar.nextMonth` from both:

English: `"period.group": "Period"`, `"period.day": "Day"`, `"period.week": "Week"`, `"period.month": "Month"`, `"toolbar.prev.day": "Previous day"`, `"toolbar.prev.week": "Previous week"`, `"toolbar.prev.month": "Previous month"`, `"toolbar.next.day": "Next day"`, `"toolbar.next.week": "Next week"`, `"toolbar.next.month": "Next month"`.
Spanish: `"period.group": "Periodo"`, `"period.day": "Día"`, `"period.week": "Semana"`, `"period.month": "Mes"`, `"toolbar.prev.day": "Día anterior"`, `"toolbar.prev.week": "Semana anterior"`, `"toolbar.prev.month": "Mes anterior"`, `"toolbar.next.day": "Día siguiente"`, `"toolbar.next.week": "Semana siguiente"`, `"toolbar.next.month": "Mes siguiente"`.

(The two string files are JSON: edit with a small node/python script that loads, mutates and rewrites with `JSON.stringify(obj, null, 2) + '\n'`, then run prettier.)

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/ui && pnpm typecheck && pnpm lint`
Expected: PASS. (`MapToolbar.ts` still references `toolbar.prevMonth` until Task 4 — if `t()` is used with a removed key it returns the key at runtime; Task 4 replaces those uses immediately, so do Tasks 3 and 4 back to back, or keep the old keys until Task 4 removes them.)

- [ ] **Step 5: Commit**

```bash
pnpm prettier --write src/ui/period-label.ts src/ui/period-label.test.ts src/ui/locale.ts src/ui/panels/toolbar-date.ts src/ui/panels/toolbar-date.test.ts public/strings/site.en.json public/strings/site.es.json
git add -A src public
git commit -m "feat: add period stepping, period labels, ui locale and strings

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Period selector in the date control

**Files:** Modify `src/ui/panels/MapToolbar.ts`, `src/main.ts` (no new option needed — locale comes from `uiLocale()`), `src/styles.css`.

**Interfaces:** Consumes `shiftPeriod`, `formatPeriodLabel`, `uiLocale` (Task 3), `AppState.period` (Task 2).

- [ ] **Step 1: Markup** — in the skeleton built by `mountMapToolbar`, put a period group as the first child of `.map-toolbar__date` (before the prev button):

```ts
      <div class="map-toolbar__period" role="group" aria-label="${escapeHtml(t('period.group', strings))}">
        ${(['day', 'week', 'month'] as const)
          .map(
            (p) =>
              `<button type="button" class="map-toolbar__period-btn" data-period="${p}" aria-pressed="false">${escapeHtml(t(`period.${p}`, strings))}</button>`,
          )
          .join('')}
      </div>
```

- [ ] **Step 2: Behaviour** in `MapToolbar.ts`:
  - `renderDate()` shows `formatPeriodLabel(state.selectedDate, state.period, state.calendarSystem, uiLocale())` in the chip, sets each period button's `aria-pressed`/`is-active`, updates the prev/next `aria-label` with `t(`toolbar.prev.${state.period}`)` / `t(`toolbar.next.${state.period}`)`, and disables prev/next when `shiftPeriod(...)` returns the current `selectedDate` (replace the two `stepMonth` calls with `shiftPeriod(state.selectedDate, state.period, ±1, state.calendarSystem, calendar.min, calendar.max)`).
  - `step(direction)` uses `shiftPeriod(...)` instead of `stepMonth(...)`.
  - A click handler on the period group: `const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-period]'); if (button) store.set({ period: button.dataset.period as Period });` (the group is persistent, so focus stays on the pressed button).
  - Remove the now-unused `stepMonth` import from `MapToolbar.ts`; remove the old `toolbar.prevMonth`/`toolbar.nextMonth` aria-labels from the static markup (set them in `renderDate`).

- [ ] **Step 3: CSS** (`src/styles.css`, next to the other `.map-toolbar__*` rules):

```css
.map-toolbar__date {
  flex-wrap: wrap;
  justify-content: center;
}
.map-toolbar__period {
  order: -1;
  flex: 0 0 100%;
  display: flex;
  justify-content: center;
}
.map-toolbar__period-btn {
  border: 1px solid var(--color-border);
  background: var(--color-white);
  color: var(--color-text);
  padding: 0.15rem 0.6rem;
  font: inherit;
  font-size: var(--font-size-xs);
  cursor: pointer;
  box-shadow: var(--shadow-md);
}
.map-toolbar__period-btn:first-child {
  border-radius: var(--radius-full) 0 0 var(--radius-full);
}
.map-toolbar__period-btn:last-child {
  border-radius: 0 var(--radius-full) var(--radius-full) 0;
}
.map-toolbar__period-btn + .map-toolbar__period-btn {
  border-left: 0;
}
.map-toolbar__period-btn.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-white);
}
```

The popover is `position: absolute; bottom: calc(100% + .4rem)` relative to `.map-toolbar__date`, so it still opens above the (now taller) group. On mobile keep the selector small: nothing else needed.

- [ ] **Step 4: Verify (browser, desktop and 375px, `events-canary-islands` and `moon-map-photos` in `es` and `en`)**
  1. `pnpm typecheck && pnpm lint && pnpm test` green.
  2. The selector appears above the date row, bottom centre; worlds with `systems.time: false` (`world-leaders`, `paranormal-spain`) show no selector and nothing else changes.
  3. Choose Semana: the chip reads e.g. "5 – 11 oct 2026"; prev/next move 7 days; choose Mes: "octubre 2026", prev/next move one month; the map shows the events of the whole period (check the marker count rises vs Día on a date with events in that period); the drawer/toolbar pill counts follow.
  4. Press a period button with the keyboard: focus stays on it; the calendar popover still opens/closes (Esc returns focus to the chip) and still fits at 375px (it must not overlap the selector).
  5. The chip date is in the UI language (Spanish UI no longer shows "July 1, 2026").

- [ ] **Step 5: Commit**

```bash
pnpm prettier --write src/ui/panels/MapToolbar.ts src/styles.css
git add -A src
git commit -m "feat: add Day | Week | Month selector to the date control

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Agenda for the whole period

**Files:** Modify `src/ui/panels/SearchOverlay.ts`, `src/styles.css`.

**Interfaces:** Consumes `periodRange` (Task 1), `getFeaturesInRange` (`engine/time/day-agenda.ts`), `formatPeriodLabel`, `uiLocale` (Task 3).

- [ ] **Step 1: Replace `renderDayAgenda`** (SearchOverlay.ts ~229–251) with a period agenda:

```ts
function renderDayAgenda(): void {
  const state = store.get();
  const visibleLayers = layers.filter((layer) => !state.hiddenLayerIds.has(layer.manifest.id));
  const range = periodRange(state.selectedDate, state.period, state.calendarSystem);
  const groups = getFeaturesInRange(visibleLayers, state.activeFilters, range.from, range.to);
  const locale = uiLocale();
  const periodLabel = formatPeriodLabel(state.selectedDate, state.period, state.calendarSystem, locale);

  const listHtml = groups.length
    ? groups
        .map(
          (group) => `<section class="search-day-agenda__group">
              ${state.period === 'day' ? '' : `<p class="search-day-agenda__group-date">${escapeHtml(formatCalendarDate(group.iso, state.calendarSystem, locale))}</p>`}
              <ul class="search-day-agenda__list">${group.entries
                .map(
                  (entry) => `<li class="search-day-agenda__item">
                    <button type="button" class="search-day-agenda__item-btn" data-feature-id="${escapeHtml(String(entry.feature.id ?? ''))}" data-iso="${escapeHtml(group.iso)}">
                      <span class="search-day-agenda__item-layer">${escapeHtml(entry.layerTitle)}</span>
                      <span class="search-day-agenda__item-name">${escapeHtml(featureLabel(entry.feature, strings))}</span>
                    </button>
                  </li>`,
                )
                .join('')}</ul>
            </section>`,
        )
        .join('')
    : `<p class="search-day-agenda__empty">${escapeHtml(t('calendarView.noEvents', strings))}</p>`;

  dayAgendaEl.innerHTML = `<p class="search-day-agenda__date">${escapeHtml(periodLabel)}</p>${listHtml}`;
  dayAgendaEl.querySelectorAll<HTMLButtonElement>('[data-feature-id]').forEach((button) => {
    button.addEventListener('click', () => {
      // An event from a later day of the period: move the selected date
      // there so its info card reads "active on the selected date".
      const iso = button.dataset.iso;
      if (iso && iso !== store.get().selectedDate) store.set({ selectedDate: iso });
      selectFeature(button.dataset.featureId!);
    });
  });
}
```

Add the imports (`getFeaturesInRange` in place of `getFeaturesOnDate` if no longer used elsewhere in the file, `periodRange`, `formatPeriodLabel`, `uiLocale`, `formatCalendarDate` is already imported).

- [ ] **Step 2: CSS** — add under the existing `.search-day-agenda__*` rules:

```css
.search-day-agenda__group + .search-day-agenda__group {
  margin-top: 0.75rem;
}
.search-day-agenda__group-date {
  margin: 0 0 0.25rem;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-light);
}
```

- [ ] **Step 3: Verify (browser)** on `events-canary-islands` (events across Aug–Sep 2026 etc.) and `moon-map-photos`:
  1. Día: same list as before (no group headings).
  2. Semana / Mes: the panel heading is the period label; events are grouped under their day headings in date order; an empty period shows "no events".
  3. Clicking an event in a later day opens its info card and the date control moves to that day (still inside the same period); the card shows it as active.
  4. `pnpm typecheck && pnpm lint && pnpm test` green.

- [ ] **Step 4: Commit**

```bash
pnpm prettier --write src/ui/panels/SearchOverlay.ts src/styles.css
git add -A src
git commit -m "feat: list a week's or month's events grouped by day in the agenda

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docs and final verification

**Files:** Modify `CHANGELOG.md`, `README.md`, `docs/api-reference.md` (only if it documents `filterActiveFeatures` / `computeTaxonomyDimensions` / `renderDataLayer` signatures).

- [ ] **Step 1: Docs.** CHANGELOG entry "Week and month events": the Día | Semana | Mes selector in the bottom-centre date control, prev/next per period, the map and counts covering the whole period, the agenda grouped by day, the week = Monday–Sunday, month = the active calendar's month, no selector for worlds without time, dates now in the UI language. In `docs/api-reference.md`, change the documented `date: Date | null` parameters to `DateSelection` and mention `selectionFromState`/`periodRange`. One README line is enough (under features if there is a list, otherwise skip).
- [ ] **Step 2: Full verification.** `pnpm format:check` (format touched docs with `pnpm prettier --write <paths>`; note `docs/json-reference.md` and `docs/api-reference.md` tables must stay Prettier-clean or CI fails), `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm build:moon-map-photos` (isolated build still works).
- [ ] **Step 3: Subpath check.** Serve `dist` under `/universal-map-app/` (the static server used earlier) and re-run the Task 4 browser checks once on `events-canary-islands`, to confirm nothing depends on a root path.
- [ ] **Step 4: Commit.**

```bash
git add -A docs README.md CHANGELOG.md
git commit -m "docs: document the week/month period view

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
