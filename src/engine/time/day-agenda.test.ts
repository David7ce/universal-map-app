import { describe, expect, it } from 'vitest';
import { getFeaturesOnDate, getFeaturesInRange } from './day-agenda';
import type { LoadedLayer } from '../taxonomy/compute-dimensions';
import type { LayerManifest } from '../manifests/layer-manifest';

function layerWithEventOn(iso: string): LoadedLayer {
  const manifest: LayerManifest = {
    id: 'poi',
    title: 'POI',
    kind: 'point',
    source: { type: 'geojson', url: '/x' },
  };
  return {
    manifest,
    features: [
      {
        type: 'Feature',
        id: '1',
        properties: { temporal: { instant: iso }, name: 'Volcano eruption' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
    ],
  };
}

describe('getFeaturesOnDate', () => {
  it('returns a feature active on the given date, with its layer id/title', () => {
    const entries = getFeaturesOnDate([layerWithEventOn('2026-07-30')], {}, '2026-07-30');
    expect(entries.length).toBe(1);
    expect(entries[0].layerId).toBe('poi');
    expect(entries[0].layerTitle).toBe('POI');
    expect(entries[0].feature.properties.name).toBe('Volcano eruption');
  });

  it('excludes a feature not active on the given date', () => {
    const entries = getFeaturesOnDate([layerWithEventOn('2026-07-30')], {}, '2026-07-29');
    expect(entries.length).toBe(0);
  });

  it('excludes an always-active feature with no temporal property', () => {
    const manifest: LayerManifest = { id: 'poi', title: 'POI', kind: 'point', source: { type: 'geojson', url: '/x' } };
    const layer: LoadedLayer = {
      manifest,
      features: [{ type: 'Feature', id: '1', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }],
    };
    expect(getFeaturesOnDate([layer], {}, '2026-07-30')).toEqual([]);
  });

  it('excludes a feature filtered out by activeFilters', () => {
    const layer = layerWithEventOn('2026-07-30');
    layer.manifest = {
      ...layer.manifest,
      taxonomy: [{ id: 'category', label: 'Category', field: 'properties.category' }],
    };
    layer.features[0].properties.category = 'shop';
    const entries = getFeaturesOnDate([layer], { category: new Set(['market']) }, '2026-07-30');
    expect(entries.length).toBe(0);
  });

  it('includes a recurring feature only on a matching occurrence', () => {
    const manifest: LayerManifest = {
      id: 'events',
      title: 'Events',
      kind: 'point',
      source: { type: 'geojson', url: '/x' },
    };
    const layer: LoadedLayer = {
      manifest,
      features: [
        {
          type: 'Feature',
          id: '1',
          properties: {
            temporal: { range: { from: '2026-01-01' }, recurrence: { rule: 'FREQ=WEEKLY;BYDAY=MO' } },
          },
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ],
    };
    // 2026-08-03 is a Monday, 2026-08-04 is a Tuesday.
    expect(getFeaturesOnDate([layer], {}, '2026-08-03').length).toBe(1);
    expect(getFeaturesOnDate([layer], {}, '2026-08-04').length).toBe(0);
  });
});

describe('getFeaturesInRange', () => {
  it('groups a feature under its own date, within range', () => {
    const groups = getFeaturesInRange([layerWithEventOn('2026-07-30')], {}, '2026-07-29', '2026-07-31');
    expect(groups).toEqual([{ iso: '2026-07-30', entries: expect.any(Array) }]);
    expect(groups[0].entries.length).toBe(1);
    expect(groups[0].entries[0].feature.properties.name).toBe('Volcano eruption');
  });

  it('excludes a feature outside the [fromIso, toIso] range', () => {
    const groups = getFeaturesInRange([layerWithEventOn('2026-07-30')], {}, '2026-08-01', '2026-08-31');
    expect(groups).toEqual([]);
  });

  it('includes features on the range boundaries themselves', () => {
    const fromGroups = getFeaturesInRange([layerWithEventOn('2026-07-30')], {}, '2026-07-30', '2026-07-30');
    expect(fromGroups.length).toBe(1);
  });

  it('omits dates with no matching entries', () => {
    const groups = getFeaturesInRange([layerWithEventOn('2026-07-30')], {}, '2026-07-28', '2026-08-01');
    expect(groups.length).toBe(1);
    expect(groups[0].iso).toBe('2026-07-30');
  });

  it('respects activeFilters', () => {
    const layer = layerWithEventOn('2026-07-30');
    layer.manifest = {
      ...layer.manifest,
      taxonomy: [{ id: 'category', label: 'Category', field: 'properties.category' }],
    };
    layer.features[0].properties.category = 'shop';
    const groups = getFeaturesInRange([layer], { category: new Set(['market']) }, '2026-07-29', '2026-07-31');
    expect(groups).toEqual([]);
  });

  it('includes a recurring feature once per matching occurrence in range', () => {
    const manifest: LayerManifest = {
      id: 'events',
      title: 'Events',
      kind: 'point',
      source: { type: 'geojson', url: '/x' },
    };
    const layer: LoadedLayer = {
      manifest,
      features: [
        {
          type: 'Feature',
          id: '1',
          properties: {
            temporal: { range: { from: '2026-01-01' }, recurrence: { rule: 'FREQ=WEEKLY;BYDAY=MO' } },
          },
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ],
    };
    // 2026-08-03 and 2026-08-10 are Mondays.
    const groups = getFeaturesInRange([layer], {}, '2026-08-01', '2026-08-11');
    expect(groups.map((g) => g.iso)).toEqual(['2026-08-03', '2026-08-10']);
  });
});
