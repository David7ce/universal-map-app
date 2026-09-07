import type { Store, AppState } from '../../engine/state/store';
import { computeTaxonomyDimensions, type LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { resolveTaxonomyIcon } from '../../engine/space/style';
import { escapeHtml } from '../escape-html';

// Always-visible category chip bar, shown under the header on the Map view.
// A fast path onto the same activeFilters state PanelRight's filters drawer
// already owns (same store.set shape, PanelRight.ts's per-value toggle) —
// this is additive, not a replacement: the drawer still holds every
// dimension (including ones with no icons, e.g. "municipality"), this bar
// only surfaces the subset a world chose to give icons to. Boundary-region
// dimensions (regionRole: "boundary") never get here since
// computeTaxonomyDimensions sets showCounts: false for them and no world
// gives those icons either way, but both checks guard it explicitly since
// "has icons" alone is the real signal a taxonomy field is meant as a
// user-facing category, not incidental metadata.
export function mountCategoryNav(container: HTMLElement, store: Store<AppState>, layers: LoadedLayer[]): void {
  function render(): void {
    if (store.get().view !== 'map') return;
    const date = new Date(`${store.get().selectedDate}T00:00:00Z`);
    const dimensions = computeTaxonomyDimensions(layers, date).filter((d) => d.showCounts && d.icons);
    const activeFilters = store.get().activeFilters;

    if (dimensions.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = dimensions
      .map((dimension) => {
        const selected = activeFilters[dimension.id] ?? new Set<string>();
        return dimension.values
          .map((v) => {
            const icon = resolveTaxonomyIcon(dimension.icons, dimension.defaultIcon, v.value) ?? '';
            const isActive = selected.has(v.value);
            return `<button type="button" class="category-nav__chip${isActive ? ' is-active' : ''}" data-dimension="${escapeHtml(dimension.id)}" data-value="${escapeHtml(v.value)}">
              <span class="category-nav__chip-icon">${icon}</span>
              <span>${escapeHtml(v.value)}</span>
            </button>`;
          })
          .join('');
      })
      .join('');

    container.querySelectorAll<HTMLButtonElement>('[data-dimension]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const dimensionId = chip.dataset.dimension!;
        const value = chip.dataset.value!;
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
