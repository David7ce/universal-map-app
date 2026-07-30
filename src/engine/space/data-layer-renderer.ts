import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.heat';
import type { GeoFeature } from '../time/temporal-types';
import type { LayerManifest } from '../manifests/layer-manifest';
import { isActiveOn } from '../time/is-active-on';
import { featureMatchesFilters } from '../taxonomy/compute-dimensions';
import { resolveMarkerStyle, resolvePolygonStyle } from './style';

export function renderDataLayer(
  map: L.Map,
  manifest: LayerManifest,
  features: GeoFeature[],
  date: Date,
  activeFilters: Record<string, Set<string>> = {}
): L.Layer {
  const active = features.filter((f) => isActiveOn(f, date) && featureMatchesFilters(f, manifest, activeFilters));

  if (manifest.kind === 'heatmap') {
    // leaflet.heat wants [lat, lng] points, the opposite order from GeoJSON
    // coordinates — only Point geometries contribute; other geometry types
    // on a heatmap layer are silently skipped (heat density has no
    // established meaning for lines/polygons here).
    const points: L.HeatLatLngTuple[] = active
      .filter((f): f is GeoFeature & { geometry: GeoJSON.Point } => f.geometry.type === 'Point')
      .map((f) => [f.geometry.coordinates[1], f.geometry.coordinates[0], 1]);
    const heatLayer = L.heatLayer(points, {});
    heatLayer.addTo(map);
    return heatLayer;
  }

  // `line`/`polygon`/`boundary` get a real style (fill + border) instead of
  // Leaflet's raw default (a plain blue outline, no fill) — every field is
  // overridable per layer via the manifest's `style`.
  const needsPolygonStyle = manifest.kind === 'line' || manifest.kind === 'polygon' || manifest.kind === 'boundary';
  const geoJsonLayer = L.geoJSON(
    active as GeoJSON.Feature[],
    needsPolygonStyle ? { style: resolvePolygonStyle(manifest) } : {}
  );

  if (manifest.kind === 'point' && resolveMarkerStyle(manifest).cluster) {
    const clusterGroup = L.markerClusterGroup();
    clusterGroup.addLayer(geoJsonLayer);
    clusterGroup.addTo(map);
    return clusterGroup;
  }

  geoJsonLayer.addTo(map);
  return geoJsonLayer;
}
