import type { LoadedLayer } from '../taxonomy/compute-dimensions';
import { featureMatchesFilters } from '../taxonomy/compute-dimensions';
import type { GeoFeature } from './temporal-types';
import { isActiveOn } from './is-active-on';

export interface DayAgendaEntry {
  layerId: string;
  layerTitle: string;
  feature: GeoFeature;
}

// Same filtering rule calendar-grid.ts's hasActiveFeatureOn already applies
// (respect activeFilters, and only features with a `temporal` property count
// — an untimed "always present" feature isn't a day's "event"), but returns
// the matching features themselves instead of a boolean, for the Calendar
// view's day agenda list.
export function getFeaturesOnDate(
  layers: LoadedLayer[],
  activeFilters: Record<string, Set<string>>,
  iso: string,
): DayAgendaEntry[] {
  const date = new Date(`${iso}T00:00:00Z`);
  const entries: DayAgendaEntry[] = [];
  for (const layer of layers) {
    for (const feature of layer.features) {
      if (
        feature.properties.temporal !== undefined &&
        featureMatchesFilters(feature, layer.manifest, activeFilters) &&
        isActiveOn(feature, date)
      ) {
        entries.push({ layerId: layer.manifest.id, layerTitle: layer.manifest.title, feature });
      }
    }
  }
  return entries;
}
