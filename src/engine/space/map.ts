import L from 'leaflet';
import type { AppManifest } from '../manifests/app-manifest';
import type { MapCrsConfig } from './map-crs';

export interface CreatedMap {
  map: L.Map;
  // Keyed by base layer id (from the manifest) — not title, so callers don't
  // have to round-trip through display text to switch layers.
  baseLayers: Record<string, L.TileLayer>;
}

// proj4leaflet (and its proj4 dependency) is only needed for a custom CRS —
// most apps use the default EPSG:3857 or the Leaflet-builtin EPSG:4326, so
// it's dynamically imported here rather than paid for on every page load.
async function resolveCrs(config: MapCrsConfig | undefined): Promise<L.CRS | undefined> {
  if (config === undefined || config === 'EPSG:3857') return undefined;
  if (config === 'EPSG:4326') return L.CRS.EPSG4326;
  await import('proj4leaflet');
  return new L.Proj.CRS('custom', config.proj4def, {
    resolutions: config.resolutions,
    origin: config.origin,
    ...(config.bounds ? { bounds: L.bounds(config.bounds[0], config.bounds[1]) } : {}),
  });
}

export async function createMap(container: HTMLElement, appManifest: AppManifest): Promise<CreatedMap> {
  const crs = await resolveCrs(appManifest.map.crs);
  const map = L.map(container, { zoomControl: false, ...(crs ? { crs } : {}) }).setView(
    appManifest.map.center,
    appManifest.map.zoom,
  );

  const baseLayers: Record<string, L.TileLayer> = {};
  appManifest.baseLayers.forEach((config, index) => {
    const layer = L.tileLayer(config.url, { attribution: config.attribution });
    baseLayers[config.id] = layer;
    if (index === 0) layer.addTo(map);
  });

  // Base-layer switching and the "map details" toggle group get a custom
  // control (LayerControl.ts) matching the reference UI, not Leaflet's
  // built-in layers box — only the zoom control stays a real Leaflet
  // control, restyled and repositioned via CSS.
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  return { map, baseLayers };
}
