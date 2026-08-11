import L from 'leaflet';
import type { AppManifest } from '../../manifests/app-manifest';
import type { MapCrsConfig } from '../map-crs';

export interface CreatedMap {
  map: L.Map;
  // Keyed by base layer id (from the manifest) — not title, so callers don't
  // have to round-trip through display text to switch layers. A plain
  // `L.TileLayer`, or an `L.LayerGroup` of two when the config declares a
  // `labelsUrl` overlay (e.g. place names over unlabeled satellite tiles).
  baseLayers: Record<string, L.Layer>;
}

// proj4leaflet (and its proj4 dependency) is only needed for a custom CRS —
// most apps use the default EPSG:3857 or the Leaflet-builtin EPSG:4326, so
// it's dynamically imported here rather than paid for on every page load.
async function resolveCrs(config: MapCrsConfig | undefined): Promise<L.CRS | undefined> {
  if (config === undefined || config === 'EPSG:3857') return undefined;
  if (config === 'EPSG:4326') return L.CRS.EPSG4326;
  // Flat pixel-space (indoor floor plans, game/fictional maps) — no
  // geographic meaning, so GeoJSON coordinates are just [x, y] in whatever
  // unit the app author's data uses, not lon/lat.
  if (config === 'Simple') return L.CRS.Simple;
  await import('proj4leaflet');
  return new L.Proj.CRS('custom', config.proj4def, {
    resolutions: config.resolutions,
    origin: config.origin,
    ...(config.bounds ? { bounds: L.bounds(config.bounds[0], config.bounds[1]) } : {}),
  });
}

export async function createMap(container: HTMLElement, appManifest: AppManifest): Promise<CreatedMap> {
  const crs = await resolveCrs(appManifest.map.crs);
  // Show a single world, not an infinitely repeating one: `noWrap` on every
  // tile layer stops horizontal tile repetition, and `maxBounds` (only for
  // the two built-in geographic CRSs — a custom CRS's units aren't known
  // here) stops panning past the edges of that single world.
  const isGeographicCrs = crs === undefined || crs === L.CRS.EPSG4326;
  const map = L.map(container, {
    zoomControl: false,
    // The footer legend (app-chrome.ts's mountAttribution) already shows
    // the active base layer's attribution — Leaflet's own attribution
    // control would just duplicate it, and it shares the bottom-right
    // corner with the zoom control, pushing it visually out of alignment
    // with the layers button.
    attributionControl: false,
    worldCopyJump: false,
    ...(isGeographicCrs ? { maxBounds: L.latLngBounds([-90, -180], [90, 180]), maxBoundsViscosity: 1.0 } : {}),
    ...(crs ? { crs } : {}),
  }).setView(appManifest.map.center, appManifest.map.zoom);

  const baseLayers: Record<string, L.Layer> = {};
  appManifest.baseLayers.forEach((config, index) => {
    const tiles = L.tileLayer(config.url, { attribution: config.attribution, noWrap: true });
    const layer = config.labelsUrl
      ? L.layerGroup([
          tiles,
          L.tileLayer(config.labelsUrl, {
            attribution: config.labelsAttribution ?? config.attribution,
            noWrap: true,
          }),
        ])
      : tiles;
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
