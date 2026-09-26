// The world loaded when the URL names none (the site root, or a plain
// `npm run dev` / `npm run build`). Kept in sync with `AVAILABLE_WORLDS`
// (`src/ui/worlds.ts`) — the first entry there is the default.
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

// The world id encoded in a URL path, or null when the path names no world
// (the site root, or a path that isn't a single safe segment).
export function worldIdFromPath(pathname: string, basePath = '/'): string | null {
  let path = pathname;
  if (basePath !== '/' && path.startsWith(basePath)) {
    path = path.slice(basePath.length);
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
