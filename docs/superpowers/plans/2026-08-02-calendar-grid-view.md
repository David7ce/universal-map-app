# Visual Calendar Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `CalendarBar.ts`'s plain "Month / Day / Year" text with a clickable calendar grid (week row / month grid / year-of-months grid) that adapts to the current `calendar.system` and marks cells that have active features.

**Architecture:** A new pure engine module (`src/engine/time/calendar-grid.ts`) computes grid cells (no DOM); a new UI module (`src/ui/panels/CalendarGrid.ts`) renders them and wires clicks; `CalendarBar.ts` mounts the grid and drives re-renders from its existing store-subscribe / granularity-change cycle. No change to `AppState` — `selectedDate` stays a single Gregorian ISO string, clicking a cell just sets it (see design doc Section 2 for why range-based filtering is out of scope).

**Tech Stack:** TypeScript, Vitest, no new dependencies — reuses `calendar-conversion.ts` (`toCalendarParts`, `calendarPartsToIso`, `daysInCalendarMonth`, `monthsInCalendarYear`) and `compute-dimensions.ts` (`featureMatchesFilters`) from prior sessions.

## Global Constraints

- Design doc: `docs/superpowers/specs/2026-08-02-calendar-grid-view-design.md` — read it before starting, it has the full rationale.
- Engine code (`src/engine/`) must not import from `src/ui/` — see `CONTEXT.md`'s layering rule. `calendar-grid.ts` gets its own tiny `addDays`/`weekdayOf` helpers rather than importing `CalendarBar.ts`'s copies.
- Week grid is Sunday-start (matches the existing `calendar.weekday.sun..sat` string keys' order in `apps/demo/strings.json`, already present but currently unused).
- Out-of-period cells (month-grid leading/trailing blanks) are never clickable and never show an event dot — `hasEvents: false` unconditionally, `inCurrentPeriod: false`.
- Clicking a day cell (week or month view) only selects that date. Clicking a month cell (year view) selects day 1 of that month **and** switches granularity to `'month'`. No other click drills or switches granularity.
- Run `npx vitest run`, `npx tsc --noEmit`, and `npx prettier --check .` before every commit in this plan — this repo has zero tolerance for any of the three failing (established this session; `prettier --write .` if the check fails).

---

### Task 1: Engine module `calendar-grid.ts`

**Files:**
- Create: `src/engine/time/calendar-grid.ts`
- Create: `src/engine/time/calendar-grid.test.ts`

**Interfaces:**
- Consumes: `toCalendarParts(isoDate: string, system: CalendarSystem, locale?: string): CalendarDateParts` (`{year,month,day,monthName}`), `calendarPartsToIso(parts: DateParts, system: CalendarSystem): string`, `daysInCalendarMonth(year: number, month: number, system: CalendarSystem): number`, `monthsInCalendarYear(year: number, system: CalendarSystem): number` — all from `./calendar-conversion`. `featureMatchesFilters(feature: GeoFeature, manifest: LayerManifest, activeFilters: Record<string,Set<string>>): boolean` from `../taxonomy/compute-dimensions`. `isActiveOn(feature: GeoFeature, date: Date): boolean` from `./is-active-on`. `LoadedLayer { manifest: LayerManifest; features: GeoFeature[] }` from `../taxonomy/compute-dimensions`.
- Produces: `CalendarGridDayCell { iso: string; day: number; inCurrentPeriod: boolean; hasEvents: boolean }`, `CalendarGridMonthCell { iso: string; month: number; hasEvents: boolean }`, `buildWeekCells(selectedIso, system, layers, activeFilters): CalendarGridDayCell[]`, `buildMonthCells(selectedIso, system, layers, activeFilters): CalendarGridDayCell[]`, `buildYearCells(selectedIso, system, layers, activeFilters): CalendarGridMonthCell[]` — Task 2 (UI rendering) and Task 3 (wiring) call these three functions directly.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/time/calendar-grid.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { buildMonthCells, buildWeekCells, buildYearCells } from './calendar-grid';
import { daysInCalendarMonth, ensureCalendarSystemLoaded, monthsInCalendarYear } from './calendar-conversion';
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
        properties: { temporal: { instant: iso } },
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
    ],
  };
}

beforeAll(async () => {
  await ensureCalendarSystemLoaded('islamic');
  await ensureCalendarSystemLoaded('hebrew');
});

describe('buildWeekCells', () => {
  it('returns the Sunday-start week containing the selected date, gregorian', () => {
    const cells = buildWeekCells('2026-07-29', 'gregorian', [], {});
    expect(cells.map((c) => c.iso)).toEqual([
      '2026-07-26',
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
    ]);
  });

  it('marks hasEvents true only on the cell matching an active feature', () => {
    const cells = buildWeekCells('2026-07-29', 'gregorian', [layerWithEventOn('2026-07-30')], {});
    expect(cells.find((c) => c.iso === '2026-07-30')!.hasEvents).toBe(true);
    expect(cells.find((c) => c.iso === '2026-07-29')!.hasEvents).toBe(false);
  });

  it('respects activeFilters when computing hasEvents', () => {
    const layer = layerWithEventOn('2026-07-30');
    layer.manifest = {
      ...layer.manifest,
      taxonomy: [{ id: 'category', label: 'Category', field: 'properties.category' }],
    };
    layer.features[0].properties.category = 'shop';
    const cells = buildWeekCells('2026-07-29', 'gregorian', [layer], { category: new Set(['market']) });
    expect(cells.find((c) => c.iso === '2026-07-30')!.hasEvents).toBe(false);
  });
});

describe('buildMonthCells', () => {
  it('has no leading blanks and 28 in-period cells for February 2026 (starts Sunday, not a leap year)', () => {
    const cells = buildMonthCells('2026-02-15', 'gregorian', [], {});
    expect(cells.length).toBe(28);
    expect(cells.every((c) => c.inCurrentPeriod)).toBe(true);
    expect(cells[0].iso).toBe('2026-02-01');
    expect(cells[27].iso).toBe('2026-02-28');
  });

  it('has 4 leading and 2 trailing blanks for February 2024 (starts Thursday, leap year)', () => {
    const cells = buildMonthCells('2024-02-15', 'gregorian', [], {});
    expect(cells.length).toBe(35);
    expect(cells.filter((c) => !c.inCurrentPeriod).length).toBe(6);
    expect(cells.filter((c) => c.inCurrentPeriod).length).toBe(29);
    expect(cells[4].iso).toBe('2024-02-01');
    expect(cells[4].inCurrentPeriod).toBe(true);
  });

  it('cell count matches daysInCalendarMonth for a non-gregorian system, rounded up to a full week', () => {
    // toCalendarParts('2026-07-29', 'islamic') is { year: 1448, month: 2, ... } (see calendar-conversion.test.ts).
    const cells = buildMonthCells('2026-07-29', 'islamic', [], {});
    const inPeriod = cells.filter((c) => c.inCurrentPeriod);
    expect(inPeriod.length).toBe(daysInCalendarMonth(1448, 2, 'islamic'));
    expect(cells.length % 7).toBe(0);
  });

  it('blank cells never report hasEvents even if a feature is active that day', () => {
    const cells = buildMonthCells('2024-02-15', 'gregorian', [layerWithEventOn('2024-01-30')], {});
    expect(cells.filter((c) => !c.inCurrentPeriod).every((c) => c.hasEvents === false)).toBe(true);
  });
});

describe('buildYearCells', () => {
  it('returns 12 cells for gregorian, months 1-12 in order', () => {
    const cells = buildYearCells('2026-07-29', 'gregorian', [], {});
    expect(cells.length).toBe(12);
    expect(cells.map((c) => c.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('cell count matches monthsInCalendarYear for hebrew (12 or 13)', () => {
    const cells = buildYearCells('2026-07-29', 'hebrew', [], {});
    expect(cells.length).toBe(monthsInCalendarYear(5786, 'hebrew'));
  });

  it('marks hasEvents true for a month containing an active feature, false for others', () => {
    const cells = buildYearCells('2026-01-15', 'gregorian', [layerWithEventOn('2026-03-10')], {});
    expect(cells.find((c) => c.month === 3)!.hasEvents).toBe(true);
    expect(cells.find((c) => c.month === 1)!.hasEvents).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/time/calendar-grid.test.ts`
Expected: FAIL — `calendar-grid.ts` doesn't exist yet (`Cannot find module './calendar-grid'`).

- [ ] **Step 3: Write the implementation**

Create `src/engine/time/calendar-grid.ts`:

```ts
import type { CalendarSystem } from './calendar-systems';
import type { LoadedLayer } from '../taxonomy/compute-dimensions';
import { featureMatchesFilters } from '../taxonomy/compute-dimensions';
import { isActiveOn } from './is-active-on';
import { calendarPartsToIso, daysInCalendarMonth, monthsInCalendarYear, toCalendarParts } from './calendar-conversion';

export interface CalendarGridDayCell {
  iso: string;
  day: number;
  inCurrentPeriod: boolean;
  hasEvents: boolean;
}

export interface CalendarGridMonthCell {
  iso: string;
  month: number;
  hasEvents: boolean;
}

// Deliberately not imported from CalendarBar.ts — engine/ must not depend on
// ui/ (see CONTEXT.md). Two five-line helpers duplicated is cheaper than
// threading a shared utility module across that boundary.
function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

function hasActiveFeatureOn(layers: LoadedLayer[], activeFilters: Record<string, Set<string>>, iso: string): boolean {
  const date = new Date(`${iso}T00:00:00Z`);
  return layers.some((layer) =>
    layer.features.some(
      (feature) => featureMatchesFilters(feature, layer.manifest, activeFilters) && isActiveOn(feature, date),
    ),
  );
}

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

export function buildWeekCells(
  selectedIso: string,
  system: CalendarSystem,
  layers: LoadedLayer[],
  activeFilters: Record<string, Set<string>>,
): CalendarGridDayCell[] {
  const weekStartIso = addDays(selectedIso, -weekdayOf(selectedIso));
  const cells: CalendarGridDayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(weekStartIso, i);
    cells.push({
      iso,
      day: toCalendarParts(iso, system).day,
      inCurrentPeriod: true,
      hasEvents: hasActiveFeatureOn(layers, activeFilters, iso),
    });
  }
  return cells;
}

export function buildMonthCells(
  selectedIso: string,
  system: CalendarSystem,
  layers: LoadedLayer[],
  activeFilters: Record<string, Set<string>>,
): CalendarGridDayCell[] {
  const { year, month } = toCalendarParts(selectedIso, system);
  const firstIso = calendarPartsToIso({ year, month, day: 1 }, system);
  const leadingBlanks = weekdayOf(firstIso);
  const dayCount = daysInCalendarMonth(year, month, system);

  const cells: CalendarGridDayCell[] = [];
  for (let i = leadingBlanks; i > 0; i--) {
    const iso = addDays(firstIso, -i);
    cells.push({ iso, day: toCalendarParts(iso, system).day, inCurrentPeriod: false, hasEvents: false });
  }
  for (let day = 1; day <= dayCount; day++) {
    const iso = calendarPartsToIso({ year, month, day }, system);
    cells.push({ iso, day, inCurrentPeriod: true, hasEvents: hasActiveFeatureOn(layers, activeFilters, iso) });
  }
  while (cells.length % 7 !== 0) {
    const iso = addDays(cells[cells.length - 1].iso, 1);
    cells.push({ iso, day: toCalendarParts(iso, system).day, inCurrentPeriod: false, hasEvents: false });
  }
  return cells;
}

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/time/calendar-grid.test.ts`
Expected: PASS, all 9 tests.

- [ ] **Step 5: Type-check and format**

Run: `npx tsc --noEmit` — expect no output (clean). Run: `npx prettier --check src/engine/time/calendar-grid.ts src/engine/time/calendar-grid.test.ts` — if it warns, run `npx prettier --write` on both files and re-check.

- [ ] **Step 6: Commit**

```bash
git add src/engine/time/calendar-grid.ts src/engine/time/calendar-grid.test.ts
git commit -m "feat: pure calendar-grid cell builders for week/month/year views"
```

---

### Task 2: UI rendering — `CalendarGrid.ts` + CSS

**Files:**
- Create: `src/ui/panels/CalendarGrid.ts`
- Modify: `src/styles.css` (append new rules near the existing `.calendar-bar__*` block, after the `.calendar-bar__system-label:empty` rule around line 1267)

**Interfaces:**
- Consumes: `buildWeekCells`/`buildMonthCells`/`buildYearCells` and `CalendarGridDayCell`/`CalendarGridMonthCell` from `../../engine/time/calendar-grid` (Task 1). `toCalendarParts` from `../../engine/time/calendar-conversion`. `t(key, strings, params?): string` from `../strings`. `escapeHtml(value: string): string` from `../escape-html`. `Granularity` type from `./CalendarBar` (already exported there: `'day' | 'week' | 'month' | 'year'`).
- Produces: `CalendarGridDeps` interface and `renderCalendarGrid(container: HTMLElement, deps: CalendarGridDeps): void` — Task 3 calls this from `CalendarBar.ts`.

- [ ] **Step 1: Create `src/ui/panels/CalendarGrid.ts`**

```ts
import type { CalendarSystem } from '../../engine/time/calendar-systems';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { buildMonthCells, buildWeekCells, buildYearCells } from '../../engine/time/calendar-grid';
import { toCalendarParts } from '../../engine/time/calendar-conversion';
import type { Granularity } from './CalendarBar';
import { t } from '../strings';
import { escapeHtml } from '../escape-html';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export interface CalendarGridDeps {
  granularity: Exclude<Granularity, 'day'>;
  selectedIso: string;
  system: CalendarSystem;
  layers: LoadedLayer[];
  activeFilters: Record<string, Set<string>>;
  strings: Record<string, string>;
  // Week/month view: clicking a day cell. Only selects — never changes granularity.
  onSelectDay: (iso: string) => void;
  // Year view: clicking a month cell. Selects day 1 of that month and drills
  // into month view — see design doc Section 4 for why day cells don't drill
  // further (they're already the finest grain).
  onSelectMonth: (iso: string) => void;
}

// Rebuilds innerHTML from scratch on every call — same pattern as
// PanelRight.ts/CalendarBar.ts, no DOM diffing anywhere in this codebase.
export function renderCalendarGrid(container: HTMLElement, deps: CalendarGridDeps): void {
  const { granularity, selectedIso, system, layers, activeFilters, strings } = deps;

  if (granularity === 'year') {
    const cells = buildYearCells(selectedIso, system, layers, activeFilters);
    const selectedMonth = toCalendarParts(selectedIso, system).month;

    container.className = 'calendar-grid calendar-grid--year';
    container.innerHTML = cells
      .map((cell) => {
        const label =
          system === 'gregorian' ? t(`calendar.month.${MONTH_KEYS[cell.month - 1]}`, strings) : String(cell.month);
        const classes = ['calendar-grid__cell'];
        if (cell.month === selectedMonth) classes.push('calendar-grid__cell--selected');
        if (cell.hasEvents) classes.push('calendar-grid__cell--has-events');
        return `<button type="button" class="${classes.join(' ')}" data-iso="${escapeHtml(cell.iso)}">${escapeHtml(label)}</button>`;
      })
      .join('');
    container.querySelectorAll<HTMLButtonElement>('[data-iso]').forEach((button) => {
      button.addEventListener('click', () => deps.onSelectMonth(button.dataset.iso!));
    });
    return;
  }

  const cells =
    granularity === 'week'
      ? buildWeekCells(selectedIso, system, layers, activeFilters)
      : buildMonthCells(selectedIso, system, layers, activeFilters);

  const weekdayHeader = WEEKDAY_KEYS.map(
    (key) => `<span class="calendar-grid__weekday">${escapeHtml(t(`calendar.weekday.${key}`, strings))}</span>`,
  ).join('');

  const cellsHtml = cells
    .map((cell) => {
      const classes = ['calendar-grid__cell'];
      if (!cell.inCurrentPeriod) classes.push('calendar-grid__cell--muted');
      if (cell.iso === selectedIso) classes.push('calendar-grid__cell--selected');
      if (cell.hasEvents) classes.push('calendar-grid__cell--has-events');
      const disabled = cell.inCurrentPeriod ? '' : 'disabled';
      return `<button type="button" class="${classes.join(' ')}" data-iso="${escapeHtml(cell.iso)}" ${disabled}>${cell.day}</button>`;
    })
    .join('');

  container.className = `calendar-grid calendar-grid--${granularity}`;
  container.innerHTML = weekdayHeader + cellsHtml;
  container.querySelectorAll<HTMLButtonElement>('[data-iso]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => deps.onSelectDay(button.dataset.iso!));
  });
}
```

- [ ] **Step 2: Append grid CSS to `src/styles.css`**

Insert after the `.calendar-bar__system-label:empty { display: none; }` rule (around line 1267):

```css

/* ========================================
   CALENDAR GRID (week/month/year views inside the Time editor)
   ======================================== */
.calendar-bar__grid {
  margin-top: 0.5rem;
}
.calendar-bar.is-editing .calendar-bar__grid {
  display: none;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.15rem;
}
.calendar-grid--year {
  grid-template-columns: repeat(4, 1fr);
}
.calendar-grid__weekday {
  font-size: var(--font-size-xs);
  color: var(--color-text-light);
  text-align: center;
  padding: 0.15rem 0;
}
.calendar-grid__cell {
  position: relative;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  padding: 0.3rem 0;
  font: inherit;
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}
.calendar-grid--year .calendar-grid__cell {
  padding: 0.5rem 0.25rem;
}
.calendar-grid__cell:hover:not(:disabled) {
  background: var(--color-primary-light);
}
.calendar-grid__cell:disabled {
  cursor: default;
}
.calendar-grid__cell--muted {
  color: var(--color-text-light);
  opacity: 0.4;
}
.calendar-grid__cell--selected {
  background: var(--color-primary);
  color: var(--color-white);
  font-weight: var(--font-weight-semibold);
}
.calendar-grid__cell--has-events::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-accent);
}
.calendar-grid__cell--selected.calendar-grid__cell--has-events::after {
  background: var(--color-white);
}
```

- [ ] **Step 3: Type-check and format**

Run: `npx tsc --noEmit` — expect no output. Run: `npx prettier --check src/ui/panels/CalendarGrid.ts src/styles.css` — if it warns, `npx prettier --write` both and re-check.

- [ ] **Step 4: Commit**

```bash
git add src/ui/panels/CalendarGrid.ts src/styles.css
git commit -m "feat: render week/month/year calendar grid with event dots"
```

---

### Task 3: Wire the grid into `CalendarBar.ts` and `main.ts`

**Files:**
- Modify: `src/ui/panels/CalendarBar.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `renderCalendarGrid`, `CalendarGridDeps` from `./CalendarGrid` (Task 2). `LoadedLayer` from `../../engine/taxonomy/compute-dimensions`.
- Produces: `mountCalendarBar`'s signature changes from `(container, store, config, strings)` to `(container, store, config, strings, layers)` — `main.ts` is the only caller, updated in this task.

- [ ] **Step 1: Add the grid container to `CalendarBar.ts`'s template**

In `src/ui/panels/CalendarBar.ts`, find the closing of the fields row (`</div>` right before `<span class="calendar-bar__system-label"`) and add a new `<div>` right after it:

```html
      </div>
      <div class="calendar-bar__grid" data-role="grid"></div>
      <span class="calendar-bar__system-label" data-role="system-label"></span>
```

(This is the existing `.calendar-bar__row` closing `</div>` — the one right after the `data-action="edit"` button — not any of the inner field divs.)

- [ ] **Step 2: Add imports and the `layers` parameter**

At the top of `src/ui/panels/CalendarBar.ts`, add:

```ts
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { renderCalendarGrid } from './CalendarGrid';
```

Change the `mountCalendarBar` signature:

```ts
export function mountCalendarBar(
  container: HTMLElement,
  store: Store<AppState>,
  config: CalendarConfig,
  strings: Record<string, string>,
  layers: LoadedLayer[],
): void {
```

- [ ] **Step 3: Query the grid container and add `renderGrid`/selection handlers**

Right after the existing `const granularitySelect = container.querySelector<HTMLSelectElement>('[data-role="granularity"]')!;` line, add:

```ts
  const gridContainer = container.querySelector<HTMLElement>('[data-role="grid"]')!;

  function renderGrid(): void {
    if (granularity === 'day') {
      gridContainer.hidden = true;
      return;
    }
    gridContainer.hidden = false;
    const state = store.get();
    renderCalendarGrid(gridContainer, {
      granularity,
      selectedIso: state.selectedDate,
      system: state.calendarSystem,
      layers,
      activeFilters: state.activeFilters,
      strings,
      onSelectDay: (iso) => store.set({ selectedDate: clampDateToRange(iso, config.min, maxIso) }),
      onSelectMonth: (iso) => {
        granularity = 'month';
        granularitySelect.value = granularity;
        store.set({ selectedDate: clampDateToRange(iso, config.min, maxIso) });
      },
    });
  }
```

- [ ] **Step 4: Call `renderGrid` at the right points**

Change the `granularitySelect` change handler from:

```ts
  granularitySelect.addEventListener('change', () => {
    granularity = granularitySelect.value as Granularity;
  });
```

to:

```ts
  granularitySelect.addEventListener('change', () => {
    granularity = granularitySelect.value as Granularity;
    renderGrid();
  });
```

Change the initial render block from:

```ts
  dateSlider.value = sliderOffsetFor(store.get().selectedDate);
  renderSystemLabel(store.get().selectedDate);
  renderFields(store.get().selectedDate);
```

to:

```ts
  dateSlider.value = sliderOffsetFor(store.get().selectedDate);
  renderSystemLabel(store.get().selectedDate);
  renderFields(store.get().selectedDate);
  renderGrid();
```

Change the `store.subscribe` callback from:

```ts
  store.subscribe((state) => {
    const offset = sliderOffsetFor(state.selectedDate);
    if (dateSlider.value !== offset) dateSlider.value = offset;
    renderSystemLabel(state.selectedDate);
    renderFields(state.selectedDate);
  });
```

to:

```ts
  store.subscribe((state) => {
    const offset = sliderOffsetFor(state.selectedDate);
    if (dateSlider.value !== offset) dateSlider.value = offset;
    renderSystemLabel(state.selectedDate);
    renderFields(state.selectedDate);
    renderGrid();
  });
```

- [ ] **Step 5: Update the `main.ts` call site**

In `src/main.ts`, change:

```ts
  mountCalendarBar(document.querySelector('#panel-right-time')!, store, appManifest.calendar, strings);
```

to:

```ts
  mountCalendarBar(document.querySelector('#panel-right-time')!, store, appManifest.calendar, strings, loadedLayers);
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit` — expect no output. This is the step that catches a mismatched `mountCalendarBar` call site or a typo in the `CalendarGridDeps` shape.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run` — expect all tests passing (no test targets this wiring directly, but this catches any accidental break in `CalendarBar.test.ts`'s existing pure-function tests, e.g. from a stray syntax error).

- [ ] **Step 8: Build**

Run: `npx vite build` — expect a clean production build.

- [ ] **Step 9: Format**

Run: `npx prettier --check src/ui/panels/CalendarBar.ts src/main.ts` — if it warns, `npx prettier --write` both and re-check.

- [ ] **Step 10: Manual verification**

Run: `npx vite --port 5173` in the background, open `http://localhost:5173` in a browser. Check:
- Time section shows a grid (not plain text) when granularity is week/month/year, and plain text when granularity is day.
- Clicking a day cell in month view selects it (highlight moves, footer date updates).
- Switching to year view and clicking a month switches to month view of that month.
- Switching `calendar.system` in Settings to islamic/hebrew and confirming the grid re-renders with that system's month lengths/year length (no crash, cell counts change).
- A day with the demo's Fasnia/Güímar/Arico POI data (`apps/demo/data/poi.geojson`) shows an event dot in month view.

Stop the dev server (`Ctrl+C` or kill the process) once done. If a real browser isn't available in this environment (as was the case earlier this session — Playwright's MCP tool needs a system Chrome install that required admin rights to add), note that explicitly instead of claiming this step passed.

- [ ] **Step 11: Commit**

```bash
git add src/ui/panels/CalendarBar.ts src/main.ts
git commit -m "feat: wire calendar grid into the Time editor"
```

---

### Task 4: Docs and final verification

**Files:**
- Modify: `CHANGELOG.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Add a CHANGELOG entry**

Add to the top of `CHANGELOG.md` (right after the `# Changelog` header and its intro paragraph):

```markdown
## Visual calendar grid in the Time editor

`CalendarBar.ts` now renders a clickable calendar grid instead of plain "Month / Day / Year" text, when not in numeric-edit mode: a week row, a full month grid, or a year-of-months grid, depending on the granularity stepper's current setting (`'day'` still shows plain text — a single day has nothing to grid). New pure engine module `src/engine/time/calendar-grid.ts` (`buildWeekCells`/`buildMonthCells`/`buildYearCells`) computes cells adapted to `calendar.system` (real day-of-week from the underlying Gregorian date, system-aware month/day counts via last session's `daysInCalendarMonth`/`monthsInCalendarYear`), and marks cells with an active feature (respecting `activeFilters`, same as every other filtered view) via an event dot. Clicking a day cell selects it; clicking a month cell in year view selects day 1 of that month and drills into month view. Selecting a week/month/year cell still resolves to one `selectedDate` — no range-based map filtering (see `docs/superpowers/specs/2026-08-02-calendar-grid-view-design.md` Section 2 for why that's out of scope).
```

- [ ] **Step 2: Full verification pass**

Run in order, all must pass before this task is done:

```bash
npx vitest run
npx tsc --noEmit
npx vite build
npx prettier --check .
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: log visual calendar grid in CHANGELOG"
```
