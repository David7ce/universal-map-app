import { describe, expect, it } from 'vitest';
import { computeTaxonomyDimensions, type LoadedLayer } from './compute-dimensions';
import { getTriState, toggleAll } from './tri-state';
import type { LayerManifest } from '../manifests/layer-manifest';

function layer(): LoadedLayer {
  const manifest: LayerManifest = {
    id: 'poi',
    title: 'POI',
    kind: 'point',
    source: { type: 'geojson', url: '/x' },
    taxonomy: [{ id: 'categoria', label: 'Categoría', field: 'properties.categoria' }],
  };
  return {
    manifest,
    features: [
      { type: 'Feature', id: '1', properties: { categoria: 'shop' }, geometry: { type: 'Point', coordinates: [0, 0] } },
      { type: 'Feature', id: '2', properties: { categoria: 'shop' }, geometry: { type: 'Point', coordinates: [0, 0] } },
      {
        type: 'Feature',
        id: '3',
        properties: { categoria: 'market', temporal: { instant: '2020-01-01' } },
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
    ],
  };
}

describe('computeTaxonomyDimensions', () => {
  it('counts values per dimension for features active on the given date', () => {
    const dims = computeTaxonomyDimensions([layer()], new Date('2026-01-01T00:00:00Z'));
    expect(dims).toEqual([
      { id: 'categoria', label: 'Categoría', values: [{ value: 'shop', count: 2 }] },
    ]);
  });

  it('includes instant-matched features on their exact date', () => {
    const dims = computeTaxonomyDimensions([layer()], new Date('2020-01-01T00:00:00Z'));
    const categoria = dims[0];
    expect(categoria.values).toEqual(
      expect.arrayContaining([
        { value: 'shop', count: 2 },
        { value: 'market', count: 1 },
      ])
    );
  });
});

describe('getTriState', () => {
  it('returns "none" when nothing is selected', () => {
    expect(getTriState(['a', 'b'], new Set())).toBe('none');
  });
  it('returns "all" when everything is selected', () => {
    expect(getTriState(['a', 'b'], new Set(['a', 'b']))).toBe('all');
  });
  it('returns "some" for a partial selection', () => {
    expect(getTriState(['a', 'b'], new Set(['a']))).toBe('some');
  });
});

describe('toggleAll', () => {
  it('selects everything when currently not all-selected', () => {
    expect(toggleAll(['a', 'b'], new Set())).toEqual(new Set(['a', 'b']));
  });
  it('clears the selection when everything is currently selected', () => {
    expect(toggleAll(['a', 'b'], new Set(['a', 'b']))).toEqual(new Set());
  });
});
