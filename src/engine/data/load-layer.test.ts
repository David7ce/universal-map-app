import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeoFeature } from '../time/temporal-types';
import { loadLayer, type LoadLayerDeps } from './load-layer';

const baseManifest = {
  id: 'leaders',
  title: 'Líderes',
  kind: 'point',
  source: { type: 'geojson', url: 'worlds/w/data/leaders.geojson' },
  taxonomy: [{ id: 'role', label: 'Cargo', field: 'properties.role' }],
};
const baseFeatures: GeoFeature[] = [
  { type: 'Feature', id: 'a', properties: { role: 'Presidente' }, geometry: { type: 'Point', coordinates: [0, 0] } },
];

function deps(files: Record<string, unknown>): LoadLayerDeps & { fetched: string[] } {
  const fetched: string[] = [];
  return {
    fetched,
    fetchJson: async (url) => {
      fetched.push(url);
      if (!(url in files)) throw new Error(`404 ${url}`);
      return files[url];
    },
    fetchFeatures: async () => baseFeatures,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadLayer', () => {
  const files = {
    'worlds/w/layers/leaders.layer.json': baseManifest,
    'worlds/w/layers/leaders.layer.en.json': { title: 'Leaders', taxonomy: [{ id: 'role', label: 'Position' }] },
    'worlds/w/data/leaders.en.json': { a: { role: 'President' } },
  };

  it('does not look for overrides when the language equals the content language', async () => {
    const d = deps(files);
    const layer = await loadLayer(d, 'w', 'layers/leaders.layer.json', 'es', 'es', ['en']);
    expect(layer.manifest.title).toBe('Líderes');
    expect(layer.features[0].properties.role).toBe('Presidente');
    expect(d.fetched).toEqual(['worlds/w/layers/leaders.layer.json']);
  });

  it('applies the layer and data overrides for another language', async () => {
    const layer = await loadLayer(deps(files), 'w', 'layers/leaders.layer.json', 'en', 'es', ['en']);
    expect(layer.manifest.title).toBe('Leaders');
    expect(layer.manifest.taxonomy?.[0].label).toBe('Position');
    expect(layer.manifest.taxonomy?.[0].field).toBe('properties.role');
    expect(layer.features[0].properties.role).toBe('President');
  });

  it('falls back to the base content when no override files exist', async () => {
    const d = deps({ 'worlds/w/layers/leaders.layer.json': baseManifest });
    const layer = await loadLayer(d, 'w', 'layers/leaders.layer.json', 'en', 'es', ['en']);
    expect(layer.manifest.title).toBe('Líderes');
    expect(layer.features[0].properties.role).toBe('Presidente');
  });

  it('does not look for overrides when the language is not listed in translations', async () => {
    const d = deps(files);
    const layer = await loadLayer(d, 'w', 'layers/leaders.layer.json', 'en', 'es', []);
    expect(layer.manifest.title).toBe('Líderes');
    expect(d.fetched).toEqual(['worlds/w/layers/leaders.layer.json']);
  });

  it('applies a data override alone', async () => {
    const d = deps({
      'worlds/w/layers/leaders.layer.json': baseManifest,
      'worlds/w/data/leaders.en.json': { a: { role: 'President' } },
    });
    const layer = await loadLayer(d, 'w', 'layers/leaders.layer.json', 'en', 'es', ['en']);
    expect(layer.manifest.title).toBe('Líderes');
    expect(layer.features[0].properties.role).toBe('President');
  });

  it('keeps the base manifest and warns when the merged manifest is invalid', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = deps({
      'worlds/w/layers/leaders.layer.json': baseManifest,
      'worlds/w/layers/leaders.layer.en.json': { kind: 'sparkle' },
    });
    const layer = await loadLayer(d, 'w', 'layers/leaders.layer.json', 'en', 'es', ['en']);
    expect(layer.manifest.kind).toBe('point');
    expect(warn).toHaveBeenCalled();
  });

  it('ignores a data override that is not an object', async () => {
    const d = deps({
      'worlds/w/layers/leaders.layer.json': baseManifest,
      'worlds/w/data/leaders.en.json': '<html>fallback page</html>',
    });
    const layer = await loadLayer(d, 'w', 'layers/leaders.layer.json', 'en', 'es', ['en']);
    expect(layer.features[0].properties.role).toBe('Presidente');
  });

  it('still throws when the base manifest cannot be loaded', async () => {
    await expect(loadLayer(deps({}), 'w', 'layers/leaders.layer.json', 'en', 'es', ['en'])).rejects.toThrow(/404/);
  });
});
