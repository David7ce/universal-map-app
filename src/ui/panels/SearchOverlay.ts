import type { Store, AppState } from '../../engine/state/store';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { featureMatchesFilters, readField } from '../../engine/taxonomy/compute-dimensions';
import type { GeoFeature } from '../../engine/time/temporal-types';
import type { LayerManifest } from '../../engine/manifests/layer-manifest';
import { searchFeatures } from './search';
import { describeTemporalStatus } from './temporal-status';
import { findContainingRegions } from '../../engine/region/spatial-join';
import { t } from '../strings';
import { escapeHtml } from '../escape-html';
import { icons } from '../icons';
import { formatCoordinates, formatInfoFieldHtml } from './info-field-format';

export function mountSearchOverlay(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>,
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
            <button type="button" class="search-clear" data-action="clear" hidden>${icons.close}</button>
          </div>
        </div>
        <div class="search-results" data-role="results" aria-live="polite" aria-atomic="false" hidden></div>
        <div class="search-info" data-role="info" hidden></div>
      </div>
    </section>
  `;

  const toggleButton = container.querySelector<HTMLButtonElement>('.control-btn--search')!;
  const overlay = container.querySelector<HTMLElement>('.map-search')!;
  const backdrop = container.querySelector<HTMLElement>('.map-search__backdrop')!;
  const searchInput = container.querySelector<HTMLInputElement>('[data-role="search-input"]')!;
  const clearButton = container.querySelector<HTMLButtonElement>('[data-action="clear"]')!;
  const resultsEl = container.querySelector<HTMLDivElement>('[data-role="results"]')!;
  const infoEl = container.querySelector<HTMLDivElement>('[data-role="info"]')!;
  const appEl = document.querySelector<HTMLElement>('#app')!;

  // Every feature (across all layers, search-opt-out or not) — needed to look
  // up whatever feature the user selected, whether via a search result or a
  // direct map click on a layer that doesn't participate in search.
  const featureEntries: { feature: GeoFeature; manifest: LayerManifest }[] = layers.flatMap((layer) =>
    layer.features.map((feature) => ({ feature, manifest: layer.manifest })),
  );

  // A layer opts out of search matching via `panel.showInSearch: false` (e.g.
  // a boundary or heatmap layer that exists to render, not to be searched).
  const searchableEntries = featureEntries.filter((entry) => entry.manifest.panel?.showInSearch !== false);

  function featureLabel(feature: GeoFeature): string {
    const props = feature.properties;
    return String(props.name ?? props.title ?? feature.id ?? t('search.untitledFeature', strings));
  }

  function searchableFeatures(): GeoFeature[] {
    const activeFilters = store.get().activeFilters;
    return searchableEntries
      .filter((entry) => featureMatchesFilters(entry.feature, entry.manifest, activeFilters))
      .map((entry) => entry.feature);
  }

  let matches: GeoFeature[] = [];

  function syncClearButton(): void {
    clearButton.hidden = searchInput.value.trim() === '';
  }

  function selectFeature(featureId: string): void {
    store.set({ selectedFeatureId: featureId, panels: { ...store.get().panels, left: 'open' } });
  }

  function runSearch(): void {
    const query = searchInput.value.trim();
    syncClearButton();
    if (!query) {
      matches = [];
      resultsEl.innerHTML = '';
      resultsEl.hidden = true;
      return;
    }

    matches = searchFeatures(searchableFeatures(), query, ['name', 'title']);
    resultsEl.hidden = false;
    resultsEl.innerHTML = matches.length
      ? matches
          .map(
            (feature, index) =>
              `<button type="button" class="search-result-item" data-result-index="${index}"><span class="search-result-item__name">${escapeHtml(featureLabel(feature))}</span></button>`,
          )
          .join('')
      : `<p class="search-results__empty">${t('search.noResults', strings)}</p>`;

    resultsEl.querySelectorAll<HTMLButtonElement>('[data-result-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const feature = matches[Number(button.dataset.resultIndex)];
        selectFeature(String(feature.id ?? ''));
      });
    });
  }

  function renderInfo(entry: { feature: GeoFeature; manifest: LayerManifest }): void {
    const state = store.get();
    const { feature, manifest } = entry;
    const date = new Date(`${state.selectedDate}T00:00:00Z`);

    let regionLine = '';
    let coordinatesLine = '';
    if (feature.geometry.type === 'Point') {
      const coords = feature.geometry.coordinates as [number, number];
      const regions = findContainingRegions(coords, layers, date);
      if (regions.length > 0) {
        const regionNames = regions.map((region) => escapeHtml(featureLabel(region))).join(', ');
        regionLine = `<p>${t('info.containingRegion', strings, { regions: regionNames })}</p>`;
      }
      coordinatesLine = `<p>${t('info.coordinates', strings, formatCoordinates(coords))}</p>`;
    }

    // Extra properties an app author chose to surface via the layer
    // manifest's `panel.infoFields` — field names always come from the
    // manifest, never hardcoded here (same pattern as `taxonomy`).
    const infoFieldLines = (manifest.panel?.infoFields ?? [])
      .map((def) => formatInfoFieldHtml(def, readField(feature, def.field)))
      .join('');

    infoEl.innerHTML = `<p>${describeTemporalStatus(feature, date, strings, state.calendarSystem)}</p>${regionLine}${coordinatesLine}${infoFieldLines}`;
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
    const hadSelection = store.get().selectedFeatureId !== null;
    searchInput.value = '';
    if (hadSelection) {
      // Deselecting also closes the panel — it was only forced 'open' as a
      // side effect of the selection (map click / picking a result), so
      // without this it would stay stuck 'open' with nothing to show.
      store.set({ selectedFeatureId: null, panels: { ...store.get().panels, left: 'closed' } });
    } else {
      runSearch();
    }
    searchInput.focus();
  });
  searchInput.addEventListener('input', () => {
    // Typing again after a selection means the user wants to search anew —
    // drop the stale selection instead of leaving it shown alongside results.
    if (store.get().selectedFeatureId !== null) store.set({ selectedFeatureId: null });
    else runSearch();
  });

  // Escape: if the overlay is open (mobile modal), close it and return focus
  // to the toggle. If the search field has text (desktop always-visible mode),
  // clear it. At desktop, `panels.left` stays 'closed' so only the else
  // branch fires.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (store.get().panels.left === 'open') {
      event.preventDefault();
      close();
      toggleButton.focus();
    } else if (document.activeElement === searchInput && searchInput.value && store.get().selectedFeatureId === null) {
      event.preventDefault();
      searchInput.value = '';
      runSearch();
    }
  });

  function render(): void {
    const state = store.get();
    const isOpen = state.panels.left === 'open';
    const selected =
      state.selectedFeatureId === null
        ? undefined
        : featureEntries.find((e) => String(e.feature.id ?? '') === state.selectedFeatureId);

    overlay.hidden = !isOpen;
    overlay.classList.toggle('is-info', selected !== undefined);
    toggleButton.setAttribute('aria-expanded', String(isOpen));
    clearButton.setAttribute(
      'aria-label',
      t(selected !== undefined ? 'selection.closeLabel' : 'search.clearLabel', strings),
    );

    if (selected !== undefined) {
      searchInput.value = featureLabel(selected.feature);
      syncClearButton();
      resultsEl.hidden = true;
      infoEl.hidden = false;
      renderInfo(selected);
    } else {
      infoEl.hidden = true;
      // Always kept fresh: on mobile this only matters while `hidden` is
      // false, but on desktop the panel is always visible (CSS overrides the
      // `hidden` attribute at that breakpoint) regardless of `panels.left`.
      runSearch();
    }

    // Mirrors the filters panel's `panel-right-open` effect on the zoom
    // control: shifts (desktop) / hides (mobile) the bottom-left Layers
    // button — but only once there's an actual selection to show. An empty
    // search (open, no query, nothing selected) has no docked content for
    // Layers to clear, so it's left alone in that state.
    appEl.classList.toggle('panel-left-open', selected !== undefined);
  }
  render();
  store.subscribe(render);
}
