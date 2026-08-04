# Universal Map-Time Engine

A static, browser-only map (OpenStreetMap + Leaflet) with a Gregorian calendar as an equal first-class dimension. See `docs/superpowers/specs/2026-07-26-universal-map-time-engine-design.md` for the full design, `docs/json-reference.md` for a field-by-field reference of `app-manifest.json`, `layer.json`, `strings.json`, and the GeoJSON+`temporal` data format (`docs/schemas/*.schema.json` has the same shapes as JSON Schema, for editor autocomplete — add `"$schema": "../../docs/schemas/app-manifest.schema.json"` (adjust the relative path) to your own manifest files to pick it up), `docs/api-reference.md` for the internal function/module API, `CHANGELOG.md` for what's shipped beyond v1, and `ROADMAP.md` for what's next.

## Run locally

    pnpm install
    pnpm dev

Open the printed local URL. No backend, no paid services — `pnpm build` produces a static `dist/` you can host anywhere (or serve locally with `pnpm preview` or any static file server).

## Run tests

    pnpm test

## Add a new world instance

1. Create a new folder under `worlds/<your-world-id>/`.
2. Add a `world.json` (see `worlds/demo/world.json` for the shape).
3. Add one `*.layer.json` per data layer under `worlds/<your-world-id>/layers/`, and the matching GeoJSON under `worlds/<your-world-id>/data/`.
4. Optionally add `strings.json` for your own UI text, and a `plugins` block to activate `participate`.
5. Load it with `?world=<your-world-id>` in the URL (e.g. `http://localhost:5173/?world=my-world`), or leave the query param off to get `worlds/demo/` by default. Full multi-world routing (a world switcher UI, per-world subdomains, etc.) is still intentionally out of scope for v1 (see the design spec's non-goals) — this is just a static id lookup, resolved once at page load.

No engine code under `src/engine/` needs to change to add a new world instance.

## Isochrone (travel-time) layers

There's no dedicated `kind` for isochrones — precompute the polygons with whatever routing tool fits your data (routing engines/APIs, GIS tools, etc.) and ship them as a normal `kind: "polygon"` layer, exactly like `apps/demo/layers/regions.layer.json`. Each isochrone gets `properties.temporal` if it should only apply on certain dates, and any `taxonomy` field (e.g. travel time bucket) like any other layer. This needs no engine code — the same reasoning that makes administrative regions "just temporal geometry" applies here. A layer that computes isochrones live (e.g. on click) would need an external routing service, which is out of scope for this static, no-backend engine.

## Recently shipped beyond the original v1 scope

- Multi-calendar display support for Gregorian, Julian, Islamic, and Hebrew calendars via `calendar.system` in the app manifest.
- Multi-projection map display support for `EPSG:3857`, `EPSG:4326`, and custom CRS definitions via `map.crs`.
- Calendar bar refinements with day/week/month/year granularity and a range slider, plus richer selection-card info rendering for links, images, and coordinates.

## Known v1 deviations from the design spec

`CalendarBar.ts` now has a day/week/month/year granularity selector plus a range slider bounded by `calendar.min`/`calendar.max` (previously only a prev/next day stepper + native date picker), covering the design spec's Section 6 gap.

`calendar.system` (`docs/json-reference.md`) renders dates in Julian/Islamic/Hebrew calendars throughout the UI (calendar bar stepping and label, temporal-status text), and `CalendarBar.ts`'s year/month/day fields edit directly in that system too, not just Gregorian.

`map.crs` (`docs/json-reference.md`) supports Leaflet's built-in `EPSG:3857`/`EPSG:4326`/`Simple` (flat pixel-space, e.g. indoor floor plans or game/fictional maps) plus fully custom projections via `proj4leaflet`.
