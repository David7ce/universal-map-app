import type { Store, AppState } from '../../engine/state/store';
import type { CalendarSystem } from '../../engine/time/calendar-systems';
import {
  addCalendarUnit,
  calendarPartsToIso,
  daysInCalendarMonth,
  formatCalendarDate,
  monthsInCalendarYear,
  toCalendarParts,
} from '../../engine/time/calendar-conversion';
import { t } from '../strings';
import { escapeHtml } from '../escape-html';
import { icons } from '../icons';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { renderCalendarGrid } from './CalendarGrid';

export interface CalendarConfig {
  system?: CalendarSystem;
  default: string;
  min: string;
  max: string;
}

export type Granularity = 'day' | 'week' | 'month' | 'year';

// `system` isn't used to filter yet — every calendar system currently
// offers the same four units. Kept as a parameter so a future system with
// a genuinely different unit set (e.g. no 7-day week) can narrow this
// without changing every call site.
export function getVisibleGranularityOptions(_system: CalendarSystem): Granularity[] {
  return ['day', 'week', 'month', 'year'];
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

// Only used for gregorian, whose month names come from the app's own
// translatable strings.json (`calendar.month.*`) rather than Temporal/Intl
// locale data — keeps existing translations working for the common case.
// Non-gregorian systems use `toCalendarParts()`'s own `monthName` instead
// (see `renderFields`), the same source `calendarSystemLabel` already uses.
function monthLabel(iso: string, strings: Record<string, string>): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return t(`calendar.month.${MONTH_KEYS[date.getUTCMonth()]}`, strings);
}

export function mountCalendarBar(
  container: HTMLElement,
  store: Store<AppState>,
  config: CalendarConfig,
  strings: Record<string, string>,
  layers: LoadedLayer[],
): void {
  // The calendar never shows the future — cap the manifest's configured
  // max at today, whatever today actually is (not a fixed future date).
  const todayIso = new Date().toISOString().slice(0, 10);
  const maxIso = config.max > todayIso ? todayIso : config.max;

  const totalDays = Math.max(daysBetween(config.min, maxIso), 1);
  // Gregorian year bounds only — a soft UI hint (real enforcement is
  // clampDateToRange, after system-aware conversion), so it's approximate
  // rather than wrong for a non-gregorian system whose year numbering
  // differs (e.g. Hijri ~578 less than Gregorian).
  const yearMin = new Date(`${config.min}T00:00:00Z`).getUTCFullYear();
  const yearMax = new Date(`${maxIso}T00:00:00Z`).getUTCFullYear();

  // Options don't vary by calendar system today (see the comment on
  // getVisibleGranularityOptions) — computed once at mount. If a future
  // system ever trims this list, the <select> would need repopulating on
  // system change too, not just here.
  const granularityOptions = getVisibleGranularityOptions(store.get().calendarSystem)
    .map((g) => `<option value="${g}">${escapeHtml(t(`calendar.granularity.${g}`, strings))}</option>`)
    .join('');

  // Lives inline inside the filters panel — always visible, no toggle of
  // its own. Layout: the date fields row, then the range slider on its own
  // full-width row at the end. The calendar-system select lives in
  // SettingsControl.ts, not here — CalendarBar only reads store.calendarSystem.
  container.innerHTML = `
    <p class="settings-control-group__title">${t('layerControl.time', strings)}</p>
    <div class="calendar-bar__controls">
      <div class="calendar-bar__row calendar-bar__row--granularity">
        <button type="button" class="calendar-bar__step-btn" data-action="step-prev" aria-label="Step back">‹</button>
        <select data-role="granularity">${granularityOptions}</select>
        <button type="button" class="calendar-bar__step-btn" data-action="step-next" aria-label="Step forward">›</button>
      </div>
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
      <div class="calendar-bar__grid" data-role="grid"></div>
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
  const granularitySelect = container.querySelector<HTMLSelectElement>('[data-role="granularity"]')!;
  const gridContainer = container.querySelector<HTMLElement>('[data-role="grid"]')!;

  function renderGrid(): void {
    if (granularity === 'day') {
      gridContainer.hidden = true;
      return;
    }
    gridContainer.hidden = false;
    const state = store.get();
    renderCalendarGrid(gridContainer, {
      granularity,
      selectedIso: state.selectedDate,
      system: state.calendarSystem,
      layers,
      activeFilters: state.activeFilters,
      strings,
      onSelectDay: (iso) => store.set({ selectedDate: clampDateToRange(iso, config.min, maxIso) }),
      onSelectMonth: (iso) => {
        granularity = 'month';
        granularitySelect.value = granularity;
        store.set({ selectedDate: clampDateToRange(iso, config.min, maxIso) });
      },
    });
  }

  // UI-only, doesn't need to survive a reload or be shared with other
  // panels — kept in this closure the same way PanelRight.ts keeps its
  // open-section state.
  let granularity: Granularity = 'day';
  granularitySelect.value = granularity;
  granularitySelect.addEventListener('change', () => {
    granularity = granularitySelect.value as Granularity;
    renderGrid();
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

  function sliderOffsetFor(dateIso: string): string {
    return String(clamp(daysBetween(config.min, dateIso), 0, totalDays));
  }

  function renderSystemLabel(dateIso: string): void {
    systemLabel.textContent = calendarSystemLabel(dateIso, store.get().calendarSystem);
  }

  // Fields edit in the *display* calendar system, not always gregorian —
  // e.g. with an islamic calendarSystem, typing "15" into the day field and
  // "2" into the month field means Hijri Safar 15, not Gregorian Feb 15.
  // calendarPartsToIso() converts back to the Gregorian ISO the store holds.
  function renderFields(dateIso: string): void {
    const system = store.get().calendarSystem;
    const parts = toCalendarParts(dateIso, system);
    monthValueEl.textContent = system === 'gregorian' ? monthLabel(dateIso, strings) : parts.monthName;
    dayValueEl.textContent = String(parts.day).padStart(2, '0');
    yearValueEl.textContent = String(parts.year);

    // Islamic/hebrew months run 29-30 days depending on the year, and a
    // hebrew year has 12 or 13 months in a leap year — bound the spinner/
    // input to what's actually valid for this system, year, and month.
    monthInputEl.max = String(monthsInCalendarYear(parts.year, system));
    dayInputEl.max = String(daysInCalendarMonth(parts.year, parts.month, system));

    // Sync numeric inputs only when not focused (avoid disrupting active typing)
    if (document.activeElement !== yearInputEl) yearInputEl.value = String(parts.year);
    if (document.activeElement !== monthInputEl) monthInputEl.value = String(parts.month);
    if (document.activeElement !== dayInputEl) dayInputEl.value = String(parts.day);
  }

  // Apply a single date-part value from a numeric input to the store.
  function applyFieldInput(part: 'year' | 'month' | 'day', input: HTMLInputElement): void {
    const val = Number(input.value);
    if (!val || isNaN(val)) {
      // Reset to current store value on invalid input
      renderFields(store.get().selectedDate);
      return;
    }
    const system = store.get().calendarSystem;
    const current = toCalendarParts(store.get().selectedDate, system);
    const nextParts = {
      year: part === 'year' ? val : current.year,
      month: part === 'month' ? val : current.month,
      day: part === 'day' ? val : current.day,
    };
    try {
      const iso = calendarPartsToIso(nextParts, system);
      store.set({ selectedDate: clampDateToRange(iso, config.min, maxIso) });
    } catch {
      // Not a real date in this system (e.g. day 30 in a 29-day month) — same
      // fallback as an unparseable gregorian entry.
      renderFields(store.get().selectedDate);
    }
  }

  dateSlider.value = sliderOffsetFor(store.get().selectedDate);
  renderSystemLabel(store.get().selectedDate);
  renderFields(store.get().selectedDate);
  renderGrid();

  editButton.addEventListener('click', () => {
    const isEditing = container.classList.toggle('is-editing');
    editButton.setAttribute('aria-pressed', String(isEditing));
    if (isEditing) {
      yearInputEl.focus();
      yearInputEl.select();
    }
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

  // A day is a day regardless of calendar system — Gregorian arithmetic on
  // the underlying ISO date is correct display-system-agnostically.
  container.querySelector('[data-action="day-up"]')!.addEventListener('click', () => {
    store.set({ selectedDate: stepDatePart(store.get().selectedDate, 'day', 1, config.min, maxIso) });
  });
  container.querySelector('[data-action="day-down"]')!.addEventListener('click', () => {
    store.set({ selectedDate: stepDatePart(store.get().selectedDate, 'day', -1, config.min, maxIso) });
  });

  // Month/year are calendar-system-shaped (a Hijri month isn't a Gregorian
  // month), so these go through addCalendarUnit — the same conversion the
  // granularity stepper above already uses — instead of stepDatePart.
  function stepUnit(unit: 'month' | 'year', direction: 1 | -1): void {
    const state = store.get();
    const iso = clampDateToRange(
      addCalendarUnit(state.selectedDate, state.calendarSystem, unit, direction),
      config.min,
      maxIso,
    );
    store.set({ selectedDate: iso });
  }
  container.querySelector('[data-action="month-up"]')!.addEventListener('click', () => stepUnit('month', 1));
  container.querySelector('[data-action="month-down"]')!.addEventListener('click', () => stepUnit('month', -1));
  container.querySelector('[data-action="year-up"]')!.addEventListener('click', () => stepUnit('year', 1));
  container.querySelector('[data-action="year-down"]')!.addEventListener('click', () => stepUnit('year', -1));

  dateSlider.addEventListener('input', () => {
    store.set({ selectedDate: addDays(config.min, Number(dateSlider.value)) });
  });

  store.subscribe((state) => {
    const offset = sliderOffsetFor(state.selectedDate);
    if (dateSlider.value !== offset) dateSlider.value = offset;
    renderSystemLabel(state.selectedDate);
    renderFields(state.selectedDate);
    renderGrid();
  });
}
