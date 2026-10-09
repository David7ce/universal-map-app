import type { GeoFeature } from '../time/temporal-types';
import type { LayerSource } from './source-types';

type Obj = Record<string, unknown>;

function isObject(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Arrays of objects that merge element by element, matched on this key.
const KEYED_ARRAYS: Record<string, string> = { taxonomy: 'id', infoFields: 'field' };
// Objects whose keys ARE the translated values — replaced wholesale so the
// original-language keys don't linger next to the translated ones.
const REPLACED_OBJECTS = new Set(['colorMap', 'badgeMap', 'icons']);

function mergeValue(key: string, base: unknown, override: unknown): unknown {
  if (REPLACED_OBJECTS.has(key) && isObject(override)) return override;
  const matchKey = KEYED_ARRAYS[key];
  if (matchKey && Array.isArray(base) && Array.isArray(override)) return mergeKeyedArray(base, override, matchKey);
  if (isObject(base) && isObject(override)) return mergeObjects(base, override);
  return override;
}

function mergeObjects(base: Obj, override: Obj): Obj {
  const out: Obj = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = key in base ? mergeValue(key, base[key], value) : value;
  }
  return out;
}

function mergeKeyedArray(base: unknown[], override: unknown[], key: string): unknown[] {
  const sameKey = (a: unknown, b: unknown): boolean => isObject(a) && isObject(b) && a[key] === b[key];
  const merged = base.map((item) => {
    const match = override.find((candidate) => sameKey(item, candidate));
    return match && isObject(item) && isObject(match) ? mergeObjects(item, match) : item;
  });
  const extra = override.filter((candidate) => !base.some((item) => sameKey(item, candidate)));
  return [...merged, ...extra];
}

// Overlays a per-language partial layer manifest on the base one. `id` and
// `source` always come from the base. Pure: neither argument is mutated.
export function mergeLayerOverride<T extends object>(base: T, override: Obj): T {
  const safe: Obj = { ...override };
  delete safe.id;
  delete safe.source;
  return mergeObjects(base as Obj, safe) as T;
}

// Shallow-merges per-feature property overrides (keyed by feature id) into
// `properties`. Geometry, id and `properties.temporal` are never changed.
export function applyFeatureOverrides(features: GeoFeature[], overrides: Record<string, Obj>): GeoFeature[] {
  return features.map((feature) => {
    const override = feature.id === undefined ? undefined : overrides[String(feature.id)];
    if (!isObject(override)) return feature;
    const props: Obj = { ...override };
    delete props.temporal;
    return { ...feature, properties: { ...feature.properties, ...props } };
  });
}

// Convention: `layers/x.layer.json` -> `layers/x.layer.<lang>.json`, and a
// `.geojson` source `d/x.geojson` -> `d/x.<lang>.json`. Sharded sources have no
// data override.
export function overridePaths(
  layerPath: string,
  source: LayerSource,
  lang: string,
): { layer: string; data: string | undefined } {
  return {
    layer: layerPath.replace(/\.json$/, `.${lang}.json`),
    data: source.type === 'geojson' ? source.url.replace(/\.geojson$/, `.${lang}.json`) : undefined,
  };
}
