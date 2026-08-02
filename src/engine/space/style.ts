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

// Fallback when a taxonomy dimension declares `icons` but a specific value
// has no entry and the manifest gives no `defaultIcon` of its own.
const FALLBACK_ICON = '📍';

// Emoji/glyph for a taxonomy value, driven entirely by the layer manifest's
// `taxonomy[].icons`/`defaultIcon` (see layer-manifest.ts) — a dimension
// with no `icons` configured gets no icon anywhere (filter list or map
// marker), so this is `undefined` rather than always returning a fallback.
export function resolveTaxonomyIcon(
  icons: Record<string, string> | undefined,
  defaultIcon: string | undefined,
  value: unknown,
): string | undefined {
  if (!icons) return undefined;
  if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(icons, value)) return icons[value];
  return defaultIcon ?? FALLBACK_ICON;
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
