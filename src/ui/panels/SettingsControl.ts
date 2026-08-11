import type { Store, AppState } from '../../engine/state/store';
import type { AppManifest } from '../../engine/manifests/app-manifest';
import type { MapAdapter } from '../../engine/space/map-adapter';
import type { MapCrsConfig } from '../../engine/space/map-crs';
import { CALENDAR_SYSTEMS, type CalendarSystem } from '../../engine/time/calendar-systems';
import { ensureCalendarSystemLoaded } from '../../engine/time/calendar-conversion';
import { t } from '../strings';
import { escapeHtml } from '../escape-html';
import { icons } from '../icons';

export interface SettingsControlDeps {
  appManifest: AppManifest;
  mapAdapter: MapAdapter;
}

// The <select>'s fixed option set: the three built-in Leaflet CRSes, plus
// "custom" standing in for whatever proj4 config the manifest declares (no
// UI here to author a new proj4 string — picking "custom" just re-applies
// the manifest's original config).
type CrsOptionId = 'EPSG:3857' | 'EPSG:4326' | 'Simple' | 'custom';

function crsOptionId(config: MapCrsConfig | undefined): CrsOptionId {
  if (config === undefined) return 'EPSG:3857';
  if (config === 'EPSG:3857' || config === 'EPSG:4326' || config === 'Simple') return config;
  return 'custom';
}

// A single button (grouping the calendar-system select, map projection
// selector, and coordinate-grid toggle) that lives inline inside the
// filters panel, opening a small popover — unlike LayerControl's popover
// this one auto-closes on click-outside, since it's a lightweight,
// infrequently-used control.
export function mountSettingsControl(
  container: HTMLElement,
  store: Store<AppState>,
  strings: Record<string, string>,
  deps: SettingsControlDeps,
): void {
  const systemOptions = CALENDAR_SYSTEMS.map(
    (system) => `<option value="${system}">${escapeHtml(t(`calendar.system.${system}`, strings))}</option>`,
  ).join('');

  // The manifest's own CRS is always offered, even if it's a custom proj4
  // config with no other way to reselect it once you've switched away.
  const manifestCrsIsCustom = crsOptionId(deps.appManifest.map.crs) === 'custom';
  const crsOptions =
    `<option value="EPSG:3857">${escapeHtml(t('settings.crs.epsg3857', strings))}</option>` +
    `<option value="EPSG:4326">${escapeHtml(t('settings.crs.epsg4326', strings))}</option>` +
    `<option value="Simple">${escapeHtml(t('settings.crs.simple', strings))}</option>` +
    (manifestCrsIsCustom ? `<option value="custom">${escapeHtml(t('settings.crs.custom', strings))}</option>` : '');

  const timeEnabled = deps.appManifest.systems?.time !== false;

  const calendarSection = timeEnabled
    ? `<p class="settings-control-group__title">${t('settings.calendarSection', strings)}</p>
      <label class="settings-control-row">
        <span>${t('settings.calendarSystemLabel', strings)}</span>
        <select data-role="calendar-system">${systemOptions}</select>
      </label>`
    : '';

  container.innerHTML = `
    <button type="button" class="settings-control-trigger" aria-expanded="false" aria-label="${t('settings.trigger', strings)}">
      ${icons.settings}
      <span class="settings-control-trigger__label">${t('settings.trigger', strings)}</span>
    </button>
    <section class="settings-control-popover" hidden>
      ${calendarSection}
      <p class="settings-control-group__title">${t('settings.mapSection', strings)}</p>
      <label class="settings-control-row">
        <span>${t('settings.projectionLabel', strings)}</span>
        <select data-role="projection">${crsOptions}</select>
      </label>
      <label class="settings-control-row">
        <span>${t('settings.gridLabel', strings)}</span>
        <input type="checkbox" data-role="grid-toggle" />
      </label>
    </section>
  `;

  const trigger = container.querySelector<HTMLButtonElement>('.settings-control-trigger')!;
  const popover = container.querySelector<HTMLElement>('.settings-control-popover')!;
  const gridToggle = container.querySelector<HTMLInputElement>('[data-role="grid-toggle"]')!;
  const systemSelect = container.querySelector<HTMLSelectElement>('[data-role="calendar-system"]');
  const projectionSelect = container.querySelector<HTMLSelectElement>('[data-role="projection"]')!;

  if (systemSelect) {
    systemSelect.value = store.get().calendarSystem;
    systemSelect.addEventListener('change', () => {
      const system = systemSelect.value as CalendarSystem;
      ensureCalendarSystemLoaded(system)
        .then(() => store.set({ calendarSystem: system }))
        .catch((error: unknown) => console.error('Failed to load calendar system', system, error));
    });
  }

  projectionSelect.value = crsOptionId(deps.appManifest.map.crs);
  projectionSelect.addEventListener('change', () => {
    const optionId = projectionSelect.value as CrsOptionId;
    const crs: MapCrsConfig | undefined = optionId === 'custom' ? deps.appManifest.map.crs : optionId;
    projectionSelect.disabled = true;
    deps.mapAdapter
      .setCrs(crs)
      .catch((error: unknown) => console.error('Failed to switch map projection', crs, error))
      .finally(() => {
        projectionSelect.disabled = false;
      });
  });

  trigger.addEventListener('click', () => {
    const open = popover.hidden;
    popover.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (event) => {
    if (!container.contains(event.target as Node)) {
      popover.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
  });

  gridToggle.addEventListener('change', () => {
    store.set({ showGrid: gridToggle.checked });
  });

  function render(): void {
    const state = store.get();
    gridToggle.checked = state.showGrid;
    deps.mapAdapter.grid.setVisible(state.showGrid);
    if (systemSelect && document.activeElement !== systemSelect) systemSelect.value = state.calendarSystem;
  }
  render();
  store.subscribe(render);
}
