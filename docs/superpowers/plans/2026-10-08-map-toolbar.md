# Map Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the top-of-map filter pills and the footer date text with one `MapToolbar` (date chip + calendar popover + always-present filter pills with a "More" overflow menu).

**Architecture:** Two small pure modules (`toolbar-pills.ts`, `toolbar-date.ts`) hold all logic that can be unit-tested in vitest's `node` environment. `MapToolbar.ts` is DOM glue over them: a persistent skeleton (date group, filters area) where only the filters area is re-rendered via `innerHTML` on store updates, so the chip, popover and the mounted `CalendarBar` keep their DOM and focus. The existing store and engine are untouched.

**Tech Stack:** TypeScript, Vite, Leaflet, Vitest (`environment: 'node'`, no DOM tests in this repo), plain CSS in `src/styles.css`.

**Spec:** `docs/superpowers/specs/2026-10-08-map-toolbar-design.md`

## Global Constraints

- Static, browser-only architecture; store shape (`selectedDate`, `activeFilters`, `calendarSystem`, `hiddenLayerIds`) unchanged.
- Worlds with `systems.time === false` (`no-time` class) show no date UI.
- No new runtime dependencies.
- Toolbar hidden on the Home view (`.map-app.view-home`).
- `maxVisible` pills: 6 desktop (>= 48rem), 4 mobile.
- Prev/next step by one month, clamped to `calendar.min`/`calendar.max`.
- New UI strings added to all 8 world strings files (`worlds/*/strings.{en,es}.json`).
- Code style: Prettier (`.prettierrc.json`); existing files use single quotes, 2-space indent, 120 cols. Run `pnpm format` before each commit.

## Review Focus

- Stepping from a month-end day (Jan 31 +1 month) must land on Feb 28, not overflow into March (Task 1 test).
- At the world's `min`/`max` date, prev/next must not move outside the range and the button is disabled (Task 1 test).
- Exactly one overflow pill: show it inline instead of a "More (1)" button (Task 1 test).
- An active filter hidden inside "More" must still be visible to the user via a badge count on the button (Task 1 test for `countActiveIn`).
- A dimension with no features active on the selected date is omitted; a value with zero is shown dimmed, not hidden; hidden layers contribute nothing (Task 1 tests).
- Popover/menu must close on outside click and Escape, with focus back on the chip (manual check, Task 3/4).

## File Structure

- Create `src/ui/panels/toolbar-pills.ts` — pure: build pill list for a date, split visible/overflow, count active hidden.
- Create `src/ui/panels/toolbar-pills.test.ts`
- Create `src/ui/panels/toolbar-date.ts` — pure: month stepping clamped to range.
- Create `src/ui/panels/toolbar-date.test.ts`
- Create `src/ui/panels/MapToolbar.ts` — DOM component.
- Modify `src/ui/panels/CalendarBar.ts` — optional `onDayPicked` callback.
- Modify `index.html`, `src/main.ts`, `src/ui/app-chrome.ts`, `src/styles.css`.
- Modify `worlds/*/strings.{en,es}.json`.
- Delete `src/ui/panels/FilterPills.ts`.
- Modify `CHANGELOG.md`, `docs/api-reference.md` (if it lists panels).

---

### Task 1: Pure helpers (pills + date stepping)

**Files:**

- Create: `src/ui/panels/toolbar-pills.ts`, `src/ui/panels/toolbar-pills.test.ts`
- Create: `src/ui/panels/toolbar-date.ts`, `src/ui/panels/toolbar-date.test.ts`

**Interfaces:**

- Produces:
  - `interface ToolbarPill { dimensionId: string; dimensionLabel: string; value: string; count: number; icons?: Record<string, string>; defaultIcon?: string }`
  - `buildToolbarPills(layers: LoadedLayer[], date: Date | null, hiddenLayerIds: Set<string>): ToolbarPill[]`
  - `splitVisiblePills(pills: ToolbarPill[], maxVisible: number): { visible: ToolbarPill[]; overflow: ToolbarPill[] }`
  - `countActiveIn(pills: ToolbarPill[], activeFilters: Record<string, Set<string>>): number`
  - `stepMonth(iso: string, system: CalendarSystem, direction: 1 | -1, min: string, max: string): string`
- Consumes: `computeTaxonomyDimensions`, `LoadedLayer` from `src/engine/taxonomy/compute-dimensions.ts`; `toCalendarParts`, `calendarPartsToIso`, `daysInCalendarMonth`, `monthsInCalendarYear` from `src/engine/time/calendar-conversion.ts`; `clampDateToRange` from `src/ui/panels/CalendarBar.ts`.

- [ ] **Step 1: Write the failing pill tests**

Create `src/ui/panels/toolbar-pills.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import type { LayerManifest } from '../../engine/manifests/layer-manifest';
import type { GeoFeature } from '../../engine/time/temporal-types';
import { buildToolbarPills, countActiveIn, splitVisiblePills, type ToolbarPill } from './toolbar-pills';

function feature(id: string, category: string, instant?: string): GeoFeature {
  return {
    type: 'Feature',
    id,
    properties: instant ? { category, temporal: { instant } } : { category },
    geometry: { type: 'Point', coordinates: [0, 0] },
  };
}

function layer(id: string, features: GeoFeature[]): LoadedLayer {
  const manifest: LayerManifest = {
    id,
    title: id,
    kind: 'point',
    source: { type: 'geojson', url: '/x' },
    taxonomy: [{ id: 'category', label: 'Category', field: 'properties.category' }],
  };
  return { manifest, features };
}

const DATE = new Date('2026-06-01T00:00:00Z');

describe('buildToolbarPills', () => {
  it('lists every value of a dimension, with its count on the date (0 when none active)', () => {
    const l = layer('poi', [feature('1', 'shop'), feature('2', 'shop'), feature('3', 'market', '2020-01-01')]);
    const pills = buildToolbarPills([l], DATE, new Set());
    expect(pills.map((p) => [p.value, p.count])).toEqual([
      ['shop', 2],
      ['market', 0],
    ]);
    expect(pills[0]).toMatchObject({ dimensionId: 'category', dimensionLabel: 'Category' });
  });

  it('omits a dimension with no features active on the date', () => {
    const l = layer('poi', [feature('3', 'market', '2020-01-01')]);
    expect(buildToolbarPills([l], DATE, new Set())).toEqual([]);
  });

  it('ignores layers that are hidden', () => {
    const l = layer('poi', [feature('1', 'shop')]);
    expect(buildToolbarPills([l], DATE, new Set(['poi']))).toEqual([]);
  });

  it('treats a null date as "no date restriction"', () => {
    const l = layer('poi', [feature('3', 'market', '2020-01-01')]);
    expect(buildToolbarPills([l], null, new Set()).map((p) => [p.value, p.count])).toEqual([['market', 1]]);
  });
});

function pill(value: string, dimensionId = 'category'): ToolbarPill {
  return { dimensionId, dimensionLabel: dimensionId, value, count: 1 };
}

describe('splitVisiblePills', () => {
  const pills = ['a', 'b', 'c', 'd', 'e'].map((v) => pill(v));

  it('keeps everything visible when it fits', () => {
    expect(splitVisiblePills(pills, 5)).toEqual({ visible: pills, overflow: [] });
  });

  it('moves the rest into overflow, preserving order', () => {
    const { visible, overflow } = splitVisiblePills(pills, 3);
    expect(visible.map((p) => p.value)).toEqual(['a', 'b', 'c']);
    expect(overflow.map((p) => p.value)).toEqual(['d', 'e']);
  });

  it('shows a single leftover pill inline instead of a "More (1)" menu', () => {
    const { visible, overflow } = splitVisiblePills(pills, 4);
    expect(visible).toHaveLength(5);
    expect(overflow).toEqual([]);
  });

  it('clamps a negative maxVisible to zero', () => {
    expect(splitVisiblePills(pills, -2).overflow).toHaveLength(5);
  });
});

describe('countActiveIn', () => {
  it('counts pills whose value is selected in activeFilters', () => {
    const pills = [pill('a'), pill('b'), pill('c', 'other')];
    const active = { category: new Set(['b']), other: new Set(['c', 'zzz']) };
    expect(countActiveIn(pills, active)).toBe(2);
  });

  it('is 0 with no filters', () => {
    expect(countActiveIn([pill('a')], {})).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/ui/panels/toolbar-pills.test.ts`
Expected: FAIL — cannot resolve `./toolbar-pills`.

- [ ] **Step 3: Implement `toolbar-pills.ts`**

```ts
import { computeTaxonomyDimensions, type LoadedLayer } from '../../engine/taxonomy/compute-dimensions';

export interface ToolbarPill {
  dimensionId: string;
  dimensionLabel: string;
  value: string;
  // Features with this value active on the selected date; 0 renders dimmed.
  count: number;
  icons?: Record<string, string>;
  defaultIcon?: string;
}

// Every value of every dimension, in manifest order, with how many features
// carry it on `date`. `computeTaxonomyDimensions(layers, null)` lists all
// values; the dated call tells us which are active. A dimension with nothing
// active on the date is dropped entirely (e.g. a seasonal world off-season).
export function buildToolbarPills(
  layers: LoadedLayer[],
  date: Date | null,
  hiddenLayerIds: Set<string>,
): ToolbarPill[] {
  const shown = layers.filter((layer) => !hiddenLayerIds.has(layer.manifest.id));
  const activeCounts = new Map<string, Map<string, number>>();
  for (const dimension of computeTaxonomyDimensions(shown, date)) {
    activeCounts.set(dimension.id, new Map(dimension.values.map((v) => [v.value, v.count])));
  }

  const pills: ToolbarPill[] = [];
  for (const dimension of computeTaxonomyDimensions(shown, null)) {
    const counts = activeCounts.get(dimension.id);
    if (!counts || counts.size === 0) continue;
    for (const { value } of dimension.values) {
      pills.push({
        dimensionId: dimension.id,
        dimensionLabel: dimension.label,
        value,
        count: counts.get(value) ?? 0,
        icons: dimension.icons,
        defaultIcon: dimension.defaultIcon,
      });
    }
  }
  return pills;
}

export function splitVisiblePills(
  pills: ToolbarPill[],
  maxVisible: number,
): { visible: ToolbarPill[]; overflow: ToolbarPill[] } {
  const max = Math.max(0, maxVisible);
  // A "More" button holding a single pill is no saving — show that pill.
  if (pills.length - max <= 1 && max > 0) return { visible: pills, overflow: [] };
  return { visible: pills.slice(0, max), overflow: pills.slice(max) };
}

export function countActiveIn(pills: ToolbarPill[], activeFilters: Record<string, Set<string>>): number {
  return pills.filter((p) => activeFilters[p.dimensionId]?.has(p.value)).length;
}
```

Note: the `max > 0` guard keeps `maxVisible = 0` behaviour literal (everything in overflow) while still collapsing the 1-leftover case for positive limits.

- [ ] **Step 4: Run pill tests**

Run: `pnpm vitest run src/ui/panels/toolbar-pills.test.ts`
Expected: PASS (all). If the "clamps a negative maxVisible" case fails because 5 pills with max 0 satisfy `pills.length - max <= 1`, it won't: 5 - 0 = 5. Fine.

- [ ] **Step 5: Write the failing date tests**

Create `src/ui/panels/toolbar-date.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureCalendarSystemLoaded } from '../../engine/time/calendar-conversion';
import { stepMonth } from './toolbar-date';

const MIN = '2000-01-01';
const MAX = '2100-12-31';

beforeAll(async () => {
  await ensureCalendarSystemLoaded('islamic');
});

describe('stepMonth', () => {
  it('steps one gregorian month', () => {
    expect(stepMonth('2026-07-15', 'gregorian', 1, MIN, MAX)).toBe('2026-08-15');
    expect(stepMonth('2026-07-15', 'gregorian', -1, MIN, MAX)).toBe('2026-06-15');
  });

  it('rolls over year boundaries', () => {
    expect(stepMonth('2026-12-15', 'gregorian', 1, MIN, MAX)).toBe('2027-01-15');
    expect(stepMonth('2026-01-15', 'gregorian', -1, MIN, MAX)).toBe('2025-12-15');
  });

  it('keeps month-end days inside the target month (no overflow into the next)', () => {
    expect(stepMonth('2026-01-31', 'gregorian', 1, MIN, MAX)).toBe('2026-02-28');
    expect(stepMonth('2026-03-31', 'gregorian', -1, MIN, MAX)).toBe('2026-02-28');
    expect(stepMonth('2028-01-31', 'gregorian', 1, MIN, MAX)).toBe('2028-02-29');
  });

  it('clamps to the world range', () => {
    expect(stepMonth('2026-06-15', 'gregorian', 1, '2026-01-01', '2026-06-20')).toBe('2026-06-20');
    expect(stepMonth('2026-01-10', 'gregorian', -1, '2026-01-01', '2026-06-20')).toBe('2026-01-01');
  });

  it('returns the input unchanged when already at the range edge', () => {
    expect(stepMonth('2026-06-20', 'gregorian', 1, '2026-01-01', '2026-06-20')).toBe('2026-06-20');
  });

  it('steps by a calendar-aware month for non-gregorian systems', () => {
    expect(stepMonth('2026-07-29', 'islamic', 1, MIN, MAX)).toBe('2026-08-27');
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `pnpm vitest run src/ui/panels/toolbar-date.test.ts`
Expected: FAIL — cannot resolve `./toolbar-date`.

- [ ] **Step 7: Implement `toolbar-date.ts`**

```ts
import type { CalendarSystem } from '../../engine/time/calendar-systems';
import {
  calendarPartsToIso,
  daysInCalendarMonth,
  monthsInCalendarYear,
  toCalendarParts,
} from '../../engine/time/calendar-conversion';
import { clampDateToRange } from './CalendarBar';

// One calendar month forward/back in the given system, keeping the day of
// month where possible (Jan 31 + 1 -> Feb 28/29) and clamping to the world's
// date range. Unlike `nextSelectedDate`, never overflows into the month after.
export function stepMonth(iso: string, system: CalendarSystem, direction: 1 | -1, min: string, max: string): string {
  const { year, month, day } = toCalendarParts(iso, system);
  let nextYear = year;
  let nextMonth = month + direction;
  if (nextMonth < 1) {
    nextYear -= 1;
    nextMonth = monthsInCalendarYear(nextYear, system);
  } else if (nextMonth > monthsInCalendarYear(year, system)) {
    nextYear += 1;
    nextMonth = 1;
  }
  const nextDay = Math.min(day, daysInCalendarMonth(nextYear, nextMonth, system));
  const next = calendarPartsToIso({ year: nextYear, month: nextMonth, day: nextDay }, system);
  return clampDateToRange(next, min, max);
}
```

- [ ] **Step 8: Run date tests**

Run: `pnpm vitest run src/ui/panels/toolbar-date.test.ts`
Expected: PASS. If the islamic case differs from `'2026-08-27'`, compare against `nextSelectedDate('2026-07-29','month',1,'islamic')` (existing test in `CalendarBar.test.ts` expects `'2026-08-27'`); a mismatch there means the day-clamp changed the day, so fix the implementation, not the expectation.

- [ ] **Step 9: Align the spec's helper name, then commit**

In `docs/superpowers/specs/2026-10-08-map-toolbar-design.md`, replace the bullet beginning "Pills for values with zero features active ..." sentence "Helper `countByValue(layers, date, hiddenLayerIds)` returns `Record<dimensionId, Record<value, number>>`, built on the existing temporal `isActiveOn` logic." with "Helper `buildToolbarPills(layers, date, hiddenLayerIds)` returns a flat pill list with a per-value count for the date, built on `computeTaxonomyDimensions`." Also in the Testing section replace `countByValue` with `buildToolbarPills`, and in the Date chip section append "Day of month is clamped to the target month's length (`stepMonth`)."

```bash
pnpm format
git add src/ui/panels/toolbar-pills.ts src/ui/panels/toolbar-pills.test.ts src/ui/panels/toolbar-date.ts src/ui/panels/toolbar-date.test.ts docs/superpowers/specs/2026-10-08-map-toolbar-design.md
git commit -m "feat: add pure helpers for map toolbar pills and month stepping

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Strings

**Files:**

- Modify: `worlds/events-canary-islands/strings.{en,es}.json`, `worlds/moon-map-photos/strings.{en,es}.json`, `worlds/paranormal-spain/strings.{en,es}.json`, `worlds/world-leaders/strings.{en,es}.json`

**Interfaces:**

- Produces string keys used by Task 3: `toolbar.calendarLabel`, `toolbar.chooseDate`, `toolbar.prevMonth`, `toolbar.nextMonth`, `toolbar.more`, `toolbar.moreLabel`. `panel.title` becomes "Filters" / "Filtros" (the calendar leaves the drawer).

- [ ] **Step 1: Insert the keys after `filters.clearAll` in every file**

```bash
for f in worlds/*/strings.en.json; do
  sed -i '/"filters.clearAll"/a\  "toolbar.calendarLabel": "Calendar",\n  "toolbar.chooseDate": "Choose date",\n  "toolbar.prevMonth": "Previous month",\n  "toolbar.nextMonth": "Next month",\n  "toolbar.more": "More",\n  "toolbar.moreLabel": "More filters",' "$f"
  sed -i 's/"panel.title": ".*"/"panel.title": "Filters"/' "$f"
done
for f in worlds/*/strings.es.json; do
  sed -i '/"filters.clearAll"/a\  "toolbar.calendarLabel": "Calendario",\n  "toolbar.chooseDate": "Elegir fecha",\n  "toolbar.prevMonth": "Mes anterior",\n  "toolbar.nextMonth": "Mes siguiente",\n  "toolbar.more": "Más",\n  "toolbar.moreLabel": "Más filtros",' "$f"
  sed -i 's/"panel.title": ".*"/"panel.title": "Filtros"/' "$f"
done
```

`panel.title` is the last-but-few line and ends with a comma in these files; the `sed` pattern `.*"` keeps the trailing comma because `.*` is greedy only up to the last `"` on the line, and the comma follows it. Verify in the next step.

- [ ] **Step 2: Verify every file is valid JSON with the new keys**

```bash
node -e "const fs=require('fs');for(const f of fs.globSync('worlds/*/strings.*.json')){const j=JSON.parse(fs.readFileSync(f,'utf8'));for(const k of ['toolbar.calendarLabel','toolbar.chooseDate','toolbar.prevMonth','toolbar.nextMonth','toolbar.more','toolbar.moreLabel','panel.title']){if(!j[k])throw new Error(f+' missing '+k)}}console.log('ok')"
```

Expected: `ok`. If `fs.globSync` is unavailable (Node < 22), loop over `worlds/*/strings.*.json` with `ls` instead.

- [ ] **Step 3: Commit**

```bash
git add worlds
git commit -m "feat: add map toolbar UI strings (en, es)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: MapToolbar component and wiring

**Files:**

- Create: `src/ui/panels/MapToolbar.ts`
- Modify: `src/ui/panels/CalendarBar.ts` (add `onDayPicked`)
- Modify: `index.html`, `src/main.ts`, `src/styles.css`
- Delete: `src/ui/panels/FilterPills.ts`

**Interfaces:**

- Consumes: everything produced by Tasks 1–2; `mountCalendarBar`, `CalendarConfig` from `CalendarBar.ts`; `resolveTaxonomyIcon` from `src/engine/space/style.ts`; `formatCalendarDate`.
- Produces: `mountMapToolbar(container: HTMLElement, store: Store<AppState>, layers: LoadedLayer[], strings: Record<string, string>, options: { calendar: CalendarConfig; showDate: boolean }): void`.

- [ ] **Step 1: Add the `onDayPicked` callback to `CalendarBar`**

In `src/ui/panels/CalendarBar.ts`, change the signature and `selectDay`:

```ts
export function mountCalendarBar(
  container: HTMLElement,
  store: Store<AppState>,
  config: CalendarConfig,
  strings: Record<string, string>,
  layers: LoadedLayer[],
  // Called after a day is picked, so a host (the toolbar popover) can close.
  onDayPicked?: () => void,
): void {
```

```ts
function selectDay(iso: string): void {
  store.set({ selectedDate: clampDateToRange(iso, config.min, maxIso) });
  // (existing comment unchanged)
  openPanel(store, 'left');
  onDayPicked?.();
}
```

- [ ] **Step 2: Create `src/ui/panels/MapToolbar.ts`**

```ts
import type { Store, AppState } from '../../engine/state/store';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { resolveTaxonomyIcon } from '../../engine/space/style';
import { formatCalendarDate } from '../../engine/time/calendar-conversion';
import { mountCalendarBar, type CalendarConfig } from './CalendarBar';
import { buildToolbarPills, countActiveIn, splitVisiblePills, type ToolbarPill } from './toolbar-pills';
import { stepMonth } from './toolbar-date';
import { escapeHtml } from '../escape-html';
import { t } from '../strings';

const MAX_VISIBLE_DESKTOP = 6;
const MAX_VISIBLE_MOBILE = 4;

export interface MapToolbarOptions {
  calendar: CalendarConfig;
  // false for worlds with `systems.time: false` — no date chip, no calendar.
  showDate: boolean;
}

// Top-of-map bar: date chip (prev / chip -> calendar popover / next) beside
// the filter pills, with a "More" menu for pills that don't fit. The full
// filter list still lives in the right drawer (PanelRight.ts).
//
// The skeleton (date group, popover, filters area) is built once; only the
// filters area is re-rendered on store updates, so the chip, popover and the
// CalendarBar mounted inside it keep their DOM and focus.
export function mountMapToolbar(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>,
  options: MapToolbarOptions,
): void {
  const { calendar } = options;

  container.innerHTML = `
    <div class="map-toolbar__date" data-role="date">
      <button type="button" class="map-toolbar__step" data-action="prev" aria-label="${escapeHtml(t('toolbar.prevMonth', strings))}">‹</button>
      <button type="button" class="map-toolbar__chip" data-action="toggle-calendar" aria-haspopup="dialog" aria-expanded="false" aria-label="${escapeHtml(t('toolbar.chooseDate', strings))}"></button>
      <button type="button" class="map-toolbar__step" data-action="next" aria-label="${escapeHtml(t('toolbar.nextMonth', strings))}">›</button>
      <div class="map-toolbar__popover calendar-bar" data-role="popover" role="dialog" aria-label="${escapeHtml(t('toolbar.calendarLabel', strings))}" hidden></div>
    </div>
    <div class="map-toolbar__filters" data-role="filters"></div>
  `;

  const dateEl = container.querySelector<HTMLElement>('[data-role="date"]')!;
  const prevBtn = container.querySelector<HTMLButtonElement>('[data-action="prev"]')!;
  const nextBtn = container.querySelector<HTMLButtonElement>('[data-action="next"]')!;
  const chip = container.querySelector<HTMLButtonElement>('[data-action="toggle-calendar"]')!;
  const popover = container.querySelector<HTMLElement>('[data-role="popover"]')!;
  const filtersEl = container.querySelector<HTMLElement>('[data-role="filters"]')!;

  const desktop = window.matchMedia('(min-width: 48rem)');

  // UI-only state, kept in this closure like PanelRight's open sections.
  let calendarOpen = false;
  let moreOpen = false;
  let hasPills = false;

  function updateVisibility(): void {
    container.hidden = !options.showDate && !hasPills;
  }

  // ---- date group -------------------------------------------------------

  function setCalendarOpen(open: boolean, restoreFocus = false): void {
    calendarOpen = open;
    popover.hidden = !open;
    chip.setAttribute('aria-expanded', String(open));
    if (!open && restoreFocus) chip.focus();
  }

  function renderDate(): void {
    const state = store.get();
    chip.textContent = formatCalendarDate(state.selectedDate, state.calendarSystem);
    prevBtn.disabled =
      stepMonth(state.selectedDate, state.calendarSystem, -1, calendar.min, calendar.max) === state.selectedDate;
    nextBtn.disabled =
      stepMonth(state.selectedDate, state.calendarSystem, 1, calendar.min, calendar.max) === state.selectedDate;
  }

  function step(direction: 1 | -1): void {
    const state = store.get();
    store.set({
      selectedDate: stepMonth(state.selectedDate, state.calendarSystem, direction, calendar.min, calendar.max),
    });
  }

  if (options.showDate) {
    mountCalendarBar(popover, store, calendar, strings, layers, () => setCalendarOpen(false));
    prevBtn.addEventListener('click', () => step(-1));
    nextBtn.addEventListener('click', () => step(1));
    chip.addEventListener('click', () => {
      moreOpen = false;
      setCalendarOpen(!calendarOpen);
      renderFilters();
    });
    renderDate();
  } else {
    dateEl.hidden = true;
  }

  // ---- filter pills -----------------------------------------------------

  function renderPill(pill: ToolbarPill, activeFilters: Record<string, Set<string>>): string {
    const icon = resolveTaxonomyIcon(pill.icons, pill.defaultIcon, pill.value);
    const isActive = activeFilters[pill.dimensionId]?.has(pill.value) ?? false;
    const classes = ['filter-pill'];
    if (isActive) classes.push('is-active');
    if (pill.count === 0) classes.push('is-empty');
    return `<button type="button" class="${classes.join(' ')}" data-dimension="${escapeHtml(pill.dimensionId)}" data-value="${escapeHtml(pill.value)}" aria-pressed="${isActive}">
      ${icon ? `<span class="filter-pill__icon">${icon}</span>` : ''}
      <span>${escapeHtml(pill.value)}</span>
    </button>`;
  }

  // Consecutive pills of one dimension share a labelled group.
  function renderGroups(pills: ToolbarPill[], activeFilters: Record<string, Set<string>>): string {
    const groups: ToolbarPill[][] = [];
    for (const pill of pills) {
      const last = groups[groups.length - 1];
      if (last && last[0].dimensionId === pill.dimensionId) last.push(pill);
      else groups.push([pill]);
    }
    return groups
      .map(
        (group) => `<div class="map-toolbar__group">
          <span class="map-toolbar__label">${escapeHtml(group[0].dimensionLabel)}</span>
          ${group.map((pill) => renderPill(pill, activeFilters)).join('')}
        </div>`,
      )
      .join('');
  }

  function renderFilters(): void {
    const state = store.get();
    if (state.view !== 'map') return;
    const pills = buildToolbarPills(layers, new Date(`${state.selectedDate}T00:00:00Z`), state.hiddenLayerIds);
    hasPills = pills.length > 0;
    updateVisibility();
    if (!hasPills) {
      filtersEl.innerHTML = '';
      return;
    }

    const { visible, overflow } = splitVisiblePills(pills, desktop.matches ? MAX_VISIBLE_DESKTOP : MAX_VISIBLE_MOBILE);
    if (overflow.length === 0) moreOpen = false;
    const activeFilters = state.activeFilters;
    const hasActiveFilters = Object.values(activeFilters).some((selected) => selected.size > 0);

    const hiddenActive = countActiveIn(overflow, activeFilters);
    const more =
      overflow.length > 0
        ? `<div class="map-toolbar__more">
            <button type="button" class="filter-pill map-toolbar__more-btn${hiddenActive > 0 ? ' is-active' : ''}" data-action="toggle-more" aria-haspopup="true" aria-expanded="${moreOpen}" aria-label="${escapeHtml(t('toolbar.moreLabel', strings))}">
              <span>${escapeHtml(t('toolbar.more', strings))}</span>${hiddenActive > 0 ? `<span class="map-toolbar__badge">${hiddenActive}</span>` : ''}
            </button>
            ${moreOpen ? `<div class="map-toolbar__menu">${renderGroups(overflow, activeFilters)}</div>` : ''}
          </div>`
        : '';
    const clearAll = hasActiveFilters
      ? `<button type="button" class="filter-pill map-toolbar__clear" data-action="clear-all">${escapeHtml(t('filters.clearAll', strings))}</button>`
      : '';

    filtersEl.innerHTML = `<div class="map-toolbar__scroll">${renderGroups(visible, activeFilters)}</div>${more}${clearAll}`;
  }

  // One delegated listener — the filters area is rebuilt on every render.
  filtersEl.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'clear-all') {
      store.set({ activeFilters: {} });
      return;
    }
    if (action === 'toggle-more') {
      moreOpen = !moreOpen;
      setCalendarOpen(false);
      renderFilters();
      return;
    }
    const pill = target.closest<HTMLButtonElement>('.filter-pill[data-dimension]');
    if (!pill) return;
    const dimensionId = pill.dataset.dimension!;
    const value = pill.dataset.value!;
    const current = new Set(store.get().activeFilters[dimensionId] ?? new Set<string>());
    if (current.has(value)) current.delete(value);
    else current.add(value);
    store.set({ activeFilters: { ...store.get().activeFilters, [dimensionId]: current } });
  });

  // ---- dismissal --------------------------------------------------------

  document.addEventListener('pointerdown', (event) => {
    if (container.contains(event.target as Node)) return;
    if (!calendarOpen && !moreOpen) return;
    setCalendarOpen(false);
    moreOpen = false;
    renderFilters();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (moreOpen) {
      moreOpen = false;
      renderFilters();
    } else if (calendarOpen) {
      setCalendarOpen(false, true);
    }
  });

  desktop.addEventListener('change', renderFilters);

  renderFilters();
  updateVisibility();
  store.subscribe(() => {
    if (options.showDate) renderDate();
    renderFilters();
  });
}
```

- [ ] **Step 3: Update `index.html`**

Replace `<div id="filter-pills" class="filter-pills"></div>` with `<div id="map-toolbar" class="map-toolbar"></div>`. In the right panel, delete the calendar block and the separator that follows it, leaving filters, one separator, then actions:

```html
<div class="panel__content">
  <div id="panel-right-filters"></div>
  <div class="panel__section-separator"></div>
  <div id="panel-right-actions"></div>
</div>
```

- [ ] **Step 4: Update `src/main.ts`**

Replace the imports of `mountCalendarBar` and `mountFilterPills` with `import { mountMapToolbar } from './ui/panels/MapToolbar';`. Delete the `mountCalendarBar(...)` call and its comment line ("The calendar and map-settings both live inline…" — reword to "Map settings live inline inside the right panel."). Replace the `mountFilterPills(...)` call with:

```ts
mountMapToolbar(document.querySelector('#map-toolbar')!, store, loadedLayers, strings, {
  calendar: appManifest.calendar,
  showDate: appManifest.systems?.time !== false,
});
```

Keep it after `mountAppChrome(...)`.

- [ ] **Step 5: Replace the CSS block**

In `src/styles.css`, replace the whole "FILTER PILLS" section (from the `/* ===… FILTER PILLS` comment through the end of `.filter-pills__clear { … }`) with:

```css
/* ========================================
   MAP TOOLBAR — top-of-map date chip (prev / chip -> calendar popover /
   next) beside the filter pills and their "More" overflow menu.
   ======================================== */
.map-toolbar {
  position: absolute;
  /* Same top offset and height as the search / panel-toggle circular
     buttons, inset past them on both sides, so the bar sits in the same band
     as those two icons. */
  top: var(--control-btn-offset);
  left: calc(var(--control-btn-offset) + var(--control-btn-size) + var(--controls-gap));
  right: calc(var(--control-btn-offset) + var(--control-btn-size) + var(--controls-gap));
  z-index: var(--z-fixed);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  min-height: var(--control-btn-size);
  pointer-events: none;
}
.map-toolbar[hidden] {
  display: none;
}
.map-toolbar__date,
.map-toolbar__filters {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 100%;
  pointer-events: auto;
}
.map-toolbar__date {
  position: relative;
}
.map-toolbar__date[hidden] {
  display: none;
}
.map-toolbar__step,
.map-toolbar__chip {
  border: 1px solid var(--color-border);
  background: var(--color-white);
  color: var(--color-text);
  box-shadow: var(--shadow-md);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  white-space: nowrap;
}
.map-toolbar__step {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  padding: 0;
}
.map-toolbar__step:disabled {
  opacity: 0.4;
  cursor: default;
}
.map-toolbar__chip {
  border-radius: var(--radius-full);
  padding: 0.3rem 0.8rem;
  font-variant-numeric: tabular-nums;
}
.map-toolbar__chip::after {
  content: ' ▾';
}
.map-toolbar__popover {
  position: absolute;
  top: calc(100% + 0.4rem);
  left: 50%;
  transform: translateX(-50%);
  width: 20rem;
  max-width: calc(100vw - 2 * var(--control-btn-offset));
  padding: 0.75rem;
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}
.map-toolbar__popover[hidden] {
  display: none;
}
.map-toolbar__popover .settings-control-group__title {
  display: none;
}
.map-toolbar__scroll {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  overflow-x: auto;
}
.map-toolbar__group {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.map-toolbar__label {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-light);
  text-shadow: 0 1px 2px var(--color-white);
}
.map-toolbar__more {
  position: relative;
  flex-shrink: 0;
}
.map-toolbar__menu {
  position: absolute;
  top: calc(100% + 0.4rem);
  right: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  max-width: calc(100vw - 2 * var(--control-btn-offset));
  max-height: 60vh;
  overflow-y: auto;
  padding: 0.6rem;
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}
.map-toolbar__menu .map-toolbar__group {
  flex-wrap: wrap;
}
.map-toolbar__badge {
  margin-left: 0.3rem;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}
.filter-pill {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--color-border);
  background: var(--color-white);
  border-radius: var(--radius-full);
  padding: 0.3rem 0.7rem;
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  color: var(--color-text);
  box-shadow: var(--shadow-md);
  white-space: nowrap;
}
.filter-pill.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-white);
}
/* No features with this value on the selected date — still clickable. */
.filter-pill.is-empty:not(.is-active) {
  opacity: 0.5;
}
.map-toolbar__clear {
  flex-shrink: 0;
}
@media (max-width: 47.99rem) {
  .map-toolbar__label {
    display: none;
  }
  .map-toolbar__filters {
    flex-wrap: wrap;
    justify-content: center;
  }
  .map-toolbar__popover {
    position: fixed;
    top: calc(var(--control-btn-offset) + var(--control-btn-size) + 2.75rem);
    left: var(--control-btn-offset);
    right: var(--control-btn-offset);
    width: auto;
    max-width: none;
    transform: none;
  }
}
@media (min-width: 48rem) {
  .map-toolbar {
    flex-direction: row;
    justify-content: center;
    align-items: flex-start;
    gap: 0.75rem;
  }
}
```

Then in the HOME VIEW block change `.map-app.view-home .filter-pills,` to `.map-app.view-home .map-toolbar,`.

- [ ] **Step 6: Delete the old component**

```bash
git rm src/ui/panels/FilterPills.ts
```

- [ ] **Step 7: Typecheck, lint, test**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass. Fix any unused-import errors (e.g. `openPanel` is still used by `CalendarBar`).

- [ ] **Step 8: Manual browser verification**

Run `pnpm dev` and open each of: `/` (world-leaders), `/paranormal-spain/`, `/events-canary-islands/`, `/moon-map-photos/`, at desktop width and at ~375px. Check, and fix CSS if any fail:

1. Toolbar visible in every world that has filter dimensions; date group absent in a no-time world.
2. world-leaders shows 6 pills (4 on mobile) plus "More"; More menu opens, toggles filters, shows a badge when a hidden pill is active; "Clear all filters" appears and clears.
3. Prev/next change the chip text and the map; buttons disable at the world's min/max.
4. Chip opens the calendar popover; picking a day closes it and opens the left agenda; outside click and Escape close it (Escape returns focus to the chip).
5. Popover and More menu stay inside the viewport at 375px (tune `.map-toolbar__popover` `top` on mobile if it overlaps the pills).
6. Right drawer still opens, holds filters + settings + plugin slot, and Escape closes it.
7. Home view hides the toolbar.

- [ ] **Step 9: Commit**

```bash
pnpm format
git add -A
git commit -m "feat: add MapToolbar with date chip, calendar popover and pill overflow

Replaces FilterPills and moves the calendar out of the right drawer.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Cleanup and docs

**Files:**

- Modify: `src/ui/app-chrome.ts`, `index.html`, `src/styles.css`, `CHANGELOG.md`, `docs/api-reference.md`

- [ ] **Step 1: Remove the footer date text**

In `src/ui/app-chrome.ts` delete `mountDateText`, its call in `mountAppChrome`, the `formatCalendarDate` import, and update the doc comment of `mountAppChrome` if it mentions the date. In `index.html` delete `<span class="map-date-text" id="map-date-text"></span>`. In `src/styles.css` delete the `.map-date-text` rules (base, `:not(:empty)::after`, and the one inside `@media (min-width: 48rem)`).

- [ ] **Step 2: Remove stale `no-time` and drawer-calendar CSS**

Find leftovers:

Run: `grep -rn "panel-right-time\|map-date-text\|filter-pills" src index.html docs README.md`

In `src/styles.css`, delete the `.map-app.no-time #panel-right-time, .map-app.no-time .map-footer-legend .map-date-text { display: none; }` rule and the `.map-app.no-time .panel__section-separator:has(+ #panel-right-map-settings)` rule with its comment (the toolbar hides its own date group via `showDate`). Update any remaining doc references (`README.md`, `docs/api-reference.md`) from `FilterPills`/footer date to `MapToolbar`.

- [ ] **Step 3: Changelog**

Add an entry at the top of the unreleased/latest section of `CHANGELOG.md` following its existing format: "Map toolbar: date chip with prev/next and calendar popover, filter pills in every world with a 'More' overflow menu and dimmed zero-result pills; the calendar moved out of the right drawer."

- [ ] **Step 4: Final verification**

Run: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`
Expected: all pass. Re-run the manual checks from Task 3 Step 8 (items 1, 3, 6 especially, plus a no-time world if one exists, confirming no leftover empty separator in the drawer).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove footer date text and stale toolbar-era CSS, update docs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
