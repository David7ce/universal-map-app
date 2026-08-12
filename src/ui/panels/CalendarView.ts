import type { Store, AppState } from '../../engine/state/store';
import type { CalendarSystem } from '../../engine/time/calendar-systems';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { buildYearMonthCells, type CalendarGridMonthGroup } from '../../engine/time/calendar-grid';
import { getFeaturesInRange } from '../../engine/time/day-agenda';
import type { DayAgendaEntry } from '../../engine/time/day-agenda';
import { toCalendarParts, formatCalendarDate } from '../../engine/time/calendar-conversion';
import type { CalendarConfig } from './CalendarBar';
import { clampDateToRange, nextSelectedDate } from './CalendarBar';
import { featureLabel } from './SearchOverlay';
import { t } from '../strings';
import { escapeHtml } from '../escape-html';

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

type CalendarViewGranularity = 'list' | 'year';

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

// Shared by the list view's per-date groups — same
// calendar-view__agenda/-item markup regardless of which date it's for.
function renderAgendaList(entries: DayAgendaEntry[], strings: Record<string, string>): string {
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

export function mountCalendarView(
  container: HTMLElement,
  store: Store<AppState>,
  config: CalendarConfig,
  strings: Record<string, string>,
  layers: LoadedLayer[],
): void {
  const maxIso = config.max;

  // Only list/year — day/week/month browsing lives in the left panel (day
  // agenda) and the compact filters-panel widget (month grid) instead, so
  // this full-screen view doesn't duplicate them. List is the primary tab:
  // a chronological read of everything from the selected date onward.
  const TAB_OPTIONS: CalendarViewGranularity[] = ['list', 'year'];
  let granularity: CalendarViewGranularity = 'list';

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
    if (store.get().view !== 'calendar') return;
    const state = store.get();
    const visibleLayers = layers.filter((layer) => !state.hiddenLayerIds.has(layer.manifest.id));
    const system = state.calendarSystem;

    const tabsHtml = TAB_OPTIONS.map(
      (g) =>
        `<button type="button" class="calendar-view__tab${g === granularity ? ' is-active' : ''}" data-granularity="${g}">${escapeHtml(t(`calendar.granularity.${g}`, strings))}</button>`,
    ).join('');

    let bodyHtml: string;
    if (granularity === 'list') {
      const groups = getFeaturesInRange(visibleLayers, state.activeFilters, state.selectedDate, maxIso);
      bodyHtml = groups.length
        ? groups
            .map(
              (group) =>
                `<div class="calendar-view__list-date">${escapeHtml(formatCalendarDate(group.iso, system))}</div>${renderAgendaList(group.entries, strings)}`,
            )
            .join('')
        : `<p class="calendar-view__agenda-empty">${escapeHtml(t('calendarView.noEvents', strings))}</p>`;
    } else {
      const groups = buildYearMonthCells(state.selectedDate, system, visibleLayers, state.activeFilters);
      bodyHtml = `<div class="calendar-view__year">${groups
        .map((g) => renderYearMonth(g, system, state.selectedDate, config.min, maxIso, strings))
        .join('')}</div>`;
    }

    const navHtml =
      granularity === 'list'
        ? ''
        : `<div class="calendar-view__nav">
          <button type="button" class="calendar-bar__step-btn" data-action="prev" aria-label="Step back">‹</button>
          <span class="calendar-view__period">${escapeHtml(String(toCalendarParts(state.selectedDate, system).year))}</span>
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
        granularity = button.dataset.granularity as CalendarViewGranularity;
        render();
      });
    });
    container.querySelector('[data-action="prev"]')?.addEventListener('click', () => step(-1));
    container.querySelector('[data-action="next"]')?.addEventListener('click', () => step(1));

    if (granularity === 'year') {
      container
        .querySelectorAll<HTMLButtonElement>('.calendar-view__year [data-iso]:not([disabled])')
        .forEach((button) => {
          button.addEventListener('click', () => {
            granularity = 'list';
            store.set({ selectedDate: clampDateToRange(button.dataset.iso!, config.min, maxIso) });
            render();
          });
        });
    }

    if (granularity === 'list') {
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
