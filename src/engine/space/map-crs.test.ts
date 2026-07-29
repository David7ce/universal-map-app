import { describe, expect, it } from 'vitest';
import { isValidMapCrsConfig } from './map-crs';

describe('isValidMapCrsConfig', () => {
  it('accepts the known named CRS ids', () => {
    expect(isValidMapCrsConfig('EPSG:3857')).toBe(true);
    expect(isValidMapCrsConfig('EPSG:4326')).toBe(true);
  });

  it('rejects an unknown named CRS id', () => {
    expect(isValidMapCrsConfig('EPSG:9999')).toBe(false);
  });

  it('accepts a valid custom CRS object', () => {
    expect(
      isValidMapCrsConfig({
        proj4def: '+proj=utm +zone=28 +datum=WGS84 +units=m +no_defs',
        resolutions: [8192, 4096, 2048],
        origin: [0, 0],
      })
    ).toBe(true);
  });

  it('accepts a valid custom CRS object with bounds', () => {
    expect(
      isValidMapCrsConfig({
        proj4def: '+proj=utm +zone=28 +datum=WGS84 +units=m +no_defs',
        resolutions: [8192, 4096, 2048],
        origin: [0, 0],
        bounds: [[0, 0], [1000000, 1000000]],
      })
    ).toBe(true);
  });

  it('rejects a custom CRS object missing proj4def', () => {
    expect(isValidMapCrsConfig({ resolutions: [8192], origin: [0, 0] })).toBe(false);
  });

  it('rejects a custom CRS object with an empty resolutions array', () => {
    expect(isValidMapCrsConfig({ proj4def: '+proj=longlat', resolutions: [], origin: [0, 0] })).toBe(false);
  });

  it('rejects a custom CRS object with a non-numeric resolutions entry', () => {
    expect(isValidMapCrsConfig({ proj4def: '+proj=longlat', resolutions: [8192, 'x'], origin: [0, 0] })).toBe(false);
  });

  it('rejects a custom CRS object with a malformed origin', () => {
    expect(isValidMapCrsConfig({ proj4def: '+proj=longlat', resolutions: [8192], origin: [0] })).toBe(false);
  });

  it('rejects a custom CRS object with malformed bounds', () => {
    expect(
      isValidMapCrsConfig({
        proj4def: '+proj=longlat',
        resolutions: [8192],
        origin: [0, 0],
        bounds: [[0, 0], [1, 'x']],
      })
    ).toBe(false);
  });

  it('rejects non-object, non-string values', () => {
    expect(isValidMapCrsConfig(null)).toBe(false);
    expect(isValidMapCrsConfig(42)).toBe(false);
    expect(isValidMapCrsConfig([])).toBe(false);
  });
});
