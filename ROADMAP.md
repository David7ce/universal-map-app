# Roadmap

Future work, none of this is implemented. See `CHANGELOG.md` for what's shipped and `README.md` for known v1 deviations.

Open items below; everything else previously listed here has shipped (see `CHANGELOG.md`).

- [Feature Request World Definition](feature-request-world-def.md)

- Border regions for paranormal-espana beyond La Orotava: resolved for the Tenerife-only scope — pulled from OpenStreetMap via `scripts/fetch-osm-boundary.mjs` (Overpass API, one relation per municipio) rather than hand-authored, since OSM already has accurate admin boundaries and no world needs live/editable ones yet. Still open: expanding coverage to all of Spain later just means running the script again per municipio/province — no new capability needed, just more `dataLayers` entries.

## For future massive refactor to own Map Server and PostgreSQL

Long-term, not scoped or scheduled. Today every world is static: `worlds/<id>/data/*.geojson` fetched whole, no backend, no database — the `"api"` `LayerSource` type (`docs/json-reference.md`) is a documented no-op stub for exactly this future. A real backend would mean: a PostgreSQL/PostGIS store instead of flat GeoJSON files (spatial queries, live edits without a redeploy), a tile-serving layer (vector or raster) instead of third-party OSM/Esri tiles, and `fetchFeatures()` (`src/engine/data/loader-registry.ts`) growing a real API-backed loader alongside the existing `geojson`/`geojson-sharded` ones — its `bounds`/`dateRange` parameters already exist for this, just unused by current loaders. Would unlock things static files can't: user-submitted places (the `participate` plugin currently just opens an email/WhatsApp/Telegram link, not a real submission pipeline), live region boundary lookups (today's OSM boundaries, per the item above, are one-time fetches committed as static geojson, not live queries) instead of committing geojson to the repo, and datasets too large to ship as static files (e.g. a full-country places index). Not needed by any current world — revisit when one actually requires live/dynamic data instead of a fixed dataset.
