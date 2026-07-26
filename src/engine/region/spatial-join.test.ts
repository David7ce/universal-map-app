import { describe, expect, it } from 'vitest';
import { findContainingRegions } from './spatial-join';
import type { LoadedLayer } from '../taxonomy/compute-dimensions';
import type { LayerManifest } from '../manifests/layer-manifest';
import type { Temporal } from '../time/temporal-types';

function square(id: string, temporal: Temporal | undefined) {
  return {
    type: 'Feature' as const,
    id,
    properties: { nombre: id, temporal },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
    },
  };
}

function boundaryLayer(): LoadedLayer {
  const manifest: LayerManifest = {
    id: 'regions',
    title: 'Regions',
    kind: 'polygon',
    source: { type: 'geojson', url: '/x' },
    regionRole: 'boundary',
  };
  return {
    manifest,
    features: [
      square('region-old', { range: { to: '2022-12-31' } }),
      square('region-new', { range: { from: '2023-01-01' } }),
    ],
  };
}

describe('findContainingRegions', () => {
  it('finds the old boundary before the change date', () => {
    const matches = findContainingRegions([5, 5], [boundaryLayer()], new Date('2022-06-01T00:00:00Z'));
    expect(matches.map((f) => f.id)).toEqual(['region-old']);
  });

  it('finds the new boundary after the change date', () => {
    const matches = findContainingRegions([5, 5], [boundaryLayer()], new Date('2023-06-01T00:00:00Z'));
    expect(matches.map((f) => f.id)).toEqual(['region-new']);
  });

  it('returns nothing for a point outside every polygon', () => {
    const matches = findContainingRegions([50, 50], [boundaryLayer()], new Date('2023-06-01T00:00:00Z'));
    expect(matches).toEqual([]);
  });

  it('ignores layers not marked as a boundary role', () => {
    const layer = boundaryLayer();
    layer.manifest.regionRole = null;
    const matches = findContainingRegions([5, 5], [layer], new Date('2023-06-01T00:00:00Z'));
    expect(matches).toEqual([]);
  });
});
