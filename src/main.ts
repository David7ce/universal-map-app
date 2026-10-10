import './styles.css';

import { validateAppManifest } from './engine/manifests/app-manifest';
import { appBasePath, isWorldExplicit, resolveWorldId } from './engine/manifests/resolve-world-id';
import { fetchFeatures } from './engine/data/loader-registry';
import { loadLayer } from './engine/data/load-layer';
import { createStore } from './engine/state/store';
import type { AppState } from './engine/state/store';
import { createLeafletMapAdapter } from './engine/space/leaflet/leaflet-map-adapter';
import { loadStrings } from './ui/strings';
import { loadSiteStrings, mergeStrings } from './ui/site-strings';
import { getStoredLanguage, resolveLanguage } from './ui/language';
import { applyBranding } from './ui/branding';
import { mountSearchOverlay } from './ui/panels/SearchOverlay';
import { mountLightbox } from './ui/panels/Lightbox';
import { mountPanelRight } from './ui/panels/PanelRight';
import { mountLayerControl } from './ui/panels/LayerControl';
import { mountHomeView } from './ui/panels/HomeView';
import { mountMapToolbar } from './ui/panels/MapToolbar';
import { mountSettingsControl } from './ui/panels/SettingsControl';
import { mountAppChrome } from './ui/app-chrome';
import { ensureCalendarSystemLoaded } from './engine/time/calendar-conversion';
import type { GeoFeature } from './engine/time/temporal-types';
import type { LoadedLayer } from './engine/taxonomy/compute-dimensions';
import { activatePlugins } from './engine/plugins/activate';
import { subscribePluginHooks } from './engine/plugins/registry';
import { createPluginContext } from './engine/plugins/context';
import { SITE_TITLE } from './ui/worlds';

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function bootstrap(): Promise<void> {
  const searchParams = new URLSearchParams(window.location.search);
  const basePath = appBasePath(document.baseURI);
  const explicitWorld = isWorldExplicit(searchParams, import.meta.env.MODE, window.location.pathname, basePath);
  const language = resolveLanguage(getStoredLanguage(), navigator.language);
  document.documentElement.lang = language;
  const siteStrings = await loadSiteStrings(language);

  // `/` is the project landing page, not the default world's Home overlay.
  // Avoid loading any world's manifest/data or constructing Leaflet until a
  // visitor follows a world link (or opens a world URL directly).
  if (!explicitWorld) {
    document.title = SITE_TITLE;
    document.querySelector<HTMLElement>('#app')!.classList.add('view-home');
    mountHomeView(document.querySelector('#home-view')!, siteStrings, language);
    document.getElementById('loading-overlay')?.remove();
    return;
  }

  const appId = resolveWorldId(searchParams, import.meta.env.MODE, window.location.pathname, basePath);
  const appManifest = validateAppManifest(await fetchJson(`worlds/${appId}/world.json`));
  applyBranding(appManifest, appId);
  document.querySelector('#app')!.classList.toggle('no-time', appManifest.systems?.time === false);

  // Only islamic/hebrew calendars pull in @js-temporal/polyfill (a sizable
  // dependency); kick the load off now so it runs in parallel with the
  // fetches below, and await it right before the first consumer needs it.
  const calendarSystemLoaded = ensureCalendarSystemLoaded(appManifest.calendar.system ?? 'gregorian');

  const worldStrings = await loadStrings(
    appManifest.strings ? `worlds/${appId}/${appManifest.strings}` : undefined,
    language,
  );
  const strings = mergeStrings(siteStrings, worldStrings);

  await activatePlugins(appManifest.plugins, strings);

  const loadedLayers: LoadedLayer[] = await Promise.all(
    appManifest.dataLayers.map((layerPath): Promise<LoadedLayer> =>
      loadLayer(
        { fetchJson, fetchFeatures },
        appId,
        layerPath,
        language,
        appManifest.contentLanguage ?? 'en',
        appManifest.translations ?? [],
      ),
    ),
  );

  // "Detail" layers (any layer with `panel.showByDefault: false` — e.g. a
  // heatmap, or a region/boundary layer) are opt-in via the layer control's
  // checkbox group, hidden until the user turns them on.
  const detailLayers = loadedLayers.filter((l) => l.manifest.panel?.showByDefault === false);

  const store = createStore<AppState>({
    selectedDate:
      appManifest.calendar.default === 'today' ? new Date().toISOString().slice(0, 10) : appManifest.calendar.default,
    activeFilters: {},
    selectedFeatureId: null,
    activeBaseLayerId: appManifest.baseLayers[0].id,
    panels: { left: 'closed', right: 'closed' },
    hiddenLayerIds: new Set(detailLayers.map((l) => l.manifest.id)),
    calendarSystem: appManifest.calendar.system ?? 'gregorian',
    showGrid: false,
    view: 'map',
  });

  const mapContainer = document.querySelector<HTMLDivElement>('#map')!;
  const mapAdapter = await createLeafletMapAdapter(mapContainer, appManifest);

  function renderMap(): void {
    const state = store.get();
    const date = new Date(`${state.selectedDate}T00:00:00Z`);
    for (const layer of loadedLayers) {
      if (state.hiddenLayerIds.has(layer.manifest.id)) {
        mapAdapter.removeDataLayer(layer.manifest.id);
        continue;
      }

      // Layers that expose an info panel are clickable directly on the map.
      // `left: 'open'` so the merged search/info panel surfaces the
      // selection on mobile, where it's otherwise hidden.
      const onFeatureClick =
        layer.manifest.panel?.showInInfo !== false
          ? (feature: GeoFeature) =>
              store.set({
                selectedFeatureId: String(feature.id ?? ''),
                // Also closes the filters panel — see `openPanel`'s comment
                // in `store.ts`: only one full-screen mobile drawer at a time.
                panels: { left: 'open', right: 'closed' },
              })
          : undefined;

      mapAdapter.renderDataLayer(
        layer.manifest.id,
        layer.manifest,
        layer.features,
        date,
        state.activeFilters,
        onFeatureClick,
      );
    }
  }

  renderMap();
  store.subscribe(renderMap);

  await calendarSystemLoaded;
  mountPanelRight(document.querySelector('#panel-right-filters')!, store, loadedLayers, strings);
  const lightbox = mountLightbox(document.querySelector('#lightbox')!, strings);
  mountSearchOverlay(document.querySelector('#search-overlay')!, store, loadedLayers, strings, lightbox);
  mountLayerControl(document.querySelector('#layer-control')!, store, strings, {
    mapAdapter,
    baseLayerConfigs: appManifest.baseLayers,
    detailLayers: detailLayers.map((l) => ({ id: l.manifest.id, title: l.manifest.title })),
  });
  // Map settings live inline inside the right panel.
  mountSettingsControl(document.querySelector('#panel-right-settings')!, store, strings, {
    appManifest,
    mapAdapter,
  });

  mountAppChrome(store, strings, appManifest, mapAdapter, loadedLayers);
  mountMapToolbar(document.querySelector('#map-toolbar')!, store, loadedLayers, strings, {
    calendar: appManifest.calendar,
    showDate: appManifest.systems?.time !== false,
  });
  subscribePluginHooks(store, createPluginContext(store, loadedLayers));

  document.getElementById('loading-overlay')?.remove();
}

bootstrap().catch((error) => {
  document.getElementById('loading-overlay')?.remove();
  console.error('Failed to bootstrap app', error);
  document.body.innerHTML = '';
  const pre = document.createElement('pre');
  pre.style.color = 'red';
  pre.textContent = String(error);
  document.body.appendChild(pre);
});
