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
