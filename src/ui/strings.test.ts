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
      vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ 'a.b': 'Hello' }) })
    );
    expect(await loadStrings('/strings.json')).toEqual({ 'a.b': 'Hello' });
  });

  it('throws a descriptive error on a failed fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }));
    await expect(loadStrings('/missing.json')).rejects.toThrow(/404/);
  });
});

describe('t', () => {
  it('returns the mapped string when the key exists', () => {
    expect(t('a.b', { 'a.b': 'Hello' })).toBe('Hello');
  });
  it('falls back to the key itself when missing', () => {
    expect(t('missing.key', {})).toBe('missing.key');
  });
});
