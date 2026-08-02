# Changelog

Record of what's been implemented beyond the original v1 (see `docs/superpowers/specs/2026-07-26-universal-map-time-engine-design.md` for the base design). Future work lives in `ROADMAP.md`, not here.

## `?app=` query-param app switcher

`src/main.ts` no longer hardcodes `apps/demo/`: `resolveAppId()` reads `?app=<id>` from the URL (restricted to `[a-zA-Z0-9_-]+`, falling back to `"demo"`), so any `apps/<id>/` instance can be loaded by URL without touching engine code. Still a single-app-per-page-load static lookup, not a router — see `README.md` ("Add a new app instance").

## Map scale indicator

The footer legend (`#map-scale` in `index.html`) shows an approximate ground distance ("X m" / "X km") for an 80px reference width at the map's current center and zoom, recomputed on every `zoomend`/`moveend` (`updateScale()` in `src/main.ts`).

## Multi-calendar and multi-projection

- Display-layer support for Gregorian, Julian, Islamic, and Hebrew calendars without touching the underlying temporal storage model.
- Configurable map CRS: `EPSG:3857`, `EPSG:4326`, and custom projections via `map.crs` in the manifest.
- UI improvements to the calendar bar, base-layer selection, and place-info display, aligned with the mobile-first redesign.

## Interface redesign (mobile-first, following a visual reference)

Rebuilt following a concrete visual reference (a screenshot plus the source of an existing Astro site, including its token/layout/control CSS). Real UI architecture changes, not just styling:

- **Full-screen map**, everything else floats on top (`position: fixed`/`absolute`) instead of the previous 4-column grid.
- **Search** (`src/ui/panels/SearchOverlay.ts`, replaces the old `PanelLeft.ts`): a circular button top-left on mobile (opens a modal with a dimmed backdrop); on desktop (`≥64rem`) the search field stays always visible, docked to that corner, no button.
- **Place selection** (`src/ui/panels/SelectionCard.ts`): an independent floating card (bottom sheet on mobile, a card anchored bottom-right on desktop), visible at any time regardless of whether search is open.
- **Filters** (`PanelRight.ts`): a slide-out drawer from the right, a circular open button top-right with a dimmed backdrop; each filter dimension is now a collapsible section with a chevron; the "select all" checkbox uses real `.indeterminate` for the "some selected" state.
- **Layer selector** (`src/ui/panels/LayerControl.ts`, new): replaces Leaflet's built-in layers control — a bottom-left button showing the active base layer's name, opening a popover with base-layer radios and "map details" checkboxes (opt-in layers, see below).
- **Zoom**: still Leaflet's real control, repositioned bottom-right and above the attribution strip.
- **Icons**: a minimal set of self-authored SVGs (`src/ui/icons.ts`), no CDN or external icon font.
- Mobile-first breakpoint in `src/styles.css`.

The reference site's logo/branding (another organization's) was not copied, nor was its "Report" view (charts/CSV/PDF) — that was already ruled out as non-core at the start of this project.

## Search results respect active filters

Typing in the search box filters by text among the currently filtered-in features (respecting `activeFilters`); clicking a result closes search and shows the selection card. An empty query shows nothing, matching `searchFeatures()`'s own pure-function contract ("empty query → `[]`"). Implementing `panel.showInSearch: false` (to exclude a layer from search) fixed a latent bug along the way: regions already had that flag in the original demo data, but it was never read, so they kept showing up in search results.

## Expanded selected-place info

`layer.json` accepts `panel.infoFields: [{ field, label }]` — each app decides which extra properties to show on the selection card, without hardcoding field names (reuses `readField()` from `compute-dimensions.ts`, now exported). See `docs/json-reference.md`.

## Base layer selector: street / satellite

`apps/demo/app-manifest.json` declares two `baseLayers` (OpenStreetMap + Esri World Imagery as satellite, free tiles). The selector actually adds/removes the corresponding tile layer via `LayerControl.ts` and syncs `store.activeBaseLayerId` directly.

## Heatmap layer

`kind: "heatmap"` has a dedicated renderer in `src/engine/space/data-layer-renderer.ts` via `leaflet.heat` (new dependency, documented in the plan). Only uses `Point` features; respects `isActiveOn` and `activeFilters`. Example: `apps/demo/layers/heatmap.layer.json`.

## Isochrones (documented pattern, no engine code)

Documented in `README.md` ("Isochrone (travel-time) layers"): precomputed isochrone polygons shipped as a normal `kind: "polygon"` layer, exactly like `regions` — no new engine code needed.

## `calendar.default` wired up

`main.ts` no longer ignores the manifest: `selectedDate` is seeded from `appManifest.calendar.default` (`"today"` → current date, or a literal ISO date). `validateAppManifest()` rejects values that aren't `"today"` or `YYYY-MM-DD`.

## Selected-place info: coordinates, link, image

`SelectionCard.ts` now automatically shows `lat, lng` (5 decimals) for any feature with `Point` geometry, no configuration needed. `panel.infoFields` also accepts an optional `type` (`"text"` by default, `"link"`, `"image"`) — as with the rest of the engine, the field name still comes from the manifest, never hardcoded. For safety, `"link"`/`"image"` only render as `<a>`/`<img>` when the value is an `http(s):`/`mailto:` URL (`isAllowedUrl()` in `src/ui/panels/info-field-format.ts`); any other scheme (e.g. a `javascript:` value injected via feature data) falls back to plain text. Example in `apps/demo/layers/poi.layer.json` (`website`/`photo` in `poi.geojson`).

## Calendar bar: granularity + slider

`CalendarBar.ts` has a granularity selector (day/week/month/year, controls the step size of the ← → buttons) and a range slider (`<input type="range">`) bounded by `calendar.min`/`calendar.max`.

## Multi-system calendar display: Gregorian, Julian, Islamic, Hebrew

`app-manifest.json` accepts an optional `calendar.system` (`"gregorian"` by default, or `"julian" | "islamic" | "hebrew"`). Storage and all temporal computation (`isActiveOn`, RRULE, `calendar.min`/`max`/`default`) stay 100% Gregorian/ISO 8601 — conversion happens only in the display layer (`src/engine/time/calendar-conversion.ts`), never toward the store. `islamic`/`hebrew` use `@js-temporal/polyfill` (new dependency); `julian` isn't in the Unicode/ICU calendar registry that Temporal/Intl use, so it was implemented by hand (Fliegel & Van Flandern's Julian day number algorithm, `src/engine/time/julian-calendar.ts`). The native date picker (`<input type="date">`) is always Gregorian — there's no custom calendar widget (see "Known v1 deviations" in `README.md`).

## Multi-projection display: EPSG:3857, EPSG:4326, custom projections

`app-manifest.json` accepts an optional `map.crs` (`"EPSG:3857"` by default — Web Mercator, same as before — or `"EPSG:4326"`, or a custom object `{ proj4def, resolutions, origin, bounds? }`). GeoJSON data stays WGS84 lon/lat always; Leaflet reprojects at render time via the active CRS, so no other engine module changes (`data-layer-renderer.ts`, `spatial-join.ts`, clustering, heatmap — all were already projection-agnostic). `"EPSG:4326"` uses Leaflet's built-in CRS, no new dependency; any other projection uses `proj4leaflet` (new dependency, `L.Proj.CRS`). `baseLayers` is still required — the app author is responsible for making sure the chosen tiles are actually served in the configured projection. See `src/engine/space/map-crs.ts` and `src/engine/space/map.ts`.

## Real polygon styling (no more unstyled default outline)

`line`/`polygon`/`boundary` layers get an actual fill + border (`resolvePolygonStyle()` in `src/engine/space/style.ts`) instead of Leaflet's raw default (a plain blue outline, no fill). Every field (`color`, `weight`, `fillColor`, `fillOpacity`) is overridable per layer via the manifest's `style`.

## Any layer can be an opt-in "map detail"

`panel.showByDefault: false` (new `layer.json` field) makes a layer hidden until the user turns it on via the layer control's "Map details" checkbox group — the same mechanism `heatmap` layers already used, now generalized to any layer (e.g. `regions`, so a boundary overlay doesn't clutter the map by default).

## Demo content and docs in English

`apps/demo/*` (place names, category values, region names, property keys like `name`/`category`/`website`/`photo`) and the project docs (`ROADMAP.md`, `CHANGELOG.md`, `docs/json-reference.md`) are now all in English.

## Compact date-editor calendar bar

`CalendarBar.ts` redesigned to a compact spinner-style editor (weekday label, month/day/year fields each with their own tiny up/down stepper, a pencil button that reveals a manual DD-MM-YYYY text field for typing a date directly) — this engine's temporal model is date-only, so there's no hour/minute/timezone field.
