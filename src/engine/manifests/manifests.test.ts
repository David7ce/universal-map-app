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
});
