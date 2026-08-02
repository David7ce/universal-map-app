import { describe, expect, it } from 'vitest';
import type L from 'leaflet';
import { buildGridLines, gridStepForZoom } from './coordinate-grid';

// A minimal stand-in for L.LatLngBounds — buildGridLines only calls these
// four accessors, and constructing a real Leaflet bounds object requires a
// `window` global that isn't available under vitest's node environment.
function bounds(south: number, west: number, north: number, east: number) {
  return {
    getSouth: () => south,
    getWest: () => west,
    getNorth: () => north,
    getEast: () => east,
  } as unknown as L.LatLngBounds;
}

describe('gridStepForZoom', () => {
  it('uses a coarse step at low zoom', () => {
    expect(gridStepForZoom(2)).toBe(30);
  });

  it('uses a finer step as zoom increases', () => {
    expect(gridStepForZoom(10)).toBeLessThan(gridStepForZoom(2));
  });

  it('never goes below the finest configured step', () => {
    expect(gridStepForZoom(50)).toBeGreaterThanOrEqual(0.001);
  });
});

describe('buildGridLines', () => {
  it('produces both latitude and longitude lines covering the bounds', () => {
    const lines = buildGridLines(bounds(0, 0, 1, 1), 0.5);
    expect(lines.length).toBeGreaterThan(0);
    // Every line has exactly two endpoints
    for (const line of lines) expect(line).toHaveLength(2);
  });

  it('caps the number of lines per axis for a huge bounds/tiny step combo', () => {
    const lines = buildGridLines(bounds(-90, -180, 90, 180), 0.001);
    // 60 lat + 60 lng lines max
    expect(lines.length).toBeLessThanOrEqual(120);
  });
});
