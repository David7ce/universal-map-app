# Universal Map-Time Engine

A static, browser-only map (OpenStreetMap + Leaflet) with a Gregorian calendar as an equal first-class dimension. See `docs/superpowers/specs/2026-07-26-universal-map-time-engine-design.md` for the full design, `docs/json-reference.md` for a field-by-field reference of `world.json`, `layer.json`, `strings.json`, and the GeoJSON+`temporal` data format (`docs/schemas/*.schema.json` has the same shapes as JSON Schema, for editor autocomplete — add `"$schema": "../../docs/schemas/world.schema.json"` (adjust the relative path) to your own manifest files to pick it up), `docs/api-reference.md` for the internal function/module API, `CHANGELOG.md` for what's shipped beyond v1, and `ROADMAP.md` for what's next.

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
5. Load it with `?world=<your-world-id>` in the URL (e.g. `http://localhost:5173/?world=my-world`), or leave the query param off to get `worlds/demo/` by default. A world switcher UI is still intentionally out of scope for v1 (see the design spec's non-goals) — this is just a static id lookup, resolved once at page load. Per-domain deployment of a single world is in scope (see below), just not a UI for switching between worlds at runtime.

No engine code under `src/engine/` needs to change to add a new world instance.

### Open and deploy each world independently

Every world can be opened on its own during development, and built + deployed as its own standalone site on its own domain — no code changes needed either way, just the world's own `world.json`/`layers/`/`data/`.

**Open one locally**, with the rest of the app unaffected — `pnpm dev`, then append `?world=<id>` to the printed URL:

| World                   | URL (dev)                                            |
|-------------------------|------------------------------------------------------|
| `demo`                  | `http://localhost:5173/` (default, no param needed)  |
| `paranormal-spain`      | `http://localhost:5173/?world=paranormal-spain`      |
| `events-canary-islands` | `http://localhost:5173/?world=events-canary-islands` |
| `moon-map-photos`       | `http://localhost:5173/?world=moon-map-photos`       |

(Port may differ — use whatever `pnpm dev` actually prints.) A world switcher UI is intentionally out of scope for v1 — this is a static id lookup resolved once at page load, not a runtime menu.

**Build one for its own domain** — `vite build --mode <world-id> --outDir builds/<world-id>` bundles *only* that world's data (not every world under `worlds/`) and makes it load by default with no `?world=` query param needed, so a visitor at that domain never sees `worlds/demo/` or any other world's content at all. Each of the 3 real worlds already has a matching `package.json` script:

    pnpm run build:paranormal-spain       # -> builds/paranormal-spain/
    pnpm run build:events-canary-islands  # -> builds/events-canary-islands/
    pnpm run build:moon-map-photos        # -> builds/moon-map-photos/

Adding a new world that should also deploy standalone means adding one matching line to `package.json`'s `"scripts"`:

    "build:<your-world-id>": "tsc --noEmit && vite build --mode <your-world-id> --outDir builds/<your-world-id>"

**Preview a build before deploying it** — the output is plain static files, so any static file server works, e.g.:

    npx serve builds/paranormal-spain

**Deploy** — upload the contents of `builds/<world-id>/` to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, an S3 bucket, etc.) and point your domain at it. `base: './'` in `vite.config.ts` means the build works whether it's served from a domain root or a subpath, unmodified. `world.json` can also set an optional `favicon` field (a path relative to that world's folder) to give that domain its own favicon, separate from the default one in `index.html`.

## Isochrone (travel-time) layers

There's no dedicated `kind` for isochrones — precompute the polygons with whatever routing tool fits your data (routing engines/APIs, GIS tools, etc.) and ship them as a normal `kind: "polygon"` layer, exactly like `worlds/demo/layers/regions.layer.json`. Each isochrone gets `properties.temporal` if it should only apply on certain dates, and any `taxonomy` field (e.g. travel time bucket) like any other layer. This needs no engine code — the same reasoning that makes administrative regions "just temporal geometry" applies here. A layer that computes isochrones live (e.g. on click) would need an external routing service, which is out of scope for this static, no-backend engine.

## Recently shipped beyond the original v1 scope

- Two top-level views — Map and a full-screen Calendar view (day/week/month/year, a 12-month year-at-a-glance layout, and a per-day event agenda).
- Multi-calendar display support for Gregorian, Julian, Islamic, and Hebrew calendars via `calendar.system` in `world.json`.
- Multi-projection map display support for `EPSG:3857`, `EPSG:4326`, and custom CRS definitions via `map.crs`.
- Calendar bar refinements with day/week/month/year granularity and a range slider, plus richer selection-card info rendering for links, images, and coordinates.
- Isolated per-domain world builds (`vite build --mode <world-id>`, see above) ship only that world's data, plus per-world `favicon`.
- `systems.time: false` hides all time/calendar UI for a world with no temporal data.
- The calendar no longer caps navigation at "today" — `calendar.min`/`max` govern the real bounds, so future-dated content (e.g. upcoming events) is reachable, not just past/current dates.
- A thematic `welcome` splash (declarative `welcome` object in `world.json`) as a world's initial view, with a live feature-count teaser, before its CTA drops you into the map.
- A multi-image `infoField` (`type: "image"` resolving to more than one value) renders a thumbnail grid that opens a full-screen lightbox with prev/next, arrow-key navigation, and Escape-to-close.
- Point-layer marker styling driven by any feature property, independent of `taxonomy`: `style.colorField`/`colorMap` (a colored circle behind the icon) and `style.badgeField`/`badgeMap` (a sparse corner badge).
- Satellite base layers can show place labels via an optional `labelsUrl` second tile source layered on top.
- `scripts/fetch-osm-boundary.mjs` pulls a real administrative boundary from OpenStreetMap (Overpass API) to use as a `regionRole: "boundary"` layer's source geojson, instead of hand-authoring one.

## Known v1 deviations from the design spec

`CalendarBar.ts` now has a day/week/month/year granularity selector plus a range slider bounded by `calendar.min`/`calendar.max` (previously only a prev/next day stepper + native date picker), covering the design spec's Section 6 gap.

`calendar.system` (`docs/json-reference.md`) renders dates in Julian/Islamic/Hebrew calendars throughout the UI (calendar bar stepping and label, temporal-status text), and `CalendarBar.ts`'s year/month/day fields edit directly in that system too, not just Gregorian.

`map.crs` (`docs/json-reference.md`) supports Leaflet's built-in `EPSG:3857`/`EPSG:4326`/`Simple` (flat pixel-space, e.g. indoor floor plans or game/fictional maps) plus fully custom projections via `proj4leaflet`.
