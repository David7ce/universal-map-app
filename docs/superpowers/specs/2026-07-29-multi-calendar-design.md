# Multi-calendar display — Design

Status: approved
Date: 2026-07-29

## 1. Purpose

Support displaying dates in calendar systems other than Gregorian (Julian, Islamic, Hebrew), per app, without touching how dates are stored or computed. Tracked as a "Futuro" item in `ROADMAP.md` — flagged there as needing a real architecture decision before any code changes, which this document makes.

## 2. Scope decision: display-only

Storage and computation stay 100% Gregorian ISO 8601 everywhere they are today:

- `properties.temporal` (`instant`/`range`/`recurrence`) — unchanged.
- `isActiveOn()` and the RRULE subset (`rrule-subset.ts`) — unchanged, still operate on Gregorian `Date`.
- `store.selectedDate` — unchanged, still an ISO string.
- `app-manifest.json`'s `calendar.min` / `calendar.max` / `calendar.default` — unchanged, still authored as Gregorian ISO regardless of display calendar. One interchange format for every app author to learn, no double-authoring burden per calendar system.

A new conversion layer sits **only between storage and rendering**: it converts a Gregorian ISO date to a target calendar system's representation for display, and converts calendar-aware arithmetic (e.g. "next month" in the Islamic calendar) back to a Gregorian ISO string before it touches the store. Nothing upstream of the UI layer needs to know a non-Gregorian calendar exists.

This scope explicitly excludes replacing the native date-picker popup with a custom calendar-grid widget (see Section 6, known deviation).

## 3. New manifest field

`app-manifest.json`'s `calendar` object gains an optional field:

```json
"calendar": {
  "system": "islamic",
  "default": "today",
  "min": "2015-01-01",
  "max": "2030-12-31"
}
```

- `calendar.system?: 'gregorian' | 'julian' | 'islamic' | 'hebrew'`, default `'gregorian'`.
- Omitting it is fully backward compatible — every existing app (which has no `system` field) renders exactly as it does today.
- Validated in `validateAppManifest()` against this fixed list (same pattern as `VALID_KINDS` in `layer-manifest.ts`) — curated to the roadmap's own named systems, not the full Temporal/ICU calendar registry, to avoid building/testing/documenting support for systems no app has asked for yet.

## 4. Conversion module: `src/engine/time/calendar-conversion.ts`

Three pure functions, all taking a Gregorian ISO date string and a `CalendarSystem`:

- `toCalendarParts(isoDate, system): { year: number; month: number; day: number; monthName: string }` — the date's year/month/day and month name in the target system.
- `addCalendarUnit(isoDate, system, unit: 'month' | 'year', delta: number): string` — adds `delta` units *in the target calendar system* (e.g. one Islamic month, which is not a fixed number of Gregorian days) and returns the result as a Gregorian ISO string.
- `formatCalendarDate(isoDate, system, locale): string` — a human-readable label in the target system (e.g. `"15 Muharram 1447 AH"`). `locale` defaults to `navigator.language` — the project has no locale-switcher concept (Section 8 of the core design spec is explicit: strings-file seam only, no i18n runtime), so this reuses whatever the browser already reports rather than adding a new manifest field.

Implementation split by system:

- `gregorian` — identity / thin wrapper around existing `Date` logic. No new behavior.
- `islamic`, `hebrew` — via `@js-temporal/polyfill` (`Temporal.PlainDate` with a calendar id), which provides correct calendar-aware arithmetic and localized formatting without hand-rolling irregular leap-year/month-length rules (Hebrew's especially are a known correctness minefield).
- `julian` — hand-rolled, via the standard Julian Day Number conversion (Fliegel & Van Flandern algorithm). Julian isn't in the Unicode/ICU calendar registry that Temporal/Intl draw from, so no library covers it regardless of which one is chosen for the others. The algorithm is short, deterministic, and well-documented, so this is low risk despite being hand-rolled.

New dependency: `@js-temporal/polyfill`, documented in `CHANGELOG.md` the same way `leaflet.heat` was when it was introduced.

## 5. UI changes

- **`CalendarBar.ts`**: the native `<input type="date">` is unchanged — still Gregorian, still the thing that actually sets `store.selectedDate` on `change`. A new read-only label is added next to it, showing the same date via `formatCalendarDate()` when `calendar.system !== 'gregorian'`. The `←`/`→` step buttons route through `addCalendarUnit()` for `month`/`year` granularity when `system !== 'gregorian'` (day/week stepping is calendar-agnostic — a day is a day — so unchanged). The range slider is unchanged for the same reason (it counts raw days between `min`/`max`).
- **`temporal-status.ts`**: `describeTemporalStatus()` gains a `system` parameter; the `since`/`until`/`activeOn` date substitutions go through `formatCalendarDate()` instead of the raw ISO string when `system !== 'gregorian'`.
- **Threading**: `calendar.system` flows from `appManifest.calendar` in `main.ts` down into `mountCalendarBar()` (already receives a `CalendarConfig`, gains a `system` field) and into `mountSelectionCard()` → `describeTemporalStatus()` (already receives layers/store, gains the system value).

## 6. Known deviation (documented, not built)

The native date-picker popup itself (the calendar grid that appears when you click the input) stays Gregorian — browsers do not expose a way to force `<input type="date">` into a different calendar system from JS. This is documented in `README.md`'s existing "Known v1 deviations" section, not silently left as a bug. A fully calendar-aware picker would require a custom-built widget, which is out of scope here.

## 7. Testing

`calendar-conversion.ts` gets a dedicated test file, same pattern as `rrule-subset.test.ts`: pure functions checked against known reference date pairs for each system, with extra coverage on `julian` specifically since it's hand-rolled (the other two systems' correctness is delegated to `@js-temporal/polyfill`). `CalendarBar.ts` and `temporal-status.ts` changes are covered by extending their existing tests with a non-gregorian `system` case.

## 8. Non-goals (unchanged from ROADMAP.md)

- No change to storage format, `isActiveOn`, or RRULE handling.
- No custom calendar-grid picker widget (Section 6).
- No support for calendar systems beyond gregorian/julian/islamic/hebrew in this iteration (Section 3).
