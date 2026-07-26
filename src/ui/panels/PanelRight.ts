import type { Store, AppState } from '../../engine/state/store';
import { computeTaxonomyDimensions, type LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { getTriState, toggleAll } from '../../engine/taxonomy/tri-state';

export function mountPanelRight(container: HTMLElement, store: Store<AppState>, layers: LoadedLayer[]): void {
  function render(): void {
    const date = new Date(`${store.get().selectedDate}T00:00:00Z`);
    const dimensions = computeTaxonomyDimensions(layers, date);
    const activeFilters = store.get().activeFilters;

    container.innerHTML = dimensions
      .map((dimension) => {
        const selected = activeFilters[dimension.id] ?? new Set<string>();
        const allValues = dimension.values.map((v) => v.value);
        const triState = getTriState(allValues, selected);
        const options = dimension.values
          .map(
            (v) => `
              <label>
                <input type="checkbox" data-dimension="${dimension.id}" data-value="${v.value}" ${selected.has(v.value) ? 'checked' : ''} />
                ${v.value} (${v.count})
              </label>`
          )
          .join('');

        return `
          <section data-dimension-section="${dimension.id}">
            <label>
              <input type="checkbox" data-select-all="${dimension.id}" ${triState === 'all' ? 'checked' : ''} />
              ${dimension.label}
            </label>
            <div>${options}</div>
          </section>`;
      })
      .join('');

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
