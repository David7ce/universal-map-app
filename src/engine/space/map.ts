import L from 'leaflet';
import type { AppManifest } from '../manifests/app-manifest';

export interface CreatedMap {
  map: L.Map;
  // Keyed by base layer id (from the manifest) — not title, so callers don't
  // have to round-trip through display text to switch layers.
  baseLayers: Record<string, L.TileLayer>;
}

export function createMap(container: HTMLElement, appManifest: AppManifest): CreatedMap {
  const map = L.map(container, { zoomControl: false }).setView(appManifest.map.center, appManifest.map.zoom);

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
