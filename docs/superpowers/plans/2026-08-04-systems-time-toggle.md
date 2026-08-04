# systems.time Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manifest-level `systems.time` boolean so a spatial-only world can disable the calendar/time UI and per-feature date filtering, without touching temporal capability for worlds that use it.

**Architecture:** A single `timeEnabled` flag is computed once in `main.ts` bootstrap from `appManifest.systems?.time !== false`, then threaded as a plain parameter into every mount/render function that needs it — no new store state, no new global. The date-filtering call sites that currently require a `Date` are widened to accept `Date | null`, with `null` meaning "skip date filtering entirely," short-circuiting through one shared helper so the "ignore `temporal` fields" behavior lives in exactly one place.

**Tech Stack:** TypeScript, Vitest, Vite. No new dependencies.

## Global Constraints

- `systems.time` defaults to `true` when `systems` or `systems.time` is absent — existing manifests (e.g. `apps/demo/app-manifest.json`) need zero changes.
- `calendar` stays a required `AppManifest` field even for time-disabled worlds (not narrowed to optional in this work).
- `findContainingRegions` and `PluginContext.getSelectedDate()` are untouched — out of scope per the spec's Non-goals.
- `main.ts`'s `timeEnabled` branches are not unit tested (no `main.test.ts` exists today, consistent with the prior plugin-activation wiring) — verified via full test suite + typecheck + build instead.

Full design: `docs/superpowers/specs/2026-08-04-systems-time-toggle-design.md`.

---

### Task 1: `systems.time` in the app manifest

**Files:**
- Modify: `src/engine/manifests/app-manifest.ts`
- Test: `src/engine/manifests/manifests.test.ts`

**Interfaces:**
- Produces: `AppManifest.systems?: { time?: boolean }` — read by later tasks as `appManifest.systems?.time !== false`.

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/manifests/manifests.test.ts`, inside the existing `describe('validateAppManifest', ...)` block (after the `plugins` cases added by the previous spec):

```ts
  it('accepts systems.time true and false', () => {
    expect(validateAppManifest({ ...valid, systems: { time: true } })).toEqual({ ...valid, systems: { time: true } });
    expect(validateAppManifest({ ...valid, systems: { time: false } })).toEqual({
      ...valid,
      systems: { time: false },
    });
  });

  it('accepts a manifest with no "systems" field at all', () => {
    expect(validateAppManifest(valid)).toEqual(valid);
  });

  it('rejects a non-boolean systems.time', () => {
    expect(() => validateAppManifest({ ...valid, systems: { time: 'yes' } })).toThrow(/systems\.time/);
  });

  it('rejects a "systems" that is not a plain object', () => {
    expect(() => validateAppManifest({ ...valid, systems: [] })).toThrow(/systems/);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/manifests/manifests.test.ts`
Expected: the two new rejection cases (`'yes'`, `[]`) FAIL — `validateAppManifest` doesn't inspect `systems` yet, so nothing throws. The two acceptance cases pass already (nothing rejects an unknown field today), which is fine — they exist to pin the shape, not to prove new behavior.

- [ ] **Step 3: Implement**

In `src/engine/manifests/app-manifest.ts`, add to the `AppManifest` interface (after `plugins?: Record<string, unknown>;`):

```ts
  systems?: { time?: boolean };
```

Add validation after the existing `plugins` check (which ends with the closing `}` of `if (obj.plugins !== undefined) { ... }`):

```ts
  if (obj.systems !== undefined) {
    if (typeof obj.systems !== 'object' || obj.systems === null || Array.isArray(obj.systems)) {
      throw new Error(`App manifest "${obj.id}" "systems" must be a plain object`);
    }
    const systems = obj.systems as Record<string, unknown>;
    if (systems.time !== undefined && typeof systems.time !== 'boolean') {
      throw new Error(`App manifest "${obj.id}" "systems.time" must be a boolean`);
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/manifests/manifests.test.ts`
Expected: PASS, all cases including the two new rejections.

- [ ] **Step 5: Commit**

```bash
git add src/engine/manifests/app-manifest.ts src/engine/manifests/manifests.test.ts
git commit -m "feat: add systems.time to the app manifest"
```

---

### Task 2: Date-filtering short-circuit in `compute-dimensions.ts`

**Files:**
- Modify: `src/engine/taxonomy/compute-dimensions.ts`
- Test: `src/engine/taxonomy/taxonomy.test.ts`

**Interfaces:**
- Consumes: `isActiveOn(feature: GeoFeature, date: Date): boolean` from `src/engine/time/is-active-on.ts` (unchanged).
- Produces:
  - `isFeatureVisibleOn(date: Date | null, feature: GeoFeature): boolean` — `date === null` short-circuits to `true`, otherwise defers to `isActiveOn`. Single source of truth for the "null means unfiltered" rule; Task 3 reuses it.
  - `filterActiveFeatures(features: GeoFeature[], date: Date | null, manifest: LayerManifest, activeFilters: Record<string, Set<string>>): GeoFeature[]` — combines `isFeatureVisibleOn` with the existing `featureMatchesFilters`. Consumed by Task 3's `data-layer-renderer.ts`.
  - `computeTaxonomyDimensions(layers: LoadedLayer[], date: Date | null): TaxonomyDimension[]` — signature change from `date: Date`.

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/taxonomy/taxonomy.test.ts`, inside `describe('computeTaxonomyDimensions', ...)`:

```ts
  it('counts every feature, ignoring temporal fields, when date is null', () => {
    const dims = computeTaxonomyDimensions([layer()], null);
    const category = dims[0];
    expect(category.values).toEqual(
      expect.arrayContaining([
        { value: 'shop', count: 2 },
        { value: 'market', count: 1 },
      ]),
    );
  });
```

Add a new `describe` block for the new exports, after the `computeTaxonomyDimensions` block:

```ts
describe('filterActiveFeatures', () => {
  const manifest: LayerManifest = {
    id: 'poi',
    title: 'POI',
    kind: 'point',
    source: { type: 'geojson', url: '/x' },
    taxonomy: [{ id: 'category', label: 'Category', field: 'properties.category' }],
  };

  function feature(id: string, properties: Record<string, unknown>): GeoFeature {
    return { type: 'Feature', id, properties, geometry: { type: 'Point', coordinates: [0, 0] } };
  }

  it('excludes a feature outside its temporal range on a real date', () => {
    const features = [feature('1', { category: 'shop', temporal: { instant: '2020-01-01' } })];
    const result = filterActiveFeatures(features, new Date('2026-01-01T00:00:00Z'), manifest, {});
    expect(result).toEqual([]);
  });

  it('includes every feature regardless of temporal fields when date is null', () => {
    const features = [feature('1', { category: 'shop', temporal: { instant: '2020-01-01' } })];
    const result = filterActiveFeatures(features, null, manifest, {});
    expect(result.map((f) => f.id)).toEqual(['1']);
  });

  it('still applies activeFilters when date is null', () => {
    const features = [feature('1', { category: 'shop' }), feature('2', { category: 'market' })];
    const result = filterActiveFeatures(features, null, manifest, { category: new Set(['market']) });
    expect(result.map((f) => f.id)).toEqual(['2']);
  });
});
```

Update the top import line of `taxonomy.test.ts` to also pull in `filterActiveFeatures`:

```ts
import { computeTaxonomyDimensions, featureMatchesFilters, filterActiveFeatures, type LoadedLayer } from './compute-dimensions';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/taxonomy/taxonomy.test.ts`
Expected: FAIL — `filterActiveFeatures` isn't exported yet (import error), and `computeTaxonomyDimensions([layer()], null)` doesn't type-check/behave correctly yet (TS will actually fail to compile before vitest runs any assertions, which is the correct RED here — confirm the failure is "not defined" / type error, not an assertion mismatch).

- [ ] **Step 3: Implement**

In `src/engine/taxonomy/compute-dimensions.ts`, add after `featureMatchesFilters`:

```ts
export function isFeatureVisibleOn(date: Date | null, feature: GeoFeature): boolean {
  return date === null || isActiveOn(feature, date);
}

export function filterActiveFeatures(
  features: GeoFeature[],
  date: Date | null,
  manifest: LayerManifest,
  activeFilters: Record<string, Set<string>>,
): GeoFeature[] {
  return features.filter((f) => isFeatureVisibleOn(date, f) && featureMatchesFilters(f, manifest, activeFilters));
}
```

Change `computeTaxonomyDimensions`'s signature and its date check:

```ts
export function computeTaxonomyDimensions(layers: LoadedLayer[], date: Date | null): TaxonomyDimension[] {
```

```ts
      for (const feature of layer.features) {
        if (!isFeatureVisibleOn(date, feature)) continue;
```

(replacing the existing `if (!isActiveOn(feature, date)) continue;` line).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/taxonomy/taxonomy.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/engine/taxonomy/compute-dimensions.ts src/engine/taxonomy/taxonomy.test.ts
git commit -m "feat: null-date short-circuit for taxonomy/feature date filtering"
```

---

### Task 3: Thread `Date | null` through the map-rendering path

**Files:**
- Modify: `src/engine/space/leaflet/data-layer-renderer.ts`
- Modify: `src/engine/space/map-adapter.ts`
- Modify: `src/engine/space/leaflet/leaflet-map-adapter.ts`

**Interfaces:**
- Consumes: `filterActiveFeatures` and `isFeatureVisibleOn` from Task 2 (`src/engine/taxonomy/compute-dimensions.ts`).
- Produces: `renderDataLayer(map, manifest, features, date: Date | null, activeFilters, onFeatureClick?): L.Layer` (was `date: Date`); `MapAdapter.renderDataLayer(...)`'s `date` param is `Date | null` (was `Date`). Consumed by Task 4's `main.ts`.

No test file exists for this task — `data-layer-renderer.ts` needs a real Leaflet map instance to render into, and the test environment is `node`, not `jsdom` (unchanged from before this work; the behavior that matters is already covered by Task 2's `filterActiveFeatures` tests). Verified via typecheck.

- [ ] **Step 1: Update `data-layer-renderer.ts`**

In `src/engine/space/leaflet/data-layer-renderer.ts`:

Replace the import line:

```ts
import { featureMatchesFilters, readField } from '../../taxonomy/compute-dimensions';
```

with:

```ts
import { filterActiveFeatures, readField } from '../../taxonomy/compute-dimensions';
```

Remove the now-unused `import { isActiveOn } from '../../time/is-active-on';` line.

Change the signature and filter line:

```ts
export function renderDataLayer(
  map: L.Map,
  manifest: LayerManifest,
  features: GeoFeature[],
  date: Date | null,
  activeFilters: Record<string, Set<string>> = {},
  onFeatureClick?: (feature: GeoFeature) => void,
): L.Layer {
  const active = filterActiveFeatures(features, date, manifest, activeFilters);
```

- [ ] **Step 2: Update `map-adapter.ts`**

In `src/engine/space/map-adapter.ts`, change the `renderDataLayer` method signature in the `MapAdapter` interface:

```ts
  renderDataLayer(
    id: string,
    manifest: LayerManifest,
    features: GeoFeature[],
    date: Date | null,
    activeFilters: Record<string, Set<string>>,
    onFeatureClick?: (feature: GeoFeature) => void,
  ): void;
```

- [ ] **Step 3: Update `leaflet-map-adapter.ts`**

In `src/engine/space/leaflet/leaflet-map-adapter.ts`, change the `RenderedLayerParams` interface's `date` field:

```ts
interface RenderedLayerParams {
  manifest: LayerManifest;
  features: GeoFeature[];
  date: Date | null;
  activeFilters: Record<string, Set<string>>;
  onFeatureClick?: (feature: GeoFeature) => void;
}
```

No other line in this file changes — `renderDataLayer(id, manifest, features, date, activeFilters, onFeatureClick)` and the `setCrs` replay loop both already just forward `date` untouched, so they pick up the widened type automatically.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (This will show call-site errors in `main.ts` until Task 4 updates them — if so, that's expected; re-run after Task 4.)

- [ ] **Step 5: Commit**

```bash
git add src/engine/space/leaflet/data-layer-renderer.ts src/engine/space/map-adapter.ts src/engine/space/leaflet/leaflet-map-adapter.ts
git commit -m "refactor: accept Date | null through the map data-layer render path"
```

---

### Task 4: Wire `timeEnabled` through bootstrap and the panels

**Files:**
- Modify: `src/main.ts`
- Modify: `src/ui/app-chrome.ts`
- Modify: `src/ui/panels/PanelRight.ts`
- Modify: `src/ui/panels/SearchOverlay.ts`

**Interfaces:**
- Consumes: `AppManifest.systems` (Task 1), `computeTaxonomyDimensions(layers, date: Date | null)` (Task 2), `MapAdapter.renderDataLayer(..., date: Date | null, ...)` (Task 3).
- Produces: `mountPanelRight(container, store, layers, strings, timeEnabled: boolean): void` (new 5th param); `mountSearchOverlay(container, store, layers, strings, timeEnabled: boolean): void` (new 5th param).

No new automated test — this is bootstrap/UI wiring with no existing test file for `main.ts`, consistent with the plugin-activation wiring done previously. Verified via full test suite (regression check), typecheck, lint, and a production build.

- [ ] **Step 1: `main.ts` — compute `timeEnabled` and gate calendar loading**

Replace:

```ts
  const appManifest = validateAppManifest(await fetchJson(`apps/${appId}/app-manifest.json`));

  // Only islamic/hebrew calendars pull in @js-temporal/polyfill (a sizable
  // dependency); kick the load off now so it runs in parallel with the
  // fetches below, and await it right before the first consumer needs it.
  const calendarSystemLoaded = ensureCalendarSystemLoaded(appManifest.calendar.system ?? 'gregorian');
```

with:

```ts
  const appManifest = validateAppManifest(await fetchJson(`apps/${appId}/app-manifest.json`));
  const timeEnabled = appManifest.systems?.time !== false;

  // Only islamic/hebrew calendars pull in @js-temporal/polyfill (a sizable
  // dependency); kick the load off now so it runs in parallel with the
  // fetches below, and await it right before the first consumer needs it.
  // Skipped entirely for a time-disabled world — there's no calendar UI to
  // need it, regardless of what "calendar.system" says.
  const calendarSystemLoaded = timeEnabled
    ? ensureCalendarSystemLoaded(appManifest.calendar.system ?? 'gregorian')
    : Promise.resolve();
```

- [ ] **Step 2: `main.ts` — pass `null` date to `renderDataLayer` when time is disabled**

Replace:

```ts
      mapAdapter.renderDataLayer(
        layer.manifest.id,
        layer.manifest,
        layer.features,
        date,
        state.activeFilters,
        onFeatureClick,
      );
```

with:

```ts
      mapAdapter.renderDataLayer(
        layer.manifest.id,
        layer.manifest,
        layer.features,
        timeEnabled ? date : null,
        state.activeFilters,
        onFeatureClick,
      );
```

- [ ] **Step 3: `main.ts` — pass `timeEnabled` to `PanelRight`/`SearchOverlay`, skip `CalendarBar`**

Replace:

```ts
  await calendarSystemLoaded;
  mountPanelRight(document.querySelector('#panel-right-filters')!, store, loadedLayers, strings);
  mountSearchOverlay(document.querySelector('#search-overlay')!, store, loadedLayers, strings);
  mountLayerControl(document.querySelector('#layer-control')!, store, strings, {
    mapAdapter,
    baseLayerConfigs: appManifest.baseLayers,
    detailLayers: detailLayers.map((l) => ({ id: l.manifest.id, title: l.manifest.title })),
  });
  // Time editor and map-settings button both live inline inside the
  // filters panel now, not as standalone floating controls.
  mountCalendarBar(document.querySelector('#panel-right-time')!, store, appManifest.calendar, strings, loadedLayers);
```

with:

```ts
  await calendarSystemLoaded;
  mountPanelRight(document.querySelector('#panel-right-filters')!, store, loadedLayers, strings, timeEnabled);
  mountSearchOverlay(document.querySelector('#search-overlay')!, store, loadedLayers, strings, timeEnabled);
  mountLayerControl(document.querySelector('#layer-control')!, store, strings, {
    mapAdapter,
    baseLayerConfigs: appManifest.baseLayers,
    detailLayers: detailLayers.map((l) => ({ id: l.manifest.id, title: l.manifest.title })),
  });
  // Time editor and map-settings button both live inline inside the
  // filters panel now, not as standalone floating controls. Not mounted at
  // all for a time-disabled world — #panel-right-time stays an empty div.
  if (timeEnabled) {
    mountCalendarBar(document.querySelector('#panel-right-time')!, store, appManifest.calendar, strings, loadedLayers);
  }
```

- [ ] **Step 4: `app-chrome.ts` — skip `mountDateText` when time is disabled**

Replace:

```ts
export function mountAppChrome(
  store: Store<AppState>,
  strings: Record<string, string>,
  appManifest: AppManifest,
  mapAdapter: MapAdapter,
  loadedLayers: LoadedLayer[],
): void {
  mountRightPanel(store, strings);
  mountDateText(store);
  mountAttribution(store, appManifest);
  mountScaleIndicator(mapAdapter);
  mountPluginSlots(store, loadedLayers);
}
```

with:

```ts
export function mountAppChrome(
  store: Store<AppState>,
  strings: Record<string, string>,
  appManifest: AppManifest,
  mapAdapter: MapAdapter,
  loadedLayers: LoadedLayer[],
): void {
  mountRightPanel(store, strings);
  if (appManifest.systems?.time !== false) mountDateText(store);
  mountAttribution(store, appManifest);
  mountScaleIndicator(mapAdapter);
  mountPluginSlots(store, loadedLayers);
}
```

- [ ] **Step 5: `PanelRight.ts` — accept `timeEnabled`, pass `null` date when disabled**

Replace:

```ts
export function mountPanelRight(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>,
): void {
```

with:

```ts
export function mountPanelRight(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>,
  timeEnabled: boolean,
): void {
```

Replace:

```ts
    const date = new Date(`${store.get().selectedDate}T00:00:00Z`);
    const dimensions = computeTaxonomyDimensions(layers, date);
```

with:

```ts
    const date = timeEnabled ? new Date(`${store.get().selectedDate}T00:00:00Z`) : null;
    const dimensions = computeTaxonomyDimensions(layers, date);
```

- [ ] **Step 6: `SearchOverlay.ts` — accept `timeEnabled`, omit the temporal-status line when disabled**

Replace:

```ts
export function mountSearchOverlay(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>,
): void {
```

with:

```ts
export function mountSearchOverlay(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>,
  timeEnabled: boolean,
): void {
```

Replace:

```ts
    infoEl.innerHTML = `<p>${describeTemporalStatus(feature, date, strings, state.calendarSystem)}</p>${regionLine}${coordinatesLine}${infoFieldLines}`;
```

with:

```ts
    const temporalStatusLine = timeEnabled
      ? `<p>${describeTemporalStatus(feature, date, strings, state.calendarSystem)}</p>`
      : '';
    infoEl.innerHTML = `${temporalStatusLine}${regionLine}${coordinatesLine}${infoFieldLines}`;
```

`date` itself (used for `findContainingRegions` and, when `timeEnabled` is true, `describeTemporalStatus`) is left as the unconditional `new Date(...)` already built at the top of `renderInfo` — untouched, per the spec's Non-goal on `findContainingRegions`.

- [ ] **Step 7: Run the full verification suite**

Run, in order:

```bash
npx vitest run
npx tsc --noEmit
npx eslint .
npm run build
```

Expected: all four pass clean — vitest all-green (existing suite plus Tasks 1–2's new cases), no type errors, no lint errors, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/main.ts src/ui/app-chrome.ts src/ui/panels/PanelRight.ts src/ui/panels/SearchOverlay.ts
git commit -m "feat: wire systems.time through bootstrap, PanelRight, and SearchOverlay"
```

---

### Task 5: Update CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add an entry**

Add a new section after the `## Generic, manifest-driven plugin activation` entry (top of the file's history, matching the existing newest-first convention):

```markdown
## `systems.time` toggle for spatial-only worlds

`AppManifest.systems?.time` (default `true`) lets a world with no meaningful temporal dimension disable the calendar/time UI entirely: `CalendarBar` isn't mounted, the `@js-temporal/polyfill` calendar-system load is skipped, the footer date text and each feature's "active since…" status line don't render, and every feature is treated as always-visible regardless of any `temporal` field on it (design: `docs/superpowers/specs/2026-08-04-systems-time-toggle-design.md`). The date-filtering call sites that used to require a `Date` (`renderDataLayer`, `computeTaxonomyDimensions`) now accept `Date | null`, with `null` meaning "skip date filtering," short-circuited through one shared `isFeatureVisibleOn` helper in `compute-dimensions.ts`.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: log systems.time toggle in CHANGELOG"
```
