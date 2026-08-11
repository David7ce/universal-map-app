import type { LoadedLayer } from '../taxonomy/compute-dimensions';
import { featureMatchesFilters } from '../taxonomy/compute-dimensions';
import type { GeoFeature } from './temporal-types';
import { isActiveOn } from './is-active-on';

export interface DayAgendaEntry {
  layerId: string;
  layerTitle: string;
  feature: GeoFeature;
}

export interface DayAgendaGroup {
  iso: string;
  entries: DayAgendaEntry[];
}

// Same duplicated-five-line-helper convention calendar-grid.ts already uses
// for addDays (engine/ files don't import UI-adjacent date helpers across
// modules for a single-purpose one-liner).
function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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

// Day-by-day scan reusing getFeaturesOnDate's own per-feature isActiveOn
// check — no RRULE occurrence enumeration. Realistic calendar.max ranges
// (all current worlds are single-digit years wide) keep this cheap; dates
// with zero matches are omitted rather than returned as empty groups.
export function getFeaturesInRange(
  layers: LoadedLayer[],
  activeFilters: Record<string, Set<string>>,
  fromIso: string,
  toIso: string,
): DayAgendaGroup[] {
  const groups: DayAgendaGroup[] = [];
  let iso = fromIso;
  while (iso <= toIso) {
    const entries = getFeaturesOnDate(layers, activeFilters, iso);
    if (entries.length > 0) groups.push({ iso, entries });
    iso = addDays(iso, 1);
  }
  return groups;
}
