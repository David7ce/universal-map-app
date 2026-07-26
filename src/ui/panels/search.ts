import type { GeoFeature } from '../../engine/time/temporal-types';

export function searchFeatures(features: GeoFeature[], query: string, searchableFields: string[]): GeoFeature[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return features.filter((feature) =>
    searchableFields.some((field) => {
      const value = feature.properties[field];
      return typeof value === 'string' && value.toLowerCase().includes(normalized);
    })
  );
}
