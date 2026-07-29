import type { Store, AppState } from '../../engine/state/store';
import type { CalendarSystem } from '../../engine/time/calendar-systems';
import { addCalendarUnit, formatCalendarDate } from '../../engine/time/calendar-conversion';
import { t } from '../strings';

export interface CalendarConfig {
  system?: CalendarSystem;
  default: string;
  min: string;
  max: string;
}

export type Granularity = 'day' | 'week' | 'month' | 'year';

export function getVisibleGranularityOptions(system: CalendarSystem): Granularity[] {
  if (system === 'gregorian') return ['day', 'week', 'month'];
  return ['day', 'week', 'month'];
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function nextSelectedDate(
  currentIso: string,
  granularity: Granularity,
  direction: 1 | -1,
  system: CalendarSystem
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

export function calendarSystemLabel(dateIso: string, system: CalendarSystem): string {
  return system === 'gregorian' ? '' : formatCalendarDate(dateIso, system);
}

export function mountCalendarBar(
  container: HTMLElement,
  store: Store<AppState>,
  config: CalendarConfig,
  strings: Record<string, string>
): void {
  const totalDays = Math.max(daysBetween(config.min, config.max), 1);

  const visibleGranularities = getVisibleGranularityOptions(config.system ?? 'gregorian');

  container.innerHTML = `
    <button type="button" data-action="prev">&larr;</button>
    <input type="date" data-role="date-input" min="${config.min}" max="${config.max}" />
    <span class="calendar-bar__system-label" data-role="system-label"></span>
    <button type="button" data-action="next">&rarr;</button>
    <select data-role="granularity">
      ${visibleGranularities
        .map((granularity) => `<option value="${granularity}">${t(`calendar.granularity.${granularity}`, strings)}</option>`)
        .join('')}
    </select>
    <input type="range" data-role="date-slider" min="0" max="${totalDays}" step="1" />
  `;

  const dateInput = container.querySelector<HTMLInputElement>('[data-role="date-input"]')!;
  const granularitySelect = container.querySelector<HTMLSelectElement>('[data-role="granularity"]')!;
  const dateSlider = container.querySelector<HTMLInputElement>('[data-role="date-slider"]')!;
  const systemLabel = container.querySelector<HTMLElement>('[data-role="system-label"]')!;

  function sliderOffsetFor(dateIso: string): string {
    return String(clamp(daysBetween(config.min, dateIso), 0, totalDays));
  }

  function renderSystemLabel(dateIso: string): void {
    systemLabel.textContent = calendarSystemLabel(dateIso, config.system ?? 'gregorian');
  }

  dateInput.value = store.get().selectedDate;
  dateSlider.value = sliderOffsetFor(store.get().selectedDate);
  renderSystemLabel(store.get().selectedDate);

  function stepDate(direction: 1 | -1): void {
    const system = config.system ?? 'gregorian';
    const granularity = granularitySelect.value as Granularity;
    store.set({ selectedDate: nextSelectedDate(store.get().selectedDate, granularity, direction, system) });
  }

  container.querySelector('[data-action="prev"]')!.addEventListener('click', () => stepDate(-1));
  container.querySelector('[data-action="next"]')!.addEventListener('click', () => stepDate(1));
  dateInput.addEventListener('change', () => store.set({ selectedDate: dateInput.value }));
  dateSlider.addEventListener('input', () => {
    store.set({ selectedDate: addDays(config.min, Number(dateSlider.value)) });
  });

  store.subscribe((state) => {
    if (dateInput.value !== state.selectedDate) dateInput.value = state.selectedDate;
    const offset = sliderOffsetFor(state.selectedDate);
    if (dateSlider.value !== offset) dateSlider.value = offset;
    renderSystemLabel(state.selectedDate);
  });
}
