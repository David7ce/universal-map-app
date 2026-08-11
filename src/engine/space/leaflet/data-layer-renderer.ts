import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.heat';
import type { GeoFeature } from '../../time/temporal-types';
import type { LayerManifest } from '../../manifests/layer-manifest';
import { filterActiveFeatures, readField } from '../../taxonomy/compute-dimensions';
import {
  resolveMarkerBadge,
  resolveMarkerColor,
  resolveMarkerStyle,
  resolvePolygonStyle,
  resolveTaxonomyIcon,
} from '../style';

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

  // Marker color/badge are independent of taxonomy — driven directly by
  // style.colorField/colorMap/defaultColor and style.badgeField/badgeMap
  // (see resolveMarkerColor/resolveMarkerBadge in ../style.ts). Untyped
  // reads matching this file's existing style.cluster/style.icon
  // convention (layer.json's `style` is a plain Record<string, unknown>,
  // not individually validated).
  const style = manifest.style ?? {};
  const colorField = typeof style.colorField === 'string' ? style.colorField : undefined;
  const colorMap =
    typeof style.colorMap === 'object' && style.colorMap !== null
      ? (style.colorMap as Record<string, string>)
      : undefined;
  const defaultColor = typeof style.defaultColor === 'string' ? style.defaultColor : undefined;
  const badgeField = typeof style.badgeField === 'string' ? style.badgeField : undefined;
  const badgeMap =
    typeof style.badgeMap === 'object' && style.badgeMap !== null
      ? (style.badgeMap as Record<string, string>)
      : undefined;

  const pointToLayer =
    manifest.kind === 'point' && (iconDimension || colorField || badgeField)
      ? (feature: GeoJSON.Feature, latlng: L.LatLng) => {
          const icon = iconDimension
            ? resolveTaxonomyIcon(
                iconDimension.icons,
                iconDimension.defaultIcon,
                readField(feature as GeoFeature, iconDimension.field)[0],
              )
            : undefined;
          const color = colorField
            ? resolveMarkerColor(colorMap, defaultColor, readField(feature as GeoFeature, colorField)[0])
            : undefined;
          const badge = badgeField
            ? resolveMarkerBadge(badgeMap, readField(feature as GeoFeature, badgeField)[0])
            : undefined;

          const circleStyle = color ? ` style="background-color:${color}"` : '';
          const html =
            `<span class="category-marker-icon__circle"${circleStyle}>${icon ?? ''}</span>` +
            (badge ? `<span class="category-marker-icon__badge">${badge}</span>` : '');

          return L.marker(latlng, {
            icon: L.divIcon({ html, className: 'category-marker-icon', iconSize: [24, 24] }),
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
