import { describe, expect, it } from 'vitest';
import { validateLayerManifest } from './layer-manifest';
import { validateAppManifest } from './app-manifest';

describe('validateLayerManifest', () => {
  const valid = {
    id: 'poi',
    title: 'Points of Interest',
    kind: 'point',
    source: { type: 'geojson', url: '/data/poi.geojson' },
  };

  it('accepts a minimal valid manifest', () => {
    expect(validateLayerManifest(valid)).toEqual(valid);
  });

  it('rejects a missing id', () => {
    expect(() => validateLayerManifest({ ...valid, id: undefined })).toThrow(/"id"/);
  });

  it('rejects an invalid kind', () => {
    expect(() => validateLayerManifest({ ...valid, kind: 'sparkle' })).toThrow(/kind/);
  });

  it('rejects an unknown source type', () => {
    expect(() => validateLayerManifest({ ...valid, source: { type: 'ftp' } })).toThrow(/source.type/);
  });

  it('accepts a null or "boundary" regionRole, rejects anything else', () => {
    expect(validateLayerManifest({ ...valid, regionRole: null })).toEqual({ ...valid, regionRole: null });
    expect(validateLayerManifest({ ...valid, regionRole: 'boundary' })).toEqual({ ...valid, regionRole: 'boundary' });
    expect(() => validateLayerManifest({ ...valid, regionRole: 'nonsense' })).toThrow(/regionRole/);
  });

  it('rejects an invalid temporal.defaultVisibility', () => {
    expect(() => validateLayerManifest({ ...valid, temporal: { defaultVisibility: 'sometimes' } })).toThrow(
      /defaultVisibility/,
    );
  });

  it('rejects a malformed taxonomy entry', () => {
    expect(() => validateLayerManifest({ ...valid, taxonomy: [{ id: 'x' }] })).toThrow(/taxonomy\[0\]/);
  });

  it('accepts a well-formed taxonomy entry', () => {
    const withTaxonomy = { ...valid, taxonomy: [{ id: 'category', label: 'Category', field: 'properties.category' }] };
    expect(validateLayerManifest(withTaxonomy)).toEqual(withTaxonomy);
  });

  it('rejects a non-boolean panel flag', () => {
    expect(() => validateLayerManifest({ ...valid, panel: { showInSearch: 'yes' } })).toThrow(/panel.showInSearch/);
  });

  it('rejects a malformed panel.infoFields entry', () => {
    expect(() => validateLayerManifest({ ...valid, panel: { infoFields: [{ field: 'x', type: 'video' }] } })).toThrow(
      /infoFields\[0\]/,
    );
  });

  it('accepts well-formed panel.infoFields', () => {
    const withPanel = { ...valid, panel: { infoFields: [{ field: 'properties.category', label: 'Category' }] } };
    expect(validateLayerManifest(withPanel)).toEqual(withPanel);
  });
});

describe('validateAppManifest', () => {
  const valid = {
    id: 'demo',
    title: 'Demo',
    map: { center: [0, 0], zoom: 10 },
    baseLayers: [{ id: 'osm', title: 'OSM', type: 'raster-tile', url: 'https://x/{z}/{x}/{y}.png', attribution: 'x' }],
    dataLayers: ['layers/poi.layer.json'],
    calendar: { default: 'today', min: '2015-01-01', max: '2030-12-31' },
  };

  it('accepts a minimal valid manifest', () => {
    expect(validateAppManifest(valid)).toEqual(valid);
  });

  it('rejects an empty baseLayers array', () => {
    expect(() => validateAppManifest({ ...valid, baseLayers: [] })).toThrow(/baseLayers/);
  });

  it('rejects a missing calendar.min', () => {
    expect(() => validateAppManifest({ ...valid, calendar: { max: '2030-12-31' } })).toThrow(/calendar/);
  });

  it('accepts an ISO date calendar.default', () => {
    const withDefault = { ...valid, calendar: { ...valid.calendar, default: '2020-06-15' } };
    expect(validateAppManifest(withDefault)).toEqual(withDefault);
  });

  it('rejects an invalid calendar.default', () => {
    const invalid = { ...valid, calendar: { ...valid.calendar, default: 'yesterday' } };
    expect(() => validateAppManifest(invalid)).toThrow(/calendar\.default/);
  });

  it('accepts a valid calendar.system', () => {
    const withSystem = { ...valid, calendar: { ...valid.calendar, system: 'islamic' } };
    expect(validateAppManifest(withSystem)).toEqual(withSystem);
  });

  it('rejects an invalid calendar.system', () => {
    const invalid = { ...valid, calendar: { ...valid.calendar, system: 'martian' } };
    expect(() => validateAppManifest(invalid)).toThrow(/calendar\.system/);
  });

  it('accepts a valid map.crs named id', () => {
    const withCrs = { ...valid, map: { ...valid.map, crs: 'EPSG:4326' } };
    expect(validateAppManifest(withCrs)).toEqual(withCrs);
  });

  it('accepts a valid custom map.crs object', () => {
    const withCrs = {
      ...valid,
      map: {
        ...valid.map,
        crs: {
          proj4def: '+proj=utm +zone=28 +datum=WGS84 +units=m +no_defs',
          resolutions: [8192, 4096, 2048],
          origin: [0, 0],
        },
      },
    };
    expect(validateAppManifest(withCrs)).toEqual(withCrs);
  });

  it('rejects an invalid map.crs', () => {
    const invalid = { ...valid, map: { ...valid.map, crs: 'EPSG:9999' } };
    expect(() => validateAppManifest(invalid)).toThrow(/map\.crs/);
  });

  it('rejects a non-string "strings" path', () => {
    expect(() => validateAppManifest({ ...valid, strings: 42 })).toThrow(/strings/);
  });

  it('accepts an open plugins bag without inspecting its contents', () => {
    const withPlugins = {
      ...valid,
      plugins: { participate: { channel: 'email', target: 'a@b.com', messageTemplate: 'Hi {{date}}' }, other: 42 },
    };
    expect(validateAppManifest(withPlugins)).toEqual(withPlugins);
  });

  it('rejects a "plugins" that is an array', () => {
    expect(() => validateAppManifest({ ...valid, plugins: [] })).toThrow(/plugins/);
  });

  it('rejects a "plugins" that is a string', () => {
    expect(() => validateAppManifest({ ...valid, plugins: 'participate' })).toThrow(/plugins/);
  });

  it('rejects a "plugins" that is null', () => {
    expect(() => validateAppManifest({ ...valid, plugins: null })).toThrow(/plugins/);
  });
});
