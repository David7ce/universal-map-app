import L from 'leaflet';
import 'leaflet.markercluster';
import type { GeoFeature } from '../time/temporal-types';
import type { LayerManifest } from '../manifests/layer-manifest';
import { isActiveOn } from '../time/is-active-on';
import { featureMatchesFilters } from '../taxonomy/compute-dimensions';
import { resolveMarkerStyle } from './style';

export function renderDataLayer(
  map: L.Map,
  manifest: LayerManifest,
  features: GeoFeature[],
  date: Date,
  activeFilters: Record<string, Set<string>> = {}
): L.Layer {
  const active = features.filter((f) => isActiveOn(f, date) && featureMatchesFilters(f, manifest, activeFilters));
  const geoJsonLayer = L.geoJSON(active as GeoJSON.Feature[]);

  if (manifest.kind === 'point' && resolveMarkerStyle(manifest).cluster) {
    const clusterGroup = L.markerClusterGroup();
    clusterGroup.addLayer(geoJsonLayer);
    clusterGroup.addTo(map);
    return clusterGroup;
  }

  geoJsonLayer.addTo(map);
  return geoJsonLayer;
}
