# `systems.time` toggle — Design

Status: approved
Date: 2026-08-04

## 1. Purpose

Add a manifest-level `systems.time` toggle so a spatial-only world (e.g. a tourism map with no meaningful temporal dimension) can disable the calendar/time UI and per-feature date filtering entirely, without deleting any temporal capability for worlds that do use it. This is the second sub-project of the larger `feature-request-world-def.md` initiative (see `docs/superpowers/specs/2026-08-04-plugin-registry-design.md` for the first, the plugin registry).

`systems.space` and `systems.events` from `feature-request-world-def.md` are explicitly out of scope — neither has a concrete use case yet (the map is always core UI; "events" isn't a defined subsystem anywhere in the current codebase). This spec covers `systems.time` only; the manifest shape leaves room for siblings later without a breaking change.

## 2. Manifest shape

`AppManifest` gains:

```ts
systems?: { time?: boolean };
```

`time` defaults to `true` when `systems` is absent, or `systems.time` is absent. `validateAppManifest` checks only that `systems`, if present, is a plain object, and that `systems.time`, if present, is a boolean — it does not know about `space`/`events` and doesn't need to; an unrecognized key inside `systems` is silently ignored, same open-bag treatment as `plugins`.

`apps/demo/app-manifest.json` is a temporal world and needs no change — absent `systems` means `time: true`, matching its current always-on behavior.

## 3. Bootstrap wiring (`src/main.ts`)

```ts
const timeEnabled = appManifest.systems?.time !== false;
```

computed once, right after `validateAppManifest`. When `false`:

- `ensureCalendarSystemLoaded(...)` is not called — no `@js-temporal/polyfill` fetch is kicked off, regardless of what `calendar.system` says (irrelevant with no calendar UI to display it).
- `mountCalendarBar(...)` is not called — no time editor, no calendar grid.

`store`'s `selectedDate` field is unchanged and still initialized from `appManifest.calendar.default` as today — the type stays required (`AppState.selectedDate: string`), just semantically inert for the rest of bootstrap when `timeEnabled` is false. `appManifest.calendar` itself remains a required manifest field (unchanged from today) even for time-disabled worlds; a spatial-only world manifest still supplies a nominal `calendar.default`/`min`/`max`, they're simply unused. No manifest-shape change to `calendar` — narrowing it to optional is out of scope for this slice.

## 4. Filtering bypass

`isActiveOn(feature, date)` already returns `true` when a feature has no `temporal` field — but a `systems.time:false` world should ignore a `temporal` field even if one is mistakenly present on a layer, not just tolerate its absence. Rather than change `isActiveOn` itself, every real call site gets an explicit "unfiltered" path:

- New pure function `filterActiveFeatures(features, date: Date | null, manifest, activeFilters)` in `src/engine/taxonomy/compute-dimensions.ts` (alongside the existing `featureMatchesFilters`, no Leaflet dependency): `null` skips the `isActiveOn` half of the predicate (short-circuits to `true`), `featureMatchesFilters` still applies as normal. `data-layer-renderer.ts`'s current inline filter (line 18) is replaced with a call to it — this also makes the filter itself unit-testable, which it currently isn't (`data-layer-renderer.ts` has no test file today; it requires a real Leaflet map instance to render into, and the test environment is `node`, not `jsdom`).
- `src/engine/taxonomy/compute-dimensions.ts`: `computeTaxonomyDimensions`'s `date` param becomes `Date | null`, using the same `filterActiveFeatures` short-circuit, so the filters panel's per-taxonomy-value counts also stop excluding features by date.
- `src/engine/space/leaflet/leaflet-map-adapter.ts`: `MapAdapter.renderDataLayer`'s `date` param becomes `Date | null`, forwarded unchanged to `renderLeafletDataLayer` and to the `setCrs` replay path.

`main.ts`'s `renderMap()` passes `timeEnabled ? date : null` to `mapAdapter.renderDataLayer(...)`; `PanelRight.ts`'s taxonomy-count computation passes the same conditional value instead of always reading `store.get().selectedDate`.

`findContainingRegions` (`spatial-join.ts`) and `calendar-grid.ts`'s `hasActiveFeatureOn` are untouched — the former isn't a temporal filter (region containment, not date-based visibility), the latter is only reachable through `CalendarBar`, which isn't mounted when `timeEnabled` is false.

## 5. UI display

Two more places show date-derived text independent of `CalendarBar`'s own DOM, and need their own `timeEnabled` guard in `main.ts`/their mount call:

- `src/ui/app-chrome.ts`'s footer date text (`mountDateText`) is not mounted when `timeEnabled` is false.
- `src/ui/panels/SearchOverlay.ts`'s temporal-status line (via `temporal-status.ts`'s `describeTemporalStatus`, which calls `isActiveOn` directly) is not rendered per-feature when `timeEnabled` is false.

`PluginContext.getSelectedDate()` (`app-chrome.ts`) keeps returning the store's static init value unchanged — a time-disabled world's plugins that call it get a harmless placeholder ISO date. Fixing that contract for plugins that care about time is out of scope here (see Non-goals).

## 6. Testing

- `src/engine/manifests/manifests.test.ts`: gains cases — `systems.time` boolean accepted (`true`/`false`), absent `systems` still valid, non-boolean `systems.time` rejected, non-object `systems` rejected.
- `src/engine/taxonomy/taxonomy.test.ts` (existing file, already covers `compute-dimensions.ts`): new cases for `filterActiveFeatures`/`computeTaxonomyDimensions` with `date: null` — every feature passing the non-date filters is included, even ones with a `temporal` field that would exclude them on a real date.
- `data-layer-renderer.ts` itself stays untested directly (unchanged from today — needs a real Leaflet map instance, `jsdom` isn't configured), but its filtering now delegates to the unit-tested `filterActiveFeatures`, so the behavior that matters is covered.
- `src/main.ts` wiring (the `timeEnabled` branch itself — skipping `ensureCalendarSystemLoaded`/`mountCalendarBar`/`mountDateText`) is not unit tested, consistent with `main.ts` having no test file today (same as the plugin-activation wiring in the previous spec).

## 7. Non-goals

- `systems.space`, `systems.events`, or any other `systems.*` key — no concrete use case yet, deferred until one exists.
- Making `calendar` an optional manifest field for time-disabled worlds — the field stays required, just unused, to avoid widening `validateAppManifest`'s branching for this slice.
- Changing what `PluginContext.getSelectedDate()` returns or how plugins should behave in a time-disabled world — plugins that need a real date should simply not be declared in a `systems.time:false` world's manifest for now.
- A demo spatial-only world fixture under `apps/` — this spec's tests cover the engine-level bypass logic directly; wiring it into a real second demo app is left for whenever one is actually needed.
