# Universal Map-Time Engine

A static, browser-only map (OpenStreetMap + Leaflet) with a Gregorian calendar as an equal first-class dimension. See `docs/superpowers/specs/2026-07-26-universal-map-time-engine-design.md` for the full design, `docs/json-reference.md` for a field-by-field reference of `app-manifest.json`, `layer.json`, `strings.json`, and the GeoJSON+`temporal` data format, `CHANGELOG.md` for what's shipped beyond v1, and `ROADMAP.md` for what's next.

## Run locally

    pnpm install
    pnpm dev

Open the printed local URL. No backend, no paid services — `pnpm build` produces a static `dist/` you can host anywhere (or serve locally with `pnpm preview` or any static file server).

## Run tests

    pnpm test

## Add a new app instance

1. Create a new folder under `apps/<your-app-id>/`.
2. Add an `app-manifest.json` (see `apps/demo/app-manifest.json` for the shape).
3. Add one `*.layer.json` per data layer under `apps/<your-app-id>/layers/`, and the matching GeoJSON under `apps/<your-app-id>/data/`.
4. Optionally add `strings.json` for your own UI text, and a `plugins` block to activate `participate`.
5. Point `src/main.ts`'s `fetch('/apps/demo/app-manifest.json')` call (and the two other `/apps/demo/` paths) at your new app id, or introduce a build-time/query-param switch — multi-app routing is intentionally out of scope for v1 (see the design spec's non-goals).

No engine code under `src/engine/` needs to change to add a new app instance.

## Isochrone (travel-time) layers

There's no dedicated `kind` for isochrones — precompute the polygons with whatever routing tool fits your data (routing engines/APIs, GIS tools, etc.) and ship them as a normal `kind: "polygon"` layer, exactly like `apps/demo/layers/regions.layer.json`. Each isochrone gets `properties.temporal` if it should only apply on certain dates, and any `taxonomy` field (e.g. travel time bucket) like any other layer. This needs no engine code — the same reasoning that makes administrative regions "just temporal geometry" applies here. A layer that computes isochrones live (e.g. on click) would need an external routing service, which is out of scope for this static, no-backend engine.

## Recently shipped beyond the original v1 scope

- Multi-calendar display support for Gregorian, Julian, Islamic, and Hebrew calendars via `calendar.system` in the app manifest.
- Multi-projection map display support for `EPSG:3857`, `EPSG:4326`, and custom CRS definitions via `map.crs`.
- Calendar bar refinements with day/week/month/year granularity and a range slider, plus richer selection-card info rendering for links, images, and coordinates.

## Known v1 deviations from the design spec

`CalendarBar.ts` now has a day/week/month/year granularity selector plus a range slider bounded by `calendar.min`/`calendar.max` (previously only a prev/next day stepper + native date picker), covering the design spec's Section 6 gap.

`calendar.system` (`docs/json-reference.md`) renders dates in Julian/Islamic/Hebrew calendars throughout the UI (calendar bar stepping and label, temporal-status text), but the native `<input type="date">` picker popup itself always stays Gregorian — browsers don't expose a way to force it into a different calendar system from JS. A fully calendar-aware picker would need a custom-built widget, out of scope for now.

`map.crs` (`docs/json-reference.md`) supports Leaflet's built-in `EPSG:3857`/`EPSG:4326` plus fully custom projections via `proj4leaflet`. It does not cover non-geographic "flat plane" pixel-space maps (indoor floor plans, game/fictional maps — Leaflet's `L.CRS.Simple`) — this iteration targets real-world geographic projections beyond Web Mercator specifically. `CRS.Simple` support remains a possible smaller future item.
