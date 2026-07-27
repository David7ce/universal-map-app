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
import { loadStrings, t } from './ui/strings';
import { mountSearchOverlay } from './ui/panels/SearchOverlay';
import { mountSelectionCard } from './ui/panels/SelectionCard';
import { mountPanelRight } from './ui/panels/PanelRight';
import { mountLayerControl } from './ui/panels/LayerControl';
import { mountCalendarBar } from './ui/panels/CalendarBar';
import type { GeoFeature } from './engine/time/temporal-types';
import type { LoadedLayer } from './engine/taxonomy/compute-dimensions';
import { registerParticipatePlugin } from '../plugins/participate';
import { getPanelSlots, type PluginContext } from './engine/plugins/registry';

async function bootstrap(): Promise<void> {
  const appManifestResponse = await fetch('/apps/demo/app-manifest.json');
  const appManifest = validateAppManifest(await appManifestResponse.json());

  const strings = await loadStrings(appManifest.strings ? `/apps/demo/${appManifest.strings}` : undefined);

  if (appManifest.plugins?.participate) {
    registerParticipatePlugin(appManifest.plugins.participate, strings);
  }

  const loadedLayers: LoadedLayer[] = [];
  for (const layerPath of appManifest.dataLayers) {
    const layerManifestResponse = await fetch(`/apps/demo/${layerPath}`);
    const manifest: LayerManifest = validateLayerManifest(await layerManifestResponse.json());
    const features: GeoFeature[] = await fetchFeatures(manifest.source);
    loadedLayers.push({ manifest, features });
  }

  // "Detail" layers (currently: heatmap) are opt-in via the layer control's
  // checkbox group, hidden by default — a heatmap glowing over the whole map
  // on first load would obscure everything else.
  const detailLayers = loadedLayers.filter((l) => l.manifest.kind === 'heatmap');

  const store = createStore<AppState>({
    selectedDate: new Date().toISOString().slice(0, 10),
    activeFilters: {},
    selectedFeatureId: null,
    activeBaseLayerId: appManifest.baseLayers[0].id,
    panels: { left: 'closed', right: 'closed' },
    hiddenLayerIds: new Set(detailLayers.map((l) => l.manifest.id)),
  });

  const mapContainer = document.querySelector<HTMLDivElement>('#map')!;
  const { map, baseLayers } = createMap(mapContainer, appManifest);
  const renderedLayers = new Map<string, Layer>();

  function renderMap(): void {
    const state = store.get();
    const date = new Date(`${state.selectedDate}T00:00:00Z`);
    for (const layer of loadedLayers) {
      const existing = renderedLayers.get(layer.manifest.id);
      if (existing) map.removeLayer(existing);

      if (state.hiddenLayerIds.has(layer.manifest.id)) {
        renderedLayers.delete(layer.manifest.id);
        continue;
      }
      renderedLayers.set(
        layer.manifest.id,
        renderDataLayer(map, layer.manifest, layer.features, date, state.activeFilters)
      );
    }
  }

  renderMap();
  store.subscribe(renderMap);

  mountCalendarBar(document.querySelector('#calendar-bar')!, store, appManifest.calendar, strings);
  mountPanelRight(document.querySelector('#panel-right-filters')!, store, loadedLayers);
  mountSearchOverlay(document.querySelector('#search-overlay')!, store, loadedLayers, strings);
  mountSelectionCard(document.querySelector('#selection-card')!, store, loadedLayers, strings);
  mountLayerControl(document.querySelector('#layer-control')!, store, strings, {
    map,
    baseLayerTiles: baseLayers,
    baseLayerConfigs: appManifest.baseLayers,
    detailLayers: detailLayers.map((l) => ({ id: l.manifest.id, title: l.manifest.title })),
  });

  // Right panel (filters) show/hide: a circular toggle button, a dimmed
  // backdrop, and the sliding drawer itself all react to `panels.right`.
  const panelRight = document.querySelector<HTMLElement>('#panel-right')!;
  const panelRightToggle = document.querySelector<HTMLButtonElement>('#panel-right-toggle')!;
  const panelRightClose = document.querySelector<HTMLButtonElement>('#panel-right-close')!;
  const panelOverlay = document.querySelector<HTMLElement>('#panel-overlay')!;
  const filtersTitle = document.querySelector<HTMLElement>('[data-role="filters-title"]')!;

  filtersTitle.textContent = t('filters.title', strings);
  panelRightToggle.setAttribute('aria-label', t('filters.openLabel', strings));
  panelRightClose.setAttribute('aria-label', t('filters.closeLabel', strings));

  function setRightPanelOpen(open: boolean): void {
    store.set({ panels: { ...store.get().panels, right: open ? 'open' : 'closed' } });
  }
  panelRightToggle.addEventListener('click', () => setRightPanelOpen(store.get().panels.right !== 'open'));
  panelRightClose.addEventListener('click', () => setRightPanelOpen(false));
  panelOverlay.addEventListener('click', () => setRightPanelOpen(false));

  function renderRightPanelVisibility(): void {
    const isOpen = store.get().panels.right === 'open';
    panelRight.classList.toggle('is-open', isOpen);
    panelRight.setAttribute('aria-hidden', String(!isOpen));
    panelOverlay.classList.toggle('is-visible', isOpen);
    panelRightToggle.setAttribute('aria-expanded', String(isOpen));
  }
  renderRightPanelVisibility();
  store.subscribe(renderRightPanelVisibility);

  // Footer attribution reflects whichever base layer is currently active.
  const attributionEl = document.querySelector<HTMLElement>('#map-attribution')!;
  function renderAttribution(): void {
    const config = appManifest.baseLayers.find((b) => b.id === store.get().activeBaseLayerId);
    attributionEl.textContent = config?.attribution ?? '';
  }
  renderAttribution();
  store.subscribe(renderAttribution);

  // Plugin panel slots (e.g. `participate`) live in a persistent sibling of
  // #panel-right-filters, not inside it: mountPanelRight replaces that
  // container's entire innerHTML on every store update, which would wipe
  // out any plugin-owned DOM appended directly inside it.
  const pluginCtx: PluginContext = {
    getSelectedDate: () => store.get().selectedDate,
    getActiveFeatures: () => loadedLayers.flatMap((l) => l.features),
    getSelectedFeature: () =>
      loadedLayers.flatMap((l) => l.features).find((f) => String(f.id ?? '') === store.get().selectedFeatureId) ?? null,
  };
  const actionsContainer = document.querySelector<HTMLDivElement>('#panel-right-actions')!;
  for (const slot of getPanelSlots()) {
    const slotContainer = document.createElement('div');
    slotContainer.dataset.pluginSlot = slot.id;
    actionsContainer.appendChild(slotContainer);
    slot.render(slotContainer, pluginCtx);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap app', error);
  document.body.innerHTML = `<pre style="color:red">${String(error)}</pre>`;
});
