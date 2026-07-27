import type { Store, AppState } from '../../engine/state/store';
import { t } from '../strings';

export interface CalendarConfig {
  default: string;
  min: string;
  max: string;
}

type Granularity = 'day' | 'week' | 'month' | 'year';

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

export function mountCalendarBar(
  container: HTMLElement,
  store: Store<AppState>,
  config: CalendarConfig,
  strings: Record<string, string>
): void {
  const totalDays = Math.max(daysBetween(config.min, config.max), 1);

  container.innerHTML = `
    <button type="button" data-action="prev">&larr;</button>
    <input type="date" data-role="date-input" min="${config.min}" max="${config.max}" />
    <button type="button" data-action="next">&rarr;</button>
    <select data-role="granularity">
      <option value="day">${t('calendar.granularity.day', strings)}</option>
      <option value="week">${t('calendar.granularity.week', strings)}</option>
      <option value="month">${t('calendar.granularity.month', strings)}</option>
      <option value="year">${t('calendar.granularity.year', strings)}</option>
    </select>
    <input type="range" data-role="date-slider" min="0" max="${totalDays}" step="1" />
  `;

  const dateInput = container.querySelector<HTMLInputElement>('[data-role="date-input"]')!;
  const granularitySelect = container.querySelector<HTMLSelectElement>('[data-role="granularity"]')!;
  const dateSlider = container.querySelector<HTMLInputElement>('[data-role="date-slider"]')!;

  function sliderOffsetFor(dateIso: string): string {
    return String(clamp(daysBetween(config.min, dateIso), 0, totalDays));
  }

  dateInput.value = store.get().selectedDate;
  dateSlider.value = sliderOffsetFor(store.get().selectedDate);

  function stepDate(direction: 1 | -1): void {
    const current = new Date(`${store.get().selectedDate}T00:00:00Z`);
    switch (granularitySelect.value as Granularity) {
      case 'day':
        current.setUTCDate(current.getUTCDate() + direction);
        break;
      case 'week':
        current.setUTCDate(current.getUTCDate() + direction * 7);
        break;
      case 'month':
        current.setUTCMonth(current.getUTCMonth() + direction);
        break;
      case 'year':
        current.setUTCFullYear(current.getUTCFullYear() + direction);
        break;
    }
    store.set({ selectedDate: current.toISOString().slice(0, 10) });
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
  });
}
