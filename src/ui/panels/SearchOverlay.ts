import type { Store, AppState } from '../../engine/state/store';
import { openPanel } from '../../engine/state/store';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { featureMatchesFilters, readField } from '../../engine/taxonomy/compute-dimensions';
import type { GeoFeature } from '../../engine/time/temporal-types';
import type { LayerManifest } from '../../engine/manifests/layer-manifest';
import { getFeaturesOnDate } from '../../engine/time/day-agenda';
import { formatCalendarDate } from '../../engine/time/calendar-conversion';
import { isActiveOn } from '../../engine/time/is-active-on';
import { searchFeatures, dedupeSearchResults } from './search';
import { describeTemporalStatus } from './temporal-status';
import { findContainingRegions } from '../../engine/region/spatial-join';
import { t } from '../strings';
import { escapeHtml } from '../escape-html';
import { icons } from '../icons';
import { formatCoordinates, formatInfoFieldHtml, isAllowedUrl } from './info-field-format';
import type { LightboxApi } from './Lightbox';

export function featureLabel(feature: GeoFeature, strings: Record<string, string>): string {
  const props = feature.properties;
  return String(props.name ?? props.title ?? feature.id ?? t('search.untitledFeature', strings));
}

export function mountSearchOverlay(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>,
  lightbox: LightboxApi,
): void {
  container.innerHTML = `
    <button type="button" class="control-btn control-btn--search" aria-controls="map-search-panel" aria-expanded="false" aria-label="${t('search.openLabel', strings)}">${icons.search}</button>
    <section id="map-search-panel" class="map-search" role="dialog" aria-label="${t('search.openLabel', strings)}" aria-modal="true" hidden>
      <div class="map-search__backdrop"></div>
      <div class="map-search__panel">
        <div class="map-search__header">
          <div class="search-field">
            <span class="search-submit">${icons.search}</span>
            <input type="search" data-role="search-input" aria-label="${t('search.placeholder', strings)}" placeholder="${t('search.placeholder', strings)}" />
            <button type="button" class="search-clear" data-action="clear" hidden>${icons.close}</button>
          </div>
          <button type="button" class="map-search__close" data-action="close" aria-label="${t('selection.closeLabel', strings)}">${icons.close}</button>
        </div>
        <div class="search-results" data-role="results" aria-live="polite" aria-atomic="false" hidden></div>
        <div class="search-info" data-role="info" hidden></div>
        <div class="search-day-agenda" data-role="day-agenda" hidden></div>
      </div>
    </section>
  `;

  const toggleButton = container.querySelector<HTMLButtonElement>('.control-btn--search')!;
  const overlay = container.querySelector<HTMLElement>('.map-search')!;
  const backdrop = container.querySelector<HTMLElement>('.map-search__backdrop')!;
  const searchInput = container.querySelector<HTMLInputElement>('[data-role="search-input"]')!;
  const clearButton = container.querySelector<HTMLButtonElement>('[data-action="clear"]')!;
  const closeButton = container.querySelector<HTMLButtonElement>('[data-action="close"]')!;
  const resultsEl = container.querySelector<HTMLDivElement>('[data-role="results"]')!;
  const infoEl = container.querySelector<HTMLDivElement>('[data-role="info"]')!;
  const dayAgendaEl = container.querySelector<HTMLDivElement>('[data-role="day-agenda"]')!;
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

  // Which feature properties a query matches against. Defaults to the usual
  // display fields; a layer can override via `panel.searchFields` (e.g. a
  // photo layer searching only by place name, not by camera/date metadata).
  const DEFAULT_SEARCH_FIELDS = ['name', 'title'];
  function searchFieldsFor(manifest: LayerManifest): string[] {
    return manifest.panel?.searchFields ?? DEFAULT_SEARCH_FIELDS;
  }

  let matches: GeoFeature[] = [];

  function syncClearButton(): void {
    clearButton.hidden = searchInput.value.trim() === '';
  }

  function selectFeature(featureId: string): void {
    // Also closes the filters panel — see `openPanel`'s comment in
    // `store.ts`: only one full-screen mobile drawer at a time.
    store.set({ selectedFeatureId: featureId, panels: { left: 'open', right: 'closed' } });
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

    // Search each layer with its own field list, then collapse results that
    // read as the same entry (e.g. many photos from one place) so the list
    // shows one row per place.
    const activeFilters = store.get().activeFilters;
    const perLayerMatches = searchableEntries
      .filter((entry) => featureMatchesFilters(entry.feature, entry.manifest, activeFilters))
      .flatMap((entry) => searchFeatures([entry.feature], query, searchFieldsFor(entry.manifest)));
    matches = dedupeSearchResults(perLayerMatches, DEFAULT_SEARCH_FIELDS);
    resultsEl.hidden = false;
    const countLine = matches.length
      ? `<p class="search-results__count">${escapeHtml(t('search.resultCount', strings, { count: String(matches.length) }))}</p>`
      : '';
    resultsEl.innerHTML =
      countLine +
      (matches.length
        ? matches
            .map(
              (feature, index) => {
                const portrait = typeof feature.properties?.portrait === 'string' ? feature.properties.portrait.trim() : '';
                const thumb = portrait
                  ? `<img class="search-result-item__thumb" src="${escapeHtml(portrait)}" alt="" loading="lazy" />`
                  : '';
                return `<button type="button" class="search-result-item" data-result-index="${index}">${thumb}<span class="search-result-item__name">${escapeHtml(featureLabel(feature, strings))}</span></button>`;
              },
            )
            .join('')
        : `<p class="search-results__empty">${t('search.noResults', strings)}</p>`);

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
        const regionNames = regions.map((region) => escapeHtml(featureLabel(region, strings))).join(', ');
        regionLine = `<p>${t('info.containingRegion', strings, { regions: regionNames })}</p>`;
      }
      coordinatesLine = `<p>${t('info.coordinates', strings, formatCoordinates(coords))}</p>`;
    }

    // Several features can share one coordinate on one day (e.g. multiple
    // moon photos taken from the same spot) — the map shows a single marker
    // for them (style.dedupeMarkers), so the panel is where every photo
    // becomes reachable. Collect the image field's values across all
    // same-coordinate, same-day siblings and render them as one gallery.
    const siblingGallery = buildSiblingGallery(entry, date);

    // Extra properties an app author chose to surface via the layer
    // manifest's `panel.infoFields` — field names always come from the
    // manifest, never hardcoded here (same pattern as `taxonomy`). When the
    // sibling gallery above already shows this feature's image field, skip
    // that field here so the same photo isn't rendered twice.
    const infoFieldLines = (manifest.panel?.infoFields ?? [])
      .filter((def) => !(siblingGallery && def.type === 'image'))
      .map((def) => formatInfoFieldHtml(def, readField(feature, def.field)))
      .join('');

    infoEl.innerHTML = `<p>${describeTemporalStatus(feature, date, strings, state.calendarSystem)}</p>${regionLine}${coordinatesLine}${siblingGallery}${infoFieldLines}`;

    // Gallery info fields (formatInfoFieldHtml, image type with >1 value)
    // render as plain buttons with the image list stashed in a data
    // attribute — wire them to the shared lightbox here, after the HTML
    // they're part of actually exists in the DOM.
    infoEl.querySelectorAll<HTMLElement>('.search-info__gallery').forEach((galleryEl) => {
      const images = JSON.parse(galleryEl.dataset.galleryImages ?? '[]');
      galleryEl.querySelectorAll<HTMLButtonElement>('[data-gallery-index]').forEach((button) => {
        button.addEventListener('click', () => lightbox.open(images, Number(button.dataset.galleryIndex)));
      });
    });
  }

  // Every feature in the same layer at the same coordinate that is active on
  // the selected date, rendered as a thumbnail gallery (with the shared
  // lightbox's prev/next arrows). Returns '' when there's only the one
  // feature — the normal single-image info field already covers that case.
  function buildSiblingGallery(entry: { feature: GeoFeature; manifest: LayerManifest }, date: Date): string {
    const { feature, manifest } = entry;
    if (feature.geometry.type !== 'Point') return '';
    const imageField = manifest.panel?.infoFields?.find((def) => def.type === 'image');
    if (!imageField) return '';

    const coords = (feature.geometry.coordinates as [number, number]).join(',');
    const siblings = layers
      .filter((layer) => layer.manifest.id === manifest.id)
      .flatMap((layer) => layer.features)
      .filter(
        (candidate) =>
          candidate.geometry.type === 'Point' &&
          (candidate.geometry.coordinates as [number, number]).join(',') === coords &&
          isActiveOn(candidate, date),
      );

    const images = siblings
      .flatMap((candidate) => readField(candidate, imageField.field))
      .filter(isAllowedUrl)
      .map((src) => ({ src, alt: imageField.label }));
    if (images.length <= 1) return '';

    const thumbs = images
      .map(
        (image, i) =>
          `<button type="button" class="search-info__gallery-thumb" data-gallery-index="${i}"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)} ${i + 1}"></button>`,
      )
      .join('');
    return `<p><strong>${escapeHtml(imageField.label)} (${images.length})</strong></p><div class="search-info__gallery" data-gallery-images="${escapeHtml(JSON.stringify(images))}">${thumbs}</div>`;
  }

  // Idle state (no search query, nothing selected): lists the selected
  // date's events right in this panel instead of leaving it blank — the
  // compact Time widget (CalendarBar.ts) and the full Calendar view's List
  // tab both only pick/browse dates now, so this is the one place a day's
  // events actually render without switching views. Reactive: re-runs from
  // the shared render() below on every store change (selectedDate,
  // activeFilters, hiddenLayerIds).
  function renderDayAgenda(): void {
    const state = store.get();
    const visibleLayers = layers.filter((layer) => !state.hiddenLayerIds.has(layer.manifest.id));
    const entries = getFeaturesOnDate(visibleLayers, state.activeFilters, state.selectedDate);
    const dateLabel = formatCalendarDate(state.selectedDate, state.calendarSystem);

    const listHtml = entries.length
      ? `<ul class="search-day-agenda__list">${entries
          .map(
            (entry) => `<li class="search-day-agenda__item">
              <button type="button" class="search-day-agenda__item-btn" data-feature-id="${escapeHtml(String(entry.feature.id ?? ''))}">
                <span class="search-day-agenda__item-layer">${escapeHtml(entry.layerTitle)}</span>
                <span class="search-day-agenda__item-name">${escapeHtml(featureLabel(entry.feature, strings))}</span>
              </button>
            </li>`,
          )
          .join('')}</ul>`
      : `<p class="search-day-agenda__empty">${escapeHtml(t('calendarView.noEvents', strings))}</p>`;

    dayAgendaEl.innerHTML = `<p class="search-day-agenda__date">${escapeHtml(dateLabel)}</p>${listHtml}`;
    dayAgendaEl.querySelectorAll<HTMLButtonElement>('[data-feature-id]').forEach((button) => {
      button.addEventListener('click', () => selectFeature(button.dataset.featureId!));
    });
  }

  function open(): void {
    openPanel(store, 'left');
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
  closeButton.addEventListener('click', close);
  clearButton.addEventListener('click', () => {
    const hadSelection = store.get().selectedFeatureId !== null;
    searchInput.value = '';
    if (hadSelection) {
      // Deselecting also closes the panel — it was only forced 'open' as a
      // side effect of the selection (map click / picking a result), so
      // without this it would stay stuck 'open' with nothing to show.
      store.set({ selectedFeatureId: null, panels: { ...store.get().panels, left: 'closed' } });
    } else {
      // Not just runSearch() — clearing back to an empty query also needs
      // to re-show the day agenda (render() syncs dayAgendaEl's hidden
      // state, runSearch() alone doesn't touch it).
      render();
    }
    searchInput.focus();
  });
  searchInput.addEventListener('input', () => {
    // Typing again after a selection means the user wants to search anew —
    // drop the stale selection instead of leaving it shown alongside results.
    if (store.get().selectedFeatureId !== null) store.set({ selectedFeatureId: null });
    // Same reasoning as the clear button above: render(), not runSearch()
    // directly, so the day agenda hides/reappears as the query goes
    // non-empty/empty.
    else render();
  });

  // Escape closes the panel and returns focus to the toggle — same
  // behavior at every breakpoint now that desktop no longer forces the
  // panel permanently open (the input is only reachable while open, so
  // there's no longer a "closed but focused and has text" state to handle
  // separately).
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || store.get().panels.left !== 'open') return;
    event.preventDefault();
    close();
    toggleButton.focus();
  });

  function render(): void {
    const state = store.get();
    const isOpen = state.panels.left === 'open';
    const selected =
      state.selectedFeatureId === null
        ? undefined
        : featureEntries.find((e) => String(e.feature.id ?? '') === state.selectedFeatureId);

    overlay.hidden = !isOpen;
    overlay.setAttribute('aria-hidden', String(!isOpen));
    overlay.classList.toggle('is-info', selected !== undefined);
    toggleButton.setAttribute('aria-expanded', String(isOpen));
    clearButton.setAttribute(
      'aria-label',
      t(selected !== undefined ? 'selection.closeLabel' : 'search.clearLabel', strings),
    );

    if (selected !== undefined) {
      searchInput.value = featureLabel(selected.feature, strings);
      syncClearButton();
      resultsEl.hidden = true;
      dayAgendaEl.hidden = true;
      infoEl.hidden = false;
      renderInfo(selected);
    } else {
      infoEl.hidden = true;
      // Always kept fresh: on mobile this only matters while `hidden` is
      // false, but on desktop the panel is always visible (CSS overrides the
      // `hidden` attribute at that breakpoint) regardless of `panels.left`.
      const hasQuery = searchInput.value.trim() !== '';
      dayAgendaEl.hidden = hasQuery;
      if (!hasQuery) renderDayAgenda();
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
