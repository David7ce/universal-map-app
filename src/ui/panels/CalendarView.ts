import type { Store, AppState } from '../../engine/state/store';
import type { CalendarSystem } from '../../engine/time/calendar-systems';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { buildYearMonthCells, type CalendarGridMonthGroup } from '../../engine/time/calendar-grid';
import { getFeaturesOnDate, getFeaturesInRange } from '../../engine/time/day-agenda';
import type { DayAgendaEntry } from '../../engine/time/day-agenda';
import { toCalendarParts, formatCalendarDate } from '../../engine/time/calendar-conversion';
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

// Shared by the day view's single-day agenda and the list view's per-date
// groups — same calendar-view__agenda/-item markup either way.
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

  // Own granularity state, independent of CalendarBar.ts's — this view
  // defaults to 'month' (a typical calendar app's default), while the
  // compact filters-panel spinner keeps defaulting to 'day'.
  let granularity: Granularity = 'month';

  function periodLabel(selectedIso: string, system: CalendarSystem): string {
    if (granularity === 'day') return formatCalendarDate(selectedIso, system);
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
    if (store.get().view !== 'calendar') return;
    const state = store.get();
    const visibleLayers = layers.filter((layer) => !state.hiddenLayerIds.has(layer.manifest.id));
    const system = state.calendarSystem;

    const tabOptions: Granularity[] = [...getVisibleGranularityOptions(system), 'list'];
    const tabsHtml = tabOptions
      .map(
        (g) =>
          `<button type="button" class="calendar-view__tab${g === granularity ? ' is-active' : ''}" data-granularity="${g}">${escapeHtml(t(`calendar.granularity.${g}`, strings))}</button>`,
      )
      .join('');

    let bodyHtml: string;
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
      const groups = buildYearMonthCells(state.selectedDate, system, visibleLayers, state.activeFilters);
      bodyHtml = `<div class="calendar-view__year">${groups
        .map((g) => renderYearMonth(g, system, state.selectedDate, config.min, maxIso, strings))
        .join('')}</div>`;
    } else {
      bodyHtml = `<div class="calendar-view__grid" data-role="grid"></div>`;
    }

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
          granularity = 'day';
          store.set({ selectedDate: clampDateToRange(iso, config.min, maxIso) });
          render();
        },
      });
    }

    if (granularity === 'year') {
      container
        .querySelectorAll<HTMLButtonElement>('.calendar-view__year [data-iso]:not([disabled])')
        .forEach((button) => {
          button.addEventListener('click', () => {
            granularity = 'day';
            store.set({ selectedDate: clampDateToRange(button.dataset.iso!, config.min, maxIso) });
            render();
          });
        });
    }

    if (granularity === 'day' || granularity === 'list') {
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
