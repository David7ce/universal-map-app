import type { MapAdapter } from '../engine/space/map-adapter';
import type { AppManifest } from '../engine/manifests/app-manifest';
import type { AppState, Store } from '../engine/state/store';
import { openPanel } from '../engine/state/store';
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
    if (open) openPanel(store, 'right');
    else store.set({ panels: { ...store.get().panels, right: 'closed' } });
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

// Persistent header: world title/branding plus Home / Map / Calendar / About
// nav links. Home only renders when the manifest declares `welcome` (that's
// the only view it can route back to); About only when it declares `about`.
// `#map` isn't torn down when hidden (same as the filters panel not being
// destroyed on close) — switching back doesn't re-fetch tiles or re-render
// layers, it just needs mapAdapter.invalidateSize() once Leaflet's container
// is visible again.
function mountHeader(
  store: Store<AppState>,
  strings: Record<string, string>,
  appManifest: AppManifest,
  mapAdapter: MapAdapter,
): void {
  const appEl = document.querySelector<HTMLElement>('#app')!;
  const brandEl = document.querySelector<HTMLElement>('#app-header-brand')!;
  const navEl = document.querySelector<HTMLElement>('#app-header-nav')!;

  brandEl.textContent = appManifest.title;

  const navButtons: { view: AppState['view']; icon: string; label: string }[] = [
    ...(appManifest.welcome ? [{ view: 'welcome' as const, icon: icons.home, label: t('nav.home', strings) }] : []),
    { view: 'map', icon: icons.pushpin, label: t('views.map', strings) },
    { view: 'calendar', icon: icons.calendar, label: t('views.calendar', strings) },
    ...(appManifest.about ? [{ view: 'about' as const, icon: icons.info, label: t('nav.about', strings) }] : []),
  ];
  navEl.innerHTML = navButtons
    .map(
      (btn) =>
        `<button type="button" class="app-header__nav-btn" data-view="${btn.view}">${btn.icon}<span>${btn.label}</span></button>`,
    )
    .join('');
  const buttons = navEl.querySelectorAll<HTMLButtonElement>('[data-view]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => store.set({ view: button.dataset.view as AppState['view'] }));
  });

  let previousView = store.get().view;
  function render(): void {
    const state = store.get();
    buttons.forEach((button) => {
      const isActive = button.dataset.view === state.view;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    appEl.classList.toggle('view-calendar', state.view === 'calendar');
    appEl.classList.toggle('view-welcome', state.view === 'welcome');
    appEl.classList.toggle('view-about', state.view === 'about');
    if (previousView !== state.view && state.view === 'map') mapAdapter.invalidateSize();
    previousView = state.view;
  }
  render();
  store.subscribe(render);
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
function mountScaleIndicator(mapAdapter: MapAdapter): void {
  const lineEl = document.querySelector<HTMLElement>('[data-role="scale-line"]')!;
  const textEl = document.querySelector<HTMLElement>('[data-role="scale-text"]')!;
  const MAX_WIDTH_PX = 90;

  function render(): void {
    const metersPerPx = mapAdapter.getMetersPerPixel();
    const maxMeters = metersPerPx * MAX_WIDTH_PX;
    const niceMeters = niceScaleDistance(maxMeters);
    const widthPx = niceMeters / metersPerPx;

    lineEl.style.width = `${Math.round(widthPx)}px`;
    textEl.textContent = niceMeters >= 1000 ? `${niceMeters / 1000} km` : `${niceMeters} m`;
  }
  render();
  mapAdapter.onViewChange(render);
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
// filters drawer toggle/backdrop/Escape-key handling, the persistent header
// nav, footer attribution, the scale indicator, and plugin panel slots.
export function mountAppChrome(
  store: Store<AppState>,
  strings: Record<string, string>,
  appManifest: AppManifest,
  mapAdapter: MapAdapter,
  loadedLayers: LoadedLayer[],
): void {
  mountRightPanel(store, strings);
  mountHeader(store, strings, appManifest, mapAdapter);
  mountDateText(store);
  mountAttribution(store, appManifest);
  mountScaleIndicator(mapAdapter);
  mountPluginSlots(store, loadedLayers);
}
