import './styles.css';

import { validateAppManifest } from './engine/manifests/app-manifest';
import { validateLayerManifest, type LayerManifest } from './engine/manifests/layer-manifest';
import { fetchFeatures } from './engine/data/loader-registry';
import { createStore } from './engine/state/store';
import type { AppState } from './engine/state/store';
import { createLeafletMapAdapter } from './engine/space/leaflet/leaflet-map-adapter';
import { loadStrings } from './ui/strings';
import { mountSearchOverlay } from './ui/panels/SearchOverlay';
import { mountPanelRight } from './ui/panels/PanelRight';
import { mountLayerControl } from './ui/panels/LayerControl';
import { mountCalendarBar } from './ui/panels/CalendarBar';
import { mountSettingsControl } from './ui/panels/SettingsControl';
import { mountAppChrome } from './ui/app-chrome';
import { ensureCalendarSystemLoaded } from './engine/time/calendar-conversion';
import type { GeoFeature } from './engine/time/temporal-types';
import type { LoadedLayer } from './engine/taxonomy/compute-dimensions';
import { registerParticipatePlugin } from '../plugins/participate';

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Which `apps/<id>/` instance to load. Defaults to "demo"; override with
// `?app=<id>` (e.g. during local development or a multi-app static host).
// Restricted to a safe path segment — no traversal via the query string.
function resolveAppId(): string {
  const requested = new URLSearchParams(window.location.search).get('app');
  return requested && /^[a-zA-Z0-9_-]+$/.test(requested) ? requested : 'demo';
}

async function bootstrap(): Promise<void> {
  const appId = resolveAppId();
  const appManifest = validateAppManifest(await fetchJson(`apps/${appId}/app-manifest.json`));

  // Only islamic/hebrew calendars pull in @js-temporal/polyfill (a sizable
  // dependency); kick the load off now so it runs in parallel with the
  // fetches below, and await it right before the first consumer needs it.
  const calendarSystemLoaded = ensureCalendarSystemLoaded(appManifest.calendar.system ?? 'gregorian');

  const strings = await loadStrings(appManifest.strings ? `apps/${appId}/${appManifest.strings}` : undefined);

  if (appManifest.plugins?.participate) {
    registerParticipatePlugin(appManifest.plugins.participate, strings);
  }

  const loadedLayers: LoadedLayer[] = await Promise.all(
    appManifest.dataLayers.map(async (layerPath): Promise<LoadedLayer> => {
      const manifest: LayerManifest = validateLayerManifest(await fetchJson(`apps/${appId}/${layerPath}`));
      const features: GeoFeature[] = await fetchFeatures(manifest.source);
      return { manifest, features };
    }),
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
                panels: { ...store.get().panels, left: 'open' },
              })
          : undefined;

      mapAdapter.renderDataLayer(layer.manifest.id, layer.manifest, layer.features, date, state.activeFilters, onFeatureClick);
    }
  }

  renderMap();
  store.subscribe(renderMap);

  await calendarSystemLoaded;
  mountPanelRight(document.querySelector('#panel-right-filters')!, store, loadedLayers, strings);
  mountSearchOverlay(document.querySelector('#search-overlay')!, store, loadedLayers, strings);
  mountLayerControl(document.querySelector('#layer-control')!, store, strings, {
    mapAdapter,
    baseLayerConfigs: appManifest.baseLayers,
    detailLayers: detailLayers.map((l) => ({ id: l.manifest.id, title: l.manifest.title })),
  });
  // Time editor and map-settings button both live inline inside the
  // filters panel now, not as standalone floating controls.
  mountCalendarBar(document.querySelector('#panel-right-time')!, store, appManifest.calendar, strings);
  mountSettingsControl(document.querySelector('#panel-right-map-settings')!, store, strings, {
    appManifest,
    grid: mapAdapter.grid,
  });

  mountAppChrome(store, strings, appManifest, mapAdapter, loadedLayers);

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
