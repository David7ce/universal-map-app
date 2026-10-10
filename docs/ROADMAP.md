# Roadmap

Open work only. Shipped work is recorded in `CHANGELOG.md`; current usage and architecture are described in `../README.md` and `CONTEXT.md`.

- [World Definition Package System — open items](../feature-request-world-def.md): rule system and a live API data-source loader. Both are deliberately deferred: no current world needs them (see `CHANGELOG.md`).

## For future massive refactor to own Map Server and PostgreSQL

Long-term, not scoped or scheduled. Today every world is static: `worlds/<id>/data/*.geojson` fetched whole, no backend, no database — the `"api"` `LayerSource` type (`json-reference.md`) is a documented no-op stub for exactly this future. A real backend would mean: a PostgreSQL/PostGIS store instead of flat GeoJSON files (spatial queries, live edits without a redeploy), a tile-serving layer (vector or raster) instead of third-party OSM/Esri tiles, and `fetchFeatures()` (`src/engine/data/loader-registry.ts`) growing a real API-backed loader alongside the existing `geojson`/`geojson-sharded` ones — its `bounds`/`dateRange` parameters already exist for this, just unused by current loaders. Would unlock things static files can't: user-submitted places (the `participate` plugin currently just opens an email/WhatsApp/Telegram link, not a real submission pipeline), live region boundary lookups (today's OSM boundaries, per the item above, are one-time fetches committed as static geojson, not live queries) instead of committing geojson to the repo, and datasets too large to ship as static files (e.g. a full-country places index). Not needed by any current world — revisit when one actually requires live/dynamic data instead of a fixed dataset.
