import type { Store, AppState } from '../../engine/state/store';
import { computeTaxonomyDimensions, type LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { getTriState, toggleAll } from '../../engine/taxonomy/tri-state';
import { resolveTaxonomyIcon } from '../../engine/space/style';
import { escapeHtml } from '../escape-html';
import { icons } from '../icons';

export function mountPanelRight(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  _strings: Record<string, string>,
): void {
  // Which dimension sections are expanded — UI-only state, kept in this
  // closure (not AppState) since nothing outside this panel needs it, and it
  // must survive re-renders triggered by unrelated store changes.
  const openSections = new Set<string>();

  function render(): void {
    const date = new Date(`${store.get().selectedDate}T00:00:00Z`);
    const dimensions = computeTaxonomyDimensions(layers, date);
    const activeFilters = store.get().activeFilters;

    container.innerHTML = dimensions
      .map((dimension) => {
        const selected = activeFilters[dimension.id] ?? new Set<string>();
        const allValues = dimension.values.map((v) => v.value);
        const triState = getTriState(allValues, selected);
        const isOpen = openSections.has(dimension.id);
        const options = dimension.values
          .map((v) => {
            const resolvedIcon = resolveTaxonomyIcon(dimension.icons, dimension.defaultIcon, v.value);
            const icon = resolvedIcon ? `${resolvedIcon} ` : '';
            const count = dimension.showCounts ? `<span class="filter-options__count">${v.count}</span>` : '';
            return `
              <label>
                <input type="checkbox" data-dimension="${escapeHtml(dimension.id)}" data-value="${escapeHtml(v.value)}" ${selected.has(v.value) ? 'checked' : ''} />
                <span>${icon}${escapeHtml(v.value)}</span>
                ${count}
              </label>`;
          })
          .join('');

        return `
          <section class="filter-section${isOpen ? ' is-open' : ''}" data-dimension-section="${escapeHtml(dimension.id)}">
            <div class="filter-section__header">
              <label class="filter-section__select-all">
                <input type="checkbox" data-select-all="${escapeHtml(dimension.id)}" data-tristate="${triState}" ${triState === 'all' ? 'checked' : ''} />
                <span class="filter-section__title">${escapeHtml(dimension.label)}</span>
              </label>
              <button type="button" class="filter-section__toggle" data-toggle-section="${escapeHtml(dimension.id)}" aria-expanded="${isOpen}">
                <span class="icon-chevron">${icons.chevron}</span>
              </button>
            </div>
            <div class="filter-options">${options}</div>
          </section>`;
      })
      .join('');

    // `.indeterminate` has no HTML attribute — must be set imperatively
    // after each render for the 'some selected' tri-state to render.
    container.querySelectorAll<HTMLInputElement>('[data-select-all]').forEach((checkbox) => {
      checkbox.indeterminate = checkbox.dataset.tristate === 'some';
    });

    container.querySelectorAll<HTMLButtonElement>('[data-toggle-section]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.toggleSection!;
        if (openSections.has(id)) openSections.delete(id);
        else openSections.add(id);
        render();
      });
    });

    container.querySelectorAll<HTMLInputElement>('[data-select-all]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const dimensionId = checkbox.dataset.selectAll!;
        const dimension = dimensions.find((d) => d.id === dimensionId)!;
        const allValues = dimension.values.map((v) => v.value);
        const current = store.get().activeFilters[dimensionId] ?? new Set<string>();
        store.set({ activeFilters: { ...store.get().activeFilters, [dimensionId]: toggleAll(allValues, current) } });
      });
    });

    container.querySelectorAll<HTMLInputElement>('input[data-dimension]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const dimensionId = checkbox.dataset.dimension!;
        const value = checkbox.dataset.value!;
        const current = new Set(store.get().activeFilters[dimensionId] ?? new Set<string>());
        if (checkbox.checked) current.add(value);
        else current.delete(value);
        store.set({ activeFilters: { ...store.get().activeFilters, [dimensionId]: current } });
      });
    });
  }

  render();
  store.subscribe(render);
}
