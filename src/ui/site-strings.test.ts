import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSiteStrings, mergeStrings, worldLabel } from './site-strings';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadSiteStrings', () => {
  it('fetches strings/site.en.json for English', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ a: 'A' }) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await loadSiteStrings('en')).toEqual({ a: 'A' });
    expect(fetchMock).toHaveBeenCalledWith('strings/site.en.json');
  });

  it('fetches strings/site.es.json for Spanish', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    await loadSiteStrings('es');
    expect(fetchMock).toHaveBeenCalledWith('strings/site.es.json');
  });

  it('throws an error naming the file when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }));
    await expect(loadSiteStrings('es')).rejects.toThrow(/strings\/site\.es\.json.*404/);
  });
});

describe('mergeStrings', () => {
  it('lets a world key override a shared key', () => {
    expect(mergeStrings({ a: 'site', b: 'site' }, { a: 'world' })).toEqual({ a: 'world', b: 'site' });
  });

  it('keeps world-only keys', () => {
    expect(mergeStrings({}, { x: '1' })).toEqual({ x: '1' });
  });
});

describe('worldLabel', () => {
  it('uses worlds.<id>.label when present', () => {
    expect(worldLabel('moon', { 'worlds.moon.label': 'Moon' }, 'Luna')).toBe('Moon');
  });

  it('falls back to the manifest title', () => {
    expect(worldLabel('moon', {}, 'Luna')).toBe('Luna');
  });
});
