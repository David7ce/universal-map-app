import { describe, expect, it } from 'vitest';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import type { LayerManifest } from '../../engine/manifests/layer-manifest';
import type { GeoFeature } from '../../engine/time/temporal-types';
import { buildToolbarPills, countActiveIn, splitVisiblePills, type ToolbarPill } from './toolbar-pills';

function feature(id: string, category: string, instant?: string): GeoFeature {
  return {
    type: 'Feature',
    id,
    properties: instant ? { category, temporal: { instant } } : { category },
    geometry: { type: 'Point', coordinates: [0, 0] },
  };
}

function layer(id: string, features: GeoFeature[]): LoadedLayer {
  const manifest: LayerManifest = {
    id,
    title: id,
    kind: 'point',
    source: { type: 'geojson', url: '/x' },
    taxonomy: [{ id: 'category', label: 'Category', field: 'properties.category' }],
  };
  return { manifest, features };
}

const DATE = new Date('2026-06-01T00:00:00Z');

describe('buildToolbarPills', () => {
  it('lists every value of a dimension, with its count on the date (0 when none active)', () => {
    const l = layer('poi', [feature('1', 'shop'), feature('2', 'shop'), feature('3', 'market', '2020-01-01')]);
    const pills = buildToolbarPills([l], DATE, new Set());
    expect(pills.map((p) => [p.value, p.count])).toEqual([
      ['shop', 2],
      ['market', 0],
    ]);
    expect(pills[0]).toMatchObject({ dimensionId: 'category', dimensionLabel: 'Category' });
  });

  it('omits a dimension with no features active on the date', () => {
    const l = layer('poi', [feature('3', 'market', '2020-01-01')]);
    expect(buildToolbarPills([l], DATE, new Set())).toEqual([]);
  });

  it('ignores layers that are hidden', () => {
    const l = layer('poi', [feature('1', 'shop')]);
    expect(buildToolbarPills([l], DATE, new Set(['poi']))).toEqual([]);
  });

  it('treats a null date as "no date restriction"', () => {
    const l = layer('poi', [feature('3', 'market', '2020-01-01')]);
    expect(buildToolbarPills([l], null, new Set()).map((p) => [p.value, p.count])).toEqual([['market', 1]]);
  });
});

function pill(value: string, dimensionId = 'category'): ToolbarPill {
  return { dimensionId, dimensionLabel: dimensionId, value, count: 1 };
}

describe('splitVisiblePills', () => {
  const pills = ['a', 'b', 'c', 'd', 'e'].map((v) => pill(v));

  it('keeps everything visible when it fits', () => {
    expect(splitVisiblePills(pills, 5)).toEqual({ visible: pills, overflow: [] });
  });

  it('moves the rest into overflow, preserving order', () => {
    const { visible, overflow } = splitVisiblePills(pills, 3);
    expect(visible.map((p) => p.value)).toEqual(['a', 'b', 'c']);
    expect(overflow.map((p) => p.value)).toEqual(['d', 'e']);
  });

  it('shows a single leftover pill inline instead of a "More (1)" menu', () => {
    const { visible, overflow } = splitVisiblePills(pills, 4);
    expect(visible).toHaveLength(5);
    expect(overflow).toEqual([]);
  });

  it('clamps a negative maxVisible to zero', () => {
    expect(splitVisiblePills(pills, -2).overflow).toHaveLength(5);
  });
});

describe('countActiveIn', () => {
  it('counts pills whose value is selected in activeFilters', () => {
    const pills = [pill('a'), pill('b'), pill('c', 'other')];
    const active = { category: new Set(['b']), other: new Set(['c', 'zzz']) };
    expect(countActiveIn(pills, active)).toBe(2);
  });

  it('is 0 with no filters', () => {
    expect(countActiveIn([pill('a')], {})).toBe(0);
  });
});
