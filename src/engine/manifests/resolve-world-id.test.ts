import { describe, expect, it } from 'vitest';
import { DEFAULT_WORLD_ID, isIsolatedWorldMode, resolveWorldId, worldIdFromPath } from './resolve-world-id';

describe('resolveWorldId', () => {
  it('uses the "world" query param when present and valid', () => {
    expect(resolveWorldId(new URLSearchParams('world=tenerife-events'), 'production')).toBe('tenerife-events');
  });

  it('ignores a query param with invalid characters', () => {
    expect(resolveWorldId(new URLSearchParams('world=../etc'), 'production')).toBe(DEFAULT_WORLD_ID);
  });

  it('falls back to the default world in development mode with no query param', () => {
    expect(resolveWorldId(new URLSearchParams(''), 'development')).toBe(DEFAULT_WORLD_ID);
  });

  it('falls back to the default world in production mode with no query param', () => {
    expect(resolveWorldId(new URLSearchParams(''), 'production')).toBe(DEFAULT_WORLD_ID);
  });

  it('falls back to the mode name in an isolated per-world build mode', () => {
    expect(resolveWorldId(new URLSearchParams(''), 'paranormal-spain')).toBe('paranormal-spain');
  });

  it('query param still overrides an isolated build mode', () => {
    expect(resolveWorldId(new URLSearchParams('world=world-leaders'), 'paranormal-spain')).toBe('world-leaders');
  });

  it('reads the world id from the first path segment', () => {
    expect(resolveWorldId(new URLSearchParams(''), 'production', '/world-leaders/')).toBe('world-leaders');
    expect(resolveWorldId(new URLSearchParams(''), 'production', '/world-leaders')).toBe('world-leaders');
  });

  it('strips the deployment base path before reading the segment', () => {
    expect(resolveWorldId(new URLSearchParams(''), 'production', '/universal-map-app/moon-map-photos/', '/universal-map-app/')).toBe(
      'moon-map-photos',
    );
  });

  it('falls back to the default world for the site root', () => {
    expect(resolveWorldId(new URLSearchParams(''), 'production', '/')).toBe(DEFAULT_WORLD_ID);
  });

  it('query param overrides the path', () => {
    expect(resolveWorldId(new URLSearchParams('world=paranormal-spain'), 'production', '/world-leaders/')).toBe(
      'paranormal-spain',
    );
  });
});

describe('worldIdFromPath', () => {
  it('returns the first segment', () => {
    expect(worldIdFromPath('/world-leaders/')).toBe('world-leaders');
  });

  it('returns null for the root', () => {
    expect(worldIdFromPath('/')).toBeNull();
    expect(worldIdFromPath('')).toBeNull();
  });

  it('returns null for an unsafe segment', () => {
    expect(worldIdFromPath('/../etc/')).toBeNull();
    expect(worldIdFromPath('/a b/')).toBeNull();
  });

  it('strips a base path', () => {
    expect(worldIdFromPath('/repo/demo/', '/repo/')).toBe('demo');
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
    expect(isIsolatedWorldMode('paranormal-spain')).toBe(true);
  });
});
