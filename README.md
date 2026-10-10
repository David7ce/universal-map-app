# Universal Calendar Map

A static, browser-only map app and reusable spatio-temporal engine. Geography and time are first-class dimensions, with Gregorian, Julian, Islamic, and Hebrew calendar display support. See [JSON format reference](docs/json-reference.md), [API reference](docs/api-reference.md), [changelog](docs/CHANGELOG.md), and [roadmap](docs/ROADMAP.md). JSON Schemas live under `docs/schemas/` for editor autocomplete; add the appropriate relative `$schema` path to a world or layer manifest.

## Run locally

    pnpm install
    pnpm dev

Open the printed local URL. No backend, no paid services — `pnpm build` produces a static `dist/` you can host anywhere (or serve locally with `pnpm preview` or any static file server).

## Run tests

    pnpm test

## Add a new world instance

1. Create a new folder under `worlds/<your-world-id>/`.
2. Add a `world.json` (see `worlds/world-leaders/world.json` for the shape).
3. Add one `*.layer.json` per data layer under `worlds/<your-world-id>/layers/`, and the matching GeoJSON under `worlds/<your-world-id>/data/`.
4. Add `strings.en.json` and optionally `strings.es.json` for world-specific UI text, plus a `plugins` block if the world needs plugins. Shared interface strings live in `public/strings/site.en.json` and `site.es.json`; world strings override shared values when keys overlap.
5. Register the world for Home and Settings by adding its `id`, label, description, and icon to `AVAILABLE_WORLDS` in `src/ui/worlds.ts`, and add its `worlds.<id>.label` and `worlds.<id>.description` entries to both shared site-string files.
6. To translate world content, set `contentLanguage` and `translations` in `world.json`, then add `layers/<name>.layer.<lang>.json` and/or `data/<file>.<lang>.json` overrides. See "Translated content" in `docs/json-reference.md` and `worlds/world-leaders/` for an example.
7. Load it at `/my-world/` (e.g. `http://localhost:5173/my-world/`). The bare root (`/`) always shows the shared Home page listing registered worlds, and never loads a world; the Home page and Settings world selector link to registered worlds, and `?world=<id>` remains supported as an override.

No engine code under `src/engine/` needs to change to add a new world instance.

### Open and deploy each world independently

Every world can be opened on its own during development, and built + deployed as its own standalone site on its own domain — no code changes needed either way, just the world's own `world.json`/`layers/`/`data/`.

**Open one locally**, with the rest of the app unaffected — `pnpm dev`, then open the world's path:

| World                   | URL (dev)                                      |
| ----------------------- | ---------------------------------------------- |
| `world-leaders`         | `http://localhost:5173/world-leaders/`         |
| `paranormal-spain`      | `http://localhost:5173/paranormal-spain/`      |
| `events-canary-islands` | `http://localhost:5173/events-canary-islands/` |
| `moon-map-photos`       | `http://localhost:5173/moon-map-photos/`       |

The bare root (`http://localhost:5173/`) always shows the shared Home page — it loads no world.

(`?world=<id>` also still works, e.g. `http://localhost:5173/?world=paranormal-spain`.) You can also switch worlds from the Settings control.

**Build one for its own domain** — `vite build --mode <world-id> --outDir builds/<world-id>` bundles only that world's data and makes it load by default at `/`, so the site contains no other worlds' content. Each world has a matching `package.json` script:

    pnpm run build:world-leaders          # -> builds/world-leaders/
    pnpm run build:paranormal-spain       # -> builds/paranormal-spain/
    pnpm run build:events-canary-islands  # -> builds/events-canary-islands/
    pnpm run build:moon-map-photos        # -> builds/moon-map-photos/

Adding a new world that should also deploy standalone means adding one matching line to `package.json`'s `"scripts"`:

    "build:<your-world-id>": "tsc --noEmit && vite build --mode <your-world-id> --outDir builds/<your-world-id>"

**Preview a build before deploying it** — the output is plain static files, so any static file server works, e.g.:

    npx serve builds/paranormal-spain

**Deploy** — upload the contents of `builds/<world-id>/` to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, an S3 bucket, etc.) and point your domain at it. `base: './'` in `vite.config.ts` means the build works whether it's served from a domain root or a subpath, unmodified. `world.json` can also set an optional `favicon` field (a path relative to that world's folder) to give that domain its own favicon, separate from the default one in `index.html`.

## Isochrone (travel-time) layers

There's no dedicated `kind` for isochrones — precompute polygons with a routing tool and ship them as a normal `kind: "polygon"` layer. Each isochrone can use `properties.temporal` and taxonomy fields like any other feature. Live isochrone calculation would need an external routing service, outside this static app's current scope.

## Current interface

The shared Home page explains the project and links directly to each world. On a map, the right panel contains full filters, a month/month-year/year drill-down calendar, and settings. Small filter sets also appear as top-of-map pill shortcuts. Worlds can also be switched from Settings. Plugin lifecycle hooks notify registered plugins about date, filter, and selection changes.

The app supports Gregorian, Julian, Islamic, and Hebrew calendar display; EPSG:3857, EPSG:4326, Simple, and custom map projections; static GeoJSON and sharded GeoJSON layers; and optional isolated builds per world.
