# Roadmap

Future work, none of this is implemented. See `CHANGELOG.md` for what's shipped and `README.md` for known v1 deviations.

Open items below; everything else previously listed here has shipped (see `CHANGELOG.md`).

- [Feature Request World Definition](feature-request-world-def.md)

- Border regions for paranormal-espana: undecided yet — Tenerife-only for now (expanding to all of Spain later), and whether to author boundary geojson by hand or pull region shapes from OpenStreetMap directly. Doesn't need `systems.time` (this world already has it disabled) — a `regionRole: "boundary"` layer works independently of temporal/calendar support.

## For future massive refactor to own Map Server and PostgreSQL

Long-term, not scoped or scheduled. Today every world is static: `worlds/<id>/data/*.geojson` fetched whole, no backend, no database — the `"api"` `LayerSource` type (`docs/json-reference.md`) is a documented no-op stub for exactly this future. A real backend would mean: a PostgreSQL/PostGIS store instead of flat GeoJSON files (spatial queries, live edits without a redeploy), a tile-serving layer (vector or raster) instead of third-party OSM/Esri tiles, and `fetchFeatures()` (`src/engine/data/loader-registry.ts`) growing a real API-backed loader alongside the existing `geojson`/`geojson-sharded` ones — its `bounds`/`dateRange` parameters already exist for this, just unused by current loaders. Would unlock things static files can't: user-submitted places (the `participate` plugin currently just opens an email/WhatsApp/Telegram link, not a real submission pipeline), live region boundary lookups (see the OSM border-pulling item below) instead of committing geojson to the repo, and datasets too large to ship as static files (e.g. a full-country places index). Not needed by any current world — revisit when one actually requires live/dynamic data instead of a fixed dataset.
