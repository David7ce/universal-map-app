# Changelog

Record of what's been implemented beyond the original v1 (see `docs/superpowers/specs/2026-07-26-universal-map-time-engine-design.md` for the base design). Future work lives in `ROADMAP.md`, not here.

## `apps/` renamed to `worlds/`, `app-manifest.json` to `world.json`

Pure rename, no behavior change — `worlds/<id>/` and `worlds/<id>/world.json` replace `apps/<id>/` and `apps/<id>/app-manifest.json`, and the URL switcher is now `?world=<id>` instead of `?app=<id>`. Matches the vocabulary `feature-request-world-def.md`'s "World Definition Package System" is specified in; this is sub-project 1 of that effort (see `docs/superpowers/specs/2026-08-04-worlds-rename-design.md`). Internal TypeScript naming (`AppManifest`, `validateAppManifest()`, `appManifest.ts`, `resolveAppId()`) deliberately stays as-is — external rename only, hard cutover, no alias for the old paths. `docs/schemas/app-manifest.schema.json` was also renamed to `docs/schemas/world.schema.json`; anyone referencing the old schema path via `$schema` in their own manifest will need to update it, since there's no alias for that either.

## Generic, manifest-driven plugin activation

Replaced the hardcoded `if (appManifest.plugins?.participate) registerParticipatePlugin(...)` in `src/main.ts` with a generic activation path (design: `docs/superpowers/specs/2026-08-04-plugin-registry-design.md`). `AppManifest.plugins` is now an open `Record<string, unknown>` — `validateAppManifest` only checks it's a plain object, it no longer knows what any plugin id means. Every `plugins/<id>/index.ts` exports a default `register(config: unknown, strings: Record<string, string>): void` responsible for validating its own config and calling `registerPlugin`; `plugins/participate/index.ts` now owns `ParticipateConfig` and its validation (moved out of `app-manifest.ts`, same error messages). New `src/engine/plugins/activate.ts` (`activatePlugins`) does id → module lookup via `import.meta.glob('/plugins/*/index.ts')`, throwing a named error for a manifest id with no matching plugin folder — a plugin folder that isn't shipped is a configuration bug, not a silently-degraded state. Adding a second plugin now requires zero edits to `main.ts` or the manifest validator.

## Visual calendar grid in the Time editor

`CalendarBar.ts` now renders a clickable calendar grid below the existing "Month / Day / Year" fields, when not in numeric-edit mode: a week row, a full month grid, or a year-of-months grid, depending on the granularity stepper's current setting (`'day'` still shows plain text — a single day has nothing to grid). New pure engine module `src/engine/time/calendar-grid.ts` (`buildWeekCells`/`buildMonthCells`/`buildYearCells`) computes cells adapted to `calendar.system` (real day-of-week from the underlying Gregorian date, system-aware month/day counts via last session's `daysInCalendarMonth`/`monthsInCalendarYear`), and marks cells with an active feature (respecting `activeFilters`, same as every other filtered view) via an event dot. Clicking a day cell selects it; clicking a month cell in year view selects day 1 of that month and drills into month view. Selecting a week/month/year cell still resolves to one `selectedDate` — no range-based map filtering (see `docs/superpowers/specs/2026-08-02-calendar-grid-view-design.md` Section 2 for why that's out of scope).

## Calendar-aware date editing (islamic/hebrew/julian, not just gregorian)

The year/month/day fields in `CalendarBar.ts` now edit in the _display_ calendar system, not always Gregorian — with `calendarSystem` set to islamic, typing into the fields means Hijri year/month/day, not Gregorian. Two new conversion functions in `calendar-conversion.ts` make this possible:

- `calendarPartsToIso(parts, system)` — the reverse of the existing `toCalendarParts()`: given year/month/day already expressed in the target system, returns the equivalent Gregorian ISO date for storage. Throws on an impossible combination (e.g. day 30 in a 29-day Hebrew month) via Temporal's `overflow: 'reject'` (its default, `'constrain'`, would have silently snapped to a different date than what was typed).
- `daysInCalendarMonth(year, month, system)` / `monthsInCalendarYear(year, system)` — bound the day/month fields to what's actually valid: islamic/hebrew months run 29-30 days depending on the year, and a Hebrew leap year has 13 months (Adar I), not 12.

The month/year spin buttons now step via `addCalendarUnit` (system-aware) instead of raw Gregorian arithmetic; the day spinner still steps the underlying ISO date directly since a day is a day regardless of display system. `julian-calendar.ts` exports `daysInJulianMonth` (previously private) for this. Removed `parseDateInputValue` (flexible dd-mm-yyyy/2-digit-year text parsing) — dead code once the numeric year/month/day fields it served became system-aware instead of accepting a single free-text string.

Not verified in a real browser this session (Playwright's MCP browser tool is pinned to a system Chrome install that isn't present and needs admin rights to add) — covered by type-check, an expanded test suite (round-trips for all four systems, leap-month/leap-year edge cases), and a production build instead.

## Runtime map projection switching, plus `L.CRS.Simple` support

`map.crs` now accepts `"Simple"` (Leaflet's flat pixel-space CRS, for indoor floor plans or game/fictional maps) alongside `EPSG:3857`/`EPSG:4326`/custom (`src/engine/space/map-crs.ts`, `src/engine/space/leaflet/map.ts`).

The Settings popover's read-only projection text is now a real `<select>` (`SettingsControl.ts`) that switches the live map. Leaflet has no supported way to change `map.options.crs` after construction, so `MapAdapter.setCrs()` (new method, `src/engine/space/map-adapter.ts`) tears down and recreates the underlying `L.Map` instance (`leaflet-map-adapter.ts`), replaying the active base layer, every previously rendered data layer, the coordinate grid, and view-change subscriptions (scale bar) onto the new instance — callers don't have to re-render anything themselves. The view resets to the manifest's original center/zoom on switch, since a coordinate from one CRS has no meaningful equivalent in an unrelated one. A custom proj4 config from the manifest is offered as a fixed, non-editable "Custom" option (no UI here to author a new proj4 string).

## JSON Schema files for app-manifest.json and layer.json

`docs/schemas/app-manifest.schema.json` and `docs/schemas/layer.schema.json` (draft-07) mirror the field-by-field shapes in `docs/json-reference.md` and the runtime checks in `validateAppManifest`/`validateLayerManifest`. Add `"$schema": "../../docs/schemas/app-manifest.schema.json"` (adjust the relative path) to a manifest file to get editor autocomplete/inline validation — wired into `apps/demo/app-manifest.json` and all three `apps/demo/layers/*.layer.json` as a working example. Verified against the demo manifests with `ajv-cli` (not a project dependency, just used to sanity-check the schema files while writing them).

## Deep validation for optional manifest fields

`validateAppManifest`/`validateLayerManifest` (`src/engine/manifests/`) now check the shape of optional nested fields, not just required top-level ones: `plugins.participate` (channel/target/messageTemplate), `strings` (must be a string path), and, per layer, `regionRole`, `temporal.defaultVisibility`, each `taxonomy` entry (id/label/field), and `panel` (boolean flags, `infoFields` entries). A malformed config now throws a specific error naming the bad field instead of failing silently or surfacing a confusing runtime error later.

## "Clear all filters" control

`PanelRight.ts` shows a `filter-panel__clear-all` button above the taxonomy sections whenever any dimension has an active selection; clicking resets `activeFilters` to `{}` in one step instead of unchecking each dimension's select-all individually.

## Granularity step control in the Time editor

New row above the year/month/day fields in `CalendarBar.ts`: a day/week/month/year `<select>` plus prev/next buttons that step `selectedDate` by that unit (`nextSelectedDate`, `getVisibleGranularityOptions` — pure functions that already existed with test coverage but were never wired to a control until now). Year steps by whole years (`addCalendarUnit` for non-gregorian systems, native `setUTCFullYear` for gregorian) — no intercalary-day handling, matching the "12 months, no intercalary days" scope the original roadmap item called for.

## Taxonomy value counts in filter checkboxes

`PanelRight.ts` now renders each taxonomy value's match count (`computeTaxonomyDimensions` already computed it, per `{ value, count }`) next to its checkbox label, right-aligned via `.filter-options__count`. Suppressed for boundary-region layers (`regionRole: 'boundary'`, e.g. `regions.layer.json`) via a new `TaxonomyDimension.showCounts` flag — one polygon per region name means the count is always 1, not useful information.

## Wider gap between the bottom-left Layers button and the docked search/info panel

At desktop width, `.bottom-left-controls` shifting right to clear the docked search/info panel only added `--control-btn-offset` (15px), which read flush against the panel edge. It now also adds `--controls-gap`, matching the spacing already used between controls in the same row.

## Time editor, calendar system, and map settings moved into the filters panel

The filters panel (`#panel-right`) now also hosts, below the Category/Region filters:

- **Time** (`src/ui/panels/CalendarBar.ts`, mounted at `#panel-right-time`): the year/month/day date editor and a range slider on its own full-width row so it always has real drag room, even in the panel's narrow column. `AppState.calendarSystem` is the single source of truth read by `CalendarBar.ts` and `SelectionCard.ts`.
- **Settings** (`src/ui/panels/SettingsControl.ts`, mounted at `#panel-right-map-settings`): a small button that opens a popover with a live calendar-system select (gregorian/julian/islamic/hebrew, independent of the manifest's default; switching to islamic/hebrew lazy-loads `@js-temporal/polyfill` on demand via `ensureCalendarSystemLoaded()`), the map projection (originally read-only display, later made selectable — see "Runtime map projection switching" below), and a "show coordinate grid" checkbox that draws a lat/lng graticule (`src/engine/space/coordinate-grid.ts` for the pure line-generation math, `coordinate-grid-layer.ts` for the Leaflet layer — split so the math stays unit-testable without a `window` global). The calendar-system select originally lived inline in the Time section; moved into Settings since it's map/app-level config, not a per-lookup date field.

No more full-width calendar bar or separate floating buttons for either — `#calendar-bar`/`#settings-control` are gone from `.bottom-left-controls`, which now holds only the Layers button. The footer legend gained a plain-text current-date reading (`#map-date-text`) as the one always-visible date indicator now that the full editor lives inside the (closed-by-default) filters panel.

## Layers popover: Map details + Map type only, stays open with an explicit close button

`LayerControl.ts`'s popover no longer auto-closes on click-outside (it behaves like the filters panel: toggle to open, an explicit header close button to dismiss). Now that Time and Settings moved into the filters panel, it only holds Map details and Map type.

## Ruler-style scale bar; footer legend fixed and moved to the bottom-right

Removed a dead, duplicate `.map-footer-legend` CSS rule block (leftover from an earlier layout, referencing an undefined `--calendar-bar-height` variable) that was overlapping and partially obscuring the calendar bar. The live rule is now anchored bottom-right instead of spanning the full width. The scale indicator (`mountScaleIndicator` in `src/ui/app-chrome.ts`) now renders as an actual ruler — a bar with side + bottom borders (no top border), sized to a "nice" round ground distance (1/2/3/5 × 10ⁿ, same table Leaflet's own scale control uses) instead of a plain number — plus a plain-text current-date reading (`#map-date-text`), the scale, and the attribution, all on one line.

## Single-world map — no more infinitely repeating tiles

`createMap()` (`src/engine/space/map.ts`) now sets `noWrap: true` on every tile layer and, for the two built-in geographic CRSs (default EPSG:3857 and EPSG:4326 — skipped for a custom CRS, whose units aren't known here), `maxBounds`/`maxBoundsViscosity` so panning stops at the edges of a single world instead of looping into repeated copies.

## Zoom control and footer legend shift with the filters panel, same as the toggle button

`.leaflet-control-zoom` and `.map-footer-legend` previously stayed pinned to the screen edge and ended up covered by the filters panel when it opened. On desktop they now slide left in sync with the panel (same `panel-right-open` pattern the filter toggle button already used); on mobile, where the panel covers the full screen, they simply hide instead.

## Search field/button visibility bug fixed on desktop

The desktop breakpoint (`≥64rem`) was missing the CSS that hides the circular mobile search-toggle button and forces the always-visible search field to override its `hidden` state — `SearchOverlay.ts`'s code already assumed this override existed. Both the button and the field could end up showing (or the field staying hidden) depending on `panels.left`. Fixed by adding the missing rules to that breakpoint.

## Filters panel no longer dims the map

Opening the right-side filters drawer used to darken the rest of the UI via a `rgba(0,0,0,0.5)` backdrop. `.panel-overlay` now stays fully transparent (still clickable, so click-outside still closes the panel) — opening filters no longer visually competes with the map underneath.

## Demo data: Tenerife (Fasnia) content

Added two real points of interest for Fasnia, Tenerife — Volcán de Fasnia (1705 eruption, IGME geological site IC4044) and Barranco de Herques (the lost Guanche necropolis Viera y Clavijo described in 1772) — under new `desastres`/`otros_planos` categories, plus `epoca`/`descripcion` `infoFields` on the `poi` layer to show them. Added three approximate municipality boundary polygons (Fasnia, Güímar, Arico) to `regions.geojson` so the new POIs resolve a containing region via the existing spatial join.

## Lazy-loaded Temporal polyfill and proj4leaflet

`@js-temporal/polyfill` (islamic/hebrew calendar display) and `proj4leaflet` (custom `map.crs` projections) are now dynamically `import()`ed only when an app manifest actually requests them, instead of shipping in every build. `ensureCalendarSystemLoaded()` (`src/engine/time/calendar-conversion.ts`) is awaited once at bootstrap, before the first calendar render; `createMap()` (`src/engine/space/map.ts`) awaits the proj4leaflet import only inside the custom-CRS branch. For the demo app (gregorian, default EPSG:3857) this drops the main bundle from ~157KB to ~67KB gzipped, with the rest split into on-demand chunks.

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
