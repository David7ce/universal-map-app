# Multi-Projection (Multi-CRS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an app manifest declare `map.crs: 'EPSG:3857' | 'EPSG:4326' | CustomCrsConfig` so the map renders in that projection, while every other engine module (data-layer rendering, clustering, heatmap, region spatial-join, GeoJSON data files) stays completely unchanged — Leaflet already reprojects at render time via the active CRS.

**Architecture:** A new pure validation module (`src/engine/space/map-crs.ts`) defines the manifest shape and validates it, with zero dependency on Leaflet. A single resolution function in the existing `src/engine/space/map.ts` turns that config into an `L.CRS` instance and passes it to `L.map()`. `'EPSG:3857'` (the default) and `'EPSG:4326'` use Leaflet's own built-in CRS objects; anything else goes through the `proj4leaflet` plugin's `L.Proj.CRS`. Nothing else in the engine changes — GeoJSON data stays WGS84 lon/lat always, and every rendering/spatial-join code path that touches Leaflet's coordinate pipeline is already CRS-agnostic by construction.

**Tech Stack:** TypeScript, Vite, Vitest, Leaflet 1.9. New dependencies: `proj4leaflet` (runtime, wraps `proj4` for custom projections) and `@types/proj4leaflet` (dev).

## Global Constraints

- `map.crs` is optional in the manifest, default `'EPSG:3857'`. Omitting it must produce byte-for-byte the same rendered output as before this plan — `createMap()` must not even pass a `crs` option key to `L.map()` in that case (verified: this is the same code path as today).
- GeoJSON data is never reprojected by engine code. It stays WGS84 lon/lat in every `apps/*/data/*.geojson` file regardless of `map.crs` — Leaflet's own CRS-aware rendering pipeline handles projection at render time.
- `baseLayers` stays required (minimum 1 entry) regardless of `map.crs` — no relaxed validation for non-default projections. The app author is responsible for supplying a tile URL that is actually served in the configured projection; the engine does not and cannot validate tile/CRS compatibility.
- `resolutions` and `origin` are required (not defaulted) for a custom CRS object — there is no safe generic default, since both are provider/grid-specific.
- `src/engine/region/spatial-join.ts` and `src/engine/space/data-layer-renderer.ts` do not change in this plan — verified during design that both operate on raw GeoJSON coordinates or through Leaflet APIs that are already CRS-agnostic.
- `map.ts`'s new CRS-construction code touches Leaflet, which throws `ReferenceError: window is not defined` at plain `require`/`import` time under Node (confirmed directly) — it cannot be unit-tested under this project's Node-only Vitest setup, same as the rest of `map.ts` today. It is verified instead by a manual browser check (Task 3).
- Run `npx tsc --noEmit` and `npm test` after every task; both must be clean before moving on.
- Spec: `docs/superpowers/specs/2026-07-29-multi-projection-design.md`.

---

### Task 1: `map-crs.ts` — types and pure validation

**Files:**
- Create: `src/engine/space/map-crs.ts`
- Test: `src/engine/space/map-crs.test.ts`

**Interfaces:**
- Produces: `export interface CustomCrsConfig { proj4def: string; resolutions: number[]; origin: [number, number]; bounds?: [[number, number], [number, number]] }`, `export type MapCrsConfig = 'EPSG:3857' | 'EPSG:4326' | CustomCrsConfig;`, `export const KNOWN_CRS_IDS = ['EPSG:3857', 'EPSG:4326'] as const;`, `export function isValidMapCrsConfig(value: unknown): value is MapCrsConfig` — Task 2 imports `isValidMapCrsConfig`/`MapCrsConfig`; Task 3 imports `MapCrsConfig`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/engine/space/map-crs.test.ts
import { describe, expect, it } from 'vitest';
import { isValidMapCrsConfig } from './map-crs';

describe('isValidMapCrsConfig', () => {
  it('accepts the known named CRS ids', () => {
    expect(isValidMapCrsConfig('EPSG:3857')).toBe(true);
    expect(isValidMapCrsConfig('EPSG:4326')).toBe(true);
  });

  it('rejects an unknown named CRS id', () => {
    expect(isValidMapCrsConfig('EPSG:9999')).toBe(false);
  });

  it('accepts a valid custom CRS object', () => {
    expect(
      isValidMapCrsConfig({
        proj4def: '+proj=utm +zone=28 +datum=WGS84 +units=m +no_defs',
        resolutions: [8192, 4096, 2048],
        origin: [0, 0],
      })
    ).toBe(true);
  });

  it('accepts a valid custom CRS object with bounds', () => {
    expect(
      isValidMapCrsConfig({
        proj4def: '+proj=utm +zone=28 +datum=WGS84 +units=m +no_defs',
        resolutions: [8192, 4096, 2048],
        origin: [0, 0],
        bounds: [[0, 0], [1000000, 1000000]],
      })
    ).toBe(true);
  });

  it('rejects a custom CRS object missing proj4def', () => {
    expect(isValidMapCrsConfig({ resolutions: [8192], origin: [0, 0] })).toBe(false);
  });

  it('rejects a custom CRS object with an empty resolutions array', () => {
    expect(isValidMapCrsConfig({ proj4def: '+proj=longlat', resolutions: [], origin: [0, 0] })).toBe(false);
  });

  it('rejects a custom CRS object with a non-numeric resolutions entry', () => {
    expect(isValidMapCrsConfig({ proj4def: '+proj=longlat', resolutions: [8192, 'x'], origin: [0, 0] })).toBe(false);
  });

  it('rejects a custom CRS object with a malformed origin', () => {
    expect(isValidMapCrsConfig({ proj4def: '+proj=longlat', resolutions: [8192], origin: [0] })).toBe(false);
  });

  it('rejects a custom CRS object with malformed bounds', () => {
    expect(
      isValidMapCrsConfig({
        proj4def: '+proj=longlat',
        resolutions: [8192],
        origin: [0, 0],
        bounds: [[0, 0], [1, 'x']],
      })
    ).toBe(false);
  });

  it('rejects non-object, non-string values', () => {
    expect(isValidMapCrsConfig(null)).toBe(false);
    expect(isValidMapCrsConfig(42)).toBe(false);
    expect(isValidMapCrsConfig([])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/engine/space/map-crs.test.ts`
Expected: FAIL with "Cannot find module './map-crs'" (the file doesn't exist yet).

- [ ] **Step 3: Implement `map-crs.ts`**

```ts
// src/engine/space/map-crs.ts
export interface CustomCrsConfig {
  proj4def: string;
  resolutions: number[];
  origin: [number, number];
  bounds?: [[number, number], [number, number]];
}

export type MapCrsConfig = 'EPSG:3857' | 'EPSG:4326' | CustomCrsConfig;

export const KNOWN_CRS_IDS = ['EPSG:3857', 'EPSG:4326'] as const;

function isNumberPair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number';
}

export function isValidMapCrsConfig(value: unknown): value is MapCrsConfig {
  if (typeof value === 'string') {
    return (KNOWN_CRS_IDS as readonly string[]).includes(value);
  }
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;
  if (typeof obj.proj4def !== 'string' || obj.proj4def.length === 0) return false;
  if (!Array.isArray(obj.resolutions) || obj.resolutions.length === 0 || !obj.resolutions.every((r) => typeof r === 'number')) {
    return false;
  }
  if (!isNumberPair(obj.origin)) return false;
  if (obj.bounds !== undefined) {
    if (!Array.isArray(obj.bounds) || obj.bounds.length !== 2) return false;
    if (!isNumberPair(obj.bounds[0]) || !isNumberPair(obj.bounds[1])) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/engine/space/map-crs.test.ts`
Expected: PASS, all 10 tests green (verified during planning — this exact file and test suite were run for real before writing this plan).

Also run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/space/map-crs.ts src/engine/space/map-crs.test.ts
git commit -m "feat: add map.crs type and validation (EPSG:3857/EPSG:4326/custom)"
```

---

### Task 2: Wire `map.crs` into the app manifest

**Files:**
- Modify: `src/engine/manifests/app-manifest.ts`
- Test: `src/engine/manifests/manifests.test.ts`

**Interfaces:**
- Consumes: `isValidMapCrsConfig`, `type MapCrsConfig` from `../space/map-crs` (Task 1).
- Produces: `AppManifest['map']` gains `crs?: MapCrsConfig`; `validateAppManifest()` rejects an invalid `map.crs` the same way it already rejects an invalid `calendar.system` — Task 3 relies on `AppManifest['map']['crs']` being typed and pre-validated by the time `createMap()` reads it.

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/manifests/manifests.test.ts`, inside the existing `describe('validateAppManifest', ...)` block (after the last existing test, `'rejects an invalid calendar.system'`):

```ts
  it('accepts a valid map.crs named id', () => {
    const withCrs = { ...valid, map: { ...valid.map, crs: 'EPSG:4326' } };
    expect(validateAppManifest(withCrs)).toEqual(withCrs);
  });

  it('accepts a valid custom map.crs object', () => {
    const withCrs = {
      ...valid,
      map: {
        ...valid.map,
        crs: {
          proj4def: '+proj=utm +zone=28 +datum=WGS84 +units=m +no_defs',
          resolutions: [8192, 4096, 2048],
          origin: [0, 0],
        },
      },
    };
    expect(validateAppManifest(withCrs)).toEqual(withCrs);
  });

  it('rejects an invalid map.crs', () => {
    const invalid = { ...valid, map: { ...valid.map, crs: 'EPSG:9999' } };
    expect(() => validateAppManifest(invalid)).toThrow(/map\.crs/);
  });
```

- [ ] **Step 2: Run the tests and confirm the third one fails**

Run: `npx vitest run src/engine/manifests/manifests.test.ts`
Expected: `rejects an invalid map.crs` FAILS (nothing throws yet — `validateAppManifest` doesn't look at `map.crs` at all). The two accept tests pass trivially either way since nothing rejects them yet; that becomes meaningful once Step 3 adds real validation.

- [ ] **Step 3: Add `map.crs` to the type and validate it**

In `src/engine/manifests/app-manifest.ts`, add the import:

```ts
import { isValidMapCrsConfig, type MapCrsConfig } from '../space/map-crs';
```

Change:

```ts
  map: { center: [number, number]; zoom: number };
```

to:

```ts
  map: { center: [number, number]; zoom: number; crs?: MapCrsConfig };
```

Then add this validation block right after the existing `calendar.system` check (after the block that throws for an invalid `calendar.system`, before `return json as AppManifest;`):

```ts
  const map = obj.map as Record<string, unknown> | undefined;
  if (map?.crs !== undefined && !isValidMapCrsConfig(map.crs)) {
    throw new Error(`App manifest "${obj.id}" has invalid "map.crs": ${JSON.stringify(map.crs)}`);
  }
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/engine/manifests/manifests.test.ts`
Expected: PASS, all tests green (14 total: 11 existing + 3 new).

Also run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/manifests/app-manifest.ts src/engine/manifests/manifests.test.ts
git commit -m "feat: validate map.crs on the app manifest"
```

---

### Task 3: Resolve the CRS in `createMap()`

**Files:**
- Modify: `package.json`, `package-lock.json` (new dependencies)
- Modify: `src/engine/space/map.ts`

**Interfaces:**
- Consumes: `type MapCrsConfig` from `./map-crs` (Task 1); `AppManifest['map']['crs']` (Task 2, already validated by the time this code runs).
- Produces: `createMap()`'s existing signature and `CreatedMap` return type are unchanged — this task only changes `createMap()`'s internal behavior (which `L.CRS` the map is constructed with), not its public interface, so no other file needs to change.

- [ ] **Step 1: Install the dependencies**

```bash
npm install proj4leaflet
npm install --save-dev @types/proj4leaflet
```

Confirm `package.json` gained `"proj4leaflet": "^1.0.2"` (or newer) under `dependencies` and `"@types/proj4leaflet": "^1.0.12"` (or newer) under `devDependencies`, and `package-lock.json` updated.

- [ ] **Step 2: Implement the CRS resolution in `map.ts`**

There is no test step here — this code touches Leaflet, which throws `ReferenceError: window is not defined` under plain Node import, so it cannot run under this project's Vitest setup (confirmed directly during planning; same reason `map.ts` has no test file today). Correctness is verified in Step 3 (typecheck) and Step 4 (manual browser check) instead.

In `src/engine/space/map.ts`, add the import (this registers `L.Proj.CRS` as a side effect, same pattern this codebase already uses for `leaflet.heat`/`leaflet.markercluster`):

```ts
import 'proj4leaflet';
```

right after the existing `import L from 'leaflet';` line. Also add:

```ts
import type { MapCrsConfig } from './map-crs';
```

Add this function above `createMap`:

```ts
function resolveCrs(config: MapCrsConfig | undefined): L.CRS | undefined {
  if (config === undefined || config === 'EPSG:3857') return undefined;
  if (config === 'EPSG:4326') return L.CRS.EPSG4326;
  return new L.Proj.CRS('custom', config.proj4def, {
    resolutions: config.resolutions,
    origin: config.origin,
    ...(config.bounds ? { bounds: L.bounds(config.bounds[0], config.bounds[1]) } : {}),
  });
}
```

Change the first line of `createMap`:

```ts
  const map = L.map(container, { zoomControl: false }).setView(appManifest.map.center, appManifest.map.zoom);
```

to:

```ts
  const crs = resolveCrs(appManifest.map.crs);
  const map = L
    .map(container, { zoomControl: false, ...(crs ? { crs } : {}) })
    .setView(appManifest.map.center, appManifest.map.zoom);
```

`resolveCrs` returning `undefined` for the default/omitted case means the `crs` key is never added to the options object passed to `L.map()` (the spread of `{}` adds nothing) — this is what keeps the default path byte-identical to today's behavior.

- [ ] **Step 3: Typecheck and run the full suite**

Run: `npx tsc --noEmit`
Expected: no errors (verified during planning: this exact code, with the real `proj4leaflet`/`@types/proj4leaflet` packages installed, was typechecked successfully before writing this plan).

Run: `npm test`
Expected: all existing tests still pass (this task adds no new test file — `map.ts` remains untested, as it was before this plan, per the Global Constraints note on why).

- [ ] **Step 4: Manual verification in the browser**

Temporarily edit `apps/demo/app-manifest.json`'s `map` object to add `"crs": "EPSG:4326"`, then:

```bash
npm run dev
```

Open the printed local URL and confirm:
- The page does not throw a JS error and the map container renders (open the browser console — no uncaught exceptions).
- POI markers (e.g. "Ayuntamiento") still appear on the map and are clickable, opening the selection card as usual — this confirms the map's vector-rendering pipeline is correctly using the new CRS end-to-end, not just accepting the option without effect.
- The base tiles will look wrong or fail to load (broken-image icons / 404s in the Network tab) — **this is expected, not a bug.** `apps/demo`'s `baseLayers` (OpenStreetMap, Esri) serve standard Web Mercator (EPSG:3857) tiles; requesting them through an EPSG:4326 tile-grid math (different zoom/resolution scheme) will not produce geographically correct imagery. Per the design spec (Section 4) and this plan's Global Constraints, the engine does not validate tile/CRS compatibility — mismatched tiles are the app author's responsibility to fix by supplying a provider that actually serves that projection. The goal of this check is confirming the CRS wiring itself works (no crash, vector layers align and are interactive), not that arbitrary pre-existing tile URLs happen to look correct under a different projection.

Revert the temporary edit afterward — `git diff apps/demo/app-manifest.json` should show no changes before committing this task.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/engine/space/map.ts
git commit -m "feat: resolve map.crs into a Leaflet CRS in createMap()"
```

---

### Task 4: Docs and roadmap close-out

**Files:**
- Modify: `docs/json-reference.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `ROADMAP.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Document `map.crs` in `docs/json-reference.md`**

Find the row describing `map.zoom` (in the `app-manifest.json` table) and add a new row directly after it:

```markdown
| `map.crs` | `"EPSG:3857" \| "EPSG:4326" \| CustomCrsConfig` | no | Proyección del mapa (por defecto `"EPSG:3857"`, Web Mercator, la misma que usa Leaflet/OSM hoy). `"EPSG:4326"` usa el CRS plano/equirectangular incorporado en Leaflet, sin dependencia nueva. Cualquier otra proyección requiere un objeto `{ proj4def: string, resolutions: number[], origin: [number, number], bounds?: [[number,number],[number,number]] }`, resuelto vía `proj4leaflet` (`L.Proj.CRS`). Los datos GeoJSON siguen siendo siempre WGS84 lon/lat sin importar este campo — Leaflet reproyecta al momento de renderizar. `baseLayers` sigue siendo obligatorio: si se cambia de proyección, el autor de la app es responsable de que los tiles elegidos realmente se sirvan en esa proyección (el motor no lo valida). Ver `src/engine/space/map-crs.ts` y `src/engine/space/map.ts`. |
```

- [ ] **Step 2: Update `README.md`'s known deviations**

Replace this sentence:

```markdown
`CalendarBar.ts` now has a day/week/month/year granularity selector plus a range slider bounded by `calendar.min`/`calendar.max` (previously only a prev/next day stepper + native date picker), covering the design spec's Section 6 gap. Not yet done: multi-projection support — tracked in `ROADMAP.md`.
```

with:

```markdown
`CalendarBar.ts` now has a day/week/month/year granularity selector plus a range slider bounded by `calendar.min`/`calendar.max` (previously only a prev/next day stepper + native date picker), covering the design spec's Section 6 gap.
```

(This removes the now-stale "not yet done" pointer — both multi-calendar and multi-projection are implemented as of this plan.)

Then, in the same "Known v1 deviations" section, add a new paragraph after the existing `calendar.system` paragraph:

```markdown
`map.crs` (`docs/json-reference.md`) supports Leaflet's built-in `EPSG:3857`/`EPSG:4326` plus fully custom projections via `proj4leaflet`. It does not cover non-geographic "flat plane" pixel-space maps (indoor floor plans, game/fictional maps — Leaflet's `L.CRS.Simple`) — this iteration targets real-world geographic projections beyond Web Mercator specifically. `CRS.Simple` support remains a possible smaller future item.
```

- [ ] **Step 3: Add the CHANGELOG entry**

Add to `CHANGELOG.md`, after the `## Calendario multi-sistema (display): gregoriano, juliano, islámico, hebreo` section (matching this file's established append-at-bottom, newest-last convention):

```markdown
## Multi-proyección (display): EPSG:3857, EPSG:4326, proyecciones personalizadas

`app-manifest.json` acepta un `map.crs` opcional (`"EPSG:3857"` por defecto — Web Mercator, igual que hoy — o `"EPSG:4326"`, o un objeto personalizado `{ proj4def, resolutions, origin, bounds? }`). Los datos GeoJSON siguen siendo siempre WGS84 lon/lat; Leaflet reproyecta al momento de renderizar vía el CRS activo, así que ningún otro módulo del motor cambia (`data-layer-renderer.ts`, `spatial-join.ts`, clustering, mapa de calor — todos ya eran agnósticos a la proyección). `"EPSG:4326"` usa el CRS incorporado en Leaflet, sin dependencia nueva; cualquier otra proyección usa `proj4leaflet` (dependencia nueva, `L.Proj.CRS`). `baseLayers` sigue siendo obligatorio — el autor de la app es responsable de que los tiles elegidos realmente se sirvan en la proyección configurada. Ver `src/engine/space/map-crs.ts` y `src/engine/space/map.ts`.
```

- [ ] **Step 4: Remove the completed item from `ROADMAP.md`**

Remove only the `### Multi-proyección` heading and its paragraph, now that it's implemented. **Do not touch anything else in the file** — check its current content before editing: as of this plan's writing, `ROADMAP.md`'s `## Pendiente` section also holds two unrelated notes the project owner added directly (about the calendar's granularity UI, and a map tile-wrapping/repetition issue) that are not part of this plan and must be left exactly as they are. If those notes are no longer present when you do this step, that's fine — just remove the `### Multi-proyección` subsection and leave every other line in the file untouched.

- [ ] **Step 5: Full test suite and typecheck one more time**

Run: `npx tsc --noEmit && npm test`
Expected: no errors, all tests pass.

Run: `git status --short`
Expected: only the four doc files from Steps 1-4 are modified; `apps/demo/app-manifest.json` shows no changes (confirms Task 3 Step 4's temporary edit was reverted).

- [ ] **Step 6: Commit**

```bash
git add docs/json-reference.md README.md CHANGELOG.md ROADMAP.md
git commit -m "docs: document map.crs and close out the multi-projection roadmap item"
```

---

## Self-Review Notes

- **Spec coverage:** Section 2 (display-only, GeoJSON stays WGS84, no other module changes) → verified as a Global Constraint and Task 3's scope (only `map.ts` changes). Section 3 (manifest field, named + custom shapes) → Tasks 1-2. Section 4 (baseLayers stays required, author's responsibility) → Global Constraints + Task 4 docs. Section 5 (`map-crs.ts` module) → Task 1. Section 6 (CRS resolution in `map.ts`, new dependencies) → Task 3. Section 7 (testing approach, including the documented untestable seam) → Task 1's real unit tests, Task 3's manual browser check. Section 8 (known deviation: no `CRS.Simple`) → Task 4 docs. Section 9 (non-goals) → respected throughout.
- **Type consistency checked:** `MapCrsConfig`/`CustomCrsConfig` (Task 1) are the single source of truth, imported unchanged by `app-manifest.ts` (Task 2) and `map.ts` (Task 3) — neither redefines the shape. `isValidMapCrsConfig`'s accepted shape and `resolveCrs`'s handled cases match exactly (named ids + custom object with `proj4def`/`resolutions`/`origin`/optional `bounds`).
- **No placeholders:** every task's code blocks are complete and were actually run before this plan was written — `map-crs.ts`'s tests were executed for real (10/10 passing), and `map.ts`'s planned code (including the `proj4leaflet` import and `L.Proj.CRS`/`L.CRS.EPSG4326`/`L.bounds` calls) was typechecked against the real installed `proj4leaflet`/`@types/proj4leaflet` packages with zero errors before being written into this document.
