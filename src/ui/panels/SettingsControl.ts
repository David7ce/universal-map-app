import type { Store, AppState } from '../../engine/state/store';
import type { AppManifest } from '../../engine/manifests/app-manifest';
import type { MapGrid } from '../../engine/space/map-adapter';
import { CALENDAR_SYSTEMS, type CalendarSystem } from '../../engine/time/calendar-systems';
import { ensureCalendarSystemLoaded } from '../../engine/time/calendar-conversion';
import { t } from '../strings';
import { escapeHtml } from '../escape-html';
import { icons } from '../icons';

export interface SettingsControlDeps {
  appManifest: AppManifest;
  grid: MapGrid;
}

function describeCrs(config: AppManifest['map']['crs']): string {
  if (config === undefined) return 'EPSG:3857';
  if (typeof config === 'string') return config;
  return 'Custom';
}

// A single button (grouping the map's projection info + coordinate-grid
// toggle) that lives inline inside the filters panel, opening a small
// popover — unlike LayerControl's popover this one auto-closes on
// click-outside, since it's a lightweight, infrequently-used control.
export function mountSettingsControl(
  container: HTMLElement,
  store: Store<AppState>,
  strings: Record<string, string>,
  deps: SettingsControlDeps,
): void {
  const systemOptions = CALENDAR_SYSTEMS.map(
    (system) => `<option value="${system}">${escapeHtml(t(`calendar.system.${system}`, strings))}</option>`,
  ).join('');

  container.innerHTML = `
    <button type="button" class="settings-control-trigger" aria-expanded="false" aria-label="${t('settings.trigger', strings)}">
      ${icons.settings}
      <span class="settings-control-trigger__label">${t('settings.trigger', strings)}</span>
    </button>
    <section class="settings-control-popover" hidden>
      <p class="settings-control-group__title">${t('settings.calendarSection', strings)}</p>
      <label class="settings-control-row">
        <span>${t('settings.calendarSystemLabel', strings)}</span>
        <select data-role="calendar-system">${systemOptions}</select>
      </label>
      <p class="settings-control-group__title">${t('settings.mapSection', strings)}</p>
      <p class="settings-control-row settings-control-row--info">
        <span>${t('settings.projectionLabel', strings)}</span>
        <span data-role="projection-value"></span>
      </p>
      <label class="settings-control-row">
        <span>${t('settings.gridLabel', strings)}</span>
        <input type="checkbox" data-role="grid-toggle" />
      </label>
    </section>
  `;

  container.querySelector('[data-role="projection-value"]')!.textContent = describeCrs(deps.appManifest.map.crs);

  const trigger = container.querySelector<HTMLButtonElement>('.settings-control-trigger')!;
  const popover = container.querySelector<HTMLElement>('.settings-control-popover')!;
  const gridToggle = container.querySelector<HTMLInputElement>('[data-role="grid-toggle"]')!;
  const systemSelect = container.querySelector<HTMLSelectElement>('[data-role="calendar-system"]')!;

  systemSelect.value = store.get().calendarSystem;
  systemSelect.addEventListener('change', () => {
    const system = systemSelect.value as CalendarSystem;
    ensureCalendarSystemLoaded(system)
      .then(() => store.set({ calendarSystem: system }))
      .catch((error: unknown) => console.error('Failed to load calendar system', system, error));
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
    deps.grid.setVisible(state.showGrid);
    if (document.activeElement !== systemSelect) systemSelect.value = state.calendarSystem;
  }
  render();
  store.subscribe(render);
}
