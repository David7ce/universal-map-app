// Which `worlds/<id>/` instance to load. `?world=<id>` always wins when
// present and safe (a plain path segment — no traversal via the query
// string). Otherwise, an isolated per-world build (`vite build --mode
// <world-id>`) makes that mode name double as the default world; the
// generic `development`/`production` modes (plain `npm run dev` / `npm run
// build`) fall back to `demo`, same as before isolated builds existed.
export function resolveWorldId(searchParams: URLSearchParams, mode: string): string {
  const requested = searchParams.get('world');
  if (requested && /^[a-zA-Z0-9_-]+$/.test(requested)) {
    return requested;
  }
  return isIsolatedWorldMode(mode) ? mode : 'demo';
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
