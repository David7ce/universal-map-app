import type { Store, AppState } from '../../engine/state/store';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { featureMatchesFilters } from '../../engine/taxonomy/compute-dimensions';
import type { GeoFeature } from '../../engine/time/temporal-types';
import type { LayerManifest } from '../../engine/manifests/layer-manifest';
import { searchFeatures } from './search';
import { describeTemporalStatus } from './temporal-status';
import { t } from '../strings';

export function mountPanelLeft(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>
): void {
  container.innerHTML = `
    <input type="search" data-role="search-input" placeholder="${t('search.placeholder', strings)}" />
    <div data-role="results"></div>
    <div data-role="info" hidden></div>
  `;

  const searchInput = container.querySelector<HTMLInputElement>('[data-role="search-input"]')!;
  const resultsEl = container.querySelector<HTMLDivElement>('[data-role="results"]')!;
  const infoEl = container.querySelector<HTMLDivElement>('[data-role="info"]')!;

  // Keep each feature paired with the layer manifest it came from so search
  // results can be filtered against `activeFilters` the same way the map is
  // (each manifest's own `taxonomy` array is what defines which dimensions
  // apply to it — no hardcoded field names here).
  const featureEntries: { feature: GeoFeature; manifest: LayerManifest }[] = layers.flatMap((layer) =>
    layer.features.map((feature) => ({ feature, manifest: layer.manifest }))
  );
  const allFeatures = featureEntries.map((entry) => entry.feature);

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
    matches = searchFeatures(searchableFeatures(), searchInput.value, ['nombre', 'title']);
    resultsEl.innerHTML = matches
      .map((feature, index) => `<button type="button" data-result-index="${index}">${featureLabel(feature)}</button>`)
      .join('');

    resultsEl.querySelectorAll<HTMLButtonElement>('[data-result-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const feature = matches[Number(button.dataset.resultIndex)];
        store.set({ selectedFeatureId: String(feature.id ?? '') });
      });
    });
  }

  searchInput.addEventListener('input', runSearch);

  store.subscribe((state) => {
    if (state.selectedFeatureId === null) {
      infoEl.hidden = true;
      resultsEl.hidden = false;
      // Filters (or anything else) may have changed while results were
      // showing — recompute so checking/unchecking a filter checkbox is
      // reflected in already-visible search results, not just the map.
      runSearch();
      return;
    }
    const feature = allFeatures.find((f) => String(f.id ?? '') === state.selectedFeatureId);
    if (!feature) return;

    const date = new Date(`${state.selectedDate}T00:00:00Z`);
    infoEl.hidden = false;
    resultsEl.hidden = true;
    infoEl.innerHTML = `<h3>${featureLabel(feature)}</h3><p>${describeTemporalStatus(feature, date, strings)}</p>`;
  });
}
