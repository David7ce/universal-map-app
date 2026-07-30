import type { Store, AppState } from '../../engine/state/store';
import type { CalendarSystem } from '../../engine/time/calendar-systems';
import { addCalendarUnit, formatCalendarDate } from '../../engine/time/calendar-conversion';
import { t } from '../strings';
import { icons } from '../icons';

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

function formatDateForInput(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return `${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${date.getUTCFullYear()}`;
}

export function parseDateInputValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, yearText, monthText, dayText] = isoMatch;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      return null;
    }
    return date.toISOString().slice(0, 10);
  }

  const numericMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (!numericMatch) return null;

  const [, dayText, monthText, yearText] = numericMatch;
  const day = Number(dayText);
  const month = Number(monthText);
  let year = Number(yearText);

  if (yearText.length === 2) {
    year = year < 70 ? 2000 + year : 1900 + year;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function clampDateToRange(iso: string, min: string, max: string): string {
  const startOffset = daysBetween(min, iso);
  const endOffset = daysBetween(iso, max);
  if (startOffset < 0) return min;
  if (endOffset < 0) return max;
  return iso;
}

export function stepDatePart(currentIso: string, part: 'day' | 'month' | 'year', direction: 1 | -1, min: string, max: string): string {
  const date = new Date(`${currentIso}T00:00:00Z`);
  switch (part) {
    case 'day':
      date.setUTCDate(date.getUTCDate() + direction);
      break;
    case 'month':
      date.setUTCMonth(date.getUTCMonth() + direction);
      break;
    case 'year':
      date.setUTCFullYear(date.getUTCFullYear() + direction);
      break;
  }
  return clampDateToRange(date.toISOString().slice(0, 10), min, max);
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function weekdayLabel(iso: string, strings: Record<string, string>): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return t(`calendar.weekday.${WEEKDAY_KEYS[date.getUTCDay()]}`, strings);
}
function monthLabel(iso: string, strings: Record<string, string>): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return t(`calendar.month.${MONTH_KEYS[date.getUTCMonth()]}`, strings);
}
function dayNumber(iso: string): string {
  return String(new Date(`${iso}T00:00:00Z`).getUTCDate()).padStart(2, '0');
}
function yearNumber(iso: string): string {
  return String(new Date(`${iso}T00:00:00Z`).getUTCFullYear());
}

export function mountCalendarBar(
  container: HTMLElement,
  store: Store<AppState>,
  config: CalendarConfig,
  strings: Record<string, string>
): void {
  const totalDays = Math.max(daysBetween(config.min, config.max), 1);

  // Compact, spinner-style date editor: weekday label, then month/day/year
  // each with their own tiny up/down stepper, plus a pencil button that
  // reveals a manual DD-MM-YYYY text field for typing a date directly. This
  // engine's temporal model is date-only (no time-of-day), so there is no
  // hour/minute/timezone field here — only the date fields are real.
  container.innerHTML = `
    <span class="calendar-bar__weekday" data-role="weekday"></span>
    <div class="calendar-bar__field" data-field="month">
      <span class="calendar-bar__field-value" data-role="month-value"></span>
      <div class="calendar-bar__spin">
        <button type="button" data-action="month-up" aria-label="Increase month">▲</button>
        <button type="button" data-action="month-down" aria-label="Decrease month">▼</button>
      </div>
    </div>
    <div class="calendar-bar__field" data-field="day">
      <span class="calendar-bar__field-value" data-role="day-value"></span>
      <div class="calendar-bar__spin">
        <button type="button" data-action="day-up" aria-label="Increase day">▲</button>
        <button type="button" data-action="day-down" aria-label="Decrease day">▼</button>
      </div>
    </div>
    <span class="calendar-bar__sep">/</span>
    <div class="calendar-bar__field" data-field="year">
      <span class="calendar-bar__field-value" data-role="year-value"></span>
      <div class="calendar-bar__spin">
        <button type="button" data-action="year-up" aria-label="Increase year">▲</button>
        <button type="button" data-action="year-down" aria-label="Decrease year">▼</button>
      </div>
    </div>
    <span class="calendar-bar__system-label" data-role="system-label"></span>
    <input type="text" class="calendar-bar__manual-input" data-role="date-input" hidden inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="${t('calendar.inputPlaceholder', strings)}" />
    <button type="button" class="calendar-bar__edit" data-action="edit" aria-label="${t('calendar.editLabel', strings)}">${icons.edit}</button>
    <input type="range" data-role="date-slider" min="0" max="${totalDays}" step="1" />
  `;

  const weekdayEl = container.querySelector<HTMLElement>('[data-role="weekday"]')!;
  const monthValueEl = container.querySelector<HTMLElement>('[data-role="month-value"]')!;
  const dayValueEl = container.querySelector<HTMLElement>('[data-role="day-value"]')!;
  const yearValueEl = container.querySelector<HTMLElement>('[data-role="year-value"]')!;
  const dateInput = container.querySelector<HTMLInputElement>('[data-role="date-input"]')!;
  const dateSlider = container.querySelector<HTMLInputElement>('[data-role="date-slider"]')!;
  const systemLabel = container.querySelector<HTMLElement>('[data-role="system-label"]')!;
  const editButton = container.querySelector<HTMLButtonElement>('[data-action="edit"]')!;

  function sliderOffsetFor(dateIso: string): string {
    return String(clamp(daysBetween(config.min, dateIso), 0, totalDays));
  }

  function renderSystemLabel(dateIso: string): void {
    systemLabel.textContent = calendarSystemLabel(dateIso, config.system ?? 'gregorian');
  }

  function renderFields(dateIso: string): void {
    weekdayEl.textContent = weekdayLabel(dateIso, strings);
    monthValueEl.textContent = monthLabel(dateIso, strings);
    dayValueEl.textContent = dayNumber(dateIso);
    yearValueEl.textContent = yearNumber(dateIso);
  }

  function commitDateInput(): void {
    const parsed = parseDateInputValue(dateInput.value);
    if (!parsed) {
      dateInput.value = formatDateForInput(store.get().selectedDate);
      return;
    }
    store.set({ selectedDate: clampDateToRange(parsed, config.min, config.max) });
  }

  dateInput.value = formatDateForInput(store.get().selectedDate);
  dateSlider.value = sliderOffsetFor(store.get().selectedDate);
  renderSystemLabel(store.get().selectedDate);
  renderFields(store.get().selectedDate);

  editButton.addEventListener('click', () => {
    dateInput.hidden = !dateInput.hidden;
    if (!dateInput.hidden) dateInput.focus();
  });

  container.querySelector('[data-action="day-up"]')!.addEventListener('click', () => {
    store.set({ selectedDate: stepDatePart(store.get().selectedDate, 'day', 1, config.min, config.max) });
  });
  container.querySelector('[data-action="day-down"]')!.addEventListener('click', () => {
    store.set({ selectedDate: stepDatePart(store.get().selectedDate, 'day', -1, config.min, config.max) });
  });
  container.querySelector('[data-action="month-up"]')!.addEventListener('click', () => {
    store.set({ selectedDate: stepDatePart(store.get().selectedDate, 'month', 1, config.min, config.max) });
  });
  container.querySelector('[data-action="month-down"]')!.addEventListener('click', () => {
    store.set({ selectedDate: stepDatePart(store.get().selectedDate, 'month', -1, config.min, config.max) });
  });
  container.querySelector('[data-action="year-up"]')!.addEventListener('click', () => {
    store.set({ selectedDate: stepDatePart(store.get().selectedDate, 'year', 1, config.min, config.max) });
  });
  container.querySelector('[data-action="year-down"]')!.addEventListener('click', () => {
    store.set({ selectedDate: stepDatePart(store.get().selectedDate, 'year', -1, config.min, config.max) });
  });

  dateInput.addEventListener('change', commitDateInput);
  dateInput.addEventListener('blur', commitDateInput);
  dateInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitDateInput();
      dateInput.blur();
    }
  });
  dateSlider.addEventListener('input', () => {
    store.set({ selectedDate: addDays(config.min, Number(dateSlider.value)) });
  });

  store.subscribe((state) => {
    const nextValue = formatDateForInput(state.selectedDate);
    if (dateInput.value !== nextValue) dateInput.value = nextValue;
    const offset = sliderOffsetFor(state.selectedDate);
    if (dateSlider.value !== offset) dateSlider.value = offset;
    renderSystemLabel(state.selectedDate);
    renderFields(state.selectedDate);
  });
}
