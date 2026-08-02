# Roadmap

Future work, none of this is implemented. See `CHANGELOG.md` for what's shipped and `README.md` for known v1 deviations.

## In Filter Panel

- "Clear all filters" control that resets every dimension at once. Today `PanelRight.ts` only offers a per-dimension select-all/select-none checkbox (`toggleAll` in `src/engine/taxonomy/tri-state.ts`); there's no one-click reset across all open dimensions.
- Make map projection actually selectable from the Settings control instead of read-only. `SettingsControl.ts` only shows `describeCrs(deps.appManifest.map.crs)` as static text; a real selector needs `MapAdapter` (`src/engine/space/map-adapter.ts`) to support re-initializing tiles/CRS at runtime, not just a state change — bigger than a UI tweak.

## Improve API and JSON

- Deep-validate optional fields in `validateAppManifest`/`validateLayerManifest` (`src/engine/manifests/`). Today validation only checks required top-level fields are present — `map.crs`, `plugins.participate`, and other optional nested shapes aren't checked, so a malformed config fails silently or surfaces as a confusing runtime error instead of a clear validation message.
- JSON Schema files for `app-manifest.json`/`layer.json` so editors can offer autocomplete and inline validation while authoring a new app instance, instead of relying on `docs/json-reference.md` alone.

## Improve architecture and simplify logic and names

- `L.CRS.Simple` support (flat pixel-space maps — indoor floor plans, game/fictional maps) alongside the existing real-world geographic CRSes (`EPSG:3857`/`EPSG:4326`/custom). Flagged as a possible future item in `README.md`'s "Known v1 deviations".
- Calendar-aware date picker. `calendar.system` renders dates in julian/islamic/hebrew throughout the UI, but the native `<input type="date">` popup itself always stays Gregorian — a custom-built widget would be needed to pick dates in the selected system directly.
