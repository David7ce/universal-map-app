import type { AppState, Store } from '../state/store';
import { filterActiveFeatures, type LoadedLayer } from '../taxonomy/compute-dimensions';
import type { PluginContext } from './registry';

/** Create a read-only, live view of the app state for plugin slots and hooks. */
export function createPluginContext(store: Store<AppState>, loadedLayers: LoadedLayer[]): PluginContext {
  return {
    getSelectedDate: () => store.get().selectedDate,
    getActiveFeatures: () => {
      const state = store.get();
      const date = new Date(`${state.selectedDate}T00:00:00Z`);

      return loadedLayers
        .filter((layer) => !state.hiddenLayerIds.has(layer.manifest.id))
        .flatMap((layer) => filterActiveFeatures(layer.features, date, layer.manifest, state.activeFilters));
    },
    getSelectedFeature: () =>
      loadedLayers
        .flatMap((layer) => layer.features)
        .find((feature) => String(feature.id ?? '') === store.get().selectedFeatureId) ?? null,
  };
}
