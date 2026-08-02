import type { LayerSource, BBox, DateRange } from './source-types';
import type { GeoFeature } from '../time/temporal-types';
import { loadGeojson } from './loaders/geojson-loader';
import { loadGeojsonSharded } from './loaders/geojson-sharded-loader';

// bounds/dateRange are accepted but unused in v1 — forward-compatible seam
// for a future server-backed "api" source type (design spec Section 9).
export async function fetchFeatures(
  source: LayerSource,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  bounds?: BBox,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dateRange?: DateRange,
): Promise<GeoFeature[]> {
  switch (source.type) {
    case 'geojson':
      return loadGeojson(source.url);
    case 'geojson-sharded':
      return loadGeojsonSharded(source.urls);
    default: {
      const exhaustive: never = source;
      throw new Error(`Unknown layer source type: ${JSON.stringify(exhaustive)}`);
    }
  }
}
