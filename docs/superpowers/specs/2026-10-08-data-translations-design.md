# Translated world data via per-language override files

## Goal

A world's content (layer labels, taxonomy values, info-card text, feature
descriptions) can be shown in the visitor's language without duplicating the
data. The mechanism is generic; this change translates `world-leaders` into
English.

## Audience and success

- Audience: English and Spanish speaking visitors of any world.
- Success: with the language set to English, `world-leaders` shows no Spanish
  in filters, pills, info cards or layer names (proper names such as people and
  party names excepted); with Spanish nothing changes; a world with no English
  override files keeps working unchanged.

## Constraints

- Static, browser-only; no new dependencies; engine render code (filters,
  toolbar, search, info card, map styling) is not changed — it keeps reading
  the same manifest and feature shapes.
- The base files (`leaders.layer.json`, `leaders.geojson`) stay the source of
  truth for geometry, ids, portraits, flags, dates and structure.
- A missing override is not an error: the base (original-language) content is
  shown.

## Non-goals

- Translating the other three worlds' content (the mechanism supports them;
  their override files are future work).
- More than two languages; reactive switching (language change still reloads).
- Translating `geojson-sharded` sources (override files apply to `geojson`
  sources only).
- Translating proper names (people), flag emoji, URLs, portrait paths.

## Design

### Declaring the base language

`world.json` gains optional `contentLanguage: "en" | "es"` (validated in
`validateAppManifest`; default `"en"`). The four existing worlds are Spanish,
so each gets `"contentLanguage": "es"`. Overrides are only fetched when the
visitor's language differs from `contentLanguage`.

### Override files (convention over configuration)

For a layer file `layers/<name>.layer.json` and a `geojson` source
`data/<file>.geojson`, the override for language `<lang>` is:

- Layer override: `layers/<name>.layer.<lang>.json` — a partial layer manifest.
- Data override: `data/<file>.<lang>.json` — an object mapping feature `id` to
  the properties to replace, e.g.
  `{ "leader-es": { "role": "Prime Minister", "country": "Spain", "bio": "…" } }`.

### Merge rules (pure functions, unit-tested)

`mergeLayerOverride(base, override)`:

- Objects merge recursively; scalars and unmatched keys in the override
  replace the base value.
- Arrays of objects (`taxonomy`, `panel.infoFields`) merge element by element
  matched on `id` (taxonomy) or `field` (infoFields); matched entries merge
  recursively, so an override can change `label` and `icons` while `field`
  comes from the base. Entries only in the base are kept; entries only in the
  override are appended.
- `style.colorMap`, `style.badgeMap` and taxonomy `icons` objects in the
  override REPLACE the base object (their keys are the translated values, so
  the Spanish keys must not linger).
- `source` and `id` in an override are ignored.

`applyFeatureOverrides(features, overrides)`:

- For each feature whose `id` (as string) is a key of `overrides`, shallow-merge
  that object into `feature.properties`. `geometry`, `id` and
  `properties.temporal` are never changed. Unknown ids are ignored.

### Loading

In `main.ts`, layer loading goes through a helper
`loadLayer(appId, layerPath, language, contentLanguage)` that:

1. fetches and validates the base manifest;
2. when `language !== contentLanguage`, tries the layer override and (for
   `geojson` sources) the data override; each fetch that fails, is non-OK or is
   not valid JSON is skipped silently (dev servers may answer a missing file
   with an HTML fallback page);
3. returns `{ manifest: merged and re-validated, features: overridden }`.

The merged manifest is validated again so an override can't produce an invalid
layer.

### world-leaders content

- `worlds/world-leaders/world.json`: `"contentLanguage": "es"`.
- `layers/leaders.layer.en.json`: title "World Leaders"; taxonomy `role`
  (label "Position", icons keyed by the English role groups) and `continent`
  (label "Continent", icons keyed by English continents); `style.colorMap`
  keyed by English continents; `panel.infoFields` labels in English.
- `data/leaders.en.json`: for every one of the 81 leaders: `role`,
  `roleGroup`, `country`, `continent`, `bio` in English. `party` is kept in its
  original language except where a standard English name exists. English
  values: role groups "Presidency", "Head of Government", "Monarchy";
  continents "Europe", "Americas", "Asia", "Oceania", "Africa".

### Other worlds

Only `"contentLanguage": "es"` is added; no override files yet.

## Files

- Create `src/engine/data/layer-override.ts` (+ test): `mergeLayerOverride`,
  `applyFeatureOverrides`, `overridePaths`.
- Create `src/engine/data/load-layer.ts` (+ test): `loadLayer`.
- Modify `src/engine/manifests/app-manifest.ts` (+ test), `src/main.ts`,
  `worlds/*/world.json`, `docs/json-reference.md`,
  `docs/schemas/world.schema.json`, `README.md`, `CHANGELOG.md`.
- Create `worlds/world-leaders/layers/leaders.layer.en.json`,
  `worlds/world-leaders/data/leaders.en.json`.

## Testing

- Unit: merge rules above (nested objects, array merge by key, replace-vs-merge
  of `colorMap`/`icons`, base-only and override-only entries, ignored `source`
  and `id`); feature overrides (merge, unknown id, geometry/temporal untouched);
  override path derivation; `loadLayer` (override applied in a different
  language, skipped when equal to `contentLanguage`, silently ignores 404 /
  non-JSON / invalid merged manifest falls back to base with a console warning).
- Data: every `world-leaders` feature id has an English override with `role`,
  `roleGroup`, `country`, `continent` and `bio`; every English
  `roleGroup`/`continent` value has an English icon and colour entry; no
  English override value is empty.
- Browser (desktop and 375px, `es` and `en`): in `en`, `world-leaders` shows no
  Spanish in toolbar pills, drawer filters, info card, search and layer name;
  `es` is unchanged; other worlds unchanged in both languages.

## Open decisions (defaults chosen)

- Party names stay as written unless a standard English name exists.
- A failing override is skipped (with a console warning only when the file
  exists but is invalid), never blocks the world from loading.
