import type { Store, AppState } from '../../engine/state/store';
import { CALENDAR_SYSTEMS, type CalendarSystem } from '../../engine/time/calendar-systems';
import { addCalendarUnit, ensureCalendarSystemLoaded, formatCalendarDate } from '../../engine/time/calendar-conversion';
import { t } from '../strings';
import { escapeHtml } from '../escape-html';
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

export function calendarSystemLabel(dateIso: string, system: CalendarSystem): string {
  return system === 'gregorian' ? '' : formatCalendarDate(dateIso, system);
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

export function stepDatePart(
  currentIso: string,
  part: 'day' | 'month' | 'year',
  direction: 1 | -1,
  min: string,
  max: string,
): string {
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

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

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
  strings: Record<string, string>,
): void {
  const totalDays = Math.max(daysBetween(config.min, config.max), 1);
  const yearMin = new Date(`${config.min}T00:00:00Z`).getUTCFullYear();
  const yearMax = new Date(`${config.max}T00:00:00Z`).getUTCFullYear();

  const systemOptions = CALENDAR_SYSTEMS.map(
    (system) => `<option value="${system}">${escapeHtml(t(`calendar.system.${system}`, strings))}</option>`,
  ).join('');

  // Lives inline inside the filters panel — always visible, no toggle of
  // its own. Layout: system select, then the date fields row, then the
  // range slider on its own full-width row at the end.
  container.innerHTML = `
    <p class="settings-control-group__title">${t('layerControl.time', strings)}</p>
    <label class="settings-control-row">
      <span>${t('settings.calendarSystemLabel', strings)}</span>
      <select data-role="calendar-system">${systemOptions}</select>
    </label>
    <div class="calendar-bar__controls">
      <div class="calendar-bar__row">
        <div class="calendar-bar__field" data-field="year">
          <span class="calendar-bar__field-value" data-role="year-value"></span>
          <input type="number" class="calendar-bar__field-input" data-role="year-input" min="${yearMin}" max="${yearMax}" step="1" />
          <div class="calendar-bar__spin">
            <button type="button" data-action="year-up" aria-label="Increase year">▲</button>
            <button type="button" data-action="year-down" aria-label="Decrease year">▼</button>
          </div>
        </div>
        <span class="calendar-bar__sep">/</span>
        <div class="calendar-bar__field" data-field="month">
          <span class="calendar-bar__field-value" data-role="month-value"></span>
          <input type="number" class="calendar-bar__field-input" data-role="month-input" min="1" max="12" step="1" />
          <div class="calendar-bar__spin">
            <button type="button" data-action="month-up" aria-label="Increase month">▲</button>
            <button type="button" data-action="month-down" aria-label="Decrease month">▼</button>
          </div>
        </div>
        <span class="calendar-bar__sep">/</span>
        <div class="calendar-bar__field" data-field="day">
          <span class="calendar-bar__field-value" data-role="day-value"></span>
          <input type="number" class="calendar-bar__field-input" data-role="day-input" min="1" max="31" step="1" />
          <div class="calendar-bar__spin">
            <button type="button" data-action="day-up" aria-label="Increase day">▲</button>
            <button type="button" data-action="day-down" aria-label="Decrease day">▼</button>
          </div>
        </div>
        <button type="button" class="calendar-bar__edit" data-action="edit" aria-label="${t('calendar.editLabel', strings)}">${icons.edit}</button>
      </div>
      <span class="calendar-bar__system-label" data-role="system-label"></span>
      <input type="range" class="calendar-bar__slider" data-role="date-slider" min="0" max="${totalDays}" step="1" />
    </div>
  `;

  const monthValueEl = container.querySelector<HTMLElement>('[data-role="month-value"]')!;
  const dayValueEl = container.querySelector<HTMLElement>('[data-role="day-value"]')!;
  const yearValueEl = container.querySelector<HTMLElement>('[data-role="year-value"]')!;
  const yearInputEl = container.querySelector<HTMLInputElement>('[data-role="year-input"]')!;
  const monthInputEl = container.querySelector<HTMLInputElement>('[data-role="month-input"]')!;
  const dayInputEl = container.querySelector<HTMLInputElement>('[data-role="day-input"]')!;
  const dateSlider = container.querySelector<HTMLInputElement>('[data-role="date-slider"]')!;
  const systemLabel = container.querySelector<HTMLElement>('[data-role="system-label"]')!;
  const editButton = container.querySelector<HTMLButtonElement>('[data-action="edit"]')!;
  const systemSelect = container.querySelector<HTMLSelectElement>('[data-role="calendar-system"]')!;

  function sliderOffsetFor(dateIso: string): string {
    return String(clamp(daysBetween(config.min, dateIso), 0, totalDays));
  }

  function renderSystemLabel(dateIso: string): void {
    systemLabel.textContent = calendarSystemLabel(dateIso, store.get().calendarSystem);
  }

  function renderFields(dateIso: string): void {
    const d = new Date(`${dateIso}T00:00:00Z`);
    monthValueEl.textContent = monthLabel(dateIso, strings);
    dayValueEl.textContent = dayNumber(dateIso);
    yearValueEl.textContent = yearNumber(dateIso);
    // Sync numeric inputs only when not focused (avoid disrupting active typing)
    if (document.activeElement !== yearInputEl) yearInputEl.value = String(d.getUTCFullYear());
    if (document.activeElement !== monthInputEl) monthInputEl.value = String(d.getUTCMonth() + 1);
    if (document.activeElement !== dayInputEl) dayInputEl.value = String(d.getUTCDate());
  }

  // Apply a single date-part value from a numeric input to the store.
  function applyFieldInput(part: 'year' | 'month' | 'day', input: HTMLInputElement): void {
    const val = Number(input.value);
    if (!val || isNaN(val)) {
      // Reset to current store value on invalid input
      renderFields(store.get().selectedDate);
      return;
    }
    const d = new Date(`${store.get().selectedDate}T00:00:00Z`);
    let year = d.getUTCFullYear();
    let month = d.getUTCMonth() + 1;
    let day = d.getUTCDate();
    if (part === 'year') year = val;
    else if (part === 'month') month = val;
    else day = val;
    const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const parsed = parseDateInputValue(iso);
    if (parsed) store.set({ selectedDate: clampDateToRange(parsed, config.min, config.max) });
    else renderFields(store.get().selectedDate);
  }

  dateSlider.value = sliderOffsetFor(store.get().selectedDate);
  systemSelect.value = store.get().calendarSystem;
  renderSystemLabel(store.get().selectedDate);
  renderFields(store.get().selectedDate);

  editButton.addEventListener('click', () => {
    const isEditing = container.classList.toggle('is-editing');
    editButton.setAttribute('aria-pressed', String(isEditing));
    if (isEditing) {
      yearInputEl.focus();
      yearInputEl.select();
    }
  });

  systemSelect.addEventListener('change', () => {
    const system = systemSelect.value as CalendarSystem;
    ensureCalendarSystemLoaded(system)
      .then(() => store.set({ calendarSystem: system }))
      .catch((error: unknown) => console.error('Failed to load calendar system', system, error));
  });

  // Each numeric input commits its part on change and on Enter; Escape exits.
  (
    [
      ['year', yearInputEl],
      ['month', monthInputEl],
      ['day', dayInputEl],
    ] as const
  ).forEach(([part, input]) => {
    input.addEventListener('change', () => applyFieldInput(part, input));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyFieldInput(part, input);
        container.classList.remove('is-editing');
        editButton.setAttribute('aria-pressed', 'false');
        editButton.focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        renderFields(store.get().selectedDate);
        container.classList.remove('is-editing');
        editButton.setAttribute('aria-pressed', 'false');
        editButton.focus();
      }
    });
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

  dateSlider.addEventListener('input', () => {
    store.set({ selectedDate: addDays(config.min, Number(dateSlider.value)) });
  });

  store.subscribe((state) => {
    const offset = sliderOffsetFor(state.selectedDate);
    if (dateSlider.value !== offset) dateSlider.value = offset;
    if (document.activeElement !== systemSelect) systemSelect.value = state.calendarSystem;
    renderSystemLabel(state.selectedDate);
    renderFields(state.selectedDate);
  });
}
