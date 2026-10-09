import { describe, expect, it } from 'vitest';
import type { GeoFeature } from '../time/temporal-types';
import { applyFeatureOverrides, mergeLayerOverride, overridePaths } from './layer-override';

const base = {
  id: 'leaders',
  title: 'Líderes',
  source: { type: 'geojson', url: 'worlds/w/data/leaders.geojson' },
  taxonomy: [
    { id: 'role', label: 'Cargo', field: 'properties.roleGroup', icons: { Presidencia: 'P' }, defaultIcon: 'D' },
    { id: 'continent', label: 'Continente', field: 'properties.continent', icons: { Europa: 'E' } },
  ],
  style: { cluster: true, colorField: 'properties.continent', colorMap: { Europa: '#111' }, defaultColor: '#000' },
  panel: {
    infoFields: [
      { field: 'properties.leader', label: 'Líder' },
      { field: 'properties.bio', label: 'Biografía' },
    ],
  },
};

describe('mergeLayerOverride', () => {
  it('replaces scalars and keeps untouched keys', () => {
    const merged = mergeLayerOverride(base, { title: 'Leaders' });
    expect(merged.title).toBe('Leaders');
    expect(merged.style.cluster).toBe(true);
  });

  it('merges taxonomy entries by id, keeping field and defaultIcon from the base', () => {
    const merged = mergeLayerOverride(base, { taxonomy: [{ id: 'role', label: 'Position' }] });
    expect(merged.taxonomy[0]).toMatchObject({
      id: 'role',
      label: 'Position',
      field: 'properties.roleGroup',
      defaultIcon: 'D',
    });
    expect(merged.taxonomy[1].label).toBe('Continente');
  });

  it('replaces icons and colorMap wholesale so base keys do not linger', () => {
    const merged = mergeLayerOverride(base, {
      taxonomy: [{ id: 'continent', icons: { Europe: 'E' } }],
      style: { colorMap: { Europe: '#222' } },
    });
    expect(merged.taxonomy[1].icons).toEqual({ Europe: 'E' });
    expect(merged.style.colorMap).toEqual({ Europe: '#222' });
    expect(merged.style.colorField).toBe('properties.continent');
  });

  it('merges infoFields by field', () => {
    const merged = mergeLayerOverride(base, {
      panel: { infoFields: [{ field: 'properties.bio', label: 'Biography' }] },
    });
    expect(merged.panel.infoFields).toEqual([
      { field: 'properties.leader', label: 'Líder' },
      { field: 'properties.bio', label: 'Biography' },
    ]);
  });

  it('appends entries that exist only in the override', () => {
    const merged = mergeLayerOverride(base, { taxonomy: [{ id: 'extra', label: 'X', field: 'properties.x' }] });
    expect(merged.taxonomy.map((t) => t.id)).toEqual(['role', 'continent', 'extra']);
  });

  it('ignores source and id in the override', () => {
    const merged = mergeLayerOverride(base, { id: 'other', source: { type: 'geojson', url: 'evil' } });
    expect(merged.id).toBe('leaders');
    expect(merged.source.url).toBe('worlds/w/data/leaders.geojson');
  });

  it('does not mutate the base', () => {
    mergeLayerOverride(base, { title: 'Leaders', taxonomy: [{ id: 'role', label: 'Position' }] });
    expect(base.title).toBe('Líderes');
    expect(base.taxonomy[0].label).toBe('Cargo');
  });
});

function feature(id: string | number | undefined, properties: Record<string, unknown>): GeoFeature {
  return { type: 'Feature', id, properties, geometry: { type: 'Point', coordinates: [1, 2] } };
}

describe('applyFeatureOverrides', () => {
  it('shallow-merges overrides into properties by id', () => {
    const [a, b] = applyFeatureOverrides(
      [feature('a', { role: 'Presidente', name: 'N' }), feature('b', { role: 'X' })],
      {
        a: { role: 'President' },
      },
    );
    expect(a.properties).toEqual({ role: 'President', name: 'N' });
    expect(b.properties).toEqual({ role: 'X' });
  });

  it('matches numeric ids as strings and ignores unknown ids', () => {
    const [a] = applyFeatureOverrides([feature(7, { v: 'es' })], { '7': { v: 'en' }, nope: { v: 'zz' } });
    expect(a.properties.v).toBe('en');
  });

  it('never changes geometry, id or temporal', () => {
    const f = feature('a', { temporal: { instant: '2020-01-01' }, role: 'r' });
    const [a] = applyFeatureOverrides([f], { a: { temporal: { instant: '1999-01-01' }, role: 'q', geometry: 'x' } });
    expect(a.properties.temporal).toEqual({ instant: '2020-01-01' });
    expect(a.properties.role).toBe('q');
    expect(a.geometry).toEqual({ type: 'Point', coordinates: [1, 2] });
    expect(a.id).toBe('a');
  });
});

describe('overridePaths', () => {
  it('derives the layer and data override paths for a geojson source', () => {
    expect(
      overridePaths('layers/leaders.layer.json', { type: 'geojson', url: 'worlds/w/data/leaders.geojson' }, 'en'),
    ).toEqual({
      layer: 'layers/leaders.layer.en.json',
      data: 'worlds/w/data/leaders.en.json',
    });
  });

  it('has no data override for a sharded source', () => {
    expect(
      overridePaths('layers/a.layer.json', { type: 'geojson-sharded', urls: ['x.geojson'] }, 'es').data,
    ).toBeUndefined();
  });
});
