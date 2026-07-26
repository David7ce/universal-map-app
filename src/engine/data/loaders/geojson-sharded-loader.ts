import type { GeoFeature } from '../../time/temporal-types';
import { loadGeojson } from './geojson-loader';

export async function loadGeojsonSharded(urls: string[]): Promise<GeoFeature[]> {
  const shards = await Promise.all(urls.map((url) => loadGeojson(url)));
  return shards.flat();
}
