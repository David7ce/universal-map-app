# JSON format reference

Field-by-field reference for the three JSON shapes the engine uses: the world manifest, the layer manifest, and the GeoJSON data (with the `temporal` extension). All of these live under `worlds/<world-id>/` — see `worlds/demo/` as a working reference instance.

Validated at runtime by `validateAppManifest` (`src/engine/manifests/app-manifest.ts`) and `validateLayerManifest` (`src/engine/manifests/layer-manifest.ts`), which check both required top-level fields and the shape of most optional nested ones (`map.crs`, `plugins.participate`, `regionRole`, `temporal.defaultVisibility`, `taxonomy` entries, `panel`/`infoFields`). `docs/schemas/*.schema.json` has the same shapes as JSON Schema, for editor autocomplete while authoring.

See `docs/api-reference.md` for the internal function/module API (not the JSON formats).

---

## `world.json`

One object per world instance, referenced from `src/main.ts` (currently with the path `/worlds/demo/world.json` hardcoded — see "Add a new world instance" in `README.md`).

| Field                           | Type                                               | Required                                                          | Description                                                                                                                                                                                                                                                                                |
| ------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                            | `string`                                           | yes                                                               | App identifier. Non-empty.                                                                                                                                                                                                                                                                 |
| `title`                         | `string`                                           | no (not enforced by validation, but always set it)                | Displayed app title.                                                                                                                                                                                                                                                                       |
| `map.center`                    | `[lat, lng]`                                       | no (not validated)                                                | Initial map center, Leaflet order `[lat, lng]` (**note:** the opposite order from GeoJSON coordinates, which are `[lng, lat]`).                                                                                                                                                            |
| `map.zoom`                      | `number`                                           | no (not validated)                                                | Initial zoom level.                                                                                                                                                                                                                                                                        |
| `map.crs`                       | `MapCrsConfig`                                     | no                                                                | Map projection. See "`map.crs` — projections" below. Defaults to Web Mercator (`EPSG:3857`, Leaflet/OSM's default) when omitted.                                                                                                                                                           |
| `baseLayers`                    | `BaseLayerConfig[]`                                | yes, at least 1 entry                                             | Base map layers (see table below). The first array element is the one active by default. With more than one entry, the layer-control popover (`LayerControl.ts`) shows a radio per base layer.                                                                                             |
| `dataLayers`                    | `string[]`                                         | yes (must be an array; may be empty)                              | Relative paths to this app's `layer.json` files, e.g. `"layers/poi.layer.json"`.                                                                                                                                                                                                           |
| `calendar.system`               | `"gregorian" \| "julian" \| "islamic" \| "hebrew"` | no                                                                | **Display only.** Which calendar the calendar bar shows dates in. Defaults to `"gregorian"`. Storage and all temporal computation (`isActiveOn`, RRULE matching, `calendar.min`/`max`/`default`) always stay Gregorian/ISO 8601 regardless of this setting — see "Calendar systems" below. |
| `calendar.default`              | `"today" \| string`                                | yes (`min`/`max` are required; `default` is validated if present) | Initial date. `"today"` seeds from the current date; otherwise must be an ISO date (`YYYY-MM-DD`) — `validateAppManifest` rejects anything else.                                                                                                                                           |
| `calendar.min` / `calendar.max` | `string` (ISO `YYYY-MM-DD`)                        | yes                                                               | Bounds for `CalendarBar.ts`'s date picker and range slider.                                                                                                                                                                                                                                |
| `strings`                       | `string`                                           | no                                                                | Relative path (inside the app's folder) to its `strings.json`. If omitted, `t()` always falls back to displaying the raw key.                                                                                                                                                              |
| `favicon`                       | `string`                                           | no                                                                | Relative path (inside the world's folder) to a favicon image, e.g. `"assets/favicon.png"`. If omitted, the default favicon (set in `index.html`) is kept.                                                                                                                                |
| `plugins.participate`           | `ParticipateConfig \| undefined`                   | no                                                                | See table below. If omitted, the "Participate" button doesn't appear.                                                                                                                                                                                                                      |
| `systems.time`                  | `boolean`                                          | no                                                                 | `false` hides all time/calendar UI (filters panel's Time section, the Map/Calendar view switcher, Settings' calendar-system row) — for a world with no temporal data. Defaults to `true` (shown) when omitted.                                                                                                                                                                              |
| `welcome`                       | `WelcomeConfig \| undefined`                       | no                                                                 | See table below. If omitted, the map is the initial view, same as before this field existed. If present, a one-way thematic splash (`WelcomeView.ts`) is the initial view instead — its CTA button switches to the map; nothing switches back.                                            |

### `BaseLayerConfig` (element of `baseLayers`)

| Field         | Type            | Description                                                                                                                      |
| ------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | `string`        | Base layer identifier — used as the key for `store.activeBaseLayerId` and to look up the active tile layer in `LayerControl.ts`. |
| `title`       | `string`        | Displayed next to its radio button in the layer control, and shown on the trigger button when active.                            |
| `type`        | `"raster-tile"` | Only value supported today.                                                                                                      |
| `url`         | `string`        | Tile URL, with the `{z}/{x}/{y}` placeholders Leaflet expects.                                                                   |
| `attribution` | `string`        | Attribution text shown in the footer strip when this layer is active.                                                            |
| `labelsUrl`   | `string`        | Optional. A second tile source rendered on top of `url` — e.g. a labels/reference layer over unlabeled satellite imagery, so place names still show. Not validated at runtime (same as `url`/`attribution`). |
| `labelsAttribution` | `string`  | Attribution for `labelsUrl`. Defaults to `attribution` when omitted.                                                             |

### `map.crs` — projections

| Value                               | Description                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"EPSG:3857"` (default, or omitted) | Web Mercator — Leaflet's own default, no code path taken.                                                                                                                                                                                                                                                                                                           |
| `"EPSG:4326"`                       | Plate Carrée / plain lat-lng — uses Leaflet's built-in `L.CRS.EPSG4326`, no new dependency.                                                                                                                                                                                                                                                                         |
| `"Simple"`                          | Flat pixel-space, no geographic meaning — uses Leaflet's built-in `L.CRS.Simple`. For indoor floor plans or game/fictional maps; GeoJSON coordinates are then just `[x, y]` in whatever unit your data uses, not lon/lat. `baseLayers` tiles served in a real geographic projection won't make sense here — that's on the app author, same as any other CRS choice. |
| `CustomCrsConfig` object            | Any other projection, via `proj4leaflet` (`L.Proj.CRS`). Fields: `proj4def` (a [proj4](https://proj.org/) definition string), `resolutions` (number array, one per zoom level), `origin` (`[x, y]`), `bounds` (optional, `[[minX,minY],[maxX,maxY]]`).                                                                                                              |

GeoJSON data is always WGS84 lon/lat regardless of `map.crs` — Leaflet reprojects at render time. You are responsible for choosing `baseLayers` tiles that are actually served in the projection you configure; the engine doesn't check this for you. See `src/engine/space/map-crs.ts`.

### `ParticipateConfig` (`plugins.participate`)

| Field             | Type                                  | Description                                                                                                                           |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `channel`         | `"email" \| "whatsapp" \| "telegram"` | Determines the generated link's scheme (`mailto:`, `https://wa.me/`, `https://t.me/`).                                                |
| `target`          | `string`                              | Email, WhatsApp number (no `+`), or Telegram user/bot, depending on `channel`.                                                        |
| `messageTemplate` | `string`                              | Message text. The `{{date}}` placeholder is replaced with the selected date (`YYYY-MM-DD`). Only the first occurrence is substituted. |

### `WelcomeConfig` (`welcome`)

| Field       | Type     | Required | Description                                                                                                                              |
| ----------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`     | `string` | yes      | Splash heading.                                                                                                                             |
| `tagline`   | `string` | yes      | One line under the title.                                                                                                                   |
| `ctaLabel`  | `string` | yes      | Button text. Clicking it sets `view` to `'map'` — the only way out of the splash.                                                          |
| `heroImage` | `string` | no       | Relative path (inside the world's folder) to a hero image, e.g. `"assets/hero.jpg"`. No hero section when omitted.                          |
| `itemNoun`  | `string` | no       | Pairs with a live count of every loaded feature across all `dataLayers` (e.g. `"8"` + `"haunted places"` → "8 haunted places"). No count line when omitted, or when the count is 0. |

---

## `layer.json`

One file per data layer, referenced from `world.json`'s `dataLayers`.

| Field                        | Type                                                        | Required | Description                                                                                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                         | `string`                                                    | yes      | Layer identifier.                                                                                                                                                                                                                                    |
| `title`                      | `string`                                                    | yes      | Layer title.                                                                                                                                                                                                                                         |
| `kind`                       | `"point" \| "line" \| "polygon" \| "boundary" \| "heatmap"` | yes      | See "Layer kinds" below.                                                                                                                                                                                                                             |
| `source`                     | `LayerSource`                                               | yes      | See table below.                                                                                                                                                                                                                                     |
| `temporal.defaultVisibility` | `"always" \| "time-filtered"`                               | no       | **Declared but not read by any code yet** — `isActiveOn` filtering always applies the same way regardless of this value.                                                                                                                             |
| `taxonomy`                   | `TaxonomyFieldDef[]`                                        | no       | Filter dimensions this layer contributes to the right-hand filters panel. See table below.                                                                                                                                                           |
| `regionRole`                 | `"boundary" \| null`                                        | no       | If `"boundary"`, this layer's features participate in `findContainingRegions()` (`src/engine/region/spatial-join.ts`) — they act as administrative boundaries with temporal validity, exactly like any other feature. `scripts/fetch-osm-boundary.mjs` fetches a real administrative boundary from OpenStreetMap to use as this kind of layer's source geojson, instead of hand-authoring one. |
| `style`                      | `Record<string, unknown>`                                   | no       | See "Style fields" below — which keys are read depends on `kind`.                                                                                                                                                                                    |
| `panel.showInSearch`         | `boolean`                                                   | no       | `false` excludes this layer's features entirely from the left panel (not searchable, not selectable). Defaults to `true`. Useful for purely visual layers like `regions` or a `heatmap` layer.                                                       |
| `panel.showInInfo`           | `boolean`                                                   | no       | **Declared but not read by any code yet** — has no observable effect today because there's no selection path that doesn't already go through `showInSearch` (e.g. no "click on the map to select" interaction exists).                               |
| `panel.infoFields`           | `{ field, label, type? }[]`                                 | no       | Extra properties shown on the selection card when a feature from this layer is selected. See "`infoFields`" below.                                                                                                                                   |
| `panel.showByDefault`        | `boolean`                                                   | no       | `false` makes the layer opt-in: hidden until the user turns it on via the layer control's "Map details" checkbox group (the same mechanism `heatmap` layers use). Defaults to `true` (always rendered, subject to the usual temporal/filter checks). |

### Layer kinds

| `kind`                                | Rendering                                                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `"point"`                             | `L.geoJSON`, clustered via `L.markerClusterGroup` if `style.cluster` is `true`.                                                           |
| `"heatmap"`                           | Density layer via `leaflet.heat`. Only uses features with `Point` geometry; other geometry types on a heatmap layer are silently skipped. |
| `"line"` / `"polygon"` / `"boundary"` | `L.geoJSON` with a real fill + border style (see "Style fields" below) — not Leaflet's raw, unstyled default.                             |

### `LayerSource` (the `source` field)

| `type`              | Extra fields     | Description                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"geojson"`         | `url: string`    | A single GeoJSON file, fetched whole.                                                                                                                                                                                                                                                                                         |
| `"geojson-sharded"` | `urls: string[]` | Several GeoJSON files, fetched and concatenated.                                                                                                                                                                                                                                                                              |
| `"api"`             | —                | **Reserved, not implemented.** Documented seam for a future backend-backed loader — `fetchFeatures(source, bounds?, dateRange?)` (`src/engine/data/loader-registry.ts`) already accepts optional `bounds`/`dateRange`, even though current loaders ignore them, so this signature won't need to change when it's implemented. |

### `TaxonomyFieldDef` (element of `taxonomy`)

| Field          | Type      | Description                                                                                                                                                                                                                      |
| -------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | `string`  | Filter-dimension identifier — the key used in the store's `activeFilters`. If two layers declare the same `id` with a different `label`, the first one processed wins (a known limitation).                                      |
| `label`        | `string`  | Label shown in the right-hand filters panel.                                                                                                                                                                                     |
| `field`        | `string`  | Dotted path inside the feature's `properties` (e.g. `"properties.category"`). This is how the engine avoids hardcoding field names — see `readField()`/`featureMatchesFilters()` in `src/engine/taxonomy/compute-dimensions.ts`. |
| `hierarchical` | `boolean` | **Declared but not read by any code yet.**                                                                                                                                                                                       |

### `infoFields` (element of `panel.infoFields`)

| Field   | Type                          | Description                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `field` | `string`                      | Dotted path inside `properties`, same convention as `taxonomy[].field`.                                                                                                                                                                                                                                                                                                                                                                |
| `label` | `string`                      | Label shown next to the value on the selection card.                                                                                                                                                                                                                                                                                                                                                                                   |
| `type`  | `"text" \| "link" \| "image"` | Defaults to `"text"` (a `<p><strong>Label:</strong> value</p>` line). `"link"` renders `<a href="value">Label</a>`; `"image"` renders the label plus an `<img>` — unless `field` resolves to **more than one** value (e.g. an array property), in which case it renders a clickable thumbnail grid that opens the shared full-screen lightbox (`src/ui/panels/Lightbox.ts`) with prev/next between them. For safety, `"link"`/`"image"` render as `<a>`/`<img>` for an `http(s):`/`mailto:` URL, or a same-origin relative path with no whitespace (e.g. a bundled world asset like `worlds/<id>/assets/photo.jpg`) — `isAllowedUrl()` in `src/ui/panels/info-field-format.ts`. Anything else (e.g. a `javascript:` value injected via feature data) falls back to plain text; for a gallery, unsafe values are dropped rather than falling back. |

Selecting a `Point` feature also always shows its `lat, lng` (5 decimals), automatically, with no configuration needed.

### Style fields

Read from the layer's `style` object; which ones apply depends on `kind`.

| `kind`                                | Field         | Type                 | Default     | Description                                                                                                                                          |
| ------------------------------------- | ------------- | -------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"point"`                             | `cluster`     | `boolean`            | `false`     | Group markers into clusters via `leaflet.markercluster`.                                                                                             |
| `"point"`                             | `icon`        | `string`             | `"default"` | Marker icon name (`resolveMarkerStyle()` in `src/engine/space/style.ts` — currently only resolves the name, doesn't map it to an actual icon asset). |
| `"point"`                             | `colorField`  | `string`              | none        | Dotted path into `properties` (same convention as `taxonomy[].field`). If set, colors a circular background behind the marker's icon — independent of `taxonomy`. |
| `"point"`                             | `colorMap`    | `Record<string, string>` (CSS color) | none | Maps `colorField`'s value to a color. Matches exactly, or (for a descriptive value like `"Media - Zona poco iluminada"`) against the part before the first `" - "`, so one entry (`"Media"`) covers every descriptive variant. |
| `"point"`                             | `defaultColor`| `string` (CSS color) | none        | Color for a `colorField` value with no `colorMap` entry (and no matching prefix). No `colorMap` at all means no background color anywhere, regardless of this. |
| `"point"`                             | `badgeField`  | `string`              | none        | Dotted path into `properties`. If set, shows a small corner badge on the marker for values present in `badgeMap` — sparse by design, most values get none. |
| `"point"`                             | `badgeMap`    | `Record<string, string>` (emoji/short text) | none | Maps `badgeField`'s value to a badge. Same exact-or-prefix matching as `colorMap`. A value not in the map (the common case, e.g. every priced event) gets no badge at all. |
| `"line"` / `"polygon"` / `"boundary"` | `color`       | `string` (CSS color) | `"#e08a3e"` | Border/stroke color.                                                                                                                                 |
| `"line"` / `"polygon"` / `"boundary"` | `weight`      | `number`             | `2`         | Border/stroke width in pixels.                                                                                                                       |
| `"line"` / `"polygon"` / `"boundary"` | `fillColor`   | `string` (CSS color) | `"#e08a3e"` | Fill color (ignored for `"line"`, which has no fill).                                                                                                |
| `"line"` / `"polygon"` / `"boundary"` | `fillOpacity` | `number` (0–1)       | `0.18`      | Fill opacity.                                                                                                                                        |

---

## Data: GeoJSON + `properties.temporal`

Data is standard GeoJSON `FeatureCollection`. The engine's only extension is `properties.temporal`, optional on every `Feature`.

```json
{
  "type": "Feature",
  "id": "poi-5",
  "properties": {
    "name": "Temporary Market",
    "category": "market",
    "temporal": {
      "range": { "from": "2024-01-01", "to": "2024-12-31" },
      "recurrence": { "rule": "FREQ=WEEKLY;BYDAY=SA" }
    }
  },
  "geometry": { "type": "Point", "coordinates": [-16.63, 28.28] }
}
```

- **Coordinates in standard GeoJSON order:** `[lng, lat]` — the opposite of `map.center` in the app manifest, which uses Leaflet's `[lat, lng]` order. A frequent source of bugs if the two get mixed up.
- `properties` can carry any app-specific fields (`name`, `category`, etc. in the demo) — these names are never hardcoded in `src/engine/`, they always come from `taxonomy[].field` / `infoFields[].field` in the `layer.json`.
- `properties.temporal` is optional. If absent, the feature is considered always active (`isActiveOn` returns `true`).

### `temporal` (object)

Its three keys are each independently optional and combinable — not mutually exclusive:

| Field                   | Type                                      | Semantics                                                                                                                            |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `instant`               | `string` (`YYYY-MM-DD`)                   | The feature is only active on that exact day.                                                                                        |
| `range.from`            | `string` (`YYYY-MM-DD`), optional         | Start of validity. If omitted, no lower bound.                                                                                       |
| `range.to`              | `string` (`YYYY-MM-DD`), optional         | End of validity (inclusive). If omitted, no upper bound.                                                                             |
| `recurrence.rule`       | `string` (RRULE subset, RFC 5545)         | See "`recurrence.rule`" below.                                                                                                       |
| `recurrence.duration`   | `string`, optional                        | **Declared in the type (`TemporalRecurrence`, `src/engine/time/temporal-types.ts`) but not read by `isActiveOn`/`matchesRule` yet.** |
| `recurrence.exceptions` | `string[]` (`YYYY-MM-DD` dates), optional | Specific dates excluded even though the rule would otherwise include them.                                                           |

If both `range` and `recurrence` are present (as in the example above), `range` acts as the overall validity window and also as the anchor for the recurrence's `INTERVAL`/`COUNT` (`range.from` is the anchor; if `recurrence.rule` uses `COUNT` with no `range.from`, `isActiveOn` throws instead of silently giving a wrong answer).

### `recurrence.rule` — supported RRULE subset

Parser in `src/engine/time/rrule-subset.ts`. Only these keys, all optional except `FREQ`:

| Key        | Supported values                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `FREQ`     | `DAILY`, `WEEKLY` — work. `MONTHLY`, `YEARLY` — the parser accepts them but `matchesRule` throws when actually matching (not implemented). |
| `BYDAY`    | Comma-separated list of `MO,TU,WE,TH,FR,SA,SU`.                                                                                            |
| `INTERVAL` | Integer. How many `FREQ` units apart occurrences repeat, anchored at `range.from`.                                                         |
| `UNTIL`    | Date in `YYYYMMDD` format (RRULE convention, no dashes) — end of the recurrence.                                                           |
| `COUNT`    | Integer. Number of occurrences, anchored at `range.from` (required if `COUNT` is used).                                                    |

Not supported: `BYSETPOS`, `BYMONTHDAY`, or the rest of RFC 5545.

---

## `strings.json`

Flat dictionary `{ "dotted.key": "text" }`, loaded by `loadStrings()` (`src/ui/strings.ts`) from the path given in `world.json`'s `strings`. Consumed via `t(key, strings, params?)`:

- If the key isn't in the dictionary, `t()` returns the key itself as-is (silent fallback — handy during development, but means a misspelled key gives no warning).
- `params` (optional) interpolates `{paramName}` inside the resolved text (or inside the key, if it fell back) — see `worlds/demo/strings.json` for the full list of keys the engine currently uses (`search.*`, `filters.*`, `layerControl.*`, `calendar.*`, `participate.*`, `info.*`, `temporalStatus.*`, `selection.*`).

---

## Calendar systems

`calendar.system` changes how dates are both _displayed_ and _edited_ in `CalendarBar.ts` — it never changes how they're stored or computed. Internally, `AppState.selectedDate` and every temporal computation (`isActiveOn`, RRULE matching, `calendar.min`/`max`/`default`) are always plain Gregorian ISO 8601 strings (`YYYY-MM-DD`). Conversion happens only in `src/engine/time/calendar-conversion.ts`: `toCalendarParts()`/`formatCalendarDate()` convert a Gregorian ISO date to the target system for display, and `calendarPartsToIso()` converts the other direction — year/month/day already expressed in the target system (e.g. typed into `CalendarBar.ts`'s fields) back to Gregorian ISO for the store.

- `"gregorian"` (default): no conversion, no extra label.
- `"islamic"` / `"hebrew"`: converted via `@js-temporal/polyfill`'s `Temporal.PlainDate`, constructed with (`calendarPartsToIso`) or converted to (`toCalendarParts`) the `islamic`/`hebrew` calendar.
- `"julian"`: the Julian calendar isn't in the Unicode/ICU calendar registry `Temporal`/`Intl` support, so it's implemented by hand (Fliegel & Van Flandern's Julian day number algorithm) in `src/engine/time/julian-calendar.ts`.

`CalendarBar.ts`'s year/month/day fields edit directly in `calendar.system`'s units (e.g. a Hijri year/month/day when `calendar.system` is `"islamic"`), bounded by `daysInCalendarMonth()`/`monthsInCalendarYear()` since islamic/hebrew months run 29-30 days depending on the year and a Hebrew leap year has 13 months. An impossible combination (e.g. day 30 in a 29-day month) is rejected rather than silently snapped to a nearby real date.

---

## Fields declared but not implemented yet (summary)

So you don't have to hunt for each one: these fields exist in the TypeScript types and pass validation if present, but no code reads them today. They're reserved for future use — setting them doesn't error, they just don't do anything yet:

- `layer.json`: `temporal.defaultVisibility`, `taxonomy[].hierarchical`, `panel.showInInfo`.
- Data: `properties.temporal.recurrence.duration`.
