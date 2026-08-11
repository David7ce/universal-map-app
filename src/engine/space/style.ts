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

// Matches `value` against `map`, either exactly or (for a descriptive value
// like "Media - Zona poco iluminada") against the part before the first
// " - " — so an author writes one colorMap/badgeMap entry per short code,
// not one per exact descriptive variant.
function lookupByValueOrPrefix(map: Record<string, string>, value: string): string | undefined {
  if (Object.prototype.hasOwnProperty.call(map, value)) return map[value];
  const prefix = value.split(' - ')[0].trim();
  return prefix !== value && Object.prototype.hasOwnProperty.call(map, prefix) ? map[prefix] : undefined;
}

// A marker's circular background color, driven by `style.colorField`'s
// value on the feature (see data-layer-renderer.ts) — independent of the
// taxonomy icon mechanism. No `colorMap` at all means no color anywhere
// (existing bare-emoji marker look is unchanged for a layer that doesn't
// configure this).
export function resolveMarkerColor(
  colorMap: Record<string, string> | undefined,
  defaultColor: string | undefined,
  value: unknown,
): string | undefined {
  if (!colorMap) return undefined;
  if (typeof value !== 'string') return defaultColor;
  return lookupByValueOrPrefix(colorMap, value) ?? defaultColor;
}

// A small corner badge on a marker, driven by `style.badgeField`'s value —
// sparse by design: only values present in `badgeMap` get a badge, every
// other value (the common case) gets none.
export function resolveMarkerBadge(badgeMap: Record<string, string> | undefined, value: unknown): string | undefined {
  if (!badgeMap || typeof value !== 'string') return undefined;
  return lookupByValueOrPrefix(badgeMap, value);
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
