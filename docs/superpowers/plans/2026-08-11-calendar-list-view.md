# Calendar list/agenda view Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5th "List" tab to the existing Calendar view (`src/ui/panels/CalendarView.ts`), showing a scrollable, date-grouped agenda from the currently selected date through the world's `calendar.max`.

**Architecture:** A new engine function `getFeaturesInRange` (day-by-day loop, same shape as the existing `calendar-grid.ts` helpers) groups matching features by date. The UI layer adds `'list'` as a `Granularity` value used only inside `CalendarView.ts`'s own tab list — the shared `getVisibleGranularityOptions()` (also used by the unrelated compact date-stepper in `CalendarBar.ts`) is left untouched.

**Tech Stack:** TypeScript, Vite, Vitest (`environment: 'node'`, no jsdom — DOM-touching code is verified manually, not via automated test).

## Global Constraints

- No manifest/`world.json` changes — the list tab is always available, same as day/week/month/year (per spec).
- Reuse the exact existing `calendar-view__agenda`/`calendar-view__agenda-item` markup and CSS classes for each date's entries — no new item-level markup (per spec).
- `getFeaturesInRange` must not add RRULE occurrence-enumeration; reuse `getFeaturesOnDate`'s existing per-day `isActiveOn` check (per spec).
- `calendar.granularity.list` string value is `"List"` in all 4 worlds' `strings.json` (per spec — matches the existing convention that structural labels stay English even in Spanish-content worlds).

---

### Task 1: `getFeaturesInRange` engine function

**Files:**
- Modify: `src/engine/time/day-agenda.ts`
- Test: `src/engine/time/day-agenda.test.ts`

**Interfaces:**
- Consumes: existing `getFeaturesOnDate(layers, activeFilters, iso)` (same file), `LoadedLayer` (`src/engine/taxonomy/compute-dimensions.ts`).
- Produces: `export interface DayAgendaGroup { iso: string; entries: DayAgendaEntry[] }` and `export function getFeaturesInRange(layers: LoadedLayer[], activeFilters: Record<string, Set<string>>, fromIso: string, toIso: string): DayAgendaGroup[]` — Task 2 imports both.

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/time/day-agenda.test.ts` (reuses the existing `layerWithEventOn` helper already defined in that file):

```ts
import { getFeaturesInRange } from './day-agenda';

describe('getFeaturesInRange', () => {
  it('groups a feature under its own date, within range', () => {
    const groups = getFeaturesInRange([layerWithEventOn('2026-07-30')], {}, '2026-07-29', '2026-07-31');
    expect(groups).toEqual([{ iso: '2026-07-30', entries: expect.any(Array) }]);
    expect(groups[0].entries.length).toBe(1);
    expect(groups[0].entries[0].feature.properties.name).toBe('Volcano eruption');
  });

  it('excludes a feature outside the [fromIso, toIso] range', () => {
    const groups = getFeaturesInRange([layerWithEventOn('2026-07-30')], {}, '2026-08-01', '2026-08-31');
    expect(groups).toEqual([]);
  });

  it('includes features on the range boundaries themselves', () => {
    const fromGroups = getFeaturesInRange([layerWithEventOn('2026-07-30')], {}, '2026-07-30', '2026-07-30');
    expect(fromGroups.length).toBe(1);
  });

  it('omits dates with no matching entries', () => {
    const groups = getFeaturesInRange([layerWithEventOn('2026-07-30')], {}, '2026-07-28', '2026-08-01');
    expect(groups.length).toBe(1);
    expect(groups[0].iso).toBe('2026-07-30');
  });

  it('respects activeFilters', () => {
    const layer = layerWithEventOn('2026-07-30');
    layer.manifest = {
      ...layer.manifest,
      taxonomy: [{ id: 'category', label: 'Category', field: 'properties.category' }],
    };
    layer.features[0].properties.category = 'shop';
    const groups = getFeaturesInRange([layer], { category: new Set(['market']) }, '2026-07-29', '2026-07-31');
    expect(groups).toEqual([]);
  });

  it('includes a recurring feature once per matching occurrence in range', () => {
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
    // 2026-08-03 and 2026-08-10 are Mondays.
    const groups = getFeaturesInRange([layer], {}, '2026-08-01', '2026-08-11');
    expect(groups.map((g) => g.iso)).toEqual(['2026-08-03', '2026-08-10']);
  });
});
```

`LayerManifest` and `LoadedLayer` are already imported at the top of this test file for the existing tests — no new imports needed for those two types.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/time/day-agenda.test.ts`
Expected: FAIL — `getFeaturesInRange is not a function` (or a TS error that the export doesn't exist).

- [ ] **Step 3: Write minimal implementation**

In `src/engine/time/day-agenda.ts`, add below the existing `DayAgendaEntry` interface and above `getFeaturesOnDate`:

```ts
export interface DayAgendaGroup {
  iso: string;
  entries: DayAgendaEntry[];
}

// Same duplicated-five-line-helper convention calendar-grid.ts already uses
// for addDays (engine/ files don't import UI-adjacent date helpers across
// modules for a single-purpose one-liner).
function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
```

Then, below `getFeaturesOnDate`:

```ts
// Day-by-day scan reusing getFeaturesOnDate's own per-feature isActiveOn
// check — no RRULE occurrence enumeration. Realistic calendar.max ranges
// (all current worlds are single-digit years wide) keep this cheap; dates
// with zero matches are omitted rather than returned as empty groups.
export function getFeaturesInRange(
  layers: LoadedLayer[],
  activeFilters: Record<string, Set<string>>,
  fromIso: string,
  toIso: string,
): DayAgendaGroup[] {
  const groups: DayAgendaGroup[] = [];
  let iso = fromIso;
  while (iso <= toIso) {
    const entries = getFeaturesOnDate(layers, activeFilters, iso);
    if (entries.length > 0) groups.push({ iso, entries });
    iso = addDays(iso, 1);
  }
  return groups;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/time/day-agenda.test.ts`
Expected: PASS, all tests including the pre-existing ones for `getFeaturesOnDate`.

- [ ] **Step 5: Commit**

```bash
git add src/engine/time/day-agenda.ts src/engine/time/day-agenda.test.ts
git commit -m "feat: add getFeaturesInRange for calendar list/agenda view"
```

---

### Task 2: List tab in `CalendarView.ts` + strings + CSS

**Files:**
- Modify: `src/ui/panels/CalendarBar.ts` (Granularity type only)
- Modify: `src/ui/panels/CalendarView.ts`
- Modify: `src/styles.css`
- Modify: `worlds/demo/strings.json`, `worlds/events-canary-islands/strings.json`, `worlds/moon-map-photos/strings.json`, `worlds/paranormal-spain/strings.json`

**Interfaces:**
- Consumes: `getFeaturesInRange`, `DayAgendaGroup` from Task 1 (`src/engine/time/day-agenda.ts`).
- Produces: nothing consumed by later tasks — this is the last task in this plan.

- [ ] **Step 1: Widen the `Granularity` type**

In `src/ui/panels/CalendarBar.ts`, change:

```ts
export type Granularity = 'day' | 'week' | 'month' | 'year';
```

to:

```ts
export type Granularity = 'day' | 'week' | 'month' | 'year' | 'list';
```

Leave `getVisibleGranularityOptions` exactly as-is (still returns only the 4 base values) — it's shared with `mountCalendarBar`'s own compact date-stepper, which has no step behavior for `'list'` and must not offer it. `nextSelectedDate`'s `switch (granularity)` has no `'list'` case and no `default`; this is intentional and harmless (returns the date unchanged), since Task 2's Step 4 hides the step buttons entirely whenever `granularity === 'list'`.

- [ ] **Step 2: Add strings**

Add `"calendar.granularity.list": "List",` to each of these 4 files, alongside the existing `calendar.granularity.day/week/month/year` keys:
- `worlds/demo/strings.json`
- `worlds/events-canary-islands/strings.json`
- `worlds/moon-map-photos/strings.json`
- `worlds/paranormal-spain/strings.json`

- [ ] **Step 3: Add CSS for the list view's date headings**

In `src/styles.css`, immediately after the existing `.calendar-view__agenda-empty` rule (currently the last `.calendar-view__*` rule before the `CALENDAR GRID` section comment), add:

```css
.calendar-view__list-date {
  font-weight: var(--font-weight-semibold);
  margin: 1rem 0 0.4rem;
}
.calendar-view__list-date:first-child {
  margin-top: 0;
}
```

- [ ] **Step 4: Wire the list tab into `CalendarView.ts`**

In `src/ui/panels/CalendarView.ts`:

1. Add the import at the top, alongside the existing `getFeaturesOnDate` import:

```ts
import { getFeaturesOnDate, getFeaturesInRange } from '../../engine/time/day-agenda';
```

2. Extract the day view's agenda-item markup into a shared module-level function (used by both the day branch and the new list branch), placed near `renderYearMonth` (both are module-level render helpers):

```ts
// Shared by the day view's single-day agenda and the list view's per-date
// groups — same calendar-view__agenda/-item markup either way.
function renderAgendaList(entries: import('../../engine/time/day-agenda').DayAgendaEntry[], strings: Record<string, string>): string {
  return `<ul class="calendar-view__agenda">${entries
    .map(
      (entry) => `<li class="calendar-view__agenda-item">
        <span class="calendar-view__agenda-layer">${escapeHtml(entry.layerTitle)}</span>
        <span class="calendar-view__agenda-name">${escapeHtml(featureLabel(entry.feature, strings))}</span>
        <button type="button" class="calendar-view__agenda-view-btn" data-feature-id="${escapeHtml(String(entry.feature.id ?? ''))}">${escapeHtml(t('calendarView.viewOnMap', strings))}</button>
      </li>`,
    )
    .join('')}</ul>`;
}
```

(If a top-level named type import reads awkwardly, add `import type { DayAgendaEntry } from '../../engine/time/day-agenda';` at the top instead and use `DayAgendaEntry` directly in the signature — either is fine, prefer the top-level import for consistency with the rest of the file's import style.)

3. Replace the existing day-branch body inside `render()`:

```ts
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
```

with:

```ts
if (granularity === 'day') {
  const entries = getFeaturesOnDate(visibleLayers, state.activeFilters, state.selectedDate);
  bodyHtml = entries.length
    ? renderAgendaList(entries, strings)
    : `<p class="calendar-view__agenda-empty">${escapeHtml(t('calendarView.noEvents', strings))}</p>`;
} else if (granularity === 'list') {
  const groups = getFeaturesInRange(visibleLayers, state.activeFilters, state.selectedDate, maxIso);
  bodyHtml = groups.length
    ? groups
        .map(
          (group) =>
            `<div class="calendar-view__list-date">${escapeHtml(formatCalendarDate(group.iso, system))}</div>${renderAgendaList(group.entries, strings)}`,
        )
        .join('')
    : `<p class="calendar-view__agenda-empty">${escapeHtml(t('calendarView.noEvents', strings))}</p>`;
} else if (granularity === 'year') {
```

4. Update the tab list. Replace:

```ts
const tabsHtml = getVisibleGranularityOptions(system)
  .map(
    (g) =>
      `<button type="button" class="calendar-view__tab${g === granularity ? ' is-active' : ''}" data-granularity="${g}">${escapeHtml(t(`calendar.granularity.${g}`, strings))}</button>`,
  )
  .join('');
```

with:

```ts
const tabOptions: Granularity[] = [...getVisibleGranularityOptions(system), 'list'];
const tabsHtml = tabOptions
  .map(
    (g) =>
      `<button type="button" class="calendar-view__tab${g === granularity ? ' is-active' : ''}" data-granularity="${g}">${escapeHtml(t(`calendar.granularity.${g}`, strings))}</button>`,
  )
  .join('');
```

5. Hide the prev/period/next nav row entirely when `granularity === 'list'` (it has no fixed "current period" to page through — the list is anchored by `state.selectedDate`, changed from elsewhere). Replace the `container.innerHTML` template's nav block. Currently:

```ts
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
```

Replace with:

```ts
    const navHtml =
      granularity === 'list'
        ? ''
        : `<div class="calendar-view__nav">
          <button type="button" class="calendar-bar__step-btn" data-action="prev" aria-label="Step back">‹</button>
          <span class="calendar-view__period">${escapeHtml(periodLabel(state.selectedDate, system))}</span>
          <button type="button" class="calendar-bar__step-btn" data-action="next" aria-label="Step forward">›</button>
        </div>`;

    container.innerHTML = `
      <div class="calendar-view__header">
        <div class="calendar-view__tabs">${tabsHtml}</div>
        ${navHtml}
      </div>
      <div class="calendar-view__body">${bodyHtml}</div>
    `;

    container.querySelectorAll<HTMLButtonElement>('[data-granularity]').forEach((button) => {
      button.addEventListener('click', () => {
        granularity = button.dataset.granularity as Granularity;
        render();
      });
    });
    container.querySelector('[data-action="prev"]')?.addEventListener('click', () => step(-1));
    container.querySelector('[data-action="next"]')?.addEventListener('click', () => step(1));
```

(Note the `?.` on the last two listeners — the nav buttons don't exist in the DOM when `granularity === 'list'`, so the previous `!.` non-null assertion would throw.)

6. Extend the "View on map" click wiring to also cover the list view (it renders the same `[data-feature-id]` buttons). Replace:

```ts
    if (granularity === 'day') {
      container.querySelectorAll<HTMLButtonElement>('[data-feature-id]').forEach((button) => {
```

with:

```ts
    if (granularity === 'day' || granularity === 'list') {
      container.querySelectorAll<HTMLButtonElement>('[data-feature-id]').forEach((button) => {
```

(the rest of that block is unchanged).

- [ ] **Step 5: Run full verification**

Run, in order:
- `npx vitest run` — expect all tests pass (including Task 1's new tests).
- `npx tsc --noEmit` — expect no errors.
- `npx eslint .` — expect no errors.
- `npx prettier --check .` — expect clean; if it flags files, run `npx prettier --write .` and re-check.

- [ ] **Step 6: Manual verification via dev server**

Start `npx vite --port 5201` (or any free port), then use the Playwright tools:
1. Navigate to `http://localhost:5201/?world=events-canary-islands` (has real dated events).
2. Open the Calendar view, click the "List" tab.
3. Confirm date headings + agenda entries render, grouped and in ascending date order from the currently selected date onward.
4. Click a "View on map" button on a list entry; confirm it switches to Map view with that feature's info panel open (same behavior as the day view's existing button).
5. Step the selected date (via day/month/year tab) to a date after the world's last event, then switch back to List; confirm the empty state message renders.
6. Check `browser_console_messages` for zero errors/warnings.
7. Repeat steps 2-3 on `?world=demo` (recurring events, if any) to sanity-check the recurrence path.
8. Take one screenshot for your own confirmation, then delete it — do not leave scratch screenshots in the repo.
9. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/ui/panels/CalendarBar.ts src/ui/panels/CalendarView.ts src/styles.css worlds/demo/strings.json worlds/events-canary-islands/strings.json worlds/moon-map-photos/strings.json worlds/paranormal-spain/strings.json
git commit -m "feat: add List tab to Calendar view"
```

---

## Self-Review Notes

- **Spec coverage:** engine function (Task 1) ✓, UI tab + rendering + nav hiding (Task 2 Steps 1/4) ✓, strings (Task 2 Step 2) ✓, styling (Task 2 Step 3) ✓, verification commands + manual Playwright check (Task 2 Steps 5-6) ✓. The spec's `getVisibleGranularityOptions` wording was corrected in the spec doc itself before this plan was written (see spec's Task-2-relevant paragraph) to avoid leaking `'list'` into the unrelated compact date-stepper.
- **Type consistency:** `DayAgendaGroup`/`getFeaturesInRange` signatures match between Task 1's implementation and Task 2's usage. `Granularity` widened in `CalendarBar.ts` (Task 2 Step 1) before any code referencing `'list'` as a `Granularity` value is written (Task 2 Step 4), so no forward-reference issue.
- **No placeholders:** all steps contain literal code, not descriptions of code.
