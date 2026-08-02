import type { LayerManifest } from '../manifests/layer-manifest';

export interface MarkerStyle {
  cluster: boolean;
  iconName: string;
}

export function resolveMarkerStyle(manifest: LayerManifest): MarkerStyle {
  const style = manifest.style ?? {};
  return {
    cluster: style.cluster === true,
    iconName: typeof style.icon === 'string' ? style.icon : 'default',
  };
}

// Emoji glyph shown on point markers, keyed by the feature's taxonomy
// category value — gives each POI category a distinct symbol on the map.
const CATEGORY_ICONS: Record<string, string> = {
  park: '🌳',
  restaurant: '🍴',
  theatre: '🎭',
};
const DEFAULT_CATEGORY_ICON = '📍';

export function resolveCategoryIcon(category: unknown): string {
  return typeof category === 'string' && category in CATEGORY_ICONS
    ? CATEGORY_ICONS[category]
    : DEFAULT_CATEGORY_ICON;
}

export interface PolygonStyle {
  color: string;
  weight: number;
  fillColor: string;
  fillOpacity: number;
}

// Applied to `line`/`polygon`/`boundary` layers so they render as a
// deliberately-styled shape instead of Leaflet's raw default (a plain blue
// outline, no fill) — every field is overridable per layer via `style`.
const DEFAULT_POLYGON_STYLE: PolygonStyle = {
  color: '#e08a3e',
  weight: 2,
  fillColor: '#e08a3e',
  fillOpacity: 0.18,
};

export function resolvePolygonStyle(manifest: LayerManifest): PolygonStyle {
  const style = manifest.style ?? {};
  return {
    color: typeof style.color === 'string' ? style.color : DEFAULT_POLYGON_STYLE.color,
    weight: typeof style.weight === 'number' ? style.weight : DEFAULT_POLYGON_STYLE.weight,
    fillColor: typeof style.fillColor === 'string' ? style.fillColor : DEFAULT_POLYGON_STYLE.fillColor,
    fillOpacity: typeof style.fillOpacity === 'number' ? style.fillOpacity : DEFAULT_POLYGON_STYLE.fillOpacity,
  };
}
