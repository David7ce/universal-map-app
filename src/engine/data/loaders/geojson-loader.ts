import type { GeoFeature } from '../../time/temporal-types';

export async function loadGeojson(url: string): Promise<GeoFeature[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load GeoJSON from ${url}: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (data.type === 'FeatureCollection') return data.features as GeoFeature[];
  if (data.type === 'Feature') return [data as GeoFeature];
  throw new Error(`Unsupported GeoJSON root type "${data.type}" at ${url}`);
}
