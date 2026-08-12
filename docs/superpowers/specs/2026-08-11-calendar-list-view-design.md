# Calendar list/agenda view — design

## Context

The Calendar view (`src/ui/panels/CalendarView.ts`) already has day, week, month, and year granularities, closely matching the list/day/week/month/year interface pattern found in the `calendar-events-tenerife` source app (see survey notes from this session). The one gap versus that app: a scrollable **list/agenda** view, grouped by date heading, showing upcoming events rather than one day or one grid at a time.

This is the first of three sub-projects generalizing good UI patterns from three source apps (`calendar-events-tenerife`, `moon-img-map`, `paranormal-espana`) into the universal-map-app engine. The other two (timeline scrubber, card/badge/detail polish) are separate specs, done later.

## Scope

Add a 5th `list` granularity to the existing Calendar view. No manifest/world.json changes — always available, same as day/week/month/year.

## Engine layer

New function in `src/engine/time/day-agenda.ts`:

```ts
export interface DayAgendaGroup {
  iso: string;
  entries: DayAgendaEntry[];
}

export function getFeaturesInRange(
  layers: LoadedLayer[],
  activeFilters: Record<string, Set<string>>,
  fromIso: string,
  toIso: string,
): DayAgendaGroup[];
```

- Day-by-day loop from `fromIso` to `toIso` (inclusive), reusing the same per-day/per-feature `isActiveOn` check `getFeaturesOnDate` already does — same algorithmic shape as `calendar-grid.ts`'s existing per-day loops (`buildWeekCells`/`buildMonthCells`). No RRULE occurrence-enumeration added; realistic `calendar.max` ranges (all current worlds are single-digit years wide) keep a day-by-day scan cheap.
- Dates with zero matching entries are omitted from the result (no empty groups).
- Reuses `DayAgendaEntry` (`layerId`, `layerTitle`, `feature`) — same shape the day view already renders.

## UI layer

`src/ui/panels/CalendarView.ts`:

- `Granularity` type (in `CalendarBar.ts`) gains `'list'`. `getVisibleGranularityOptions` is **not** changed — it's shared with `CalendarBar.ts`'s own compact date-stepper spinner (a different UI, filters-panel-only), which has no step logic for `'list'` and shouldn't offer it. Instead, `CalendarView.ts` builds its own tab list as `[...getVisibleGranularityOptions(system), 'list']`, ordered last, local to the full Calendar view only.
- New branch in `render()`: when `granularity === 'list'`, call `getFeaturesInRange(visibleLayers, state.activeFilters, state.selectedDate, maxIso)` and render one `<div class="calendar-view__list-date">` heading (formatted via `formatCalendarDate`, matching the day view's date formatting) per group, followed by a `<ul class="calendar-view__agenda">` reusing the exact `calendar-view__agenda-item` markup the day view already renders (layer title, feature name, "View on map" button) — no new item markup, just repeated per date group.
- Empty state (no groups in range): reuse existing `calendarView.noEvents` string.
- "View on map" click wiring reuses the exact same handler pattern the day view's agenda already has (`selectedFeatureId`, open left panel, switch to map view).
- Period label / prev-next step controls: the list view has no natural "current period" to page through (it's a running list, not a fixed window), so the nav row's step buttons are hidden for this granularity — clicking a day elsewhere (month/year view, or the calendar bar) changes `selectedDate`, which re-anchors the list's start.

## Strings

Add to all 4 worlds' `strings.json` (`demo`, `events-canary-islands`, `moon-map-photos`, `paranormal-spain`):

- `calendar.granularity.list`: `"List"` in all 4 worlds — verified all existing `calendar.granularity.*` values (day/week/month/year) are already English structural labels even in the Spanish-content worlds (`events-canary-islands`, `paranormal-spain`), so `list` follows the same existing convention, not a new one.

## Testing

TDD, per this session's established convention:

- `getFeaturesInRange`: new tests in `day-agenda.test.ts` (or wherever `getFeaturesOnDate` is currently tested) — grouping by date, range boundary inclusivity (`fromIso`/`toIso` both included), respecting `activeFilters`, omitting empty dates, recurrence handled correctly via existing `isActiveOn` (one recurring-event test reusing existing recurrence fixtures if any exist).
- `CalendarView.ts` UI wiring: no automated test (no jsdom in this project, consistent with the rest of `CalendarView.ts`/`CalendarGrid.ts` — DOM-touching UI verified manually via dev server + Playwright).

## Verification

- `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`, `npx prettier --check .` all clean.
- Manual Playwright check: switch to List tab in at least 2 worlds (one with recurring events if any exist, one without), confirm date headings + entries render, confirm "View on map" navigates correctly, confirm empty state when `selectedDate` is past the last event.
