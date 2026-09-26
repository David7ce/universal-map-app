import type { Store, AppState } from '../../engine/state/store';
import { computeTaxonomyDimensions, type LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { resolveTaxonomyIcon } from '../../engine/space/style';
import { escapeHtml } from '../escape-html';
import { t } from '../strings';

// Top-of-map filter pills — a *shortcut* onto the most-used filters, not the
// full filter UI. The right panel (PanelRight.ts) always holds every
// dimension; this bar only appears when the whole filter set is small enough
// to fit comfortably at the top of the map (see MAX_PILLS/MAX_DIMENSIONS).
// A world with many dimensions or many values (e.g. a world with dozens of
// municipios) gets no top bar at all — filters live in the panel instead.
const MAX_PILLS = 8;
const MAX_DIMENSIONS = 2;

export function mountFilterPills(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>,
): void {
  function render(): void {
    if (store.get().view !== 'map') return;
    const date = new Date(`${store.get().selectedDate}T00:00:00Z`);
    // A dimension with no values active on the selected date (e.g. a
    // seasonal events world in the off-season) would otherwise render a
    // label with an empty pill row — drop those entirely.
    const dimensions = computeTaxonomyDimensions(layers, date).filter((d) => d.values.length > 0);
    const totalPills = dimensions.reduce((sum, d) => sum + d.values.length, 0);

    // Too many filters to be a glanceable shortcut — leave them to the panel.
    if (dimensions.length === 0 || dimensions.length > MAX_DIMENSIONS || totalPills > MAX_PILLS) {
      container.innerHTML = '';
      return;
    }

    const activeFilters = store.get().activeFilters;
    const hasActiveFilters = Object.values(activeFilters).some((selected) => selected.size > 0);

    const clearAll = hasActiveFilters
      ? `<button type="button" class="filter-pills__clear" data-action="clear-all">${escapeHtml(t('filters.clearAll', strings))}</button>`
      : '';

    const groups = dimensions
      .map((dimension) => {
        const selected = activeFilters[dimension.id] ?? new Set<string>();
        const pills = dimension.values
          .map((v) => {
            const icon = resolveTaxonomyIcon(dimension.icons, dimension.defaultIcon, v.value);
            const isActive = selected.has(v.value);
            return `<button type="button" class="filter-pill${isActive ? ' is-active' : ''}" data-dimension="${escapeHtml(dimension.id)}" data-value="${escapeHtml(v.value)}" aria-pressed="${isActive}">
              ${icon ? `<span class="filter-pill__icon">${icon}</span>` : ''}
              <span>${escapeHtml(v.value)}</span>
            </button>`;
          })
          .join('');
        return `<div class="filter-pills__group" data-dimension-group="${escapeHtml(dimension.id)}">
          <span class="filter-pills__label">${escapeHtml(dimension.label)}</span>
          ${pills}
        </div>`;
      })
      .join('');

    container.innerHTML = `<div class="filter-pills__scroll">${groups}</div>${clearAll}`;

    container.querySelector<HTMLButtonElement>('[data-action="clear-all"]')?.addEventListener('click', () => {
      store.set({ activeFilters: {} });
    });

    container.querySelectorAll<HTMLButtonElement>('.filter-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const dimensionId = pill.dataset.dimension!;
        const value = pill.dataset.value!;
        const current = new Set(store.get().activeFilters[dimensionId] ?? new Set<string>());
        if (current.has(value)) current.delete(value);
        else current.add(value);
        store.set({ activeFilters: { ...store.get().activeFilters, [dimensionId]: current } });
      });
    });
  }

  render();
  store.subscribe(render);
}
