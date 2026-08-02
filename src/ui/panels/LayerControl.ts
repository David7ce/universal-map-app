import type L from 'leaflet';
import type { Store, AppState } from '../../engine/state/store';
import type { BaseLayerConfig } from '../../engine/manifests/app-manifest';
import { t } from '../strings';
import { escapeHtml } from '../escape-html';
import { icons } from '../icons';

export interface DetailLayerOption {
  id: string;
  title: string;
}

export interface LayerControlDeps {
  map: L.Map;
  baseLayerTiles: Record<string, L.TileLayer>;
  baseLayerConfigs: BaseLayerConfig[];
  detailLayers: DetailLayerOption[];
}

export function mountLayerControl(
  container: HTMLElement,
  store: Store<AppState>,
  strings: Record<string, string>,
  deps: LayerControlDeps,
): void {
  const baseLayerCards = deps.baseLayerConfigs
    .map(
      (config) => `
        <label class="layer-control-card">
          <input type="radio" name="base-layer" data-base-layer="${escapeHtml(config.id)}" class="layer-control-card__input" />
          <span class="layer-control-card__thumb" data-layer-id="${escapeHtml(config.id)}" aria-hidden="true"></span>
          <span class="layer-control-card__label">${escapeHtml(config.title)}</span>
        </label>`,
    )
    .join('');

  const detailCards = deps.detailLayers
    .map(
      (layer) => `
        <label class="layer-control-card">
          <input type="checkbox" data-detail-layer="${escapeHtml(layer.id)}" class="layer-control-card__input" />
          <span class="layer-control-card__thumb" data-layer-id="${escapeHtml(layer.id)}" aria-hidden="true"></span>
          <span class="layer-control-card__label">${escapeHtml(layer.title)}</span>
        </label>`,
    )
    .join('');

  const detailGroup = deps.detailLayers.length
    ? `<div class="layer-control-group">
         <p class="layer-control-group__title">${t('layerControl.mapDetails', strings)}</p>
         <div class="layer-control-cards">${detailCards}</div>
       </div>`
    : '';

  container.innerHTML = `
    <button type="button" class="layer-control-trigger" aria-expanded="false" aria-label="${t('layerControl.trigger', strings)}">
      ${icons.layers}
      <span class="layer-control-trigger__label">${t('layerControl.trigger', strings)}</span>
    </button>
    <section class="layer-control-popover" hidden>
      <header class="layer-control-popover__header">
        <p class="layer-control-group__title">${t('layerControl.trigger', strings)}</p>
        <button type="button" class="layer-control-popover__close" aria-label="${t('layerControl.closeLabel', strings)}">${icons.close}</button>
      </header>
      ${detailGroup}
      ${detailGroup ? '<hr class="layer-control-separator" />' : ''}
      <div class="layer-control-group">
        <p class="layer-control-group__title">${t('layerControl.mapType', strings)}</p>
        <div class="layer-control-cards">${baseLayerCards}</div>
      </div>
    </section>
  `;

  const trigger = container.querySelector<HTMLButtonElement>('.layer-control-trigger')!;
  const popover = container.querySelector<HTMLElement>('.layer-control-popover')!;
  const closeButton = container.querySelector<HTMLButtonElement>('.layer-control-popover__close')!;

  // Stays open until explicitly closed (trigger toggle or the close button)
  // — no click-outside auto-close, so it behaves like the filters panel.
  function setOpen(open: boolean): void {
    popover.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  }
  trigger.addEventListener('click', () => setOpen(popover.hidden));
  closeButton.addEventListener('click', () => setOpen(false));

  container.querySelectorAll<HTMLInputElement>('[data-base-layer]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const id = radio.dataset.baseLayer!;
      if (id !== store.get().activeBaseLayerId) store.set({ activeBaseLayerId: id });
    });
  });

  container.querySelectorAll<HTMLInputElement>('[data-detail-layer]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const id = checkbox.dataset.detailLayer!;
      const hidden = new Set(store.get().hiddenLayerIds);
      if (checkbox.checked) hidden.delete(id);
      else hidden.add(id);
      store.set({ hiddenLayerIds: hidden });
    });
  });

  let activeTileLayer: L.TileLayer | undefined;

  function render(): void {
    const state = store.get();

    container.querySelectorAll<HTMLInputElement>('[data-base-layer]').forEach((radio) => {
      radio.checked = radio.dataset.baseLayer === state.activeBaseLayerId;
    });
    container.querySelectorAll<HTMLInputElement>('[data-detail-layer]').forEach((checkbox) => {
      checkbox.checked = !state.hiddenLayerIds.has(checkbox.dataset.detailLayer!);
    });

    const nextTile = deps.baseLayerTiles[state.activeBaseLayerId];
    if (nextTile && nextTile !== activeTileLayer) {
      if (activeTileLayer) deps.map.removeLayer(activeTileLayer);
      nextTile.addTo(deps.map);
      activeTileLayer = nextTile;
    }
  }

  render();
  store.subscribe(render);
}
