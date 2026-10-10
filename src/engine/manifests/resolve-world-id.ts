// Fallback world for callers that need an id when no URL or isolated build
// mode names one. The app's bare site root shows the shared Home page and does
// not load this world. Kept in sync with `AVAILABLE_WORLDS` — the first entry
// there is the fallback.
export const DEFAULT_WORLD_ID = 'world-leaders';

// Which `worlds/<id>/` instance to load, in priority order:
//
// 1. `?world=<id>` — always wins when present and safe (a plain path
//    segment, no traversal via the query string). Kept for backward
//    compatibility and for links that can't use a path.
// 2. The first path segment — `/world-leaders/` loads `world-leaders`.
//    This is the primary form; `vite.config.ts`'s `worldRoutesPlugin`
//    emits a nested `index.html` per world so a static host serves it.
// 3. An isolated per-world build (`vite build --mode <world-id>`) makes
//    that mode name double as the default world.
// 4. Otherwise `DEFAULT_WORLD_ID`.
//
// `basePath` is the deployment subpath (e.g. `/universal-map-app/` on a
// GitHub Pages project site) — stripped before reading the segment, so the
// same build works at a domain root or any subpath.
export function resolveWorldId(searchParams: URLSearchParams, mode: string, pathname = '/', basePath = '/'): string {
  const requested = searchParams.get('world');
  if (requested && /^[a-zA-Z0-9_-]+$/.test(requested)) {
    return requested;
  }

  const fromPath = worldIdFromPath(pathname, basePath);
  if (fromPath) return fromPath;

  return isIsolatedWorldMode(mode) ? mode : DEFAULT_WORLD_ID;
}

// Whether the URL itself names the world — `?world=<id>`, a first path segment,
// or a standalone per-world build — as opposed to the bare site root, which
// shows the shared Home without loading a world. A world's own URL opens that
// world directly (it is independent of the Home page).
export function isWorldExplicit(searchParams: URLSearchParams, mode: string, pathname = '/', basePath = '/'): boolean {
  const requested = searchParams.get('world');
  if (requested && /^[a-zA-Z0-9_-]+$/.test(requested)) return true;
  return worldIdFromPath(pathname, basePath) !== null || isIsolatedWorldMode(mode);
}

// The deployment subpath of the app, from the page's base URI
// (`document.baseURI`) — e.g. '/universal-map-app/' on a GitHub Pages project
// site, '/' at a domain root. `import.meta.env.BASE_URL` can't be used for
// this: `vite.config.ts` sets `base: './'`, so in production it is './', which
// never matches a pathname. The built `index.html` carries `<base href="./">`
// (and `"../"` on a world's nested page), which always resolves to the app root.
export function appBasePath(baseURI: string): string {
  return new URL(baseURI).pathname;
}

// The world id encoded in a URL path, or null when the path names no world
// (the site root, or a path that isn't a single safe segment).
export function worldIdFromPath(pathname: string, basePath = '/'): string | null {
  let path = pathname;
  if (basePath !== '/') {
    const prefix = basePath.endsWith('/') ? basePath : `${basePath}/`;
    // '/universal-map-app' (no trailing slash) is the project root too.
    if (path === prefix.slice(0, -1)) path = '';
    else if (path.startsWith(prefix)) path = path.slice(prefix.length);
  }
  const segment = path.replace(/^\/+/, '').split('/')[0];
  if (!segment || !/^[a-zA-Z0-9_-]+$/.test(segment)) return null;
  return segment;
}

// Whether `mode` (Vite's `--mode`) names an isolated per-world build rather
// than the generic `development`/`production` modes. Shared by
// `resolveWorldId` (runtime resolution) and `vite.config.ts`'s
// `copyWorldsDirPlugin` (build-time world-data copying) so the two can't
// silently drift apart — see that plugin's docstring for the failure mode
// if they ever disagreed.
export function isIsolatedWorldMode(mode: string): boolean {
  return mode !== 'development' && mode !== 'production';
}
