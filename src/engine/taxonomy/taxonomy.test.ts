import { describe, expect, it } from 'vitest';
import { computeTaxonomyDimensions, featureMatchesFilters, filterActiveFeatures, type LoadedLayer } from './compute-dimensions';
import { getTriState, toggleAll } from './tri-state';
import type { LayerManifest } from '../manifests/layer-manifest';
import type { GeoFeature } from '../time/temporal-types';

function layer(): LoadedLayer {
  const manifest: LayerManifest = {
    id: 'poi',
    title: 'POI',
    kind: 'point',
    source: { type: 'geojson', url: '/x' },
    taxonomy: [{ id: 'category', label: 'Category', field: 'properties.category' }],
  };
  return {
    manifest,
    features: [
      { type: 'Feature', id: '1', properties: { category: 'shop' }, geometry: { type: 'Point', coordinates: [0, 0] } },
      { type: 'Feature', id: '2', properties: { category: 'shop' }, geometry: { type: 'Point', coordinates: [0, 0] } },
      {
        type: 'Feature',
        id: '3',
        properties: { category: 'market', temporal: { instant: '2020-01-01' } },
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
    ],
  };
}

describe('computeTaxonomyDimensions', () => {
  it('counts values per dimension for features active on the given date', () => {
    const dims = computeTaxonomyDimensions([layer()], new Date('2026-01-01T00:00:00Z'));
    expect(dims).toEqual([
      { id: 'category', label: 'Category', values: [{ value: 'shop', count: 2 }], showCounts: true },
    ]);
  });

  it('turns off counts for a boundary-region layer (one polygon per value, count always 1)', () => {
    const boundaryLayer = layer();
    boundaryLayer.manifest = { ...boundaryLayer.manifest, regionRole: 'boundary' };
    const dims = computeTaxonomyDimensions([boundaryLayer], new Date('2026-01-01T00:00:00Z'));
    expect(dims[0].showCounts).toBe(false);
  });

  it('includes instant-matched features on their exact date', () => {
    const dims = computeTaxonomyDimensions([layer()], new Date('2020-01-01T00:00:00Z'));
    const category = dims[0];
    expect(category.values).toEqual(
      expect.arrayContaining([
        { value: 'shop', count: 2 },
        { value: 'market', count: 1 },
      ]),
    );
  });

  it('counts every feature, ignoring temporal fields, when date is null', () => {
    const dims = computeTaxonomyDimensions([layer()], null);
    const category = dims[0];
    expect(category.values).toEqual(
      expect.arrayContaining([
        { value: 'shop', count: 2 },
        { value: 'market', count: 1 },
      ]),
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

describe('featureMatchesFilters', () => {
  const manifest: LayerManifest = {
    id: 'poi',
    title: 'POI',
    kind: 'point',
    source: { type: 'geojson', url: '/x' },
    taxonomy: [
      { id: 'category', label: 'Category', field: 'properties.category' },
      { id: 'region', label: 'Region', field: 'properties.region' },
    ],
  };

  function feature(properties: Record<string, unknown>): GeoFeature {
    return {
      type: 'Feature',
      id: 'f1',
      properties,
      geometry: { type: 'Point', coordinates: [0, 0] },
    };
  }

  it('matches everything when activeFilters is empty (no restriction)', () => {
    expect(featureMatchesFilters(feature({ category: 'shop' }), manifest, {})).toBe(true);
  });

  it('matches everything when a dimension has an empty Set (no restriction)', () => {
    const activeFilters = { category: new Set<string>() };
    expect(featureMatchesFilters(feature({ category: 'shop' }), manifest, activeFilters)).toBe(true);
  });

  it('matches when the feature value is in the selected set', () => {
    const activeFilters = { category: new Set(['shop', 'market']) };
    expect(featureMatchesFilters(feature({ category: 'shop' }), manifest, activeFilters)).toBe(true);
  });

  it('rejects when the feature value is not in the selected set', () => {
    const activeFilters = { category: new Set(['market']) };
    expect(featureMatchesFilters(feature({ category: 'shop' }), manifest, activeFilters)).toBe(false);
  });

  it('requires every restricted dimension to match (AND across dimensions)', () => {
    const activeFilters = {
      category: new Set(['shop']),
      region: new Set(['north']),
    };
    expect(featureMatchesFilters(feature({ category: 'shop', region: 'south' }), manifest, activeFilters)).toBe(false);
    expect(featureMatchesFilters(feature({ category: 'shop', region: 'north' }), manifest, activeFilters)).toBe(true);
  });

  it('rejects a feature missing the field entirely when that dimension is restricted', () => {
    const activeFilters = { category: new Set(['shop']) };
    expect(featureMatchesFilters(feature({}), manifest, activeFilters)).toBe(false);
  });

  it('ignores activeFilters keys for dimensions the layer does not declare', () => {
    const activeFilters = { unrelatedDimension: new Set(['x']) };
    expect(featureMatchesFilters(feature({ category: 'shop' }), manifest, activeFilters)).toBe(true);
  });
});

describe('filterActiveFeatures', () => {
  const manifest: LayerManifest = {
    id: 'poi',
    title: 'POI',
    kind: 'point',
    source: { type: 'geojson', url: '/x' },
    taxonomy: [{ id: 'category', label: 'Category', field: 'properties.category' }],
  };

  function feature(id: string, properties: Record<string, unknown>): GeoFeature {
    return { type: 'Feature', id, properties, geometry: { type: 'Point', coordinates: [0, 0] } };
  }

  it('excludes a feature outside its temporal range on a real date', () => {
    const features = [feature('1', { category: 'shop', temporal: { instant: '2020-01-01' } })];
    const result = filterActiveFeatures(features, new Date('2026-01-01T00:00:00Z'), manifest, {});
    expect(result).toEqual([]);
  });

  it('includes every feature regardless of temporal fields when date is null', () => {
    const features = [feature('1', { category: 'shop', temporal: { instant: '2020-01-01' } })];
    const result = filterActiveFeatures(features, null, manifest, {});
    expect(result.map((f) => f.id)).toEqual(['1']);
  });

  it('still applies activeFilters when date is null', () => {
    const features = [feature('1', { category: 'shop' }), feature('2', { category: 'market' })];
    const result = filterActiveFeatures(features, null, manifest, { category: new Set(['market']) });
    expect(result.map((f) => f.id)).toEqual(['2']);
  });
});
