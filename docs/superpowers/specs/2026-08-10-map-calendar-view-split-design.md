# Map / Calendar view split — Design

Status: approved
Date: 2026-08-10

## 1. Purpose

Split the app into two top-level, switchable interfaces: **Map** (the existing full-screen map, unchanged) and a new **Calendar** view — a full-screen day/week/month/year browser. Year view shows all 12 months at once, each as a mini-month grid with every day cell visible (not just 12 clickable month buttons). Picking a day in Calendar view shows an agenda list of that day's events, with a way to jump to Map view already filtered to that date. This absorbs and supersedes the grid-browsing role `CalendarBar.ts`'s embedded grid currently plays inside the filters panel.

## 2. State: `AppState.view`

New field in `src/engine/state/store.ts`:

```ts
view: 'map' | 'calendar';
```

Defaults to `'map'` at bootstrap (`main.ts`). Nothing else about `AppState` changes — `selectedDate`, `activeFilters`, and `calendarSystem` stay the single source of truth both views read and write, so switching views never loses or duplicates state.

## 3. View switcher

A two-tab control (Map / Calendar, reusing `icons.calendar` and a new/existing map icon) mounted in `app-chrome.ts`, visible in both views so the user can always switch back. Clicking a tab sets `store.set({ view: 'map' | 'calendar' })`. Placement: top-center, above both `#map` and `#calendar-view` — the only free corner (top-left holds search, top-right the filters toggle, bottom-left the layer control, bottom-right zoom/footer legend) — styled consistent with the existing floating-control token set in `styles.css`.

## 4. `index.html` / `app-chrome.ts` changes

New sibling container next to `#map`:

```html
<div id="calendar-view" class="calendar-view" hidden></div>
```

`app-chrome.ts` gains a `mountViewSwitcher` (or extends `mountRightPanel`'s file) that toggles `.hidden`/a CSS class on `#map`'s wrapper and `#calendar-view` based on `state.view`, mirroring how `panels.right` already drives `is-open` on `#panel-right`. The map itself (`mapAdapter`) is not torn down when hidden — same pattern as the filters panel not being destroyed on close — so switching back to Map view doesn't require re-fetching tiles or re-rendering layers.

## 5. Engine: `buildYearMonthCells` (`src/engine/time/calendar-grid.ts`)

```ts
export interface CalendarGridMonthGroup {
  month: number; // 1-based, display system
  cells: CalendarGridDayCell[]; // same shape buildMonthCells returns
}

export function buildYearMonthCells(
  selectedIso: string,
  system: CalendarSystem,
  layers: LoadedLayer[],
  activeFilters: Record<string, Set<string>>,
): CalendarGridMonthGroup[]; // one group per month in the display-system year (12, or 13 for a Hebrew leap year)
```

Implementation: for each month in the year (`monthsInCalendarYear`), compute that month's `iso` day 1 (`calendarPartsToIso`) and delegate to the existing `buildMonthCells` with that iso as the reference date. No new date math — this is a thin loop over the already-tested per-month builder. `buildYearCells` (the current 12-button version) stays as-is; nothing currently using it needs to change.

## 6. Engine: day agenda (`src/engine/time/day-agenda.ts`, new file)

```ts
export interface DayAgendaEntry {
  layerId: string;
  layerTitle: string;
  feature: GeoFeature;
}

export function getFeaturesOnDate(
  layers: LoadedLayer[],
  activeFilters: Record<string, Set<string>>,
  iso: string,
): DayAgendaEntry[];
```

Same filtering rule `calendar-grid.ts`'s `hasActiveFeatureOn` already applies (`featureMatchesFilters` + `isActiveOn`, only features with `properties.temporal` set — untimed "always present" features don't clutter a day's agenda), but returns the matching features instead of a boolean. `calendar-grid.ts` is not modified to share this — same reasoning the existing file gives for duplicating tiny date helpers rather than crossing engine/ui boundaries or creating cross-file coupling for a few lines of filter logic. Pure function, no DOM.

## 7. UI: `src/ui/panels/CalendarView.ts` (new)

Mounted once at bootstrap (`main.ts`), into `#calendar-view`. Owns:

- **Granularity tabs**: day/week/month/year (reuses the existing `Granularity` type from `CalendarBar.ts`).
- **Prev/next nav**: reuses `nextSelectedDate()` (already exported, system-aware) — no new stepping logic.
- **Week/month grids**: renders via the existing `renderCalendarGrid` (`CalendarGrid.ts`) — same component the filters panel used, now full-size.
- **Year grid**: new rendering path — 12 (or 13) mini-month blocks, each a weekday header + `buildYearMonthCells` cells for that month, each cell showing its event dot. Clicking a day cell in any mini-month sets `selectedDate` and switches granularity to `'day'` (drills all the way to agenda, not just to month view — year view here is a browsing surface, not primarily a drill-down button grid like `buildYearCells`'s 12-button version).
- **Day view / agenda**: when granularity is `'day'`, no grid — instead calls `getFeaturesOnDate(layers, activeFilters, selectedDate)` and renders a list: layer title + feature title per entry. Each entry has a "View on map" button: sets `selectedFeatureId`, sets `panels.left = 'open'` (same as clicking a feature on the map today, per `main.ts`'s `onFeatureClick`), and sets `view: 'map'`.
- Reacts to `store.subscribe` same as every other panel — full re-render on any relevant state change, no diffing, consistent with the rest of the codebase.

## 8. `CalendarBar.ts` simplification

The grid this file currently renders via `renderCalendarGrid` (week/month/year, when not in numeric-edit mode) is dropped — that role now belongs entirely to `CalendarView.ts`. `CalendarBar.ts` goes back to being the compact spinner (weekday label, year/month/day fields with steppers, pencil-toggle manual entry, range slider) — its role while the user is on Map view and wants a quick date nudge without leaving the map. `gridContainer`/`renderGrid`/the `layers` parameter threading required only for the grid are removed from `CalendarBar.ts`; `CalendarGrid.ts` and `calendar-grid.ts` are unchanged (still used by `CalendarView.ts`). `mountCalendarBar()`'s signature loses the `layers` parameter it only needed for the grid — `main.ts`'s call site updates accordingly.

## 9. Styling

New `.calendar-view`, `.calendar-view__year`, `.calendar-view__year-month`, `.calendar-view__agenda` rules in `styles.css`, following the existing `.calendar-grid`/`.calendar-bar` token usage (`--color-primary` event dot, existing spacing scale) — no new design tokens. Mobile-first, matching the rest of the app's breakpoint (`≥64rem` for desktop refinements).

## 10. Testing

- `buildYearMonthCells`: new tests in `calendar-grid.test.ts`, same fixture pattern as the existing `buildYearCells`/`buildMonthCells` tests (per-system month/day counts, leap-year month counts).
- `getFeaturesOnDate`: new `day-agenda.test.ts`, mirroring `calendar-grid.test.ts`'s fixture-feature-set pattern — filtered-out features excluded, untimed features excluded, date-range features (RRULE) included on matching occurrences.
- `CalendarView.ts`: DOM-level, no dedicated test file — consistent with `CalendarGrid.ts`/`PanelRight.ts`/`SettingsControl.ts` today (type-check + build + manual verification only).
- `CalendarBar.ts`'s existing test file loses whatever cases covered grid-rendering (if any — check before deleting); spinner/slider/step-function tests are unaffected since those functions don't change.

## 11. Non-goals

- No range-based map filtering — same boundary the original calendar-grid-view design drew (Section 2 of `2026-08-02-calendar-grid-view-design.md`). Picking a day in Calendar view still resolves to one `selectedDate`.
- No persistence of `view` or Calendar-view granularity across a page reload — session-only UI state, same as every other panel-open/granularity flag today.
- No animated transition between Map and Calendar view — a plain instant show/hide, matching how the filters panel and search overlay already toggle.
- Audit (typecheck/lint/test) came back clean — no separate "fixes" bucket for this round; anything found during implementation gets folded in inline, not tracked separately.
