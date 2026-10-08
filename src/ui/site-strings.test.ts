import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSiteStrings, mergeStrings, worldLabel } from './site-strings';
import { AVAILABLE_WORLDS } from './worlds';

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

function readJson(path: string): Record<string, string> {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('site strings data', () => {
  const en = () => readJson('public/strings/site.en.json');
  const es = () => readJson('public/strings/site.es.json');

  it('defines the same keys in English and Spanish', () => {
    expect(Object.keys(es()).sort()).toEqual(Object.keys(en()).sort());
  });

  it('defines a label and description for every available world in both languages', () => {
    for (const strings of [en(), es()]) {
      for (const world of AVAILABLE_WORLDS) {
        expect(strings[`worlds.${world.id}.label`], world.id).toBeTruthy();
        expect(strings[`worlds.${world.id}.description`], world.id).toBeTruthy();
      }
    }
  });

  it('does not repeat a shared value inside a world strings file', () => {
    for (const lang of ['en', 'es'] as const) {
      const site = lang === 'en' ? en() : es();
      for (const dir of readdirSync('worlds')) {
        const file = `worlds/${dir}/strings.${lang}.json`;
        if (!existsSync(file)) continue;
        for (const [key, value] of Object.entries(readJson(file))) {
          expect(site[key] === value, `${file} repeats shared key ${key}`).toBe(false);
        }
      }
    }
  });
});
