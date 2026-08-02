import type { Map as LeafletMap } from 'leaflet';
import type { AppManifest } from '../engine/manifests/app-manifest';
import type { AppState, Store } from '../engine/state/store';
import type { LoadedLayer } from '../engine/taxonomy/compute-dimensions';
import { getPanelSlots, type PluginContext } from '../engine/plugins/registry';
import { formatCalendarDate } from '../engine/time/calendar-conversion';
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
}

// Current selected date, plain text — the full editor lives inline in the
// filters panel now, so this is the only always-visible date indicator.
function mountDateText(store: Store<AppState>): void {
  const dateTextEl = document.querySelector<HTMLElement>('#map-date-text')!;
  function render(): void {
    const state = store.get();
    dateTextEl.textContent = formatCalendarDate(state.selectedDate, state.calendarSystem);
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

// "Nice" round distances (same table Leaflet's own L.Control.Scale uses) so
// the bar's width always lines up with a label like "3 km", not "3.2 km".
const NICE_SCALE_DISTANCES = [
  1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000, 30000, 50000, 100000, 200000,
  300000, 500000, 1000000, 2000000, 3000000, 5000000,
];

function niceScaleDistance(maxMeters: number): number {
  for (let i = NICE_SCALE_DISTANCES.length - 1; i >= 0; i--) {
    if (NICE_SCALE_DISTANCES[i] <= maxMeters) return NICE_SCALE_DISTANCES[i];
  }
  return NICE_SCALE_DISTANCES[0];
}

// Scale display: a ruler-style bar (line + side borders, like a printed map
// legend) sized to a "nice" round ground distance, plus its label — both
// recomputed on every zoom/pan since meters-per-pixel changes with them.
function mountScaleIndicator(map: LeafletMap): void {
  const lineEl = document.querySelector<HTMLElement>('[data-role="scale-line"]')!;
  const textEl = document.querySelector<HTMLElement>('[data-role="scale-text"]')!;
  const MAX_WIDTH_PX = 90;

  function render(): void {
    const center = map.getCenter();
    const bounds = map.getBounds();
    const mapW = map.getContainer().clientWidth || 1;
    const metersPerDeg = (Math.PI / 180) * 6371000 * Math.cos((center.lat * Math.PI) / 180);
    const metersPerPx = ((bounds.getEast() - bounds.getWest()) * metersPerDeg) / mapW;
    const maxMeters = metersPerPx * MAX_WIDTH_PX;
    const niceMeters = niceScaleDistance(maxMeters);
    const widthPx = niceMeters / metersPerPx;

    lineEl.style.width = `${Math.round(widthPx)}px`;
    textEl.textContent = niceMeters >= 1000 ? `${niceMeters / 1000} km` : `${niceMeters} m`;
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
// filters drawer toggle/backdrop/Escape-key handling, footer attribution,
// the scale indicator, and plugin panel slots.
export function mountAppChrome(
  store: Store<AppState>,
  strings: Record<string, string>,
  appManifest: AppManifest,
  map: LeafletMap,
  loadedLayers: LoadedLayer[],
): void {
  mountRightPanel(store, strings);
  mountDateText(store);
  mountAttribution(store, appManifest);
  mountScaleIndicator(map);
  mountPluginSlots(store, loadedLayers);
}
