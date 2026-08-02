# Visual calendar grid (day/week/month/year, click-to-select) — Design

Status: approved
Date: 2026-08-02

## 1. Purpose

Replace `CalendarBar.ts`'s plain "Month / Day / Year" text (shown when not in numeric-edit mode) with a real, clickable calendar grid — a week row, a month grid, or a year-of-months grid, depending on the granularity already selected by the day/week/month/year stepper added in the previous session. Clicking a cell selects that date; cells with active features get a dot indicator. The grid must render correctly for every supported `calendar.system` (gregorian/julian/islamic/hebrew), not just gregorian.

## 2. Scope decision: single-day selection, no range-based map filtering

`AppState.selectedDate` stays exactly what it is today: one Gregorian ISO date, filtering the map via `isActiveOn(feature, date)` for that one day. Clicking a week/month/year cell sets `selectedDate` to that cell's first day (day 1 of the month/year) — it does **not** make the map show every event across the whole period at once. That would require `isActiveOn` and the map-rendering path to accept a date *range* instead of a single date, a materially bigger change to `src/engine/time/` and `renderDataLayer` touching code well outside this feature's boundary. Explicitly out of scope; noted in Section 6.

The numeric year/month/day edit fields (pencil-icon toggle, built last session) are unchanged — they remain the precise-entry fallback. The grid is what renders in their place when *not* editing.

## 3. Engine module: `src/engine/time/calendar-grid.ts`

New pure functions, no DOM, no Leaflet — kept in `engine/` per `CONTEXT.md`'s layering rule (engine must not depend on UI). This module needs its own small `addDays`/`daysBetween` date helpers rather than importing `CalendarBar.ts`'s copies — `engine/` cannot depend on `ui/`, only the reverse. The duplication is two five-line functions, not worth threading a shared utility module through the layering boundary for.

```ts
export interface CalendarGridDayCell {
  iso: string;            // Gregorian ISO date this cell represents
  day: number;             // day-of-month number, in the display calendar system
  inCurrentPeriod: boolean; // false for leading/trailing blanks in a month grid
  hasEvents: boolean;
}

export interface CalendarGridMonthCell {
  iso: string;   // Gregorian ISO of day 1 of that month, in the display system
  month: number;  // 1-based month number, in the display system
  hasEvents: boolean;
}

export function buildWeekCells(selectedIso: string, system: CalendarSystem, layers: LoadedLayer[], activeFilters: Record<string, Set<string>>): CalendarGridDayCell[];   // 7 cells, Sunday-start, the week containing selectedIso

export function buildMonthCells(selectedIso: string, system: CalendarSystem, layers: LoadedLayer[], activeFilters: Record<string, Set<string>>): CalendarGridDayCell[];  // full weeks (multiple of 7 cells), leading/trailing blanks for days outside the month

export function buildYearCells(selectedIso: string, system: CalendarSystem, layers: LoadedLayer[], activeFilters: Record<string, Set<string>>): CalendarGridMonthCell[]; // 12 cells (13 for a Hebrew leap year)
```

Reuses existing `src/engine/time/calendar-conversion.ts` functions built last session: `toCalendarParts` (get the display-system year for a given ISO date), `calendarPartsToIso` (target-system year/month/day → Gregorian ISO for each cell), `daysInCalendarMonth`, `monthsInCalendarYear`. A cell's day-of-week (for month-grid column position) comes from the real underlying Gregorian date (`new Date(iso).getUTCDay()`) — Monday is Monday regardless of which calendar labels the year/month/day, so no per-system weekday logic is needed.

`hasEvents` respects the same filtering every other view already does: `featureMatchesFilters(feature, manifest, activeFilters)` (from `compute-dimensions.ts`) before checking `isActiveOn(feature, date)` for the cell's day(s) — a day cell checks its own day; a month cell (in year view) checks every day in that month. A dot showing an event the user has filtered out elsewhere would be misleading, so filters apply here too.

## 4. UI changes

- **New `src/ui/panels/CalendarGrid.ts`**: pure rendering + click-wiring for the three grid shapes, given the cells `calendar-grid.ts` computed. Kept separate from `CalendarBar.ts` (already ~350 lines) per "smaller, well-bounded units."
- **`CalendarBar.ts`**: `mountCalendarBar()` gains a `layers: LoadedLayer[]` parameter (needed to compute `hasEvents`) — `main.ts`'s existing `loadedLayers` gets threaded through, same as it already is to `mountPanelRight`/`mountSearchOverlay`. When not in numeric-edit mode, renders `CalendarGrid` instead of the current plain text, choosing week/month/year/none based on the existing `granularity` stepper state (`'day'` renders no grid — the field-value text stays as today, since a single day has nothing to grid).
- **Click behavior**: clicking a day cell sets `selectedDate`. Clicking a month cell (year view) sets `selectedDate` to day 1 of that month **and** switches `granularity` to `'month'` (drilling down). Month view's day cells are already the finest grain, so clicking there only selects, no further drill. Week view behaves the same way (select only).
- **Event dot**: a small CSS-only marker (`::after` dot, reusing the existing `--color-primary` token) on cells where `hasEvents` is true.

## 5. Testing

`calendar-grid.ts` gets a dedicated test file, same pattern as `calendar-conversion.test.ts`: known reference dates per system, checking cell counts (28/29/30/31-day months, 12-vs-13-month years), leading/trailing blank counts in month view, and `hasEvents` against a small fixture feature set (mirroring `taxonomy.test.ts`'s `layer()` fixture pattern). `CalendarGrid.ts`'s click wiring is DOM-level UI code — consistent with how `PanelRight.ts`/`SettingsControl.ts` have no dedicated test files today, this stays covered by type-check + build + manual verification, not a jsdom test suite.

## 6. Non-goals

- No range-based map filtering (Section 2) — a week/month/year click still resolves to one selected day.
- No new calendar systems beyond gregorian/julian/islamic/hebrew (unchanged from the multi-calendar design).
- No persistence of which grid granularity was last used across a page reload — `granularity` stays session-only UI state, same as it is today.
