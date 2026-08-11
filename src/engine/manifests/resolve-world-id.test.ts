import { describe, expect, it } from 'vitest';
import { isIsolatedWorldMode, resolveWorldId } from './resolve-world-id';

describe('resolveWorldId', () => {
  it('uses the "world" query param when present and valid', () => {
    expect(resolveWorldId(new URLSearchParams('world=tenerife-events'), 'production')).toBe('tenerife-events');
  });

  it('ignores a query param with invalid characters', () => {
    expect(resolveWorldId(new URLSearchParams('world=../etc'), 'production')).toBe('demo');
  });

  it('falls back to "demo" in development mode with no query param', () => {
    expect(resolveWorldId(new URLSearchParams(''), 'development')).toBe('demo');
  });

  it('falls back to "demo" in production mode with no query param', () => {
    expect(resolveWorldId(new URLSearchParams(''), 'production')).toBe('demo');
  });

  it('falls back to the mode name in an isolated per-world build mode', () => {
    expect(resolveWorldId(new URLSearchParams(''), 'paranormal-espana')).toBe('paranormal-espana');
  });

  it('query param still overrides an isolated build mode', () => {
    expect(resolveWorldId(new URLSearchParams('world=demo'), 'paranormal-espana')).toBe('demo');
  });
});

describe('isIsolatedWorldMode', () => {
  it('is false for "development"', () => {
    expect(isIsolatedWorldMode('development')).toBe(false);
  });

  it('is false for "production"', () => {
    expect(isIsolatedWorldMode('production')).toBe(false);
  });

  it('is true for an arbitrary world id used as a mode', () => {
    expect(isIsolatedWorldMode('paranormal-espana')).toBe(true);
  });
});
