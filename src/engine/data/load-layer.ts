import { validateLayerManifest } from '../manifests/layer-manifest';
import type { LoadedLayer } from '../taxonomy/compute-dimensions';
import type { GeoFeature } from '../time/temporal-types';
import { applyFeatureOverrides, mergeLayerOverride, overridePaths } from './layer-override';
import type { LayerSource } from './source-types';

export interface LoadLayerDeps {
  fetchJson(url: string): Promise<unknown>;
  fetchFeatures(source: LayerSource): Promise<GeoFeature[]>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// An override file is optional: a 404, a network error or a non-JSON fallback
// page (dev servers answer a missing file with index.html) all mean "none".
async function tryFetchObject(deps: LoadLayerDeps, url: string): Promise<Record<string, unknown> | undefined> {
  try {
    const json = await deps.fetchJson(url);
    return isObject(json) ? json : undefined;
  } catch {
    return undefined;
  }
}

// Loads a layer in the visitor's language: the base manifest and features,
// overlaid with `<name>.layer.<lang>.json` / `<file>.<lang>.json` when the
// language differs from the world's `contentLanguage` and is listed in the
// world's `translations`. Only the base files are required.
export async function loadLayer(
  deps: LoadLayerDeps,
  appId: string,
  layerPath: string,
  language: string,
  contentLanguage: string,
  translations: readonly string[],
): Promise<LoadedLayer> {
  const base = validateLayerManifest(await deps.fetchJson(`worlds/${appId}/${layerPath}`));
  const baseFeatures = await deps.fetchFeatures(base.source);
  if (language === contentLanguage || !translations.includes(language))
    return { manifest: base, features: baseFeatures };

  const paths = overridePaths(layerPath, base.source, language);
  const [layerOverride, dataOverride] = await Promise.all([
    tryFetchObject(deps, `worlds/${appId}/${paths.layer}`),
    paths.data ? tryFetchObject(deps, paths.data) : Promise.resolve(undefined),
  ]);

  let manifest = base;
  if (layerOverride) {
    try {
      manifest = validateLayerManifest(mergeLayerOverride(base, layerOverride));
    } catch (error) {
      console.warn(`Ignoring invalid ${language} override for layer "${base.id}"`, error);
    }
  }
  const features = dataOverride
    ? applyFeatureOverrides(baseFeatures, dataOverride as Record<string, Record<string, unknown>>)
    : baseFeatures;
  return { manifest, features };
}
