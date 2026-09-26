import type { GeoFeature } from '../../engine/time/temporal-types';

export function searchFeatures(features: GeoFeature[], query: string, searchableFields: string[]): GeoFeature[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return features.filter((feature) =>
    searchableFields.some((field) => {
      const value = feature.properties[field];
      return typeof value === 'string' && value.toLowerCase().includes(normalized);
    }),
  );
}

// Collapses search results that would read as the same entry — e.g. several
// moon photos taken from one place all matching "Asturias". Keyed by the
// first searchable field that has a value (the display label), so the list
// shows one row per distinct place rather than one per photo. The first
// feature wins; the info panel still surfaces every photo at that place.
export function dedupeSearchResults(features: GeoFeature[], searchableFields: string[]): GeoFeature[] {
  const seen = new Set<string>();
  const result: GeoFeature[] = [];
  for (const feature of features) {
    const key =
      searchableFields.map((field) => feature.properties[field]).find((value) => typeof value === 'string') ??
      String(feature.id ?? '');
    const normalizedKey = String(key).trim().toLowerCase();
    if (seen.has(normalizedKey)) continue;
    seen.add(normalizedKey);
    result.push(feature);
  }
  return result;
}
