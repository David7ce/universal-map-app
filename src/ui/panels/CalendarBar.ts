import type { Store, AppState } from '../../engine/state/store';
import { openPanel } from '../../engine/state/store';
import type { CalendarSystem } from '../../engine/time/calendar-systems';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import {
  addCalendarUnit,
  toCalendarParts,
  calendarPartsToIso,
  daysInCalendarMonth,
  monthsInCalendarYear,
} from '../../engine/time/calendar-conversion';
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


// Windows-Calendar-style drill-down: a month grid whose header shows
// "September 2026" with prev/next arrows. Clicking the header zooms out to a
// 12-month grid (header "2026"), clicking again zooms out to a decade of
// years (header "2020-2029"). Picking a month zooms back in to that month;
// picking a year zooms in to its months. Arrows step by whatever level is
// showing. The calendar-system select lives in SettingsControl.ts, not here —
// CalendarBar only reads store.calendarSystem.
type CalendarLevel = 'days' | 'months' | 'years';

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const YEARS_PER_PAGE = 12;

export function mountCalendarBar(
  container: HTMLElement,
  store: Store<AppState>,
  config: CalendarConfig,
  strings: Record<string, string>,
  layers: LoadedLayer[],
): void {
  const maxIso = config.max;

  container.innerHTML = `
    <p class="settings-control-group__title">${t('layerControl.time', strings)}</p>
    <div class="calendar-bar__controls">
      <div class="calendar-bar__header">
        <button type="button" class="calendar-bar__nav-btn" data-action="prev" aria-label="${escapeHtml(t('calendar.prevLabel', strings))}">‹</button>
        <button type="button" class="calendar-bar__title-btn" data-action="zoom-out" aria-live="polite"></button>
        <button type="button" class="calendar-bar__nav-btn" data-action="next" aria-label="${escapeHtml(t('calendar.nextLabel', strings))}">›</button>
      </div>
      <div class="calendar-bar__grid" data-role="grid"></div>
    </div>
  `;

  const gridEl = container.querySelector<HTMLElement>('[data-role="grid"]')!;
  const titleBtn = container.querySelector<HTMLButtonElement>('[data-action="zoom-out"]')!;

  // UI-only state, kept in this closure like PanelRight's open sections.
  let level: CalendarLevel = 'days';
  // The year/month the grid is *showing*, which can differ from the selected
  // date's own month while the user browses (e.g. after stepping back).
  let viewYear: number;
  let viewMonth: number;
  let viewDecadeStart: number;

  function syncViewToSelection(): void {
    const state = store.get();
    const parts = toCalendarParts(state.selectedDate, state.calendarSystem);
    viewYear = parts.year;
    viewMonth = parts.month;
    viewDecadeStart = Math.floor(parts.year / YEARS_PER_PAGE) * YEARS_PER_PAGE;
  }

  function selectDay(iso: string): void {
    store.set({ selectedDate: clampDateToRange(iso, config.min, maxIso) });
    // Picking a day here should actually surface its agenda, not just
    // update a panel the user may not have open — SearchOverlay.ts's day
    // agenda is the only place a day's events render.
    openPanel(store, 'left');
  }

  // Jumps to a year/month (day kept where it was, clamped to that month's
  // length) and zooms back in to the day grid.
  function jumpTo(year: number, month: number): void {
    const state = store.get();
    const system = state.calendarSystem;
    const day = Math.min(toCalendarParts(state.selectedDate, system).day, daysInCalendarMonth(year, month, system));
    const iso = calendarPartsToIso({ year, month, day }, system);
    const clamped = clampDateToRange(iso, config.min, maxIso);
    store.set({ selectedDate: clamped });
    // Re-derive the viewed month from the *clamped* date, so picking a month
    // outside the world's range doesn't leave the grid showing a month the
    // selection isn't actually in.
    const parts = toCalendarParts(clamped, system);
    viewYear = parts.year;
    viewMonth = parts.month;
    level = 'days';
    render();
  }

  function step(direction: 1 | -1): void {
    if (level === 'days') {
      const system = store.get().calendarSystem;
      const next = addCalendarUnit(
        calendarPartsToIso({ year: viewYear, month: viewMonth, day: 1 }, system),
        system,
        'month',
        direction,
      );
      const parts = toCalendarParts(next, system);
      viewYear = parts.year;
      viewMonth = parts.month;
    } else if (level === 'months') {
      viewYear += direction;
    } else {
      viewDecadeStart += direction * YEARS_PER_PAGE;
    }
    render();
  }

  function zoomOut(): void {
    if (level === 'days') level = 'months';
    else if (level === 'months') {
      level = 'years';
      viewDecadeStart = Math.floor(viewYear / YEARS_PER_PAGE) * YEARS_PER_PAGE;
    }
    render();
  }

  function monthName(year: number, month: number, system: CalendarSystem): string {
    if (system === 'gregorian') return t(`calendar.month.${MONTH_KEYS[month - 1]}`, strings);
    return toCalendarParts(calendarPartsToIso({ year, month, day: 1 }, system), system).monthName;
  }

  function renderDays(system: CalendarSystem): void {
    const visibleLayers = layers.filter((layer) => !store.get().hiddenLayerIds.has(layer.manifest.id));
    const monthIso = calendarPartsToIso({ year: viewYear, month: viewMonth, day: 1 }, system);
    titleBtn.textContent = `${monthName(viewYear, viewMonth, system)} ${viewYear}`;
    renderCalendarGrid(gridEl, {
      granularity: 'month',
      selectedIso: store.get().selectedDate,
      system,
      layers: visibleLayers,
      activeFilters: store.get().activeFilters,
      strings,
      min: config.min,
      max: maxIso,
      onSelectDay: selectDay,
      // The grid renders the *viewed* month, not necessarily the selected
      // date's month — pass the viewed month's ISO as the anchor.
      anchorIso: monthIso,
    });
  }

  function renderMonths(system: CalendarSystem): void {
    titleBtn.textContent = String(viewYear);
    const monthCount = monthsInCalendarYear(viewYear, system);
    const selectedParts = toCalendarParts(store.get().selectedDate, system);
    const cells: string[] = [];
    for (let month = 1; month <= monthCount; month++) {
      const isSelected = selectedParts.year === viewYear && selectedParts.month === month;
      cells.push(
        `<button type="button" class="calendar-bar__pick${isSelected ? ' is-selected' : ''}" data-month="${month}">${escapeHtml(monthName(viewYear, month, system))}</button>`,
      );
    }
    gridEl.className = 'calendar-bar__grid calendar-bar__picks';
    gridEl.innerHTML = cells.join('');
    gridEl.querySelectorAll<HTMLButtonElement>('[data-month]').forEach((button) => {
      button.addEventListener('click', () => jumpTo(viewYear, Number(button.dataset.month)));
    });
  }

  function renderYears(): void {
    titleBtn.textContent = `${viewDecadeStart}–${viewDecadeStart + YEARS_PER_PAGE - 1}`;
    const selectedYear = toCalendarParts(store.get().selectedDate, store.get().calendarSystem).year;
    const cells: string[] = [];
    for (let i = 0; i < YEARS_PER_PAGE; i++) {
      const year = viewDecadeStart + i;
      const isSelected = year === selectedYear;
      cells.push(
        `<button type="button" class="calendar-bar__pick${isSelected ? ' is-selected' : ''}" data-year="${year}">${year}</button>`,
      );
    }
    gridEl.className = 'calendar-bar__grid calendar-bar__picks';
    gridEl.innerHTML = cells.join('');
    gridEl.querySelectorAll<HTMLButtonElement>('[data-year]').forEach((button) => {
      button.addEventListener('click', () => {
        viewYear = Number(button.dataset.year);
        level = 'months';
        render();
      });
    });
  }

  function render(): void {
    const system = store.get().calendarSystem;
    if (level === 'days') renderDays(system);
    else if (level === 'months') renderMonths(system);
    else renderYears();
  }

  container.querySelector('[data-action="prev"]')!.addEventListener('click', () => step(-1));
  container.querySelector('[data-action="next"]')!.addEventListener('click', () => step(1));
  titleBtn.addEventListener('click', zoomOut);

  syncViewToSelection();
  render();
  store.subscribe(() => {
    // Re-anchor the viewed month/year when the selection changes from
    // elsewhere (e.g. the left panel's day agenda), but don't fight the
    // user's own browsing while they're on a zoomed-out level.
    if (level === 'days') syncViewToSelection();
    render();
  });
}
