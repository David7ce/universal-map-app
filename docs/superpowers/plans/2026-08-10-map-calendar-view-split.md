# Map / Calendar View Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the app into two top-level, switchable views — Map (existing, unchanged) and a new full-screen Calendar view with day/week/month/year navigation, a 12-mini-month year layout showing every day, and a per-day agenda list that can hand off to Map view.

**Architecture:** New `AppState.view: 'map' | 'calendar'` field drives which of two sibling full-screen containers (`#map` / `#calendar-view`) is visible, toggled by a new always-visible view-switcher control in `app-chrome.ts`. `CalendarView.ts` (new) is a self-contained mounted panel, following the exact conventions `CalendarBar.ts`/`CalendarGrid.ts` already use (full `innerHTML` re-render on every `store.subscribe`, no DOM diffing). Two new pure engine functions support it: `buildYearMonthCells` (engine/time/calendar-grid.ts) and `getFeaturesOnDate` (new engine/time/day-agenda.ts). `CalendarBar.ts`'s embedded grid — now redundant — is removed, which in turn makes the old 12-button year grid (`buildYearCells`, `CalendarGridMonthCell`) dead code, removed in its own task.

**Tech Stack:** TypeScript, Vite, Vitest, vanilla DOM (no framework), Leaflet (via `MapAdapter`).

## Global Constraints

- `engine/` must never import from `ui/` (CONTEXT.md layering rule) — both new engine functions stay pure, no DOM.
- No DOM-diffing: every panel re-renders its `innerHTML` fully on `store.subscribe`, matching `CalendarBar.ts`/`PanelRight.ts`/`SearchOverlay.ts`.
- Panel mount functions (`PanelRight.ts`, `SettingsControl.ts`, `CalendarGrid.ts`) have no dedicated test file — DOM-level code stays covered by `tsc --noEmit`, `vitest run`, `eslint .`, and manual verification, not jsdom tests. `CalendarView.ts` follows the same precedent.
- Pure engine functions always get a dedicated Vitest file, fixture style matching `calendar-grid.test.ts` (a `layerWithEventOn(iso)` helper building a minimal `LoadedLayer`).
- Run `pnpm run typecheck`, `pnpm run lint`, and `pnpm test` before every commit in this plan — baseline (start of this plan) is 213 passing tests, 0 lint errors, 0 type errors; every task must leave those clean.
- `t(key, strings)` falls back to the raw key when a string is missing, but new UI copy still gets a real entry in `worlds/demo/strings.json` (the only strings file in the repo), matching every existing UI string.
- Repo convention: ship-level changes get a `CHANGELOG.md` entry (see existing entries for style/tone) and, for user-facing new capability, one bullet in `README.md`'s "Recently shipped beyond the original v1 scope" list.

---

### Task 1: Engine — `buildYearMonthCells` (12 mini-months, each with all days)

**Files:**

- Modify: `src/engine/time/calendar-grid.ts`
- Test: `src/engine/time/calendar-grid.test.ts`

**Interfaces:**

- Consumes: existing `buildMonthCells(selectedIso, system, layers, activeFilters): CalendarGridDayCell[]`, `toCalendarParts`, `calendarPartsToIso`, `monthsInCalendarYear` (all already imported in this file).
- Produces: `export interface CalendarGridMonthGroup { month: number; iso: string; cells: CalendarGridDayCell[] }` and `export function buildYearMonthCells(selectedIso: string, system: CalendarSystem, layers: LoadedLayer[], activeFilters: Record<string, Set<string>>): CalendarGridMonthGroup[]` — consumed by `CalendarView.ts` in Task 6.

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/time/calendar-grid.test.ts`, right after the existing `describe('buildYearCells', ...)` block:

```ts
describe('buildYearMonthCells', () => {
  it('returns 12 groups for gregorian, in month order, each matching buildMonthCells for that month', () => {
    const groups = buildYearMonthCells('2026-07-29', 'gregorian', [], {});
    expect(groups.length).toBe(12);
    expect(groups.map((g) => g.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(groups[1].iso).toBe('2026-02-01');
    expect(groups[1].cells).toEqual(buildMonthCells('2026-02-01', 'gregorian', [], {}));
  });

  it('returns as many groups as monthsInCalendarYear for a hebrew leap year', () => {
    const groups = buildYearMonthCells('2026-07-29', 'hebrew', [], {});
    expect(groups.length).toBe(monthsInCalendarYear(5786, 'hebrew'));
  });

  it('marks hasEvents on the correct day cell inside the correct month group', () => {
    const groups = buildYearMonthCells('2026-01-15', 'gregorian', [layerWithEventOn('2026-03-10')], {});
    const march = groups.find((g) => g.month === 3)!;
    expect(march.cells.find((c) => c.iso === '2026-03-10')!.hasEvents).toBe(true);
    const january = groups.find((g) => g.month === 1)!;
    expect(january.cells.every((c) => c.hasEvents === false)).toBe(true);
  });
});
```

Also update the import line at the top of the file to add the new name:

```ts
import { buildMonthCells, buildWeekCells, buildYearCells, buildYearMonthCells } from './calendar-grid';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- calendar-grid`
Expected: FAIL — `buildYearMonthCells is not exported` / `is not a function`.

- [ ] **Step 3: Implement `buildYearMonthCells`**

In `src/engine/time/calendar-grid.ts`, add this interface next to `CalendarGridMonthCell` and this function next to `buildYearCells` (order in the file doesn't matter, but keeping it adjacent to `buildYearCells` matches the file's existing grouping):

```ts
export interface CalendarGridMonthGroup {
  iso: string; // Gregorian ISO of day 1 of this month, in the display system
  month: number; // 1-based, display system
  cells: CalendarGridDayCell[]; // same shape buildMonthCells returns for this month
}

// One buildMonthCells call per month in the display-system year — used by the
// full-screen Calendar view's year layout (all 12 months laid out at once,
// every day visible), unlike buildYearCells' 12 clickable month buttons.
export function buildYearMonthCells(
  selectedIso: string,
  system: CalendarSystem,
  layers: LoadedLayer[],
  activeFilters: Record<string, Set<string>>,
): CalendarGridMonthGroup[] {
  const { year } = toCalendarParts(selectedIso, system);
  const monthCount = monthsInCalendarYear(year, system);
  const groups: CalendarGridMonthGroup[] = [];
  for (let month = 1; month <= monthCount; month++) {
    const iso = calendarPartsToIso({ year, month, day: 1 }, system);
    groups.push({ iso, month, cells: buildMonthCells(iso, system, layers, activeFilters) });
  }
  return groups;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- calendar-grid`
Expected: PASS, all `buildYearMonthCells` tests plus the pre-existing ones in this file.

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm run typecheck`
Expected: no errors.

```bash
git add src/engine/time/calendar-grid.ts src/engine/time/calendar-grid.test.ts
git commit -m "$(cat <<'EOF'
feat: add buildYearMonthCells for the full year-at-a-glance calendar layout

Groups buildMonthCells output by month for a whole display-system year,
for the Calendar view's year layout (12 mini-months, all days visible).
EOF
)"
```

---

### Task 2: Engine — `getFeaturesOnDate` (day agenda)

**Files:**

- Create: `src/engine/time/day-agenda.ts`
- Test: `src/engine/time/day-agenda.test.ts`

**Interfaces:**

- Consumes: `LoadedLayer` (`src/engine/taxonomy/compute-dimensions.ts`), `featureMatchesFilters` (same file), `isActiveOn` (`src/engine/time/is-active-on.ts`), `GeoFeature` (`src/engine/time/temporal-types.ts`).
- Produces: `export interface DayAgendaEntry { layerId: string; layerTitle: string; feature: GeoFeature }` and `export function getFeaturesOnDate(layers: LoadedLayer[], activeFilters: Record<string, Set<string>>, iso: string): DayAgendaEntry[]` — consumed by `CalendarView.ts` in Task 6.

- [ ] **Step 1: Write the failing test file**

Create `src/engine/time/day-agenda.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getFeaturesOnDate } from './day-agenda';
import type { LoadedLayer } from '../taxonomy/compute-dimensions';
import type { LayerManifest } from '../manifests/layer-manifest';

function layerWithEventOn(iso: string): LoadedLayer {
  const manifest: LayerManifest = {
    id: 'poi',
    title: 'POI',
    kind: 'point',
    source: { type: 'geojson', url: '/x' },
  };
  return {
    manifest,
    features: [
      {
        type: 'Feature',
        id: '1',
        properties: { temporal: { instant: iso }, name: 'Volcano eruption' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
    ],
  };
}

describe('getFeaturesOnDate', () => {
  it('returns a feature active on the given date, with its layer id/title', () => {
    const entries = getFeaturesOnDate([layerWithEventOn('2026-07-30')], {}, '2026-07-30');
    expect(entries.length).toBe(1);
    expect(entries[0].layerId).toBe('poi');
    expect(entries[0].layerTitle).toBe('POI');
    expect(entries[0].feature.properties.name).toBe('Volcano eruption');
  });

  it('excludes a feature not active on the given date', () => {
    const entries = getFeaturesOnDate([layerWithEventOn('2026-07-30')], {}, '2026-07-29');
    expect(entries.length).toBe(0);
  });

  it('excludes an always-active feature with no temporal property', () => {
    const manifest: LayerManifest = { id: 'poi', title: 'POI', kind: 'point', source: { type: 'geojson', url: '/x' } };
    const layer: LoadedLayer = {
      manifest,
      features: [{ type: 'Feature', id: '1', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }],
    };
    expect(getFeaturesOnDate([layer], {}, '2026-07-30')).toEqual([]);
  });

  it('excludes a feature filtered out by activeFilters', () => {
    const layer = layerWithEventOn('2026-07-30');
    layer.manifest = {
      ...layer.manifest,
      taxonomy: [{ id: 'category', label: 'Category', field: 'properties.category' }],
    };
    layer.features[0].properties.category = 'shop';
    const entries = getFeaturesOnDate([layer], { category: new Set(['market']) }, '2026-07-30');
    expect(entries.length).toBe(0);
  });

  it('includes a recurring feature only on a matching occurrence', () => {
    const manifest: LayerManifest = {
      id: 'events',
      title: 'Events',
      kind: 'point',
      source: { type: 'geojson', url: '/x' },
    };
    const layer: LoadedLayer = {
      manifest,
      features: [
        {
          type: 'Feature',
          id: '1',
          properties: {
            temporal: { range: { from: '2026-01-01' }, recurrence: { rule: 'FREQ=WEEKLY;BYDAY=MO' } },
          },
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ],
    };
    // 2026-08-03 is a Monday, 2026-08-04 is a Tuesday.
    expect(getFeaturesOnDate([layer], {}, '2026-08-03').length).toBe(1);
    expect(getFeaturesOnDate([layer], {}, '2026-08-04').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- day-agenda`
Expected: FAIL — `Cannot find module './day-agenda'`.

- [ ] **Step 3: Implement `day-agenda.ts`**

Create `src/engine/time/day-agenda.ts`:

```ts
import type { LoadedLayer } from '../taxonomy/compute-dimensions';
import { featureMatchesFilters } from '../taxonomy/compute-dimensions';
import type { GeoFeature } from './temporal-types';
import { isActiveOn } from './is-active-on';

export interface DayAgendaEntry {
  layerId: string;
  layerTitle: string;
  feature: GeoFeature;
}

// Same filtering rule calendar-grid.ts's hasActiveFeatureOn already applies
// (respect activeFilters, and only features with a `temporal` property count
// — an untimed "always present" feature isn't a day's "event"), but returns
// the matching features themselves instead of a boolean, for the Calendar
// view's day agenda list.
export function getFeaturesOnDate(
  layers: LoadedLayer[],
  activeFilters: Record<string, Set<string>>,
  iso: string,
): DayAgendaEntry[] {
  const date = new Date(`${iso}T00:00:00Z`);
  const entries: DayAgendaEntry[] = [];
  for (const layer of layers) {
    for (const feature of layer.features) {
      if (
        feature.properties.temporal !== undefined &&
        featureMatchesFilters(feature, layer.manifest, activeFilters) &&
        isActiveOn(feature, date)
      ) {
        entries.push({ layerId: layer.manifest.id, layerTitle: layer.manifest.title, feature });
      }
    }
  }
  return entries;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- day-agenda`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm run typecheck`
Expected: no errors.

```bash
git add src/engine/time/day-agenda.ts src/engine/time/day-agenda.test.ts
git commit -m "$(cat <<'EOF'
feat: add getFeaturesOnDate for the Calendar view's day agenda

Pure engine function returning every feature active on a given date
(respecting activeFilters, same rule the calendar grid dots use).
EOF
)"
```

---

### Task 3: Simplify `CalendarBar.ts` — drop the embedded grid

**Files:**

- Modify: `src/ui/panels/CalendarBar.ts`
- Modify: `src/main.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `export function clampDateToRange(iso: string, min: string, max: string): string` (was private) — consumed by `CalendarView.ts` in Task 6. `mountCalendarBar`'s signature drops its `layers: LoadedLayer[]` parameter (5 args → 4).

This makes `CalendarBar.ts` go back to being purely the compact year/month/day spinner + slider (its role while on Map view) — the grid it currently renders is superseded by the new full-screen `CalendarView.ts` (Task 6). Doing this simplification _before_ the dead-code cleanup in Task 4 avoids a window where the app briefly renders an inconsistent hybrid.

- [ ] **Step 1: Remove the grid from `CalendarBar.ts`**

In `src/ui/panels/CalendarBar.ts`:

Remove these two import lines (near the top):

```ts
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
```

```ts
import { renderCalendarGrid } from './CalendarGrid';
```

Change the `clampDateToRange` function from private to exported (keep its body identical):

```ts
export function clampDateToRange(iso: string, min: string, max: string): string {
```

Change `mountCalendarBar`'s signature — remove the trailing `layers` parameter:

```ts
export function mountCalendarBar(
  container: HTMLElement,
  store: Store<AppState>,
  config: CalendarConfig,
  strings: Record<string, string>,
): void {
```

Remove this line from the template string (the grid container div):

```html
<div class="calendar-bar__grid" data-role="grid"></div>
```

Remove this line (the DOM query for it):

```ts
const gridContainer = container.querySelector<HTMLElement>('[data-role="grid"]')!;
```

Remove the entire `renderGrid` function:

```ts
function renderGrid(): void {
  if (granularity === 'day') {
    gridContainer.hidden = true;
    gridContainer.className = 'calendar-bar__grid';
    gridContainer.innerHTML = '';
    return;
  }
  gridContainer.hidden = false;
  const state = store.get();
  const visibleLayers = layers.filter((layer) => !state.hiddenLayerIds.has(layer.manifest.id));
  renderCalendarGrid(gridContainer, {
    granularity,
    selectedIso: state.selectedDate,
    system: state.calendarSystem,
    layers: visibleLayers,
    activeFilters: state.activeFilters,
    strings,
    min: config.min,
    max: maxIso,
    onSelectDay: (iso) => store.set({ selectedDate: clampDateToRange(iso, config.min, maxIso) }),
    onSelectMonth: (iso) => {
      granularity = 'month';
      granularitySelect.value = granularity;
      store.set({ selectedDate: clampDateToRange(iso, config.min, maxIso) });
    },
  });
}
```

Remove the `renderGrid();` call from `granularitySelect`'s change handler, leaving just:

```ts
granularitySelect.addEventListener('change', () => {
  granularity = granularitySelect.value as Granularity;
});
```

Remove the standalone `renderGrid();` call in the initial-render block (it sits alongside `dateSlider.value = ...`, `renderSystemLabel(...)`, `renderFields(...)`).

Remove `renderGrid();` from the `store.subscribe` callback at the bottom, leaving just the slider/system-label/fields updates.

- [ ] **Step 2: Update `main.ts`'s call site**

In `src/main.ts`, change:

```ts
mountCalendarBar(document.querySelector('#panel-right-time')!, store, appManifest.calendar, strings, loadedLayers);
```

to:

```ts
mountCalendarBar(document.querySelector('#panel-right-time')!, store, appManifest.calendar, strings);
```

- [ ] **Step 3: Run typecheck, lint, and tests**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: no errors; `CalendarBar.test.ts` (which only tests pure functions, not the grid) still passes unchanged.

- [ ] **Step 4: Manual verification**

Run: `pnpm dev`, open the printed URL, open the filters panel (top-right button) — the Time section should show only the spinner fields (weekday/month/day/year, steppers, slider), no grid below it, for every granularity.

- [ ] **Step 5: Commit**

```bash
git add src/ui/panels/CalendarBar.ts src/main.ts
git commit -m "$(cat <<'EOF'
refactor: drop CalendarBar's embedded grid, keep it a compact spinner

The grid view is superseded by the new full-screen Calendar view
(next commits) — CalendarBar goes back to its original role: a quick
date nudge while looking at the map. clampDateToRange is now exported
for CalendarView.ts to reuse.
EOF
)"
```

---

### Task 4: Remove the now-dead 12-button year grid

**Files:**

- Modify: `src/engine/time/calendar-grid.ts`
- Modify: `src/engine/time/calendar-grid.test.ts`
- Modify: `src/ui/panels/CalendarGrid.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new — pure removal. `renderCalendarGrid`'s `CalendarGridDeps.granularity` narrows from `Exclude<Granularity, 'day'>` to `'week' | 'month'`, and `onSelectMonth` is removed from `CalendarGridDeps` (both consumed by `CalendarView.ts` in Task 6, which only ever calls it for week/month).

After Task 3, `CalendarBar.ts` was the only caller of `renderCalendarGrid`'s `'year'` branch (via `buildYearCells`). `CalendarView.ts` (Task 6) uses `buildYearMonthCells` for year instead, so that branch, `buildYearCells`, and `CalendarGridMonthCell` have no remaining callers.

- [ ] **Step 1: Remove `buildYearCells` from `calendar-grid.ts`**

In `src/engine/time/calendar-grid.ts`, remove the `CalendarGridMonthCell` interface:

```ts
export interface CalendarGridMonthCell {
  iso: string;
  month: number;
  hasEvents: boolean;
}
```

Remove the `hasActiveFeatureInMonth` helper (only ever called from `buildYearCells`):

```ts
function hasActiveFeatureInMonth(
  layers: LoadedLayer[],
  activeFilters: Record<string, Set<string>>,
  year: number,
  month: number,
  system: CalendarSystem,
): boolean {
  const dayCount = daysInCalendarMonth(year, month, system);
  for (let day = 1; day <= dayCount; day++) {
    if (hasActiveFeatureOn(layers, activeFilters, calendarPartsToIso({ year, month, day }, system))) return true;
  }
  return false;
}
```

Remove the `buildYearCells` function:

```ts
export function buildYearCells(
  selectedIso: string,
  system: CalendarSystem,
  layers: LoadedLayer[],
  activeFilters: Record<string, Set<string>>,
): CalendarGridMonthCell[] {
  const { year } = toCalendarParts(selectedIso, system);
  const monthCount = monthsInCalendarYear(year, system);
  const cells: CalendarGridMonthCell[] = [];
  for (let month = 1; month <= monthCount; month++) {
    cells.push({
      iso: calendarPartsToIso({ year, month, day: 1 }, system),
      month,
      hasEvents: hasActiveFeatureInMonth(layers, activeFilters, year, month, system),
    });
  }
  return cells;
}
```

`daysInCalendarMonth` stays imported/used elsewhere in this file (`buildMonthCells`) — no import changes needed beyond the removed function bodies.

- [ ] **Step 2: Remove its tests**

In `src/engine/time/calendar-grid.test.ts`, remove `buildYearCells` from the import:

```ts
import { buildMonthCells, buildWeekCells, buildYearMonthCells } from './calendar-grid';
```

Remove the entire `describe('buildYearCells', ...)` block (the one with the 3 `it(...)` cases about 12 cells / hebrew leap year / hasEvents-per-month).

- [ ] **Step 3: Remove the year branch from `CalendarGrid.ts`**

In `src/ui/panels/CalendarGrid.ts`, change the import line from:

```ts
import { buildMonthCells, buildWeekCells, buildYearCells } from '../../engine/time/calendar-grid';
import { toCalendarParts } from '../../engine/time/calendar-conversion';
```

to:

```ts
import { buildMonthCells, buildWeekCells } from '../../engine/time/calendar-grid';
```

(the `toCalendarParts` import becomes unused once the year branch below is removed, so drop it entirely.)

Remove the `MONTH_KEYS` constant (only used by the year branch):

```ts
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
```

Change `CalendarGridDeps`'s `granularity` field and remove `onSelectMonth` (never called once the year branch is gone):

```ts
export interface CalendarGridDeps {
  granularity: 'week' | 'month';
  selectedIso: string;
  system: CalendarSystem;
  layers: LoadedLayer[];
  activeFilters: Record<string, Set<string>>;
  strings: Record<string, string>;
  min: string; // ISO date — cells before this are shown disabled/muted
  max: string; // ISO date — cells after this are shown disabled/muted
  // Clicking a day cell. Only selects — never changes granularity.
  onSelectDay: (iso: string) => void;
}
```

Remove the `Granularity` type import (no longer needed once the field above is a literal union):

```ts
import type { Granularity } from './CalendarBar';
```

Remove the entire year `if` block at the top of `renderCalendarGrid`:

```ts
if (granularity === 'year') {
  const cells = buildYearCells(selectedIso, system, layers, activeFilters);
  const selectedMonth = toCalendarParts(selectedIso, system).month;

  container.className = 'calendar-bar__grid calendar-grid calendar-grid--year';
  container.innerHTML = cells
    .map((cell) => {
      const label =
        system === 'gregorian' ? t(`calendar.month.${MONTH_KEYS[cell.month - 1]}`, strings) : String(cell.month);
      const outOfRange = cell.iso > max;
      const classes = ['calendar-grid__cell'];
      if (cell.month === selectedMonth) classes.push('calendar-grid__cell--selected');
      if (cell.hasEvents) classes.push('calendar-grid__cell--has-events');
      if (outOfRange) classes.push('calendar-grid__cell--muted');
      const disabled = outOfRange ? 'disabled' : '';
      return `<button type="button" class="${classes.join(' ')}" data-iso="${escapeHtml(cell.iso)}" ${disabled}>${escapeHtml(label)}</button>`;
    })
    .join('');
  container.querySelectorAll<HTMLButtonElement>('[data-iso]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => deps.onSelectMonth(button.dataset.iso!));
  });
  return;
}
```

Simplify the cells computation right after it (was a ternary handling week/month, `year` already returned above) — since `granularity` is now only `'week' | 'month'`, this line stays exactly as-is (it already reads `granularity === 'week' ? buildWeekCells(...) : buildMonthCells(...)`), no change needed there.

- [ ] **Step 4: Run typecheck, lint, and tests**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: no errors, no unused-import lint warnings, all tests pass (calendar-grid.test.ts now covers `buildWeekCells`/`buildMonthCells`/`buildYearMonthCells` only).

- [ ] **Step 5: Commit**

```bash
git add src/engine/time/calendar-grid.ts src/engine/time/calendar-grid.test.ts src/ui/panels/CalendarGrid.ts
git commit -m "$(cat <<'EOF'
refactor: remove the dead 12-button year grid

buildYearCells/CalendarGridMonthCell and CalendarGrid.ts's year branch
had no remaining caller after CalendarBar.ts dropped its embedded grid
— the new Calendar view's year layout uses buildYearMonthCells instead.
EOF
)"
```

---

### Task 5: View switcher — `AppState.view`, containers, Map/Leaflet resize fix

**Files:**

- Modify: `src/engine/state/store.ts`
- Modify: `src/engine/space/map-adapter.ts`
- Modify: `src/engine/space/leaflet/leaflet-map-adapter.ts`
- Modify: `src/main.ts`
- Modify: `src/ui/app-chrome.ts`
- Modify: `index.html`
- Modify: `src/styles.css`

**Interfaces:**

- Consumes: `icons.pushpin`, `icons.calendar` (`src/ui/icons.ts`, unchanged), `MapAdapter` (extended).
- Produces: `AppState.view: 'map' | 'calendar'`. `MapAdapter.invalidateSize(): void`. A `#calendar-view` container in the DOM that Task 6 mounts `CalendarView.ts` into — empty in this task.

- [ ] **Step 1: Add `view` to `AppState`**

In `src/engine/state/store.ts`, add to the `AppState` interface (after `showGrid`):

```ts
// Which top-level screen is showing: the full-screen map, or the
// full-screen Calendar view (day/week/month/year + day agenda).
view: 'map' | 'calendar';
```

- [ ] **Step 2: Add `invalidateSize` to `MapAdapter`**

In `src/engine/space/map-adapter.ts`, add to the `MapAdapter` interface (after `setCrs`):

```ts
  // Leaflet caches the container's pixel size; when the map's container was
  // hidden (`display: none`, e.g. while Calendar view is showing) and then
  // shown again, panning/zoom controls end up misaligned until this is
  // called once.
  invalidateSize(): void;
```

In `src/engine/space/leaflet/leaflet-map-adapter.ts`, add to the returned `adapter` object (after `getMetersPerPixel`/`onViewChange`, before `setCrs` — anywhere in the object literal is fine, this placement matches the interface's declaration order):

```ts
    invalidateSize() {
      map.invalidateSize();
    },
```

- [ ] **Step 3: Add the containers to `index.html`**

In `index.html`, right after `<div id="map" class="map"></div>`, add:

```html
<div id="view-switcher" class="view-switcher"></div>

<div id="calendar-view" class="calendar-view"></div>
```

- [ ] **Step 4: Seed `view` in `main.ts`**

In `src/main.ts`, add `view: 'map',` to the `createStore<AppState>({...})` call (anywhere among the other fields, e.g. right after `hiddenLayerIds`):

```ts
    view: 'map',
```

- [ ] **Step 5: Add the view-switcher CSS**

In `src/styles.css`, add a new section (e.g. right before the `CALENDAR GRID` section):

```css
/* ========================================
   VIEW SWITCHER (Map / Calendar)
   ======================================== */
.view-switcher {
  position: absolute;
  top: var(--control-btn-offset);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-fixed);
  display: flex;
  gap: 0.25rem;
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 0.25rem;
  box-shadow: var(--shadow-md);
}
.view-switcher__btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  border: none;
  background: transparent;
  border-radius: var(--radius-full);
  padding: 0.4rem 0.9rem;
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  color: var(--color-text-light);
  transition: background-color var(--transition-fast);
}
.view-switcher__btn svg {
  width: 18px;
  height: 18px;
}
.view-switcher__btn.is-active {
  background: var(--color-primary);
  color: var(--color-white);
}
.calendar-view {
  display: none;
  position: absolute;
  inset: 0;
  overflow-y: auto;
  background: var(--color-bg);
  padding: calc(var(--control-btn-size) + var(--control-btn-offset) * 2) 1rem 1.5rem;
}
.map-app.view-calendar #calendar-view {
  display: block;
}
.map-app.view-calendar #map,
.map-app.view-calendar #search-overlay,
.map-app.view-calendar .bottom-left-controls,
.map-app.view-calendar .map-footer-legend,
.map-app.view-calendar .leaflet-control-zoom {
  display: none;
}
```

- [ ] **Step 6: Mount the switcher in `app-chrome.ts`**

In `src/ui/app-chrome.ts`, add this function (e.g. right after `mountRightPanel`):

```ts
// Always-visible top-center Map/Calendar toggle. `#map` isn't torn down
// when hidden (same as the filters panel not being destroyed on close) —
// switching back doesn't re-fetch tiles or re-render layers, it just needs
// mapAdapter.invalidateSize() once Leaflet's container is visible again.
function mountViewSwitcher(store: Store<AppState>, strings: Record<string, string>, mapAdapter: MapAdapter): void {
  const appEl = document.querySelector<HTMLElement>('#app')!;
  const switcherEl = document.querySelector<HTMLElement>('#view-switcher')!;

  switcherEl.innerHTML = `
    <button type="button" class="view-switcher__btn" data-view="map">${icons.pushpin}<span>${t('views.map', strings)}</span></button>
    <button type="button" class="view-switcher__btn" data-view="calendar">${icons.calendar}<span>${t('views.calendar', strings)}</span></button>
  `;
  const buttons = switcherEl.querySelectorAll<HTMLButtonElement>('[data-view]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => store.set({ view: button.dataset.view as AppState['view'] }));
  });

  let previousView = store.get().view;
  function render(): void {
    const state = store.get();
    buttons.forEach((button) => {
      const isActive = button.dataset.view === state.view;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    appEl.classList.toggle('view-calendar', state.view === 'calendar');
    if (previousView !== state.view && state.view === 'map') mapAdapter.invalidateSize();
    previousView = state.view;
  }
  render();
  store.subscribe(render);
}
```

Wire it into `mountAppChrome` (add the call alongside the other `mount*` calls at the bottom of that function):

```ts
mountViewSwitcher(store, strings, mapAdapter);
```

- [ ] **Step 7: Add the two new strings**

In `worlds/demo/strings.json`, add (anywhere, e.g. near the top, alphabetically grouped with the other top-level keys is not required by this file — it isn't sorted):

```json
  "views.map": "Map",
  "views.calendar": "Calendar",
```

- [ ] **Step 8: Run typecheck, lint, and tests**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: no errors.

- [ ] **Step 9: Manual verification**

Run: `pnpm run build && pnpm run preview` (or `pnpm dev`), open the printed URL:

- A pill-shaped Map/Calendar switcher shows top-center, "Map" active by default.
- Click "Calendar" — the map, search button, layers button, and footer legend disappear; an empty area shows where `#calendar-view` is (nothing rendered into it yet — that's Task 6).
- Click "Map" again — the map reappears and is still fully interactive (pan/zoom/click a marker) with no visual glitches (this exercises `invalidateSize()`).

- [ ] **Step 10: Commit**

```bash
git add src/engine/state/store.ts src/engine/space/map-adapter.ts src/engine/space/leaflet/leaflet-map-adapter.ts src/main.ts src/ui/app-chrome.ts index.html src/styles.css worlds/demo/strings.json
git commit -m "$(cat <<'EOF'
feat: add Map/Calendar view switcher

New AppState.view field plus a top-center toggle in app-chrome.ts.
#map stays mounted (not torn down) when hidden; MapAdapter gained
invalidateSize() so Leaflet recalculates its container size when the
user switches back to Map view. #calendar-view is an empty container
for now — CalendarView.ts mounts into it in the next commit.
EOF
)"
```

---

### Task 6: `CalendarView.ts` — the full-screen calendar browser

**Files:**

- Create: `src/ui/panels/CalendarView.ts`
- Modify: `src/ui/panels/SearchOverlay.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `worlds/demo/strings.json`

**Interfaces:**

- Consumes: `buildYearMonthCells`, `CalendarGridMonthGroup` (Task 1), `getFeaturesOnDate`, `DayAgendaEntry` (Task 2), `clampDateToRange`, `Granularity`, `CalendarConfig`, `getVisibleGranularityOptions`, `nextSelectedDate` (all from `CalendarBar.ts`, Task 3), `renderCalendarGrid` (`CalendarGrid.ts`, now `'week' | 'month'`-only per Task 4), `CalendarSystem` (`calendar-systems.ts`), `toCalendarParts` (`calendar-conversion.ts`), `LoadedLayer` (`compute-dimensions.ts`), `Store`/`AppState` (`store.ts`), `t`/`strings`, `escapeHtml`, `icons`.
- Produces: `export function mountCalendarView(container: HTMLElement, store: Store<AppState>, config: CalendarConfig, strings: Record<string, string>, layers: LoadedLayer[]): void`. `featureLabel` becomes exported from `SearchOverlay.ts` (was private).

- [ ] **Step 1: Export `featureLabel` from `SearchOverlay.ts`**

In `src/ui/panels/SearchOverlay.ts`, change:

```ts
  function featureLabel(feature: GeoFeature): string {
```

to a module-level exported function — move it out of `mountSearchOverlay`'s body to the top level of the file (it only uses its `feature` parameter and the module-level `t`/`strings` — but `strings` is a parameter of `mountSearchOverlay`, so it needs to become a second parameter):

```ts
export function featureLabel(feature: GeoFeature, strings: Record<string, string>): string {
  const props = feature.properties;
  return String(props.name ?? props.title ?? feature.id ?? t('search.untitledFeature', strings));
}
```

Remove the old inline `function featureLabel(feature: GeoFeature): string { ... }` from inside `mountSearchOverlay`, and update every call site inside `mountSearchOverlay` to pass `strings`:

- `featureLabel(feature)` → `featureLabel(feature, strings)` (inside `runSearch`'s `.map(...)`)
- `featureLabel(region)` → `featureLabel(region, strings)` (inside `renderInfo`)
- `featureLabel(selected.feature)` → `featureLabel(selected.feature, strings)` (inside `render`)

- [ ] **Step 2: Add the new strings**

In `worlds/demo/strings.json`, add:

```json
  "calendarView.viewOnMap": "View on map",
  "calendarView.noEvents": "No events on this day",
```

- [ ] **Step 3: Write `CalendarView.ts`**

Create `src/ui/panels/CalendarView.ts`:

```ts
import type { Store, AppState } from '../../engine/state/store';
import type { CalendarSystem } from '../../engine/time/calendar-systems';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { buildYearMonthCells, type CalendarGridMonthGroup } from '../../engine/time/calendar-grid';
import { getFeaturesOnDate } from '../../engine/time/day-agenda';
import { toCalendarParts } from '../../engine/time/calendar-conversion';
import type { CalendarConfig, Granularity } from './CalendarBar';
import { clampDateToRange, getVisibleGranularityOptions, nextSelectedDate } from './CalendarBar';
import { renderCalendarGrid } from './CalendarGrid';
import { featureLabel } from './SearchOverlay';
import { t } from '../strings';
import { escapeHtml } from '../escape-html';

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Renders one mini-month (weekday header + all its day cells) for the year
// layout. Duplicates the muted/selected/has-events cell class logic
// CalendarGrid.ts's month branch already has — reusing it would mean
// exporting a single-cell renderer across files for ~10 lines, not worth it
// (same reasoning calendar-grid.ts gives for its own small duplicated
// helpers).
function renderYearMonth(
  group: CalendarGridMonthGroup,
  system: CalendarSystem,
  selectedIso: string,
  min: string,
  max: string,
  strings: Record<string, string>,
): string {
  const monthName =
    system === 'gregorian'
      ? t(`calendar.month.${MONTH_KEYS[group.month - 1]}`, strings)
      : toCalendarParts(group.iso, system).monthName;

  const weekdayHeader = WEEKDAY_KEYS.map(
    (key) => `<span class="calendar-grid__weekday">${escapeHtml(t(`calendar.weekday.${key}`, strings))}</span>`,
  ).join('');

  const cellsHtml = group.cells
    .map((cell) => {
      const outOfRange = cell.iso < min || cell.iso > max;
      const muted = !cell.inCurrentPeriod || outOfRange;
      const classes = ['calendar-grid__cell'];
      if (muted) classes.push('calendar-grid__cell--muted');
      if (cell.iso === selectedIso) classes.push('calendar-grid__cell--selected');
      if (cell.hasEvents) classes.push('calendar-grid__cell--has-events');
      const disabled = muted ? 'disabled' : '';
      return `<button type="button" class="${classes.join(' ')}" data-iso="${escapeHtml(cell.iso)}" ${disabled}>${cell.day}</button>`;
    })
    .join('');

  return `<div class="calendar-view__year-month">
    <p class="calendar-view__year-month-title">${escapeHtml(monthName)}</p>
    <div class="calendar-grid">${weekdayHeader}${cellsHtml}</div>
  </div>`;
}

export function mountCalendarView(
  container: HTMLElement,
  store: Store<AppState>,
  config: CalendarConfig,
  strings: Record<string, string>,
  layers: LoadedLayer[],
): void {
  const todayIso = new Date().toISOString().slice(0, 10);
  const maxIso = config.max > todayIso ? todayIso : config.max;

  // Own granularity state, independent of CalendarBar.ts's — this view
  // defaults to 'month' (a typical calendar app's default), while the
  // compact filters-panel spinner keeps defaulting to 'day'.
  let granularity: Granularity = 'month';

  function periodLabel(selectedIso: string, system: CalendarSystem): string {
    const parts = toCalendarParts(selectedIso, system);
    if (granularity === 'year') return String(parts.year);
    const monthName =
      system === 'gregorian' ? t(`calendar.month.${MONTH_KEYS[parts.month - 1]}`, strings) : parts.monthName;
    return `${monthName} ${parts.year}`;
  }

  function step(direction: 1 | -1): void {
    const state = store.get();
    const next = clampDateToRange(
      nextSelectedDate(state.selectedDate, granularity, direction, state.calendarSystem),
      config.min,
      maxIso,
    );
    store.set({ selectedDate: next });
  }

  function render(): void {
    const state = store.get();
    const visibleLayers = layers.filter((layer) => !state.hiddenLayerIds.has(layer.manifest.id));
    const system = state.calendarSystem;

    const tabsHtml = getVisibleGranularityOptions(system)
      .map(
        (g) =>
          `<button type="button" class="calendar-view__tab${g === granularity ? ' is-active' : ''}" data-granularity="${g}">${escapeHtml(t(`calendar.granularity.${g}`, strings))}</button>`,
      )
      .join('');

    let bodyHtml = '';
    if (granularity === 'day') {
      const entries = getFeaturesOnDate(visibleLayers, state.activeFilters, state.selectedDate);
      bodyHtml = entries.length
        ? `<ul class="calendar-view__agenda">${entries
            .map(
              (entry) => `<li class="calendar-view__agenda-item">
                <span class="calendar-view__agenda-layer">${escapeHtml(entry.layerTitle)}</span>
                <span class="calendar-view__agenda-name">${escapeHtml(featureLabel(entry.feature, strings))}</span>
                <button type="button" class="calendar-view__agenda-view-btn" data-feature-id="${escapeHtml(String(entry.feature.id ?? ''))}">${escapeHtml(t('calendarView.viewOnMap', strings))}</button>
              </li>`,
            )
            .join('')}</ul>`
        : `<p class="calendar-view__agenda-empty">${escapeHtml(t('calendarView.noEvents', strings))}</p>`;
    } else if (granularity === 'year') {
      const groups = buildYearMonthCells(state.selectedDate, system, visibleLayers, state.activeFilters);
      bodyHtml = `<div class="calendar-view__year">${groups
        .map((g) => renderYearMonth(g, system, state.selectedDate, config.min, maxIso, strings))
        .join('')}</div>`;
    } else {
      bodyHtml = `<div class="calendar-view__grid" data-role="grid"></div>`;
    }

    container.innerHTML = `
      <div class="calendar-view__header">
        <div class="calendar-view__tabs">${tabsHtml}</div>
        <div class="calendar-view__nav">
          <button type="button" class="calendar-bar__step-btn" data-action="prev" aria-label="Step back">‹</button>
          <span class="calendar-view__period">${escapeHtml(periodLabel(state.selectedDate, system))}</span>
          <button type="button" class="calendar-bar__step-btn" data-action="next" aria-label="Step forward">›</button>
        </div>
      </div>
      <div class="calendar-view__body">${bodyHtml}</div>
    `;

    container.querySelectorAll<HTMLButtonElement>('[data-granularity]').forEach((button) => {
      button.addEventListener('click', () => {
        granularity = button.dataset.granularity as Granularity;
        render();
      });
    });
    container.querySelector('[data-action="prev"]')!.addEventListener('click', () => step(-1));
    container.querySelector('[data-action="next"]')!.addEventListener('click', () => step(1));

    if (granularity === 'week' || granularity === 'month') {
      const gridEl = container.querySelector<HTMLElement>('[data-role="grid"]')!;
      renderCalendarGrid(gridEl, {
        granularity,
        selectedIso: state.selectedDate,
        system,
        layers: visibleLayers,
        activeFilters: state.activeFilters,
        strings,
        min: config.min,
        max: maxIso,
        onSelectDay: (iso) => {
          store.set({ selectedDate: clampDateToRange(iso, config.min, maxIso) });
          granularity = 'day';
          render();
        },
      });
    }

    if (granularity === 'year') {
      container
        .querySelectorAll<HTMLButtonElement>('.calendar-view__year [data-iso]:not([disabled])')
        .forEach((button) => {
          button.addEventListener('click', () => {
            store.set({ selectedDate: clampDateToRange(button.dataset.iso!, config.min, maxIso) });
            granularity = 'day';
            render();
          });
        });
    }

    if (granularity === 'day') {
      container.querySelectorAll<HTMLButtonElement>('[data-feature-id]').forEach((button) => {
        button.addEventListener('click', () => {
          store.set({
            selectedFeatureId: button.dataset.featureId!,
            panels: { ...store.get().panels, left: 'open' },
            view: 'map',
          });
        });
      });
    }
  }

  render();
  store.subscribe(render);
}
```

- [ ] **Step 4: Add the `.calendar-view__*` CSS**

In `src/styles.css`, add right after the `.calendar-view`/`.view-switcher` rules added in Task 5:

```css
.calendar-view__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.calendar-view__tabs {
  display: flex;
  gap: 0.25rem;
}
.calendar-view__tab {
  border: 1px solid var(--color-border);
  background: var(--color-white);
  border-radius: var(--radius-full);
  padding: 0.35rem 0.9rem;
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}
.calendar-view__tab.is-active {
  background: var(--color-primary);
  color: var(--color-white);
  border-color: var(--color-primary);
}
.calendar-view__nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.calendar-view__period {
  font-weight: var(--font-weight-semibold);
  min-width: 8rem;
  text-align: center;
}
/* renderCalendarGrid() (CalendarGrid.ts) fully overwrites its container's
   className to "calendar-bar__grid calendar-grid calendar-grid--<granularity>"
   — the "calendar-view__grid" class on the wrapper div in the template below
   gets wiped the instant renderCalendarGrid runs, so this targets the class
   that actually survives (.calendar-grid, which renderCalendarGrid sets)
   scoped under .calendar-view__body instead of relying on a class of our own. */
.calendar-view__body > .calendar-grid {
  max-width: 28rem;
}
.calendar-view__year {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 1.5rem;
}
.calendar-view__year-month-title {
  font-weight: var(--font-weight-semibold);
  margin: 0 0 0.4rem;
}
.calendar-view__agenda {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 32rem;
}
.calendar-view__agenda-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.6rem 0.8rem;
}
.calendar-view__agenda-layer {
  font-size: var(--font-size-xs);
  color: var(--color-text-light);
  text-transform: uppercase;
}
.calendar-view__agenda-name {
  flex: 1;
  font-weight: var(--font-weight-medium);
}
.calendar-view__agenda-view-btn {
  border: 1px solid var(--color-primary);
  background: var(--color-white);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  padding: 0.3rem 0.75rem;
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.calendar-view__agenda-view-btn:hover {
  background: var(--color-primary-light);
}
.calendar-view__agenda-empty {
  color: var(--color-text-light);
}
```

- [ ] **Step 5: Mount it in `main.ts`**

In `src/main.ts`, add the import:

```ts
import { mountCalendarView } from './ui/panels/CalendarView';
```

Add the mount call right after the existing `mountCalendarBar(...)` call:

```ts
mountCalendarView(document.querySelector('#calendar-view')!, store, appManifest.calendar, strings, loadedLayers);
```

- [ ] **Step 6: Run typecheck, lint, and tests**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: no errors; `SearchOverlay.ts`'s behavior is unchanged (only `featureLabel` moved + gained a parameter), so no existing test regresses (it has no dedicated test file).

- [ ] **Step 7: Manual verification**

Run: `pnpm dev`, open the printed URL:

- Switch to Calendar view — month view shows by default, with the demo data's event dots visible on days that have POIs.
- Click the Week/Day/Year tabs — each renders (year shows 12 mini-months, every day visible, with a header per month).
- Click a day cell anywhere (week, month, or a mini-month in year view) — it switches to Day view and shows either the agenda list for that day or "No events on this day".
- If a day has events (e.g. navigate to a date matching one of the demo POIs' `temporal.instant`), click "View on map" — it switches to Map view, opens the info panel, and shows that feature's details.
- Use the granularity stepper's prev/next buttons at every granularity level — the period label and grid update accordingly.

- [ ] **Step 8: Commit**

```bash
git add src/ui/panels/CalendarView.ts src/ui/panels/SearchOverlay.ts src/main.ts src/styles.css worlds/demo/strings.json
git commit -m "$(cat <<'EOF'
feat: add full-screen Calendar view (day/week/month/year + day agenda)

Year view lays out all 12 (or 13, hebrew leap year) months at once,
every day visible, reusing buildYearMonthCells. Day view shows an
agenda of that day's events (getFeaturesOnDate) with a "View on map"
button that selects the feature and switches back to Map view.
featureLabel is now exported from SearchOverlay.ts so both panels
format a feature's display name the same way.
EOF
)"
```

---

### Task 7: Full regression pass and docs

**Files:**

- Modify: `CHANGELOG.md`
- Modify: `README.md`

**Interfaces:** None — this task only verifies and documents.

- [ ] **Step 1: Full verification run**

Run: `pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm test && pnpm run build`
Expected: all clean; test count should be 213 (baseline) + 6 new (`buildYearMonthCells` ×3, `getFeaturesOnDate` ×5) − 3 removed (`buildYearCells`'s describe block) = 221 passing, 0 failures. Adjust the exact expected number if a step above added/removed a different count than planned — the point is: no drop from baseline, no failures.

- [ ] **Step 2: Full manual smoke test**

Run: `pnpm run preview` (serves the production build), open the printed URL, and walk through:

1. Map view loads exactly as before (search, filters, layers, selection, footer legend all work).
2. Switch to Calendar view and back to Map multiple times — map stays interactive every time (pans/zooms correctly, `invalidateSize` fix holds).
3. In Calendar view, change a category filter in the filters panel (still reachable in both views), then check the agenda/grid dots reflect the filtered set.
4. Switch calendar system (Settings popover) to islamic or hebrew — Calendar view's month names, year view month count (13 for a hebrew leap year), and day agenda all render correctly in that system.

- [ ] **Step 3: Update `CHANGELOG.md`**

Add a new entry at the top of `CHANGELOG.md` (right after the `# Changelog` header and its intro line), matching the existing entries' style:

```markdown
## Full-screen Calendar view (day/week/month/year), separate from Map view

The app now has two top-level, switchable views — Map (unchanged) and a new full-screen **Calendar view** (`src/ui/panels/CalendarView.ts`), toggled by a pill-shaped Map/Calendar control (`app-chrome.ts`, always visible). Calendar view has its own day/week/month/year granularity tabs: week/month reuse the existing `CalendarGrid.ts` grid, and year is new — all 12 months (13 for a Hebrew leap year) laid out at once, every day visible with event dots, via a new engine function `buildYearMonthCells` (`src/engine/time/calendar-grid.ts`). Picking any day switches to day view and shows an agenda of that day's events (new `getFeaturesOnDate`, `src/engine/time/day-agenda.ts`) with a "View on map" button per entry that selects the feature and switches back to Map view. `#map` isn't torn down when Calendar view is showing — `MapAdapter` gained `invalidateSize()` so Leaflet recalculates its container size correctly when the user switches back.

`CalendarBar.ts`'s embedded grid (added in "Visual calendar grid in the Time editor", below) is removed — it's superseded by the new full-screen Calendar view. `CalendarBar.ts` goes back to being a compact spinner-only date editor for quick nudges while on Map view. This also removed the old 12-button year grid (`buildYearCells`, `CalendarGridMonthCell`) as dead code, since Calendar view's year layout replaced its only caller.
```

- [ ] **Step 4: Update `README.md`**

In `README.md`'s "Recently shipped beyond the original v1 scope" list, add a new bullet:

```markdown
- Two top-level views — Map and a full-screen Calendar view (day/week/month/year, a 12-month year-at-a-glance layout, and a per-day event agenda).
```

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md README.md
git commit -m "$(cat <<'EOF'
docs: record the Map/Calendar view split in CHANGELOG and README
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Section 2 (state) → Task 5 Step 1. Section 3 (switcher) → Task 5 Steps 5-6. Section 4 (containers) → Task 5 Step 3. Section 5 (`buildYearMonthCells`) → Task 1. Section 6 (`day-agenda.ts`) → Task 2. Section 7 (`CalendarView.ts`) → Task 6. Section 8 (`CalendarBar.ts` simplification) → Task 3, plus the dead-code follow-up the spec didn't fully trace → Task 4. Section 9 (styling) → Task 5 Step 5 + Task 6 Step 4. Section 10 (testing) → Tasks 1, 2, 4, 6 Step 6. Section 11 (non-goals) — no task violates them (single `selectedDate`, no persistence of `view`/granularity, no animation).
- **Type consistency checked:** `CalendarGridMonthGroup` (Task 1) is the exact type `CalendarView.ts` (Task 6) imports and consumes. `getFeaturesOnDate`'s `DayAgendaEntry.layerTitle`/`layerId`/`feature` fields match what Task 6's agenda rendering reads. `clampDateToRange`'s exported signature (Task 3) matches every call in Task 6. `CalendarGridDeps` (post-Task-4) has no `onSelectMonth`, and Task 6 never passes one.
- **Deviation from the spec resolved during planning:** Section 5 of the design spec said `buildYearCells` "stays as-is; nothing currently using it needs to change" — tracing actual call sites showed its only caller (`CalendarBar.ts`'s embedded grid) is exactly what Section 8 removes, so it becomes dead code. Task 4 removes it rather than leaving it unused, matching CONTEXT.md's "avoid large abstractions without real use cases."
