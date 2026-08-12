import type { Store, AppState } from '../../engine/state/store';
import type { CalendarSystem } from '../../engine/time/calendar-systems';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { addCalendarUnit, toCalendarParts } from '../../engine/time/calendar-conversion';
import { buildYearMonthCells } from '../../engine/time/calendar-grid';
import { renderCalendarGrid } from './CalendarGrid';
import { t } from '../strings';
import { escapeHtml } from '../escape-html';

export interface CalendarConfig {
  system?: CalendarSystem;
  default: string;
  min: string;
  max: string;
}

// 'day'/'week' stay part of the type (nextSelectedDate still steps by
// either) even though no UI currently exposes them as a pickable
// granularity — the compact filters-panel widget below only offers
// month/year, and the full-screen Calendar view (CalendarView.ts) only
// offers list/year.
export type Granularity = 'day' | 'week' | 'month' | 'year' | 'list';

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function nextSelectedDate(
  currentIso: string,
  granularity: Granularity,
  direction: 1 | -1,
  system: CalendarSystem,
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

export function clampDateToRange(iso: string, min: string, max: string): string {
  const startOffset = daysBetween(min, iso);
  const endOffset = daysBetween(iso, max);
  if (startOffset < 0) return min;
  if (endOffset < 0) return max;
  return iso;
}

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// One mini-month (title + weekday header + day cells), for the year
// granularity's stacked list of 12 (13 for a Hebrew leap year) months.
// Same cell markup/classes as CalendarGrid.ts's renderCalendarGrid, kept
// separate rather than shared — CalendarView.ts's renderYearMonth makes the
// identical call (see its comment): reusing a single-cell renderer across
// files for ~10 lines of markup isn't worth the coupling.
function renderYearMonth(
  group: {
    iso: string;
    month: number;
    cells: { iso: string; day: number; inCurrentPeriod: boolean; hasEvents: boolean }[];
  },
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

  return `<div class="calendar-bar__year-month">
    <p class="calendar-bar__year-month-title">${escapeHtml(monthName)}</p>
    <div class="calendar-grid">${weekdayHeader}${cellsHtml}</div>
  </div>`;
}

export function mountCalendarBar(
  container: HTMLElement,
  store: Store<AppState>,
  config: CalendarConfig,
  strings: Record<string, string>,
  layers: LoadedLayer[],
): void {
  const maxIso = config.max;

  // Fixed month/year — day/week browsing lives in the left panel instead
  // (SearchOverlay.ts's day agenda, always reflecting store.selectedDate),
  // so this widget only needs to pick a month or jump by year.
  const GRANULARITIES: ReadonlyArray<'month' | 'year'> = ['month', 'year'];
  const granularityOptions = GRANULARITIES.map(
    (g) => `<option value="${g}">${escapeHtml(t(`calendar.granularity.${g}`, strings))}</option>`,
  ).join('');

  // Lives inline inside the filters panel — always visible, no toggle of
  // its own. No numeric year/month/day fields and no slider — the plain
  // selected-date text already lives elsewhere (app-chrome.ts's
  // #map-date-text, the map's own always-visible date indicator). This is
  // a browsable day list instead: month lists that month's days, year
  // lists every month. Picking a day here also drives the left panel's day
  // agenda (SearchOverlay.ts), which just reads store.selectedDate. The
  // calendar-system select lives in SettingsControl.ts, not here —
  // CalendarBar only reads store.calendarSystem.
  container.innerHTML = `
    <p class="settings-control-group__title">${t('layerControl.time', strings)}</p>
    <div class="calendar-bar__controls">
      <div class="calendar-bar__row calendar-bar__row--granularity">
        <button type="button" class="calendar-bar__step-btn" data-action="step-prev" aria-label="Step back">‹</button>
        <select data-role="granularity">${granularityOptions}</select>
        <button type="button" class="calendar-bar__step-btn" data-action="step-next" aria-label="Step forward">›</button>
      </div>
      <div class="calendar-bar__grid" data-role="grid"></div>
    </div>
  `;

  const gridEl = container.querySelector<HTMLElement>('[data-role="grid"]')!;
  const granularitySelect = container.querySelector<HTMLSelectElement>('[data-role="granularity"]')!;

  // UI-only, doesn't need to survive a reload or be shared with other
  // panels — kept in this closure the same way PanelRight.ts keeps its
  // open-section state.
  let granularity: 'month' | 'year' = 'month';
  granularitySelect.value = granularity;
  granularitySelect.addEventListener('change', () => {
    granularity = granularitySelect.value as 'month' | 'year';
    render();
  });

  function step(direction: 1 | -1): void {
    const state = store.get();
    const next = clampDateToRange(
      nextSelectedDate(state.selectedDate, granularity, direction, state.calendarSystem),
      config.min,
      maxIso,
    );
    store.set({ selectedDate: next });
  }
  container.querySelector('[data-action="step-prev"]')!.addEventListener('click', () => step(-1));
  container.querySelector('[data-action="step-next"]')!.addEventListener('click', () => step(1));

  function selectDay(iso: string): void {
    store.set({ selectedDate: clampDateToRange(iso, config.min, maxIso) });
  }

  function render(): void {
    const state = store.get();
    const system = state.calendarSystem;
    const visibleLayers = layers.filter((layer) => !state.hiddenLayerIds.has(layer.manifest.id));

    if (granularity === 'year') {
      const groups = buildYearMonthCells(state.selectedDate, system, visibleLayers, state.activeFilters);
      gridEl.className = 'calendar-bar__grid calendar-bar__year';
      gridEl.innerHTML = groups
        .map((g) => renderYearMonth(g, system, state.selectedDate, config.min, maxIso, strings))
        .join('');
      gridEl.querySelectorAll<HTMLButtonElement>('[data-iso]:not([disabled])').forEach((button) => {
        button.addEventListener('click', () => selectDay(button.dataset.iso!));
      });
      return;
    }

    renderCalendarGrid(gridEl, {
      granularity: 'month',
      selectedIso: state.selectedDate,
      system,
      layers: visibleLayers,
      activeFilters: state.activeFilters,
      strings,
      min: config.min,
      max: maxIso,
      onSelectDay: selectDay,
    });
  }

  render();
  store.subscribe(render);
}
