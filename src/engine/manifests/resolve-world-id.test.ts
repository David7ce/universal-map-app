import { describe, expect, it } from 'vitest';
import {
  appBasePath,
  DEFAULT_WORLD_ID,
  isIsolatedWorldMode,
  isWorldExplicit,
  resolveWorldId,
  worldIdFromPath,
} from './resolve-world-id';

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
    expect(
      resolveWorldId(
        new URLSearchParams(''),
        'production',
        '/universal-map-app/moon-map-photos/',
        '/universal-map-app/',
      ),
    ).toBe('moon-map-photos');
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

// `vite.config.ts` uses `base: './'`, so `import.meta.env.BASE_URL` is './' in
// production — useless for finding the deployment subpath. The page's own
// `<base href>` (which the build keeps pointing at the app root, '../' on a
// world's nested page) is what resolves correctly.
describe('appBasePath', () => {
  it('is the pathname of the document base URI', () => {
    expect(appBasePath('https://david7ce.github.io/universal-map-app/')).toBe('/universal-map-app/');
    expect(appBasePath('http://localhost:5173/')).toBe('/');
  });

  it('works for a site served from a domain root', () => {
    expect(appBasePath('https://maps.example.com/')).toBe('/');
  });
});

describe('world resolution on a GitHub Pages project site', () => {
  const base = appBasePath('https://david7ce.github.io/universal-map-app/');
  const resolve = (pathname: string) => resolveWorldId(new URLSearchParams(''), 'production', pathname, base);

  it('loads the default world at the project root (not "universal-map-app")', () => {
    expect(resolve('/universal-map-app/')).toBe(DEFAULT_WORLD_ID);
    expect(resolve('/universal-map-app')).toBe(DEFAULT_WORLD_ID);
  });

  it('loads the world named by the first segment after the project root', () => {
    expect(resolve('/universal-map-app/paranormal-spain/')).toBe('paranormal-spain');
  });
});

describe('world resolution at a domain root', () => {
  const base = appBasePath('http://localhost:5173/');
  it('still reads the first segment', () => {
    expect(resolveWorldId(new URLSearchParams(''), 'development', '/moon-map-photos/', base)).toBe('moon-map-photos');
    expect(resolveWorldId(new URLSearchParams(''), 'development', '/', base)).toBe(DEFAULT_WORLD_ID);
  });
});

// A world's own URL (/world-leaders/, ?world=…, or a standalone per-world build)
// opens that world directly; only the bare site root shows the shared Home.
describe('isWorldExplicit', () => {
  const none = new URLSearchParams('');

  it('is false at the site root and at a project-site root', () => {
    expect(isWorldExplicit(none, 'production', '/', '/')).toBe(false);
    expect(isWorldExplicit(none, 'production', '/universal-map-app/', '/universal-map-app/')).toBe(false);
    expect(isWorldExplicit(none, 'development', '/', '/')).toBe(false);
  });

  it('is true when the first path segment names a world, with or without a base path', () => {
    expect(isWorldExplicit(none, 'production', '/world-leaders/', '/')).toBe(true);
    expect(isWorldExplicit(none, 'production', '/universal-map-app/world-leaders/', '/universal-map-app/')).toBe(true);
  });

  it('is true for a valid ?world= and false for an invalid one', () => {
    expect(isWorldExplicit(new URLSearchParams('world=moon-map-photos'), 'production', '/', '/')).toBe(true);
    expect(isWorldExplicit(new URLSearchParams('world=../etc'), 'production', '/', '/')).toBe(false);
  });

  it('is true for an isolated per-world build, even at its root', () => {
    expect(isWorldExplicit(none, 'world-leaders', '/', '/')).toBe(true);
  });
});
