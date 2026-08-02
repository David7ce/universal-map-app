import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFeatures } from './loader-registry';

function mockFetchOnce(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      statusText: ok ? 'OK' : 'Server Error',
      json: async () => body,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchFeatures', () => {
  it('loads a single geojson FeatureCollection', async () => {
    mockFetchOnce({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', id: 'a', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }],
    });
    const features = await fetchFeatures({ type: 'geojson', url: '/data/a.geojson' });
    expect(features).toHaveLength(1);
    expect(features[0].id).toBe('a');
  });

  it('throws a descriptive error on a failed fetch', async () => {
    mockFetchOnce({}, false);
    await expect(fetchFeatures({ type: 'geojson', url: '/data/missing.geojson' })).rejects.toThrow(/500/);
  });

  it('merges shards for geojson-sharded sources', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', id: 'a', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', id: 'b', properties: {}, geometry: { type: 'Point', coordinates: [1, 1] } }],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const features = await fetchFeatures({ type: 'geojson-sharded', urls: ['/data/1.json', '/data/2.json'] });
    expect(features.map((f) => f.id)).toEqual(['a', 'b']);
  });
});
