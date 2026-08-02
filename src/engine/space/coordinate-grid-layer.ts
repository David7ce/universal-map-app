import L from 'leaflet';
import { buildGridLines, gridStepForZoom } from './coordinate-grid';

export interface CoordinateGrid {
  setVisible(visible: boolean): void;
}

// A lightweight lat/lng graticule overlay — no dedicated Leaflet plugin
// dependency, just polylines redrawn on move/zoom while visible. Split out
// of coordinate-grid.ts (which stays runtime-Leaflet-free and unit-tested)
// because importing 'leaflet' at runtime requires a `window` global that
// isn't available under vitest's node test environment.
export function mountCoordinateGrid(map: L.Map): CoordinateGrid {
  const group = L.layerGroup();
  let visible = false;

  function render(): void {
    if (!visible) return;
    group.clearLayers();
    const step = gridStepForZoom(map.getZoom());
    for (const line of buildGridLines(map.getBounds(), step)) {
      L.polyline(line, { color: '#8899a6', weight: 1, opacity: 0.55, interactive: false }).addTo(group);
    }
  }

  map.on('moveend zoomend', render);

  return {
    setVisible(next: boolean): void {
      if (next === visible) return;
      visible = next;
      if (visible) {
        group.addTo(map);
        render();
      } else {
        group.clearLayers();
        map.removeLayer(group);
      }
    },
  };
}
