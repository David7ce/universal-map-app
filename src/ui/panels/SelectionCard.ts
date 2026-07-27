import type { Store, AppState } from '../../engine/state/store';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { readField } from '../../engine/taxonomy/compute-dimensions';
import type { GeoFeature } from '../../engine/time/temporal-types';
import type { LayerManifest } from '../../engine/manifests/layer-manifest';
import { describeTemporalStatus } from './temporal-status';
import { findContainingRegions } from '../../engine/region/spatial-join';
import { t } from '../strings';
import { escapeHtml } from '../escape-html';
import { icons } from '../icons';

export function mountSelectionCard(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>
): void {
  const featureEntries: { feature: GeoFeature; manifest: LayerManifest }[] = layers.flatMap((layer) =>
    layer.features.map((feature) => ({ feature, manifest: layer.manifest }))
  );

  function featureLabel(feature: GeoFeature): string {
    const props = feature.properties;
    return String(props.nombre ?? props.title ?? feature.id ?? t('search.untitledFeature', strings));
  }

  container.classList.add('map-selection-card');
  container.innerHTML = `
    <div class="map-selection-card__sheet">
      <div class="map-selection-card__header">
        <h3 class="map-selection-card__title" data-role="title"></h3>
        <button type="button" class="map-selection-card__close" aria-label="${t('selection.closeLabel', strings)}">${icons.close}</button>
      </div>
      <div class="map-selection-card__content" data-role="content"></div>
    </div>
  `;

  const titleEl = container.querySelector<HTMLElement>('[data-role="title"]')!;
  const contentEl = container.querySelector<HTMLElement>('[data-role="content"]')!;
  container.querySelector('.map-selection-card__close')!.addEventListener('click', () => {
    store.set({ selectedFeatureId: null });
  });

  function render(): void {
    const state = store.get();
    const entry =
      state.selectedFeatureId === null
        ? undefined
        : featureEntries.find((e) => String(e.feature.id ?? '') === state.selectedFeatureId);

    if (!entry) {
      container.classList.remove('is-open');
      return;
    }
    const { feature, manifest } = entry;
    const date = new Date(`${state.selectedDate}T00:00:00Z`);

    let regionLine = '';
    if (feature.geometry.type === 'Point') {
      const regions = findContainingRegions(feature.geometry.coordinates as [number, number], layers, date);
      if (regions.length > 0) {
        const regionNames = regions.map((region) => escapeHtml(featureLabel(region))).join(', ');
        regionLine = `<p>${t('info.containingRegion', strings, { regions: regionNames })}</p>`;
      }
    }

    // Extra properties an app author chose to surface via the layer
    // manifest's `panel.infoFields` — field names always come from the
    // manifest, never hardcoded here (same pattern as `taxonomy`).
    const infoFieldLines = (manifest.panel?.infoFields ?? [])
      .map((def) => ({ def, values: readField(feature, def.field) }))
      .filter(({ values }) => values.length > 0)
      .map(
        ({ def, values }) =>
          `<p><strong>${escapeHtml(def.label)}:</strong> ${escapeHtml(values.join(', '))}</p>`
      )
      .join('');

    titleEl.textContent = featureLabel(feature);
    contentEl.innerHTML = `<p>${describeTemporalStatus(feature, date, strings)}</p>${regionLine}${infoFieldLines}`;
    container.classList.add('is-open');
  }
  render();
  store.subscribe(render);
}
