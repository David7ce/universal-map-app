import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import type { LoadedLayer } from '../taxonomy/compute-dimensions';
import type { GeoFeature } from '../time/temporal-types';
import { isActiveOn } from '../time/is-active-on';

export function findContainingRegions(
  point: [number, number],
  boundaryLayers: LoadedLayer[],
  date: Date,
): GeoFeature[] {
  const matches: GeoFeature[] = [];

  for (const layer of boundaryLayers) {
    if (layer.manifest.regionRole !== 'boundary') continue;

    for (const feature of layer.features) {
      if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') continue;
      if (!isActiveOn(feature, date)) continue;
      if (booleanPointInPolygon(point, feature.geometry)) {
        matches.push(feature);
      }
    }
  }

  return matches;
}
