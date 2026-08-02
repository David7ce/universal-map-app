# Universal Map-Time Engine — Core Design

Status: approved (v1 scope)
Date: 2026-07-26

## 1. Purpose

A reusable, static, browser-only engine that combines **space** (OpenStreetMap + Leaflet) and **time** (Gregorian calendar) as first-class, equal dimensions, with a left panel (search + info) and a right panel (dynamic filters: regions, categories, or any other dimension a dataset defines). Any third party should be able to build a new map-time app on top of the engine by writing a config (app manifest + layer manifests) and supplying data, without touching engine code.

This design is informed by an existing production site (`tenerife-comercio-astro` `/mapa`), which has the space dimension (Leaflet + OSM/Grafcan base layers, search overlay, region/category filter panel with tri-state selection, report view) but no time dimension. This engine generalizes that pattern and adds time as a core, equal citizen — including the insight that **regions themselves are time-dependent** (administrative boundaries are born, change, and die, same as any other feature).

## 2. Scope decisions (from stakeholder discussion)

- **Reusable engine**, not a single app. Core must not hardcode any project's field names, taxonomy, or region set.
- **Build tooling**: Vite + TypeScript. Builds to a plain static `dist/`; still zero cost, still just HTML/JS/CSS to host or run locally.
- **Time model**: must support instant, range, and recurrence — not just one.
- **Local runtime**: static server (Vite preview, `python -m http.server`, GitHub Pages, Netlify free tier, etc.), not literal `file://` double-click. This is required because `fetch()` of local JSON is blocked under `file://` by browser CORS rules, and the layer-loading standard depends on `fetch()`.
- **Geographic/temporal generality**: must work for any place in the world, any geolocation dataset, any time — but optimized for present/near-present use. Deep historical time is explicitly out of scope for v1 because regions themselves change too much across long spans to model simply.
- **Architecture**: hybrid (declarative core + plugin hooks), chosen over pure-declarative (no room for custom behavior) and pure-plugin (forces even simple apps to be JS code).

## 3. Module architecture

Two distinct meanings of "layer" appear in this document: **data layers** (map content — a set of geographic features, e.g. shops, boundaries) and **software modules** (engine code). This section covers software modules.

- **`engine/space`** — Leaflet adapter. Renders base layers (raster tile sources, OSM by default) and any data layer's geometry (point, line, polygon, boundary, heatmap), with clustering for point layers.
- **`engine/time`** — Calendar store (current selected date/range) plus the temporal resolver `isActiveOn(feature, date): boolean`. Every piece of temporal logic in the app funnels through this one function — no other module re-implements date logic.
- **`engine/taxonomy`** — Computes available filter dimensions and their values by scanning the taxonomy fields declared in loaded layer manifests. Implements the generic tri-state (all/some/none) selection behavior. Not aware of any specific dimension name (category, region, or otherwise) — dimensions are entirely data-driven.
- **`engine/region`** — Spatial join: given a point feature, a selected date, and the set of layers marked `regionRole: "boundary"` in the active app, determines which region(s) contain that point — respecting the boundary layer's own temporal validity via `engine/time`.
- **`engine/state`** — Single reactive store holding: selected date/range, active filter selections, selected feature, active base layer, panel open/closed state. Every other module reads from and reacts to this store; only `state` itself is mutated directly (plugins react to it but do not mutate it directly, to avoid plugins fighting each other).
- **`engine/plugins`** — Registry and lifecycle-hook dispatcher (see Section 7).
- **`ui/panels`** — Left panel (search / info, single slot, two modes), right panel (list of taxonomy filter sections, generated dynamically), calendar bar (bottom).

**Data flow**: app manifest references layer manifests → layer manifests are loaded via their declared `source.type` loader → `engine/time`, `engine/taxonomy`, `engine/region` compute derived visibility/membership per selected date and active filters → `engine/space` renders what's currently active → `ui/panels` reflect the same derived state.

## 4. Data standard

Base geometry format: **GeoJSON** (Feature / FeatureCollection). Chosen because it is native to Leaflet, has universal tooling support, is human-editable, and much existing open geodata is already in this format (only needs a manifest wrapper to become compatible).

Two conventions are layered on top of plain GeoJSON, both **optional per feature**:

### 4.1 Temporal — `properties.temporal`

```json
{
  "instant": "2026-03-14",
  "range": { "from": "2020-01-01", "to": "2023-06-30" },
  "recurrence": {
    "rule": "FREQ=WEEKLY;BYDAY=SU",
    "duration": "PT4H",
    "exceptions": ["2026-12-25"]
  }
}
```

- All three of `instant`, `range`, `recurrence` are optional and may combine (e.g., a range **and** a recurrence models "ran every Sunday, 2020–2023").
- A feature with no `temporal` property is always visible/active (e.g., a static basemap decoration).
- `range.from` and `range.to` are independently optional (open-ended: "since" or "until").
- `recurrence.rule` is an RFC 5545 RRULE **subset**: `FREQ`, `BYDAY`, `INTERVAL`, `UNTIL`, `COUNT` only. Full iCalendar spec support is explicitly out of scope.
- All date logic (does this feature count as active on date D) is resolved by exactly one function: `isActiveOn(feature, date)`.

### 4.2 Taxonomy and region

There is no reserved property name for category or region — real-world datasets use inconsistent field names ("category", "tipo", "sector", etc.). Instead, the **layer manifest** declares which property maps to which filter dimension (Section 5.1).

Region membership can be handled two ways, both supported:

1. **Explicit**: the feature already carries a region-identifying property, declared as a taxonomy field like any other.
2. **Spatial**: computed at render/filter time by joining against whichever layer(s) are marked `regionRole: "boundary"` in the active app, via `engine/region`, respecting that boundary layer's own temporal validity.

## 5. Manifests

### 5.1 Layer manifest

Describes how the engine should treat one data layer.

```json
{
  "id": "comercios",
  "title": "Comercios",
  "kind": "point",
  "source": { "type": "geojson", "url": "data/comercios.geojson" },
  "temporal": { "defaultVisibility": "time-filtered" },
  "taxonomy": [{ "id": "category", "label": "Category", "field": "properties.category", "hierarchical": true }],
  "regionRole": null,
  "style": { "cluster": true, "icon": "shop" },
  "panel": { "showInSearch": true, "showInInfo": true }
}
```

- `kind`: `"point" | "line" | "polygon" | "boundary" | "heatmap"`.
- `source.type`: extensible enum. v1 implements `"geojson"` (single static file) and `"geojson-sharded"` (array of file URLs, matching the legacy per-municipio split pattern). All loader types implement one interface: `fetchFeatures(source, bounds?, dateRange?) → Feature[]`. This is the documented seam for migrating to a real database later (Section 8) — a future `"api"` type would hit a REST/tile endpoint returning the same GeoJSON shape, filtered server-side by bbox/date, without any change to manifest schema, engine internals, or UI.
- A boundary/region layer is not a special type — it is a layer manifest with `"kind": "polygon"` and `"regionRole": "boundary"`, and nothing else distinguishes it. This is the concrete proof that regions are ordinary data, not a hardcoded concept.

### 5.2 App manifest

Describes one deployed app instance — what a third party writes to build an app on top of the engine.

```json
{
  "id": "demo",
  "title": "Demo Map",
  "map": { "center": [28.29, -16.62], "zoom": 10 },
  "baseLayers": [
    {
      "id": "osm",
      "title": "Callejero",
      "type": "raster-tile",
      "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      "attribution": "© OpenStreetMap contributors"
    }
  ],
  "dataLayers": ["layers/comercios.layer.json", "layers/municipios.layer.json"],
  "calendar": { "default": "today", "min": "2015-01-01", "max": "2030-12-31" },
  "strings": "strings.json",
  "plugins": []
}
```

Adding a new app = new folder, new app manifest, own layer manifests and data — zero engine code touched. Multiple base layers may be listed (OSM is always available at zero cost; others are the app author's choice and cost).

## 6. UI / panel layout

- **Left panel** — one slot, two modes: _search_ (query box + result list) and _info_ (selected feature's detail, including its temporal status — e.g. "active since 2020", "recurs every Sunday", "not active on the selected date"). Selecting a feature switches the slot to info mode instead of a small Leaflet popup, giving room for temporal detail.
- **Right panel** — dynamic list of taxonomy filter sections, one per dimension declared across the active app's layers (categories, regions, or anything else a layer manifest defines), each using the tri-state select-all/partial/none pattern.
- **Calendar bar** — horizontal strip, full width, docked at the bottom of the map stage: current date display, previous/next day stepper, range slider bounded by the app manifest's `calendar.min`/`calendar.max`, and a granularity toggle (day/week/month/year). No auto-play/animate-through-time in v1.
- **Map stage** — center, everything else docks around it.
- **Plugins** get a panel-actions slot (e.g., an extra button) for app-specific features; their internal content is entirely plugin-owned.

## 7. Plugin API

A thin registration surface keeps the core ignorant of plugin internals:

```ts
registerPlugin(id: string, {
  panelSlot?: { label, icon, render(container, ctx) },
  onDateChange?(date, ctx) {},
  onFilterChange?(activeFeatures, ctx) {},
  onFeatureSelect?(feature, ctx) {},
});
```

`ctx` is a read-only handle into `engine/state` (current date, active filters, selected feature, map instance). Plugins react to state; they do not mutate it directly. An app manifest's `plugins` array (e.g. `["participate"]`) activates registered plugins for that instance; plugin code lives under `/plugins/<id>/` and self-registers on import.

### 7.1 `participate` plugin (v1 scope)

An external-link launcher only: a panel button that opens a `mailto:` link (prefilled subject/body) or a `wa.me` / `t.me` deep link, optionally templated with context (selected feature, selected date). No form UI, no backend, no storage.

### 7.2 `informe` plugin

Out of scope for this spec — a future spec once the core engine and `participate` have proven the plugin API is sufficient.

## 8. Internationalization seam (not a framework)

All user-facing strings live in one `strings.json` per app instance (referenced by the app manifest's `strings` field), or a shared default if omitted. Engine and UI code never hardcode display text. Translating an app instance to another language means swapping that one file. Explicitly **not** built in v1: a locale-switcher UI, pluralization handling, or per-user language state.

## 9. Migration seam: static files to a real database

The `source.type` field on layer manifests (Section 5.1) is the designed extension point. v1 ships only file-based loaders (`geojson`, `geojson-sharded`). Moving a layer to a real backend later requires writing one new loader function conforming to `fetchFeatures(source, bounds?, dateRange?) → Feature[]` and adding a new `source.type` value — no change to the manifest schema, engine internals, or UI components. This is documented as the intended path; it is not implemented in v1.

## 10. Folder structure & build

```
universal-map-app/
  src/
    engine/
      space/       (Leaflet adapter, layer renderers, clustering)
      time/        (calendar store, isActiveOn resolver, RRULE subset parser)
      taxonomy/    (filter dimension computation, tri-state logic)
      region/      (spatial join against boundary layers)
      state/       (central reactive store)
      plugins/     (registry, hook dispatch)
    ui/
      panels/      (PanelLeft, PanelRight, CalendarBar, LayerControl)
      components/  (shared widgets)
    main.ts        (boots engine from an app manifest)
  apps/
    demo/
      app-manifest.json
      strings.json
      layers/*.layer.json
      data/*.geojson
  plugins/
    participate/   (built after core; see Section 7.1)
  docs/superpowers/specs/
  index.html
  vite.config.ts
  package.json
```

- Vite + TypeScript. `npm run dev` for local dev server; `npm run build` produces static `dist/`, servable by any free static host or locally via `vite preview` / `python -m http.server`.
- One Vite entry point for v1, serving a single app instance (`demo`). Multi-app-instance routing (Vite multi-page, or query-param app selection) is deferred until a second real app instance exists.
- Vitest for engine unit tests, with priority on `engine/time`'s resolver (instant/range/recurrence edge cases) — the area most likely to hide subtle bugs.

## 11. Non-goals for v1

- No backend, no database, no auth — pure static site.
- No write-back persistence in core. `participate` (Section 7.1) opens an external link; it does not submit or store data itself.
- No large-scale geo infrastructure (vector tiles, server-side spatial index). Client-side Leaflet + clustering only, adequate up to the tens-of-thousands-of-features scale seen in the reference site.
- No full RFC 5545 recurrence support — RRULE subset only (Section 4.1).
- No i18n runtime (locale switcher, pluralization) — only the strings-file seam (Section 8).
- No calendar auto-play/animate-through-time.
- No multi-app-instance routing.
- No deep historical time modeling — v1 targets present/near-present use; long historical spans need region-change modeling beyond this design's scope.

## 12. First reference instance

A minimal `demo` app instance (synthetic or small real dataset) is built first to validate the engine end-to-end. A second instance retrofitting the Tenerife comercio dataset (adding temporal fields to existing comercio/municipio data) is a natural follow-up once the core is proven, but is not part of this spec.
