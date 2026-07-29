# Multi-projection (multi-CRS) display — Design

Status: approved
Date: 2026-07-29

## 1. Purpose

Support map projections other than Leaflet/OSM's default Web Mercator (EPSG:3857), per app: Leaflet's own built-in flat/equirectangular CRS (EPSG:4326), and fully custom projections (e.g. a national grid or polar stereographic system) with explicit control over the tile grid. Tracked as a "Futuro" item in `ROADMAP.md` — flagged there as needing a real architecture decision before any code changes, which this document makes.

## 2. Scope decision: display-only, GeoJSON stays WGS84

Data stays authored in plain GeoJSON lon/lat (WGS84), exactly as it is today — no reprojection of stored data, ever. Leaflet's own rendering pipeline reprojects every point at render time via the map's active CRS (`project()`/`unproject()`), so this is not something the engine has to implement: any code that calls into Leaflet's coordinate pipeline (`L.geoJSON()`, `leaflet.markercluster`, `leaflet.heat`, `map.latLngToContainerPoint()`) is already CRS-agnostic by construction. Verified directly: Leaflet computes tile addressing and marker placement through the active `CRS` object regardless of which one is installed.

Consequently, this feature touches exactly one seam — which `L.CRS` instance the map is constructed with — and nothing downstream of it:

- `src/engine/space/data-layer-renderer.ts` (point/line/polygon/heatmap rendering, clustering) — unchanged. It calls Leaflet APIs that already respect the active CRS.
- `src/engine/region/spatial-join.ts` (`findContainingRegions`, via `@turf/boolean-point-in-polygon`) — unchanged. Turf operates directly on GeoJSON lon/lat coordinates, never on projected pixels, so it is CRS-independent regardless of what the map displays.
- All GeoJSON data files (`apps/*/data/*.geojson`) — unchanged, still plain WGS84 lon/lat per the existing convention.
- `map.center` in `app-manifest.json` — unchanged, stays `[lat, lng]`; `L.Map.setView()` accepts lat/lng regardless of the active CRS (the CRS only changes how that gets projected to pixels internally).

## 3. New manifest field

`app-manifest.json`'s `map` object gains an optional field:

```json
"map": {
  "center": [28.29, -16.62],
  "zoom": 12,
  "crs": "EPSG:4326"
}
```

or, for a fully custom projection:

```json
"map": {
  "crs": {
    "proj4def": "+proj=utm +zone=28 +datum=WGS84 +units=m +no_defs",
    "resolutions": [8192, 4096, 2048, 1024, 512, 256, 128],
    "origin": [0, 0]
  }
}
```

- `map.crs?: 'EPSG:3857' | 'EPSG:4326' | CustomCrsConfig`, where `CustomCrsConfig = { proj4def: string; resolutions: number[]; origin: [number, number]; bounds?: [[number, number], [number, number]] }`.
- Omitting it is fully backward compatible — the code path never passes a `crs` option to `L.map()` in that case, so existing apps render exactly as they do today (verified as the explicit non-regression requirement, same pattern as `calendar.system`'s default).
- `'EPSG:3857'` and `'EPSG:4326'` use Leaflet's own built-in `L.CRS.EPSG3857` / `L.CRS.EPSG4326` — no new dependency for either. Anything else requires the full custom object.
- `resolutions` and `origin` are required for a custom CRS (no invented defaults) — every real-world Proj4Leaflet deployment supplies these explicitly, because they depend entirely on the specific tile provider/grid the app author is targeting. Inventing a default would be guessing at a provider-specific detail we cannot know.

## 4. Base layer compatibility

`baseLayers` stays required (at least one entry) regardless of `map.crs` — unchanged validation. When `map.crs` is not the default, it is the app author's responsibility to supply a tile URL actually served in that projection; the engine does not validate tile/CRS compatibility (doing so would require fetching and inspecting tiles at runtime, which is out of scope). A mismatched tile provider under a custom CRS fails the same way a wrong tile URL fails today: broken/missing tiles, not a thrown error.

## 5. New module: `src/engine/space/map-crs.ts`

Pure validation and types, no Leaflet import (so it is unit-testable under this project's Node-only Vitest setup, unlike the Leaflet-touching code in `map.ts`):

- `export type CustomCrsConfig = { proj4def: string; resolutions: number[]; origin: [number, number]; bounds?: [[number, number], [number, number]] };`
- `export type MapCrsConfig = 'EPSG:3857' | 'EPSG:4326' | CustomCrsConfig;`
- `export const KNOWN_CRS_IDS = ['EPSG:3857', 'EPSG:4326'] as const;`
- `export function isValidMapCrsConfig(value: unknown): value is MapCrsConfig` — validates the shape above (named id from `KNOWN_CRS_IDS`, or an object with a non-empty `proj4def` string, a non-empty numeric `resolutions` array, a 2-number `origin` tuple, and an optional 2x2-number `bounds`).

`validateAppManifest()` (`src/engine/manifests/app-manifest.ts`) imports this and rejects an invalid `map.crs` the same way it already rejects an invalid `calendar.system` — curated list plus a validated escape hatch, consistent with this project's existing manifest-validation pattern.

## 6. CRS resolution: `src/engine/space/map.ts`

`createMap()` gains a CRS-resolution step before constructing `L.Map`:

- `undefined` or `'EPSG:3857'` → no `crs` option passed to `L.map()` at all (byte-identical to today).
- `'EPSG:4326'` → `L.CRS.EPSG4326` (built into Leaflet core, no new dependency).
- A `CustomCrsConfig` object → `new L.Proj.CRS('custom', config.proj4def, { resolutions, origin, bounds })`, from the new `proj4leaflet` dependency (imported for its side effect, same pattern this codebase already uses for `leaflet.heat`/`leaflet.markercluster`: `import 'proj4leaflet';`).

New dependencies: `proj4leaflet` (runtime) and `@types/proj4leaflet` (dev) — verified the exact constructor signature (`L.Proj.CRS(code: string, proj4def: string, options?: { resolutions?, origin?, bounds?, ... })`) against the real published type definitions before writing this spec.

## 7. Testing

- `map-crs.ts`'s `isValidMapCrsConfig()` gets full unit test coverage (named ids, valid custom object, invalid/missing fields, optional `bounds` present/absent) — pure function, no Leaflet, no DOM.
- `validateAppManifest()`'s new `map.crs` branch gets accept/reject test cases in `manifests.test.ts`, same pattern as the existing `calendar.system` tests.
- `map.ts`'s actual CRS construction (`L.Proj.CRS`, `L.map({ crs })`) cannot be unit-tested under this project's test setup: importing `leaflet` itself throws `ReferenceError: window is not defined` under plain Node (confirmed directly) — the same reason `map.ts` has no test file today. This is verified instead via manual browser check (temporarily set `apps/demo/app-manifest.json`'s `map.crs` to `'EPSG:4326'`, confirm the map still renders and pans/zooms correctly, then revert) — same pattern used for `CalendarBar.ts`'s DOM wiring.

## 8. Known deviation (documented, not built)

Non-geographic "flat plane" pixel-space maps (indoor floor plans, game/fictional maps — Leaflet's built-in `L.CRS.Simple`) are out of scope for this iteration. This round targets real-world geographic projections beyond Web Mercator (an explicit choice made during design, over the smaller/simpler `CRS.Simple`-only alternative). `CRS.Simple` support remains a separate, smaller potential future roadmap item.

## 9. Non-goals

- No reprojection of stored GeoJSON data — it stays WGS84 lon/lat always (Section 2).
- No tile/CRS compatibility validation (Section 4).
- No support for `L.CRS.Simple` / non-geographic pixel-space maps in this iteration (Section 8).
- No change to `map.center`'s `[lat, lng]` format or to any spatial-join/region logic.
