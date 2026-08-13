import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadStrings, t } from './strings';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadStrings', () => {
  it('returns an empty object when no path is given', async () => {
    expect(await loadStrings(undefined)).toEqual({});
  });

  it('fetches and returns the strings JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ 'a.b': 'Hello' }) }),
    );
    expect(await loadStrings('/strings.json')).toEqual({ 'a.b': 'Hello' });
  });

  it('throws a descriptive error on a failed fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }));
    await expect(loadStrings('/missing.json')).rejects.toThrow(/404/);
  });

  it('fetches the given path as-is when lang is "en" (the default)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    await loadStrings('worlds/demo/strings.en.json', 'en');
    expect(fetchMock).toHaveBeenCalledWith('worlds/demo/strings.en.json');
  });

  it('swaps the ".en.json" suffix for the requested language', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    await loadStrings('worlds/demo/strings.en.json', 'es');
    expect(fetchMock).toHaveBeenCalledWith('worlds/demo/strings.es.json');
  });

  it('fetches a path with no ".en.json" suffix as-is, even for a non-English language', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    await loadStrings('worlds/demo/strings.json', 'es');
    expect(fetchMock).toHaveBeenCalledWith('worlds/demo/strings.json');
  });
});

describe('t', () => {
  it('returns the mapped string when the key exists', () => {
    expect(t('a.b', { 'a.b': 'Hello' })).toBe('Hello');
  });
  it('falls back to the key itself when missing', () => {
    expect(t('missing.key', {})).toBe('missing.key');
  });

  it('interpolates params into the mapped string', () => {
    expect(t('greeting', { greeting: 'Hello, {name}!' }, { name: 'Ana' })).toBe('Hello, Ana!');
  });

  it('interpolates params into the fallback key when the string is missing', () => {
    expect(t('Hello, {name}!', {}, { name: 'Ana' })).toBe('Hello, Ana!');
  });

  it('replaces multiple distinct and repeated placeholders', () => {
    expect(t('range', { range: 'from {from} to {to}, {from} onward' }, { from: 'A', to: 'B' })).toBe(
      'from A to B, A onward',
    );
  });

  it('leaves unmatched placeholders untouched when no param is supplied for them', () => {
    expect(t('partial', { partial: '{known} and {unknown}' }, { known: 'X' })).toBe('X and {unknown}');
  });

  it('behaves identically to the no-params call when params is omitted (backward compatible)', () => {
    expect(t('a.b', { 'a.b': 'Hello' })).toBe('Hello');
    expect(t('missing.key', {})).toBe('missing.key');
  });
});
