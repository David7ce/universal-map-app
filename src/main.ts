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
import { icons } from './ui/icons';

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

  // "Detail" layers (any layer with `panel.showByDefault: false` — e.g. a
  // heatmap, or a region/boundary layer) are opt-in via the layer control's
  // checkbox group, hidden until the user turns them on.
  const detailLayers = loadedLayers.filter((l) => l.manifest.panel?.showByDefault === false);

  const store = createStore<AppState>({
    selectedDate:
      appManifest.calendar.default === 'today'
        ? new Date().toISOString().slice(0, 10)
        : appManifest.calendar.default,
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

      // Layers that expose an info panel are clickable directly on the map.
      const onFeatureClick =
        layer.manifest.panel?.showInInfo !== false
          ? (feature: GeoFeature) =>
              store.set({
                selectedFeatureId: String(feature.id ?? ''),
                panels: { ...store.get().panels, left: 'closed' },
              })
          : undefined;

      renderedLayers.set(
        layer.manifest.id,
        renderDataLayer(map, layer.manifest, layer.features, date, state.activeFilters, onFeatureClick)
      );
    }
  }

  renderMap();
  store.subscribe(renderMap);

  mountCalendarBar(document.querySelector('#calendar-bar')!, store, appManifest.calendar, strings);
  mountPanelRight(document.querySelector('#panel-right-filters')!, store, loadedLayers, strings);
  mountSearchOverlay(document.querySelector('#search-overlay')!, store, loadedLayers, strings);
  mountSelectionCard(
    document.querySelector('#selection-card')!,
    store,
    loadedLayers,
    strings,
    appManifest.calendar.system ?? 'gregorian'
  );
  mountLayerControl(document.querySelector('#layer-control')!, store, strings, {
    map,
    baseLayerTiles: baseLayers,
    baseLayerConfigs: appManifest.baseLayers,
    detailLayers: detailLayers.map((l) => ({ id: l.manifest.id, title: l.manifest.title })),
  });

  // Right panel (filters) show/hide: a circular toggle button, a dimmed
  // backdrop, and the sliding drawer itself all react to `panels.right`.
  const appEl = document.querySelector<HTMLElement>('#app')!;
  const panelRight = document.querySelector<HTMLElement>('#panel-right')!;
  const panelRightToggle = document.querySelector<HTMLButtonElement>('#panel-right-toggle')!;
  const panelOverlay = document.querySelector<HTMLElement>('#panel-overlay')!;
  const filtersTitle = document.querySelector<HTMLElement>('[data-role="filters-title"]')!

  filtersTitle.textContent = t('filters.title', strings);
  panelRightToggle.innerHTML = icons.filter;

  // Mobile close button inside panel header
  const panelRightClose = document.querySelector<HTMLButtonElement>('#panel-right-close');
  panelRightClose!.innerHTML = icons.close;

  function setRightPanelOpen(open: boolean): void {
    store.set({ panels: { ...store.get().panels, right: open ? 'open' : 'closed' } });
  }
  panelRightToggle.addEventListener('click', () => setRightPanelOpen(store.get().panels.right !== 'open'));
  panelRightClose!.addEventListener('click', () => setRightPanelOpen(false));
  panelOverlay.addEventListener('click', () => setRightPanelOpen(false));

  function renderRightPanelVisibility(): void {
    const isOpen = store.get().panels.right === 'open';
    if (!isOpen && panelRight.contains(document.activeElement)) {
      panelRightToggle.focus();
    }
    panelRight.classList.toggle('is-open', isOpen);
    panelRight.setAttribute('aria-hidden', String(!isOpen));
    panelOverlay.classList.toggle('is-visible', isOpen);
    panelRightToggle.setAttribute('aria-expanded', String(isOpen));
    panelRightToggle.setAttribute('aria-label', t(isOpen ? 'filters.closeLabel' : 'filters.openLabel', strings));
    appEl.classList.toggle('panel-right-open', isOpen);
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

  // Scale display: updated on every map zoom / pan
  const scaleEl = document.querySelector<HTMLElement>('#map-scale')!;
  function updateScale(): void {
    const center = map.getCenter();
    const bounds = map.getBounds();
    const mapW = map.getContainer().clientWidth || 1;
    const metersPerDeg = (Math.PI / 180) * 6371000 * Math.cos((center.lat * Math.PI) / 180);
    const metersPerPx = ((bounds.getEast() - bounds.getWest()) * metersPerDeg) / mapW;
    const dist = metersPerPx * 80; // 80-pixel reference width
    scaleEl.textContent = dist >= 1000 ? `${Math.round(dist / 1000)} km` : `${Math.round(dist)} m`;
  }
  updateScale();
  map.on('zoomend moveend', updateScale);

  // Active filter count badge — shown on the filter toggle button whenever
  // at least one taxonomy value is selected. aria-hidden since the open panel
  // itself communicates the selection state to assistive technology.
  const filterBadge = document.createElement('span');
  filterBadge.className = 'filter-badge';
  filterBadge.setAttribute('aria-hidden', 'true');
  filterBadge.hidden = true;
  panelRightToggle.appendChild(filterBadge);

  function renderFilterBadge(): void {
    const total = Object.values(store.get().activeFilters).reduce((sum, s) => sum + s.size, 0);
    filterBadge.textContent = String(total);
    filterBadge.hidden = total === 0;
  }
  renderFilterBadge();
  store.subscribe(renderFilterBadge);

  // Escape key closes whichever panel is open.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (store.get().panels.right === 'open') {
      event.preventDefault();
      setRightPanelOpen(false);
    }
  });

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

  document.getElementById('loading-overlay')?.remove();
}

bootstrap().catch((error) => {
  document.getElementById('loading-overlay')?.remove();
  console.error('Failed to bootstrap app', error);
  document.body.innerHTML = `<pre style="color:red">${String(error)}</pre>`;
});
