import type { Store, AppState } from '../../engine/state/store';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { featureMatchesFilters } from '../../engine/taxonomy/compute-dimensions';
import type { GeoFeature } from '../../engine/time/temporal-types';
import type { LayerManifest } from '../../engine/manifests/layer-manifest';
import { searchFeatures } from './search';
import { t } from '../strings';
import { escapeHtml } from '../escape-html';
import { icons } from '../icons';

export function mountSearchOverlay(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>
): void {
  container.innerHTML = `
    <button type="button" class="control-btn control-btn--search" aria-label="${t('search.openLabel', strings)}">${icons.search}</button>
    <section class="map-search" hidden>
      <div class="map-search__backdrop"></div>
      <div class="map-search__panel">
        <div class="map-search__header">
          <div class="search-field">
            <span class="search-submit">${icons.search}</span>
            <input type="search" data-role="search-input" placeholder="${t('search.placeholder', strings)}" />
            <button type="button" class="search-clear" data-action="clear" aria-label="${t('search.clearLabel', strings)}">${icons.close}</button>
          </div>
        </div>
        <div class="search-results" data-role="results"></div>
      </div>
    </section>
  `;

  const toggleButton = container.querySelector<HTMLButtonElement>('.control-btn--search')!;
  const overlay = container.querySelector<HTMLElement>('.map-search')!;
  const backdrop = container.querySelector<HTMLElement>('.map-search__backdrop')!;
  const searchInput = container.querySelector<HTMLInputElement>('[data-role="search-input"]')!;
  const clearButton = container.querySelector<HTMLButtonElement>('[data-action="clear"]')!;
  const resultsEl = container.querySelector<HTMLDivElement>('[data-role="results"]')!;

  // A layer opts out entirely via `panel.showInSearch: false` (e.g. a
  // boundary or heatmap layer that exists to render, not to be searched).
  const featureEntries: { feature: GeoFeature; manifest: LayerManifest }[] = layers
    .filter((layer) => layer.manifest.panel?.showInSearch !== false)
    .flatMap((layer) => layer.features.map((feature) => ({ feature, manifest: layer.manifest })));

  function featureLabel(feature: GeoFeature): string {
    const props = feature.properties;
    return String(props.nombre ?? props.title ?? feature.id ?? t('search.untitledFeature', strings));
  }

  function searchableFeatures(): GeoFeature[] {
    const activeFilters = store.get().activeFilters;
    return featureEntries
      .filter((entry) => featureMatchesFilters(entry.feature, entry.manifest, activeFilters))
      .map((entry) => entry.feature);
  }

  let matches: GeoFeature[] = [];

  function runSearch(): void {
    const query = searchInput.value.trim();
    matches = query ? searchFeatures(searchableFeatures(), query, ['nombre', 'title']) : searchableFeatures();
    resultsEl.innerHTML = matches.length
      ? matches
          .map(
            (feature, index) =>
              `<button type="button" class="search-result-item" data-result-index="${index}"><span class="search-result-item__name">${escapeHtml(featureLabel(feature))}</span></button>`
          )
          .join('')
      : `<p class="search-results__empty">${t('search.noResults', strings)}</p>`;

    resultsEl.querySelectorAll<HTMLButtonElement>('[data-result-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const feature = matches[Number(button.dataset.resultIndex)];
        searchInput.value = '';
        store.set({
          selectedFeatureId: String(feature.id ?? ''),
          panels: { ...store.get().panels, left: 'closed' },
        });
      });
    });
  }

  function open(): void {
    store.set({ panels: { ...store.get().panels, left: 'open' } });
    searchInput.focus();
  }
  function close(): void {
    store.set({ panels: { ...store.get().panels, left: 'closed' } });
  }

  toggleButton.addEventListener('click', () => {
    if (store.get().panels.left === 'open') close();
    else open();
  });
  backdrop.addEventListener('click', close);
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    runSearch();
    searchInput.focus();
  });
  searchInput.addEventListener('input', runSearch);

  function render(): void {
    const isOpen = store.get().panels.left === 'open';
    overlay.hidden = !isOpen;
    toggleButton.setAttribute('aria-expanded', String(isOpen));
    // Always kept fresh: on mobile this only matters while `hidden` is
    // false, but on desktop the panel is always visible (CSS overrides the
    // `hidden` attribute at that breakpoint) regardless of `panels.left`.
    runSearch();
  }
  render();
  store.subscribe(render);
}
