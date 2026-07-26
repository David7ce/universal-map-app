import './styles.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Layer } from 'leaflet';

import { validateAppManifest } from './engine/manifests/app-manifest';
import { validateLayerManifest, type LayerManifest } from './engine/manifests/layer-manifest';
import { fetchFeatures } from './engine/data/loader-registry';
import { createStore } from './engine/state/store';
import type { AppState } from './engine/state/store';
import { createMap } from './engine/space/map';
import { renderDataLayer } from './engine/space/data-layer-renderer';
import { loadStrings } from './ui/strings';
import { mountPanelLeft } from './ui/panels/PanelLeft';
import { mountPanelRight } from './ui/panels/PanelRight';
import { mountCalendarBar } from './ui/panels/CalendarBar';
import type { GeoFeature } from './engine/time/temporal-types';
import type { LoadedLayer } from './engine/taxonomy/compute-dimensions';

async function bootstrap(): Promise<void> {
  const appManifestResponse = await fetch('/apps/demo/app-manifest.json');
  const appManifest = validateAppManifest(await appManifestResponse.json());

  const strings = await loadStrings(appManifest.strings ? `/apps/demo/${appManifest.strings}` : undefined);

  const loadedLayers: LoadedLayer[] = [];
  for (const layerPath of appManifest.dataLayers) {
    const layerManifestResponse = await fetch(`/apps/demo/${layerPath}`);
    const manifest: LayerManifest = validateLayerManifest(await layerManifestResponse.json());
    const features: GeoFeature[] = await fetchFeatures(manifest.source);
    loadedLayers.push({ manifest, features });
  }

  const store = createStore<AppState>({
    selectedDate: new Date().toISOString().slice(0, 10),
    activeFilters: {},
    selectedFeatureId: null,
    activeBaseLayerId: appManifest.baseLayers[0].id,
    panels: { left: 'closed', right: 'closed' },
  });

  const mapContainer = document.querySelector<HTMLDivElement>('#map')!;
  const map = createMap(mapContainer, appManifest);
  const renderedLayers = new Map<string, Layer>();

  function renderMap(): void {
    const state = store.get();
    const date = new Date(`${state.selectedDate}T00:00:00Z`);
    for (const layer of loadedLayers) {
      const existing = renderedLayers.get(layer.manifest.id);
      if (existing) map.removeLayer(existing);
      renderedLayers.set(
        layer.manifest.id,
        renderDataLayer(map, layer.manifest, layer.features, date, state.activeFilters)
      );
    }
  }

  renderMap();
  store.subscribe(renderMap);

  mountCalendarBar(document.querySelector('#calendar-bar')!, store, appManifest.calendar);
  mountPanelRight(document.querySelector('#panel-right')!, store, loadedLayers);
  mountPanelLeft(document.querySelector('#panel-left')!, store, loadedLayers, strings);
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap app', error);
  document.body.innerHTML = `<pre style="color:red">${String(error)}</pre>`;
});
