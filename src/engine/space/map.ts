import L from 'leaflet';
import type { AppManifest } from '../manifests/app-manifest';

export function createMap(container: HTMLElement, appManifest: AppManifest): L.Map {
  const map = L.map(container).setView(appManifest.map.center, appManifest.map.zoom);

  const baseLayers: Record<string, L.TileLayer> = {};
  appManifest.baseLayers.forEach((config, index) => {
    const layer = L.tileLayer(config.url, { attribution: config.attribution });
    baseLayers[config.title] = layer;
    if (index === 0) layer.addTo(map);
  });
  L.control.layers(baseLayers).addTo(map);

  return map;
}
