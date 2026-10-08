import type { Store, AppState } from '../../engine/state/store';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { resolveTaxonomyIcon } from '../../engine/space/style';
import { formatCalendarDate } from '../../engine/time/calendar-conversion';
import { mountCalendarBar, type CalendarConfig } from './CalendarBar';
import { buildToolbarPills, countActiveIn, splitVisiblePills, type ToolbarPill } from './toolbar-pills';
import { stepMonth } from './toolbar-date';
import { escapeHtml } from '../escape-html';
import { t } from '../strings';

const MAX_VISIBLE_DESKTOP = 6;
const MAX_VISIBLE_MOBILE = 4;

export interface MapToolbarOptions {
  calendar: CalendarConfig;
  // false for worlds with `systems.time: false` — no date chip, no calendar.
  showDate: boolean;
}

// Top-of-map bar: date chip (prev / chip -> calendar popover / next) beside
// the filter pills, with a "More" menu for pills that don't fit. The full
// filter list still lives in the right drawer (PanelRight.ts).
//
// The skeleton (date group, popover, filters area) is built once; only the
// filters area is re-rendered on store updates, so the chip, popover and the
// CalendarBar mounted inside it keep their DOM and focus.
export function mountMapToolbar(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>,
  options: MapToolbarOptions,
): void {
  const { calendar } = options;

  container.innerHTML = `
    <div class="map-toolbar__date" data-role="date">
      <button type="button" class="map-toolbar__step" data-action="prev" aria-label="${escapeHtml(t('toolbar.prevMonth', strings))}">‹</button>
      <button type="button" class="map-toolbar__chip" data-action="toggle-calendar" aria-haspopup="dialog" aria-expanded="false" aria-label="${escapeHtml(t('toolbar.chooseDate', strings))}"></button>
      <button type="button" class="map-toolbar__step" data-action="next" aria-label="${escapeHtml(t('toolbar.nextMonth', strings))}">›</button>
      <div class="map-toolbar__popover calendar-bar" data-role="popover" role="dialog" aria-label="${escapeHtml(t('toolbar.calendarLabel', strings))}" hidden></div>
    </div>
    <div class="map-toolbar__filters" data-role="filters"></div>
  `;

  const dateEl = container.querySelector<HTMLElement>('[data-role="date"]')!;
  const prevBtn = container.querySelector<HTMLButtonElement>('[data-action="prev"]')!;
  const nextBtn = container.querySelector<HTMLButtonElement>('[data-action="next"]')!;
  const chip = container.querySelector<HTMLButtonElement>('[data-action="toggle-calendar"]')!;
  const popover = container.querySelector<HTMLElement>('[data-role="popover"]')!;
  const filtersEl = container.querySelector<HTMLElement>('[data-role="filters"]')!;

  const desktop = window.matchMedia('(min-width: 48rem)');

  // UI-only state, kept in this closure like PanelRight's open sections.
  let calendarOpen = false;
  let moreOpen = false;
  let hasPills = false;

  function updateVisibility(): void {
    container.hidden = !options.showDate && !hasPills;
  }

  // ---- date group -------------------------------------------------------

  function setCalendarOpen(open: boolean, restoreFocus = false): void {
    calendarOpen = open;
    popover.hidden = !open;
    chip.setAttribute('aria-expanded', String(open));
    if (!open && restoreFocus) chip.focus();
  }

  function renderDate(): void {
    const state = store.get();
    chip.textContent = formatCalendarDate(state.selectedDate, state.calendarSystem);
    prevBtn.disabled =
      stepMonth(state.selectedDate, state.calendarSystem, -1, calendar.min, calendar.max) === state.selectedDate;
    nextBtn.disabled =
      stepMonth(state.selectedDate, state.calendarSystem, 1, calendar.min, calendar.max) === state.selectedDate;
  }

  function step(direction: 1 | -1): void {
    const state = store.get();
    store.set({
      selectedDate: stepMonth(state.selectedDate, state.calendarSystem, direction, calendar.min, calendar.max),
    });
  }

  if (options.showDate) {
    mountCalendarBar(popover, store, calendar, strings, layers, () => setCalendarOpen(false));
    prevBtn.addEventListener('click', () => step(-1));
    nextBtn.addEventListener('click', () => step(1));
    chip.addEventListener('click', () => {
      moreOpen = false;
      setCalendarOpen(!calendarOpen);
      renderFilters();
    });
    renderDate();
  } else {
    dateEl.hidden = true;
  }

  // ---- filter pills -----------------------------------------------------

  function renderPill(pill: ToolbarPill, activeFilters: Record<string, Set<string>>): string {
    const icon = resolveTaxonomyIcon(pill.icons, pill.defaultIcon, pill.value);
    const isActive = activeFilters[pill.dimensionId]?.has(pill.value) ?? false;
    const classes = ['filter-pill'];
    if (isActive) classes.push('is-active');
    if (pill.count === 0) classes.push('is-empty');
    return `<button type="button" class="${classes.join(' ')}" data-dimension="${escapeHtml(pill.dimensionId)}" data-value="${escapeHtml(pill.value)}" aria-pressed="${isActive}">
      ${icon ? `<span class="filter-pill__icon">${icon}</span>` : ''}
      <span>${escapeHtml(pill.value)}</span>
    </button>`;
  }

  // Consecutive pills of one dimension share a labelled group.
  function renderGroups(pills: ToolbarPill[], activeFilters: Record<string, Set<string>>): string {
    const groups: ToolbarPill[][] = [];
    for (const pill of pills) {
      const last = groups[groups.length - 1];
      if (last && last[0].dimensionId === pill.dimensionId) last.push(pill);
      else groups.push([pill]);
    }
    return groups
      .map(
        (group) => `<div class="map-toolbar__group">
          <span class="map-toolbar__label">${escapeHtml(group[0].dimensionLabel)}</span>
          ${group.map((pill) => renderPill(pill, activeFilters)).join('')}
        </div>`,
      )
      .join('');
  }

  function renderFilters(): void {
    const state = store.get();
    if (state.view !== 'map') return;
    const pills = buildToolbarPills(layers, new Date(`${state.selectedDate}T00:00:00Z`), state.hiddenLayerIds);
    hasPills = pills.length > 0;
    updateVisibility();
    if (!hasPills) {
      filtersEl.innerHTML = '';
      return;
    }

    const { visible, overflow } = splitVisiblePills(pills, desktop.matches ? MAX_VISIBLE_DESKTOP : MAX_VISIBLE_MOBILE);
    if (overflow.length === 0) moreOpen = false;
    const activeFilters = state.activeFilters;
    const hasActiveFilters = Object.values(activeFilters).some((selected) => selected.size > 0);

    const hiddenActive = countActiveIn(overflow, activeFilters);
    const more =
      overflow.length > 0
        ? `<div class="map-toolbar__more">
            <button type="button" class="filter-pill map-toolbar__more-btn${hiddenActive > 0 ? ' is-active' : ''}" data-action="toggle-more" aria-haspopup="true" aria-expanded="${moreOpen}" aria-label="${escapeHtml(t('toolbar.moreLabel', strings))}">
              <span>${escapeHtml(t('toolbar.more', strings))}</span>${hiddenActive > 0 ? `<span class="map-toolbar__badge">${hiddenActive}</span>` : ''}
            </button>
            ${moreOpen ? `<div class="map-toolbar__menu">${renderGroups(overflow, activeFilters)}</div>` : ''}
          </div>`
        : '';
    const clearAll = hasActiveFilters
      ? `<button type="button" class="filter-pill map-toolbar__clear" data-action="clear-all">${escapeHtml(t('filters.clearAll', strings))}</button>`
      : '';

    // The area is rebuilt wholesale, which would drop keyboard focus from the
    // pill/button the user just activated — remember it and put it back.
    const focused = filtersEl.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
    const focusedKey = focused
      ? { action: focused.dataset.action, dimension: focused.dataset.dimension, value: focused.dataset.value }
      : null;

    filtersEl.innerHTML = `<div class="map-toolbar__scroll">${renderGroups(visible, activeFilters)}</div>${more}${clearAll}`;

    if (focusedKey) {
      const buttons = Array.from(filtersEl.querySelectorAll<HTMLElement>('button'));
      buttons
        .find(
          (el) =>
            el.dataset.action === focusedKey.action &&
            el.dataset.dimension === focusedKey.dimension &&
            el.dataset.value === focusedKey.value,
        )
        ?.focus();
    }
  }

  // One delegated listener — the filters area is rebuilt on every render.
  filtersEl.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'clear-all') {
      store.set({ activeFilters: {} });
      return;
    }
    if (action === 'toggle-more') {
      moreOpen = !moreOpen;
      setCalendarOpen(false);
      renderFilters();
      return;
    }
    const pill = target.closest<HTMLButtonElement>('.filter-pill[data-dimension]');
    if (!pill) return;
    const dimensionId = pill.dataset.dimension!;
    const value = pill.dataset.value!;
    const current = new Set(store.get().activeFilters[dimensionId] ?? new Set<string>());
    if (current.has(value)) current.delete(value);
    else current.add(value);
    store.set({ activeFilters: { ...store.get().activeFilters, [dimensionId]: current } });
  });

  // ---- dismissal --------------------------------------------------------

  document.addEventListener('pointerdown', (event) => {
    if (container.contains(event.target as Node)) return;
    if (!calendarOpen && !moreOpen) return;
    setCalendarOpen(false);
    moreOpen = false;
    renderFilters();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (moreOpen) {
      moreOpen = false;
      renderFilters();
    } else if (calendarOpen) {
      setCalendarOpen(false, true);
    }
  });

  desktop.addEventListener('change', renderFilters);

  renderFilters();
  updateVisibility();
  store.subscribe(() => {
    if (options.showDate) renderDate();
    renderFilters();
  });
}
