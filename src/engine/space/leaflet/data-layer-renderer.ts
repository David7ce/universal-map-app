import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.heat';
import type { GeoFeature } from '../../time/temporal-types';
import type { LayerManifest } from '../../manifests/layer-manifest';
import { filterActiveFeatures, readField } from '../../taxonomy/compute-dimensions';
import { resolveMarkerStyle, resolvePolygonStyle, resolveTaxonomyIcon } from '../style';

export function renderDataLayer(
  map: L.Map,
  manifest: LayerManifest,
  features: GeoFeature[],
  date: Date | null,
  activeFilters: Record<string, Set<string>> = {},
  onFeatureClick?: (feature: GeoFeature) => void,
): L.Layer {
  const active = filterActiveFeatures(features, date, manifest, activeFilters);

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

  const onEachFeature = onFeatureClick
    ? (geoFeature: GeoJSON.Feature, layer: L.Layer) => {
        layer.on('click', () => onFeatureClick(geoFeature as GeoFeature));
      }
    : undefined;

  // `line`/`polygon`/`boundary` get a real style (fill + border) instead of
  // Leaflet's raw default (a plain blue outline, no fill) — every field is
  // overridable per layer via the manifest's `style`.
  const needsPolygonStyle = manifest.kind === 'line' || manifest.kind === 'polygon' || manifest.kind === 'boundary';

  // Point features get an emoji marker keyed by whichever taxonomy
  // dimension declares `icons` (see layer-manifest.ts) — a layer with no
  // such dimension falls back to Leaflet's plain default marker.
  const iconDimension = manifest.taxonomy?.find((dim) => dim.icons);
  const pointToLayer =
    manifest.kind === 'point' && iconDimension
      ? (feature: GeoJSON.Feature, latlng: L.LatLng) => {
          const value = readField(feature as GeoFeature, iconDimension.field)[0];
          const icon = resolveTaxonomyIcon(iconDimension.icons, iconDimension.defaultIcon, value);
          return L.marker(latlng, {
            icon: L.divIcon({ html: icon ?? '', className: 'category-marker-icon', iconSize: [24, 24] }),
          });
        }
      : undefined;

  const geoJsonLayer = L.geoJSON(active as GeoJSON.Feature[], {
    ...(needsPolygonStyle ? { style: resolvePolygonStyle(manifest) } : {}),
    ...(onEachFeature ? { onEachFeature } : {}),
    ...(pointToLayer ? { pointToLayer } : {}),
  });

  if (manifest.kind === 'point' && resolveMarkerStyle(manifest).cluster) {
    const clusterGroup = L.markerClusterGroup();
    clusterGroup.addLayer(geoJsonLayer);
    clusterGroup.addTo(map);
    return clusterGroup;
  }

  geoJsonLayer.addTo(map);
  return geoJsonLayer;
}
