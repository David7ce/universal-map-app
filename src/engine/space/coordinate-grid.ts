import type L from 'leaflet';

// "Nice" grid steps in degrees, coarsest to finest — picked so a line lands
// on round numbers (30°, 15°, 10°, 5°, 2°, 1°, 0.5°, ...) at every zoom.
const GRID_STEPS_DEG = [30, 15, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.025, 0.01, 0.005, 0.0025, 0.001];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Roughly one grid line per screen at low zoom, denser as the user zooms in.
export function gridStepForZoom(zoom: number): number {
  const index = clamp(Math.round((zoom - 2) * 1.3), 0, GRID_STEPS_DEG.length - 1);
  return GRID_STEPS_DEG[index];
}

const MAX_LINES_PER_AXIS = 60;

export function buildGridLines(bounds: L.LatLngBounds, step: number): L.LatLngExpression[][] {
  const south = Math.floor(bounds.getSouth() / step) * step;
  const north = Math.ceil(bounds.getNorth() / step) * step;
  const west = Math.floor(bounds.getWest() / step) * step;
  const east = Math.ceil(bounds.getEast() / step) * step;

  const lines: L.LatLngExpression[][] = [];
  for (let i = 0, lat = south; lat <= north && i < MAX_LINES_PER_AXIS; i++, lat += step) {
    lines.push([
      [lat, west],
      [lat, east],
    ]);
  }
  for (let i = 0, lng = west; lng <= east && i < MAX_LINES_PER_AXIS; i++, lng += step) {
    lines.push([
      [south, lng],
      [north, lng],
    ]);
  }
  return lines;
}
