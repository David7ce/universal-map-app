# API reference

Reference for the engine's internal functions, modules, and interfaces — what you'd import if you were extending the engine itself or writing a plugin. For the JSON manifest/data formats, see `docs/json-reference.md`.

Everything under `src/engine/` is the reusable core: it never hardcodes field names, taxonomy labels, or region roles — those always come from a layer manifest (see `docs/json-reference.md`). `src/ui/` is the reference DOM layer built on top of it; an app author could replace it entirely and keep `src/engine/` unchanged.

---

## `engine/time` — the temporal resolver

The area the design spec flags as most likely to hide subtle bugs — has the heaviest test coverage in the codebase.

### `isActiveOn(feature, date): boolean`

`src/engine/time/is-active-on.ts`

The one function everything else calls to answer "is this feature active on this date". A feature with no `properties.temporal` is always active. Otherwise checks `instant`, then `range` bounds, then `recurrence` (with `exceptions` excluded first). Dates are normalized to UTC day-boundary before comparing — a `Date` with a non-midnight time component still compares correctly.

### `parseRule(rule: string): ParsedRule` / `matchesRule(parsed, date, anchor?): boolean`

`src/engine/time/rrule-subset.ts`

The RRULE-subset parser and matcher `isActiveOn` delegates to for `recurrence.rule`. `parseRule` throws on a missing/unrecognized `FREQ`. `matchesRule` throws if `FREQ` is `MONTHLY`/`YEARLY` (parsed but not matchable in v1) or if `COUNT` is used with no `anchor`. `anchor` is `temporal.range.from` when present — see `docs/json-reference.md`'s "`recurrence.rule`" section for the supported key list.

### `startOfDayUtc(date: Date): Date` / `parseIsoDateUtc(iso: string): Date`

`src/engine/time/rrule-subset.ts`

Small date-normalization helpers, exported because `is-active-on.ts` needs the exact same UTC-midnight normalization `rrule-subset.ts` uses internally — this is the fix for a bug class (raw-millisecond `Date` comparison instead of day-boundary-normalized) that showed up twice during this project's build.

### Calendar systems (display only — see `docs/json-reference.md`'s "Calendar systems" section for the storage/display split)

- `formatCalendarDate(isoDate, system, locale?): string` — `src/engine/time/calendar-conversion.ts`. Formats an ISO Gregorian date as a human string in the target `CalendarSystem`.
- `addCalendarUnit(isoDate, system, unit, delta): string` — same file. Steps a date by a calendar-aware month/year (day/week stepping is calendar-agnostic and handled directly by `CalendarBar.ts`'s own `nextSelectedDate`/`stepDatePart`).
- `toCalendarParts(isoDate, system, locale?): CalendarDateParts` — same file. Decomposed `{ year, month, day, monthName }`, for a future consumer that needs the parts rather than a pre-formatted string (no current call site).
- `CalendarSystem` type and `CALENDAR_SYSTEMS` array — `src/engine/time/calendar-systems.ts`. `'gregorian' | 'julian' | 'islamic' | 'hebrew'`.

---

## `engine/taxonomy` — filter dimensions

### `computeTaxonomyDimensions(layers, date): TaxonomyDimension[]`

`src/engine/taxonomy/compute-dimensions.ts`

Scans every loaded layer's declared `taxonomy` fields and, for features active on `date`, counts occurrences per value. Powers the right-hand filters panel — this is what turns `layer.json`'s `taxonomy` declarations into the checkbox groups you see.

### `featureMatchesFilters(feature, manifest, activeFilters): boolean`

Same file.

Whether a feature should be shown given the user's current filter selections. Semantics: a dimension absent from `activeFilters`, or with an empty `Set`, means "no restriction" — every feature passes it. Only once the user has actively selected at least one value does membership get enforced. This is what `renderDataLayer` and `SearchOverlay.ts` both call to stay in sync with the filters panel.

### `readField(feature, path): string[]`

Same file.

Reads a dotted property path (e.g. `"properties.category"`) off a feature, returning `[]` if absent/null, or a single-element array otherwise (array-valued properties are returned as-is, stringified). This is the one place field-path resolution lives — `taxonomy[].field` and `panel.infoFields[].field` both go through it.

### `getTriState(allValues, selected): 'all' | 'some' | 'none'` / `toggleAll(allValues, selected): Set<string>`

`src/engine/taxonomy/tri-state.ts`

Pure tri-state checkbox logic for a dimension's "select all" control. `toggleAll` returns everything selected if not already all-selected, otherwise clears the selection.

---

## `engine/region` — spatial membership

### `findContainingRegions(point, boundaryLayers, date): GeoFeature[]`

`src/engine/region/spatial-join.ts`

For a `[lng, lat]` point, returns every feature from any layer with `regionRole: "boundary"` that both contains the point (`@turf/boolean-point-in-polygon`) and is active on `date` (`isActiveOn`). This is the concrete mechanism behind "regions are just temporal geometry" — a boundary that changed shape on a given date is modeled as two ordinary features with non-overlapping `temporal.range`, not as special region objects. `SelectionCard.ts` calls this to show a selected point feature's containing region(s).

---

## `engine/manifests` — validation

### `validateAppManifest(json): AppManifest`

`src/engine/manifests/app-manifest.ts`

### `validateLayerManifest(json): LayerManifest`

`src/engine/manifests/layer-manifest.ts`

Both throw a descriptive `Error` on a structurally invalid manifest, otherwise return the parsed object typed as the manifest interface. Validation is intentionally shallow today — required top-level fields are checked, most optional fields' inner shapes aren't deep-validated. See `docs/json-reference.md` for the full field tables these validate against.

---

## `engine/state` — the reactive store

### `createStore<T>(initial: T): Store<T>`

`src/engine/state/store.ts`

```ts
interface Store<T> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(listener: (state: T) => void): () => void; // returns an unsubscribe function
}
```

A minimal reactive store: `set()` shallow-merges the patch into state and synchronously notifies every subscriber, on every call — there's no diffing, so a `set()` with no actual value change still re-notifies. This is why `main.ts`'s `renderMap()` (and every other `store.subscribe` callback) is written to be cheap to re-run and re-derive its output from current state, rather than relying on being called only when something relevant changed.

`AppState` (`src/engine/state/store.ts`) is the concrete state shape this app instance uses — `selectedDate`, `activeFilters`, `selectedFeatureId`, `activeBaseLayerId`, `panels`, `hiddenLayerIds`. A different app instance could in principle use a different state shape; nothing in `src/engine/` besides `main.ts`'s own wiring assumes this exact interface.

---

## `engine/space` — the map

### `createMap(container, appManifest): { map: L.Map, baseLayers: Record<string, L.TileLayer> }`

`src/engine/space/map.ts`

Creates the Leaflet map, adds the first `baseLayers` entry, adds a real Leaflet zoom control (repositioned via CSS), and applies `map.crs` if set (see `docs/json-reference.md`). Returns the raw tile-layer instances keyed by base-layer `id` so a caller (`LayerControl.ts`) can add/remove them on user action — base-layer switching is not Leaflet's built-in layers control, it's driven externally.

### `renderDataLayer(map, manifest, features, date, activeFilters?): L.Layer`

`src/engine/space/data-layer-renderer.ts`

Filters `features` to those active on `date` and matching `activeFilters` (`isActiveOn` + `featureMatchesFilters`), then renders them per `manifest.kind` — see `docs/json-reference.md`'s "Layer kinds" table. Returns the created `L.Layer` so the caller can remove it before the next render (this function doesn't track or diff previous renders itself — `main.ts`'s `renderMap()` owns that bookkeeping via a `Map<layerId, Layer>`).

### `resolveMarkerStyle(manifest): MarkerStyle` / `resolvePolygonStyle(manifest): PolygonStyle`

`src/engine/space/style.ts`

Read `manifest.style` and fill in defaults per field — see `docs/json-reference.md`'s "Style fields" table for exactly which keys each reads and their defaults.

### `isValidMapCrsConfig(value): value is MapCrsConfig`

`src/engine/space/map-crs.ts`

Runtime shape guard for `map.crs` — accepts `"EPSG:3857"`, `"EPSG:4326"`, or a `CustomCrsConfig` object with valid `proj4def`/`resolutions`/`origin`/optional `bounds`.

---

## `engine/data` — loading features

### `fetchFeatures(source, bounds?, dateRange?): Promise<GeoFeature[]>`

`src/engine/data/loader-registry.ts`

Dispatches on `source.type` (`"geojson"` / `"geojson-sharded"`) to the matching loader. `bounds`/`dateRange` are accepted but currently ignored by both loaders — this is the documented seam for a future server-backed `"api"` source type (see `docs/json-reference.md`'s `LayerSource` table) so this signature won't need to change when that's implemented.

---

## `engine/plugins` — the plugin hook API

`src/engine/plugins/registry.ts`. This is the thin extension point non-core features (like `plugins/participate/`) are built on, instead of touching engine code.

```ts
interface PluginContext {
  getSelectedDate(): string;
  getActiveFeatures(): GeoFeature[];
  getSelectedFeature(): GeoFeature | null;
}

interface PanelSlot {
  id: string;
  label: string;
  icon: string;
  render(container: HTMLElement, ctx: PluginContext): void;
}

interface PluginHooks {
  panelSlot?: PanelSlot;
  onDateChange?(date: string, ctx: PluginContext): void;
  onFilterChange?(activeFeatures: GeoFeature[], ctx: PluginContext): void;
  onFeatureSelect?(feature: GeoFeature | null, ctx: PluginContext): void;
}
```

- `registerPlugin(id: string, hooks: PluginHooks): void` — registers a plugin. `main.ts` calls this for `participate` when `app-manifest.json`'s `plugins.participate` is set.
- `getPanelSlots(): PanelSlot[]` — every registered plugin's `panelSlot`, if it declared one. `main.ts` mounts each into `#panel-right-actions`.
- `PluginContext` is deliberately read-only — a plugin can _read_ the current date/features/selection, but the only thing in this codebase allowed to mutate `AppState` is `store.set()` itself; plugins never get a `set()`.

**Known gap:** `dispatchDateChange`/`dispatchFilterChange`/`dispatchFeatureSelect` are implemented and unit-tested at the registry level, but `main.ts` never calls them — only `panelSlot` is actually wired into the live bootstrap today. A plugin implementing `onDateChange`/`onFilterChange`/`onFeatureSelect` would register successfully but those hooks would never fire in the running app.

---

## `ui/strings` — the i18n seam

`src/ui/strings.ts`.

- `loadStrings(path: string | undefined): Promise<Record<string, string>>` — fetches and parses a `strings.json`; returns `{}` if `path` is undefined.
- `t(key: string, strings: Record<string, string>, params?: Record<string, string>): string` — looks up `key`, falling back to the raw key if missing. If `params` is given, replaces `{paramName}` placeholders in whatever string was resolved (looked-up or fallback). See `docs/json-reference.md`'s `strings.json` section.

This is the seam every piece of user-facing text in `src/ui/` and `plugins/` is required to go through — no hardcoded display strings, enforced by convention (caught in review, not by a lint rule) throughout this project's history.

---

## `ui/panels` — pure logic used by the DOM-wiring layer

These are the testable, DOM-free building blocks the actual panel components (`SearchOverlay.ts`, `SelectionCard.ts`, `PanelRight.ts`, `CalendarBar.ts`, `LayerControl.ts`) are built from.

- `searchFeatures(features, query, searchableFields): GeoFeature[]` — `src/ui/panels/search.ts`. Case-insensitive substring match across the given property names. Empty query returns `[]` — `SearchOverlay.ts` shows nothing until the user types.
- `describeTemporalStatus(feature, date, strings, calendarSystem?): string` — `src/ui/panels/temporal-status.ts`. Human-readable status text ("Always active", "Active on {date}", "Not active on selected date (recurs: {rule})", etc.), fully routed through `t()`.
- `formatInfoFieldHtml(def, values): string` / `formatCoordinates(coords): { lat, lng }` / `isAllowedUrl(value): boolean` — `src/ui/panels/info-field-format.ts`. Rendering for `panel.infoFields` entries (see `docs/json-reference.md`) and the automatic lat/lng line; `isAllowedUrl` is the safety check restricting `link`/`image` fields to `http(s):`/`mailto:`.
- `escapeHtml(value: string): string` — `src/ui/escape-html.ts`. The one HTML-escaping helper; every data-derived string interpolated into `innerHTML` anywhere in `src/ui/` goes through this (feature names, taxonomy values, region names — anything that ultimately comes from third-party GeoJSON, not from `t()`-resolved trusted UI copy).
- `icons` — `src/ui/icons.ts`. A `Record<string, string>` of self-contained inline SVG markup strings (`search`, `close`, `filter`, `layers`, `chevron`, `pushpin`, `edit`). No external icon font, no CDN.

---

## Writing a plugin

`plugins/participate/` is the reference example (an external `mailto:`/`wa.me:`/`t.me:` link launcher, no backend). The shape:

1. A pure function building whatever the plugin needs from its config (`buildParticipateUrl(config, context)` in `plugins/participate/links.ts`) — keep this DOM-free and unit-testable, same as the `ui/panels` pure-logic functions above.
2. A `registerXPlugin(config, strings)` function that calls `registerPlugin(id, hooks)` with a `panelSlot` (if the plugin needs UI) whose `render(container, ctx)` builds real DOM, using `ctx: PluginContext` to read current app state and `t()` for any display text.
3. `main.ts` calls your `registerXPlugin(...)` when the corresponding key exists under `app-manifest.json`'s `plugins`, before `getPanelSlots()` runs.

Remember the read-only constraint: a plugin's `render`/hook functions can call `ctx.getSelectedDate()` etc., but must never reach into `AppState` and mutate it directly — there's currently no `store` access exposed to plugins at all, by design.
