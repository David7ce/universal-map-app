# Universal Map-Time Engine

A static, browser-only map (OpenStreetMap + Leaflet) with a Gregorian calendar as an equal first-class dimension. See `docs/superpowers/specs/2026-07-26-universal-map-time-engine-design.md` for the full design.

## Run locally

    npm install
    npm run dev

Open the printed local URL. No backend, no paid services — `npm run build` produces a static `dist/` you can host anywhere (or serve locally with `npm run preview` or any static file server).

## Run tests

    npm test

## Add a new app instance

1. Create a new folder under `apps/<your-app-id>/`.
2. Add an `app-manifest.json` (see `apps/demo/app-manifest.json` for the shape).
3. Add one `*.layer.json` per data layer under `apps/<your-app-id>/layers/`, and the matching GeoJSON under `apps/<your-app-id>/data/`.
4. Optionally add `strings.json` for your own UI text, and a `plugins` block to activate `participate`.
5. Point `src/main.ts`'s `fetch('/apps/demo/app-manifest.json')` call (and the two other `/apps/demo/` paths) at your new app id, or introduce a build-time/query-param switch — multi-app routing is intentionally out of scope for v1 (see the design spec's non-goals).

No engine code under `src/engine/` needs to change to add a new app instance.

## Known v1 deviations from the design spec

The calendar bar (`src/ui/panels/CalendarBar.ts`) currently provides only single-date stepping — a previous/next day button plus a native date picker — not the range slider (bounded by `calendar.min`/`calendar.max`) and day/week/month/year granularity toggle described in the design spec's Section 6. This is a UI-completeness gap only: the underlying temporal data model (instant/range/recurrence per feature, `isActiveOn`) is fully implemented and unaffected, so adding the slider/toggle later is additive UI work, not an engine change.
