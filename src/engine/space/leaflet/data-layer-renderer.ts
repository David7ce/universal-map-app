import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.heat';
import type { GeoFeature } from '../../time/temporal-types';
import type { LayerManifest } from '../../manifests/layer-manifest';
import { filterActiveFeatures, readField } from '../../taxonomy/compute-dimensions';
import {
  resolveMarkerBadge,
  resolveMarkerColor,
  resolveMarkerImage,
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

  // Opt-in (`style.dedupeMarkers: true`): collapse point features that share
  // the exact same coordinate into a single marker, so e.g. several moon
  // photos taken from one spot don't stack into an unreadable pile. The
  // first feature wins for the marker's own look; the info panel still
  // surfaces every feature at that coordinate (see SearchOverlay.ts).
  // Off by default — two distinct places can legitimately share a
  // coordinate (e.g. two world leaders based in the same capital).
  const style = manifest.style ?? {};
  const dedupeMarkers = style.dedupeMarkers === true;
  const rendered =
    dedupeMarkers && manifest.kind === 'point'
      ? active.filter((feature, index) => {
          if (feature.geometry.type !== 'Point') return true;
          const key = feature.geometry.coordinates.join(',');
          return active.findIndex((f) => f.geometry.type === 'Point' && f.geometry.coordinates.join(',') === key) === index;
        })
      : active;

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
  const imageField = typeof style.imageField === 'string' ? style.imageField : undefined;
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

  const escapeAttr = (val: string): string =>
    val.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);

  const pointToLayer =
    manifest.kind === 'point' && (iconDimension || colorField || badgeField || imageField)
      ? (feature: GeoJSON.Feature, latlng: L.LatLng) => {
          const icon = iconDimension
            ? resolveTaxonomyIcon(
                iconDimension.icons,
                iconDimension.defaultIcon,
                readField(feature as GeoFeature, iconDimension.field)[0],
              )
            : undefined;
          const imageUrl = imageField
            ? resolveMarkerImage(readField(feature as GeoFeature, imageField)[0])
            : resolveMarkerImage(icon);
          const color = colorField
            ? resolveMarkerColor(colorMap, defaultColor, readField(feature as GeoFeature, colorField)[0])
            : undefined;
          const badge = badgeField
            ? resolveMarkerBadge(badgeMap, readField(feature as GeoFeature, badgeField)[0])
            : undefined;

          const circleStyle = color ? ` style="background-color:${color}"` : '';
          const name = typeof feature.properties?.name === 'string' ? feature.properties.name : '';
          const content = imageUrl
            ? `<img class="category-marker-icon__image" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(name)}" loading="lazy" />`
            : (icon ?? '');

          const hasImage = Boolean(imageUrl);
          // `style.imageVariant: 'phase'` renders the image as a bare glyph
          // (no white circle behind it) — for a transparent shape like a moon
          // phase SVG, where a filled disc would hide the very shape it's
          // meant to show.
          const isPhase = hasImage && style.imageVariant === 'phase';
          const markerClass = isPhase
            ? 'category-marker-icon category-marker-icon--phase'
            : hasImage
              ? 'category-marker-icon category-marker-icon--portrait'
              : 'category-marker-icon';
          const iconSize: L.PointTuple = hasImage ? [72, 72] : [44, 44];

          const html =
            `<span class="category-marker-icon__circle"${circleStyle}>${content}</span>` +
            (badge ? `<span class="category-marker-icon__badge">${badge}</span>` : '');

          return L.marker(latlng, {
            icon: L.divIcon({ html, className: markerClass, iconSize }),
          });
        }
      : undefined;

  const geoJsonLayer = L.geoJSON(rendered as GeoJSON.Feature[], {
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
