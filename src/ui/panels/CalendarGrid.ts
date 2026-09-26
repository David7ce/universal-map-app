import type { CalendarSystem } from '../../engine/time/calendar-systems';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { buildMonthCells, buildWeekCells } from '../../engine/time/calendar-grid';
import { t } from '../strings';
import { escapeHtml } from '../escape-html';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

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
  // Which month/week to render, when it differs from `selectedIso`'s own
  // (e.g. the drill-down calendar browsing a month the user hasn't picked a
  // day in yet). Defaults to `selectedIso`.
  anchorIso?: string;
}

// Rebuilds innerHTML from scratch on every call — same pattern as
// PanelRight.ts/CalendarBar.ts, no DOM diffing anywhere in this codebase.
export function renderCalendarGrid(container: HTMLElement, deps: CalendarGridDeps): void {
  const { granularity, selectedIso, system, layers, activeFilters, strings, min, max } = deps;
  const anchorIso = deps.anchorIso ?? selectedIso;

  const cells =
    granularity === 'week'
      ? buildWeekCells(anchorIso, system, layers, activeFilters)
      : buildMonthCells(anchorIso, system, layers, activeFilters);

  const weekdayHeader = WEEKDAY_KEYS.map(
    (key) => `<span class="calendar-grid__weekday">${escapeHtml(t(`calendar.weekday.${key}`, strings))}</span>`,
  ).join('');

  const cellsHtml = cells
    .map((cell) => {
      // A cell can be both !inCurrentPeriod (blank) and out-of-range —
      // both get the same muted/disabled treatment, no third visual state.
      const outOfRange = cell.iso < min || cell.iso > max;
      const muted = !cell.inCurrentPeriod || outOfRange;
      const classes = ['calendar-grid__cell'];
      if (muted) classes.push('calendar-grid__cell--muted');
      // Dates after the world's `calendar.max` are shown in a softer tone
      // and are not selectable — there's no data beyond that point.
      if (cell.iso > max) classes.push('calendar-grid__cell--future');
      if (cell.iso === selectedIso) classes.push('calendar-grid__cell--selected');
      if (cell.hasEvents) classes.push('calendar-grid__cell--has-events');
      const disabled = muted ? 'disabled' : '';
      return `<button type="button" class="${classes.join(' ')}" data-iso="${escapeHtml(cell.iso)}" ${disabled}>${cell.day}</button>`;
    })
    .join('');

  container.className = `calendar-bar__grid calendar-grid calendar-grid--${granularity}`;
  container.innerHTML = weekdayHeader + cellsHtml;
  container.querySelectorAll<HTMLButtonElement>('[data-iso]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => deps.onSelectDay(button.dataset.iso!));
  });
}
