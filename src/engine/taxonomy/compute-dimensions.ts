import type { GeoFeature } from '../time/temporal-types';
import type { LayerManifest } from '../manifests/layer-manifest';
import { isActiveOn } from '../time/is-active-on';

export interface TaxonomyDimension {
  id: string;
  label: string;
  values: { value: string; count: number }[];
}

export interface LoadedLayer {
  manifest: LayerManifest;
  features: GeoFeature[];
}

function readField(feature: GeoFeature, path: string): string[] {
  const parts = path.split('.');
  let value: unknown = feature;
  for (const part of parts) {
    if (value === null || typeof value !== 'object') return [];
    value = (value as Record<string, unknown>)[part];
  }
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null) return [];
  return [String(value)];
}

export function computeTaxonomyDimensions(layers: LoadedLayer[], date: Date): TaxonomyDimension[] {
  const dimensions = new Map<string, TaxonomyDimension>();

  for (const layer of layers) {
    for (const dim of layer.manifest.taxonomy ?? []) {
      const bucket = dimensions.get(dim.id) ?? { id: dim.id, label: dim.label, values: [] };
      const counts = new Map(bucket.values.map((v) => [v.value, v.count]));

      for (const feature of layer.features) {
        if (!isActiveOn(feature, date)) continue;
        for (const value of readField(feature, dim.field)) {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
      }

      bucket.values = Array.from(counts, ([value, count]) => ({ value, count }));
      dimensions.set(dim.id, bucket);
    }
  }

  return Array.from(dimensions.values());
}
