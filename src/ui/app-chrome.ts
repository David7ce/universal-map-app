import type { Map as LeafletMap } from 'leaflet';
import type { AppManifest } from '../engine/manifests/app-manifest';
import type { AppState, Store } from '../engine/state/store';
import type { LoadedLayer } from '../engine/taxonomy/compute-dimensions';
import { getPanelSlots, type PluginContext } from '../engine/plugins/registry';
import { icons } from './icons';
import { t } from './strings';

// Right panel (filters) show/hide: a circular toggle button, a dimmed
// backdrop, and the sliding drawer itself all react to `panels.right`.
// Also wires the Escape key to close it.
function mountRightPanel(store: Store<AppState>, strings: Record<string, string>): void {
  const appEl = document.querySelector<HTMLElement>('#app')!;
  const panelRight = document.querySelector<HTMLElement>('#panel-right')!;
  const panelRightToggle = document.querySelector<HTMLButtonElement>('#panel-right-toggle')!;
  const panelOverlay = document.querySelector<HTMLElement>('#panel-overlay')!;
  const filtersTitle = document.querySelector<HTMLElement>('[data-role="filters-title"]')!;
  const panelRightClose = document.querySelector<HTMLButtonElement>('#panel-right-close')!;

  filtersTitle.textContent = t('filters.title', strings);
  panelRightToggle.innerHTML = icons.filter;
  panelRightClose.innerHTML = icons.close;

  function setRightPanelOpen(open: boolean): void {
    store.set({ panels: { ...store.get().panels, right: open ? 'open' : 'closed' } });
  }
  panelRightToggle.addEventListener('click', () => setRightPanelOpen(store.get().panels.right !== 'open'));
  panelRightClose.addEventListener('click', () => setRightPanelOpen(false));
  panelOverlay.addEventListener('click', () => setRightPanelOpen(false));

  function render(): void {
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
  render();
  store.subscribe(render);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (store.get().panels.right === 'open') {
      event.preventDefault();
      setRightPanelOpen(false);
    }
  });

  mountFilterBadge(store, panelRightToggle);
}

// Active filter count badge — shown on the filter toggle button whenever at
// least one taxonomy value is selected. aria-hidden since the open panel
// itself communicates the selection state to assistive technology.
function mountFilterBadge(store: Store<AppState>, panelRightToggle: HTMLButtonElement): void {
  const filterBadge = document.createElement('span');
  filterBadge.className = 'filter-badge';
  filterBadge.setAttribute('aria-hidden', 'true');
  filterBadge.hidden = true;
  panelRightToggle.appendChild(filterBadge);

  function render(): void {
    const total = Object.values(store.get().activeFilters).reduce((sum, s) => sum + s.size, 0);
    filterBadge.textContent = String(total);
    filterBadge.hidden = total === 0;
  }
  render();
  store.subscribe(render);
}

// Footer attribution reflects whichever base layer is currently active.
function mountAttribution(store: Store<AppState>, appManifest: AppManifest): void {
  const attributionEl = document.querySelector<HTMLElement>('#map-attribution')!;
  function render(): void {
    const config = appManifest.baseLayers.find((b) => b.id === store.get().activeBaseLayerId);
    attributionEl.textContent = config?.attribution ?? '';
  }
  render();
  store.subscribe(render);
}

// Scale display: an approximate ground distance for an 80px reference
// width at the map's current center/zoom, updated on every zoom/pan.
function mountScaleIndicator(map: LeafletMap): void {
  const scaleEl = document.querySelector<HTMLElement>('#map-scale')!;
  function render(): void {
    const center = map.getCenter();
    const bounds = map.getBounds();
    const mapW = map.getContainer().clientWidth || 1;
    const metersPerDeg = (Math.PI / 180) * 6371000 * Math.cos((center.lat * Math.PI) / 180);
    const metersPerPx = ((bounds.getEast() - bounds.getWest()) * metersPerDeg) / mapW;
    const dist = metersPerPx * 80; // 80-pixel reference width
    scaleEl.textContent = dist >= 1000 ? `${Math.round(dist / 1000)} km` : `${Math.round(dist)} m`;
  }
  render();
  map.on('zoomend moveend', render);
}

// Plugin panel slots (e.g. `participate`) live in a persistent sibling of
// #panel-right-filters, not inside it: mountPanelRight replaces that
// container's entire innerHTML on every store update, which would wipe out
// any plugin-owned DOM appended directly inside it.
function mountPluginSlots(store: Store<AppState>, loadedLayers: LoadedLayer[]): void {
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

// Wires up all the "chrome" around the map and the mounted panels: the
// filters drawer toggle/backdrop/Escape-key handling, the filter count
// badge, footer attribution, the scale indicator, and plugin panel slots.
export function mountAppChrome(
  store: Store<AppState>,
  strings: Record<string, string>,
  appManifest: AppManifest,
  map: LeafletMap,
  loadedLayers: LoadedLayer[],
): void {
  mountRightPanel(store, strings);
  mountAttribution(store, appManifest);
  mountScaleIndicator(map);
  mountPluginSlots(store, loadedLayers);
}
