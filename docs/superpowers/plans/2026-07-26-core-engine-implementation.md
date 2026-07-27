# Universal Map-Time Engine — Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1 universal space+time map engine described in `docs/superpowers/specs/2026-07-26-universal-map-time-engine-design.md`: a static, browser-only app where any third party can add a new app instance (map + calendar + panels) by writing manifests and GeoJSON data, with zero engine code changes.

**Architecture:** Layered modules under `src/engine/` (time, data loaders, manifests, state, taxonomy, region, space, plugins) consumed by `src/ui/` panels and wired together in `src/main.ts`, which boots one app instance (`apps/demo/`) from its app-manifest. Pure logic (temporal resolution, taxonomy, region join, manifests, loaders, plugin registry) is TDD'd with Vitest; DOM/Leaflet wiring is verified manually in a browser via the dev server, per project convention for UI code.

**Tech Stack:** Vite + TypeScript, Vitest, Leaflet + leaflet.markercluster, `@turf/boolean-point-in-polygon`. No backend, no bundler plugins beyond Vite defaults, no CSS framework (hand-written CSS grid).

## Global Constraints

- Static output only — `npm run build` must produce a `dist/` servable by any static file server; no backend, no database, no server-side code anywhere in this plan.
- Base geometry format is GeoJSON; temporal data lives in `properties.temporal` with optional `instant` / `range` / `recurrence` keys, each independently optional and combinable.
- RRULE subset only: `FREQ` (DAILY or WEEKLY implemented; MONTHLY/YEARLY parse but are rejected at match time), `BYDAY`, `INTERVAL`, `UNTIL`, `COUNT`. No BYSETPOS, no BYMONTHDAY, no full RFC 5545.
- `INTERVAL` and `COUNT` on a recurrence are resolved relative to an anchor date. The anchor is `temporal.range.from` when present; if `COUNT` is set and no `range.from` exists, `matchesRule` throws (no silent wrong answer).
- No hardcoded taxonomy/region field names anywhere in `src/engine/` — all field mapping comes from layer manifests.
- Plugins read `PluginContext` but never mutate `AppState` directly; only `src/engine/state/store.ts`'s `set()` mutates state.
- All user-facing UI strings are looked up via `t(key, strings)` from a per-app `strings.json` — no hardcoded display text in `src/ui/`.
- Dependencies stay minimal: `leaflet`, `leaflet.markercluster`, `@turf/boolean-point-in-polygon` at runtime; `typescript`, `vite`, `vitest`, `@types/leaflet`, `@types/geojson`, `@types/node` (needed for `vite.config.ts`'s build-time Node API usage, e.g. `node:fs`, `node:path`, `process`) at dev-time. Do not add other packages without updating this plan.
- `fetchFeatures(source, bounds?, dateRange?)` keeps its 3-argument shape even though v1 loaders ignore `bounds`/`dateRange` — this is the documented seam for a future server-backed loader (spec Section 9).

---

## File Structure

```
universal-map-app/
  package.json, tsconfig.json, vite.config.ts, index.html
  src/
    styles.css
    main.ts
    engine/
      time/
        temporal-types.ts
        rrule-subset.ts (+ .test.ts)
        is-active-on.ts (+ .test.ts)
      data/
        source-types.ts
        loaders/geojson-loader.ts
        loaders/geojson-sharded-loader.ts
        loader-registry.ts (+ .test.ts)
      manifests/
        layer-manifest.ts
        app-manifest.ts
        manifests.test.ts
      state/
        store.ts (+ .test.ts)
      taxonomy/
        compute-dimensions.ts
        tri-state.ts
        taxonomy.test.ts
      region/
        spatial-join.ts (+ .test.ts)
      space/
        style.ts (+ .test.ts)
        map.ts
        data-layer-renderer.ts
      plugins/
        registry.ts (+ .test.ts)
    ui/
      strings.ts (+ .test.ts)
      panels/
        search.ts (+ .test.ts)
        temporal-status.ts (+ .test.ts)
        PanelLeft.ts
        PanelRight.ts
        CalendarBar.ts
    types/
      leaflet-markercluster.d.ts
  plugins/
    participate/
      links.ts (+ .test.ts)
      index.ts
  apps/
    demo/
      app-manifest.json
      strings.json
      layers/poi.layer.json
      layers/regions.layer.json
      data/poi.geojson
      data/regions.geojson
  docs/superpowers/{specs,plans}/
  README.md
```

Rationale: each engine module is one responsibility (time math, loading, validation, state, taxonomy, spatial join, rendering, plugin dispatch), matching the spec's module list exactly. UI wiring is separated from pure logic (`search.ts`/`temporal-status.ts` vs `PanelLeft.ts`) so the parts that can be unit-tested are, and the DOM-only parts stay small and easy to eyeball.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/styles.css`, `src/main.ts`

**Interfaces:**
- Produces: a working `npm run dev` / `npm run build` / `npm test` toolchain that every later task builds on.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "universal-map-app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "leaflet": "^1.9.4",
    "leaflet.markercluster": "^1.5.3",
    "@turf/boolean-point-in-polygon": "^7.1.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4",
    "@types/leaflet": "^1.9.14",
    "@types/geojson": "^7946.0.14"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` written, no errors.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "plugins"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Universal Map</title>
  </head>
  <body>
    <div id="app">
      <aside id="panel-left"></aside>
      <div id="map"></div>
      <aside id="panel-right"></aside>
      <div id="calendar-bar"></div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/styles.css`**

```css
html, body, #app {
  height: 100%;
  margin: 0;
  font-family: system-ui, sans-serif;
}

#app {
  display: grid;
  grid-template-columns: 280px 1fr 280px;
  grid-template-rows: 1fr auto;
}

#map { grid-column: 2; grid-row: 1; }
#panel-left { grid-column: 1; grid-row: 1 / span 2; overflow-y: auto; border-right: 1px solid #ccc; }
#panel-right { grid-column: 3; grid-row: 1 / span 2; overflow-y: auto; border-left: 1px solid #ccc; }
#calendar-bar { grid-column: 2; grid-row: 2; border-top: 1px solid #ccc; padding: 0.5rem; }
```

- [ ] **Step 7: Create minimal `src/main.ts`** (replaced fully in Task 15; this just proves the toolchain works end to end)

```ts
import './styles.css';

document.querySelector<HTMLDivElement>('#map')!.textContent = 'Universal Map — engine not wired yet';
```

- [ ] **Step 8: Verify the build works**

Run: `npm run build`
Expected: exits 0, `dist/index.html` and `dist/assets/*.js` exist.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/styles.css src/main.ts
git commit -m "chore: scaffold Vite + TypeScript project"
```

---

### Task 2: Temporal types and RRULE-subset parser

**Files:**
- Create: `src/engine/time/temporal-types.ts`
- Create: `src/engine/time/rrule-subset.ts`
- Test: `src/engine/time/rrule-subset.test.ts`

**Interfaces:**
- Produces: `Temporal`, `GeoFeature` types (used by every later task that touches feature data); `parseRule(rule: string): ParsedRule`, `matchesRule(parsed: ParsedRule, date: Date, anchor?: Date): boolean`, `parseIsoDateUtc(iso: string): Date` (used by Task 3's `isActiveOn`).

- [ ] **Step 1: Create `src/engine/time/temporal-types.ts`**

```ts
export interface TemporalRecurrence {
  rule: string;
  duration?: string;
  exceptions?: string[];
}

export interface Temporal {
  instant?: string;
  range?: { from?: string; to?: string };
  recurrence?: TemporalRecurrence;
}

export interface GeoFeature {
  type: 'Feature';
  id?: string | number;
  geometry: GeoJSON.Geometry;
  properties: Record<string, unknown> & { temporal?: Temporal };
}
```

- [ ] **Step 2: Write the failing test for `parseRule`/`matchesRule`**

Create `src/engine/time/rrule-subset.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseRule, matchesRule, parseIsoDateUtc } from './rrule-subset';

describe('parseRule', () => {
  it('parses FREQ, BYDAY, INTERVAL, UNTIL, COUNT', () => {
    const parsed = parseRule('FREQ=WEEKLY;BYDAY=SU,WE;INTERVAL=2;UNTIL=2026-12-31;COUNT=10');
    expect(parsed).toEqual({
      freq: 'WEEKLY',
      interval: 2,
      byDay: ['SU', 'WE'],
      until: parseIsoDateUtc('2026-12-31'),
      count: 10,
    });
  });

  it('defaults interval to 1 when omitted', () => {
    expect(parseRule('FREQ=DAILY').interval).toBe(1);
  });

  it('throws on missing FREQ', () => {
    expect(() => parseRule('BYDAY=SU')).toThrow(/FREQ/);
  });

  it('throws on unsupported FREQ', () => {
    expect(() => parseRule('FREQ=SECONDLY')).toThrow(/FREQ/);
  });
});

describe('matchesRule', () => {
  it('matches every Sunday for FREQ=WEEKLY;BYDAY=SU with no anchor', () => {
    const rule = parseRule('FREQ=WEEKLY;BYDAY=SU');
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-15'))).toBe(true);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-16'))).toBe(false);
  });

  it('respects UNTIL', () => {
    const rule = parseRule('FREQ=WEEKLY;BYDAY=SU;UNTIL=2026-03-15');
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-15'))).toBe(true);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-22'))).toBe(false);
  });

  it('respects INTERVAL=2 relative to an anchor week', () => {
    const rule = parseRule('FREQ=WEEKLY;BYDAY=SU;INTERVAL=2');
    const anchor = parseIsoDateUtc('2026-03-01');
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-01'), anchor)).toBe(true);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-08'), anchor)).toBe(false);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-15'), anchor)).toBe(true);
  });

  it('throws when COUNT is set without an anchor', () => {
    const rule = parseRule('FREQ=WEEKLY;BYDAY=SU;COUNT=3');
    expect(() => matchesRule(rule, parseIsoDateUtc('2026-03-15'))).toThrow(/COUNT requires/);
  });

  it('respects COUNT relative to an anchor', () => {
    const rule = parseRule('FREQ=WEEKLY;BYDAY=SU;COUNT=2');
    const anchor = parseIsoDateUtc('2026-03-01');
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-01'), anchor)).toBe(true);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-08'), anchor)).toBe(true);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-15'), anchor)).toBe(false);
  });

  it('rejects FREQ=MONTHLY at match time (parses, but unsupported for matching)', () => {
    const rule = parseRule('FREQ=MONTHLY');
    expect(() => matchesRule(rule, parseIsoDateUtc('2026-03-01'))).toThrow(/not supported/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/engine/time/rrule-subset.test.ts`
Expected: FAIL — `Cannot find module './rrule-subset'`.

- [ ] **Step 4: Implement `src/engine/time/rrule-subset.ts`**

```ts
export type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface ParsedRule {
  freq: Freq;
  interval: number;
  byDay?: string[];
  until?: Date;
  count?: number;
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = MS_PER_DAY * 7;
const EPOCH = new Date('1970-01-01T00:00:00Z');
const SUPPORTED_MATCH_FREQ: Freq[] = ['DAILY', 'WEEKLY'];

export function parseIsoDateUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function parseRule(rule: string): ParsedRule {
  const parts: Record<string, string> = {};
  for (const pair of rule.split(';')) {
    const [key, value] = pair.split('=');
    if (key && value) parts[key] = value;
  }

  const freq = parts.FREQ as Freq;
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) {
    throw new Error(`Unsupported or missing FREQ in rule: "${rule}"`);
  }

  return {
    freq,
    interval: parts.INTERVAL ? Number(parts.INTERVAL) : 1,
    byDay: parts.BYDAY ? parts.BYDAY.split(',') : undefined,
    until: parts.UNTIL ? parseIsoDateUtc(parts.UNTIL) : undefined,
    count: parts.COUNT ? Number(parts.COUNT) : undefined,
  };
}

function startOfWeekUtc(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() - copy.getUTCDay());
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function matchesPattern(parsed: ParsedRule, date: Date, anchor: Date): boolean {
  if (parsed.byDay && parsed.freq === 'WEEKLY') {
    if (!parsed.byDay.includes(DAY_CODES[date.getUTCDay()])) return false;
  }
  if (parsed.freq === 'DAILY') {
    const daysSinceAnchor = Math.round((date.getTime() - anchor.getTime()) / MS_PER_DAY);
    return daysSinceAnchor % parsed.interval === 0;
  }
  const weeksSinceAnchor = Math.round(
    (startOfWeekUtc(date).getTime() - startOfWeekUtc(anchor).getTime()) / MS_PER_WEEK
  );
  return weeksSinceAnchor % parsed.interval === 0;
}

function countOccurrencesUpTo(parsed: ParsedRule, anchor: Date, date: Date): number {
  let count = 0;
  for (let t = anchor.getTime(); t <= date.getTime(); t += MS_PER_DAY) {
    if (matchesPattern(parsed, new Date(t), anchor)) count += 1;
  }
  return count;
}

export function matchesRule(parsed: ParsedRule, date: Date, anchor?: Date): boolean {
  if (!SUPPORTED_MATCH_FREQ.includes(parsed.freq)) {
    throw new Error(`FREQ=${parsed.freq} is not supported for matching in the v1 RRULE subset (only DAILY, WEEKLY)`);
  }
  if (parsed.count !== undefined && !anchor) {
    throw new Error('COUNT requires temporal.range.from as an anchor date');
  }
  if (parsed.until && date.getTime() > parsed.until.getTime()) return false;

  const effectiveAnchor = anchor ?? EPOCH;
  if (date.getTime() < effectiveAnchor.getTime()) return false;
  if (!matchesPattern(parsed, date, effectiveAnchor)) return false;

  if (parsed.count !== undefined) {
    if (countOccurrencesUpTo(parsed, effectiveAnchor, date) > parsed.count) return false;
  }

  return true;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/engine/time/rrule-subset.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/time/temporal-types.ts src/engine/time/rrule-subset.ts src/engine/time/rrule-subset.test.ts
git commit -m "feat: add RRULE-subset parser and matcher"
```

---

### Task 3: `isActiveOn` temporal resolver

**Files:**
- Create: `src/engine/time/is-active-on.ts`
- Test: `src/engine/time/is-active-on.test.ts`

**Interfaces:**
- Consumes: `GeoFeature`, `parseRule`, `matchesRule`, `parseIsoDateUtc` from Task 2.
- Produces: `isActiveOn(feature: GeoFeature, date: Date): boolean` — the single function every other module uses to decide if a feature counts on a given date.

- [ ] **Step 1: Write the failing test**

Create `src/engine/time/is-active-on.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isActiveOn } from './is-active-on';
import type { GeoFeature, Temporal } from './temporal-types';

function feature(temporal?: Temporal): GeoFeature {
  return {
    type: 'Feature',
    id: 'f1',
    properties: { temporal },
    geometry: { type: 'Point', coordinates: [0, 0] },
  };
}

describe('isActiveOn', () => {
  it('is always active when temporal is absent', () => {
    expect(isActiveOn(feature(undefined), new Date('2026-01-01T00:00:00Z'))).toBe(true);
  });

  it('matches an instant exactly', () => {
    const f = feature({ instant: '2026-03-14' });
    expect(isActiveOn(f, new Date('2026-03-14T00:00:00Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2026-03-15T00:00:00Z'))).toBe(false);
  });

  it('respects an open-ended range', () => {
    const f = feature({ range: { from: '2020-01-01' } });
    expect(isActiveOn(f, new Date('2019-12-31T00:00:00Z'))).toBe(false);
    expect(isActiveOn(f, new Date('2020-01-01T00:00:00Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2099-01-01T00:00:00Z'))).toBe(true);
  });

  it('respects a bounded range', () => {
    const f = feature({ range: { from: '2018-01-01', to: '2023-06-30' } });
    expect(isActiveOn(f, new Date('2023-06-30T00:00:00Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2023-07-01T00:00:00Z'))).toBe(false);
  });

  it('resolves recurrence using range.from as the anchor', () => {
    const f = feature({
      range: { from: '2026-03-01', to: '2026-12-31' },
      recurrence: { rule: 'FREQ=WEEKLY;BYDAY=SU' },
    });
    expect(isActiveOn(f, new Date('2026-03-08T00:00:00Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2026-03-09T00:00:00Z'))).toBe(false);
    expect(isActiveOn(f, new Date('2026-02-01T00:00:00Z'))).toBe(false);
  });

  it('skips exception dates', () => {
    const f = feature({
      range: { from: '2026-03-01' },
      recurrence: { rule: 'FREQ=WEEKLY;BYDAY=SU', exceptions: ['2026-03-08'] },
    });
    expect(isActiveOn(f, new Date('2026-03-01T00:00:00Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2026-03-08T00:00:00Z'))).toBe(false);
    expect(isActiveOn(f, new Date('2026-03-15T00:00:00Z'))).toBe(true);
  });

  it('gives instant precedence over range/recurrence if both are present', () => {
    const f = feature({ instant: '2026-03-14', range: { from: '2020-01-01' } });
    expect(isActiveOn(f, new Date('2026-03-14T00:00:00Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2026-03-15T00:00:00Z'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/time/is-active-on.test.ts`
Expected: FAIL — `Cannot find module './is-active-on'`.

- [ ] **Step 3: Implement `src/engine/time/is-active-on.ts`**

```ts
import type { GeoFeature } from './temporal-types';
import { parseRule, matchesRule, parseIsoDateUtc } from './rrule-subset';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isActiveOn(feature: GeoFeature, date: Date): boolean {
  const temporal = feature.properties.temporal;
  if (!temporal) return true;

  if (temporal.instant) {
    return parseIsoDateUtc(temporal.instant).getTime() === date.getTime();
  }

  const from = temporal.range?.from ? parseIsoDateUtc(temporal.range.from) : undefined;
  const to = temporal.range?.to ? parseIsoDateUtc(temporal.range.to) : undefined;

  if (from && date.getTime() < from.getTime()) return false;
  if (to && date.getTime() > to.getTime()) return false;

  if (temporal.recurrence) {
    if (temporal.recurrence.exceptions?.includes(isoDate(date))) return false;
    const parsed = parseRule(temporal.recurrence.rule);
    return matchesRule(parsed, date, from);
  }

  return true;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/time/is-active-on.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/time/is-active-on.ts src/engine/time/is-active-on.test.ts
git commit -m "feat: add isActiveOn temporal resolver"
```

---

### Task 4: Data source loaders

**Files:**
- Create: `src/engine/data/source-types.ts`
- Create: `src/engine/data/loaders/geojson-loader.ts`
- Create: `src/engine/data/loaders/geojson-sharded-loader.ts`
- Create: `src/engine/data/loader-registry.ts`
- Test: `src/engine/data/loader-registry.test.ts`

**Interfaces:**
- Consumes: `GeoFeature` from Task 2.
- Produces: `LayerSource` type, `fetchFeatures(source: LayerSource, bounds?: BBox, dateRange?: DateRange): Promise<GeoFeature[]>` — used by Task 15's bootstrap.

- [ ] **Step 1: Create `src/engine/data/source-types.ts`**

```ts
export type LayerSource =
  | { type: 'geojson'; url: string }
  | { type: 'geojson-sharded'; urls: string[] };

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface DateRange {
  from?: string;
  to?: string;
}
```

- [ ] **Step 2: Write the failing test**

Create `src/engine/data/loader-registry.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFeatures } from './loader-registry';

function mockFetchOnce(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      statusText: ok ? 'OK' : 'Server Error',
      json: async () => body,
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchFeatures', () => {
  it('loads a single geojson FeatureCollection', async () => {
    mockFetchOnce({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', id: 'a', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }],
    });
    const features = await fetchFeatures({ type: 'geojson', url: '/data/a.geojson' });
    expect(features).toHaveLength(1);
    expect(features[0].id).toBe('a');
  });

  it('throws a descriptive error on a failed fetch', async () => {
    mockFetchOnce({}, false);
    await expect(fetchFeatures({ type: 'geojson', url: '/data/missing.geojson' })).rejects.toThrow(/500/);
  });

  it('merges shards for geojson-sharded sources', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', id: 'a', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', id: 'b', properties: {}, geometry: { type: 'Point', coordinates: [1, 1] } }],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const features = await fetchFeatures({ type: 'geojson-sharded', urls: ['/data/1.json', '/data/2.json'] });
    expect(features.map((f) => f.id)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/engine/data/loader-registry.test.ts`
Expected: FAIL — `Cannot find module './loader-registry'`.

- [ ] **Step 4: Implement the loaders and registry**

Create `src/engine/data/loaders/geojson-loader.ts`:

```ts
import type { GeoFeature } from '../../time/temporal-types';

export async function loadGeojson(url: string): Promise<GeoFeature[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load GeoJSON from ${url}: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (data.type === 'FeatureCollection') return data.features as GeoFeature[];
  if (data.type === 'Feature') return [data as GeoFeature];
  throw new Error(`Unsupported GeoJSON root type "${data.type}" at ${url}`);
}
```

Create `src/engine/data/loaders/geojson-sharded-loader.ts`:

```ts
import type { GeoFeature } from '../../time/temporal-types';
import { loadGeojson } from './geojson-loader';

export async function loadGeojsonSharded(urls: string[]): Promise<GeoFeature[]> {
  const shards = await Promise.all(urls.map((url) => loadGeojson(url)));
  return shards.flat();
}
```

Create `src/engine/data/loader-registry.ts`:

```ts
import type { LayerSource, BBox, DateRange } from './source-types';
import type { GeoFeature } from '../time/temporal-types';
import { loadGeojson } from './loaders/geojson-loader';
import { loadGeojsonSharded } from './loaders/geojson-sharded-loader';

// bounds/dateRange are accepted but unused in v1 — forward-compatible seam
// for a future server-backed "api" source type (design spec Section 9).
export async function fetchFeatures(
  source: LayerSource,
  bounds?: BBox,
  dateRange?: DateRange
): Promise<GeoFeature[]> {
  switch (source.type) {
    case 'geojson':
      return loadGeojson(source.url);
    case 'geojson-sharded':
      return loadGeojsonSharded(source.urls);
    default: {
      const exhaustive: never = source;
      throw new Error(`Unknown layer source type: ${JSON.stringify(exhaustive)}`);
    }
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/engine/data/loader-registry.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/data
git commit -m "feat: add geojson data loaders and fetchFeatures registry"
```

---

### Task 5: Manifest types and validation

**Files:**
- Create: `src/engine/manifests/layer-manifest.ts`
- Create: `src/engine/manifests/app-manifest.ts`
- Test: `src/engine/manifests/manifests.test.ts`

**Interfaces:**
- Consumes: `LayerSource` from Task 4.
- Produces: `LayerManifest`, `TaxonomyFieldDef`, `LayerKind` types + `validateLayerManifest(json: unknown): LayerManifest`; `AppManifest`, `BaseLayerConfig`, `ParticipateConfig` types + `validateAppManifest(json: unknown): AppManifest`. Used by Task 7 (taxonomy), Task 8 (region), Task 10 (space), Task 15 (bootstrap), Task 16 (participate).

Note: the design spec's app-manifest example showed `"plugins": []`. This task implements `plugins` as an object keyed by plugin id (`{ "participate"?: ParticipateConfig }`) instead — an empty object `{}` means "no plugins active", and each activated plugin carries its own config (e.g. participate's target address). This is a necessary refinement of the spec's placeholder example, not a contradiction of its intent.

- [ ] **Step 1: Write the failing test**

Create `src/engine/manifests/manifests.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateLayerManifest } from './layer-manifest';
import { validateAppManifest } from './app-manifest';

describe('validateLayerManifest', () => {
  const valid = {
    id: 'poi',
    title: 'Points of Interest',
    kind: 'point',
    source: { type: 'geojson', url: '/data/poi.geojson' },
  };

  it('accepts a minimal valid manifest', () => {
    expect(validateLayerManifest(valid)).toEqual(valid);
  });

  it('rejects a missing id', () => {
    expect(() => validateLayerManifest({ ...valid, id: undefined })).toThrow(/"id"/);
  });

  it('rejects an invalid kind', () => {
    expect(() => validateLayerManifest({ ...valid, kind: 'sparkle' })).toThrow(/kind/);
  });

  it('rejects an unknown source type', () => {
    expect(() => validateLayerManifest({ ...valid, source: { type: 'ftp' } })).toThrow(/source.type/);
  });
});

describe('validateAppManifest', () => {
  const valid = {
    id: 'demo',
    title: 'Demo',
    map: { center: [0, 0], zoom: 10 },
    baseLayers: [{ id: 'osm', title: 'OSM', type: 'raster-tile', url: 'https://x/{z}/{x}/{y}.png', attribution: 'x' }],
    dataLayers: ['layers/poi.layer.json'],
    calendar: { default: 'today', min: '2015-01-01', max: '2030-12-31' },
  };

  it('accepts a minimal valid manifest', () => {
    expect(validateAppManifest(valid)).toEqual(valid);
  });

  it('rejects an empty baseLayers array', () => {
    expect(() => validateAppManifest({ ...valid, baseLayers: [] })).toThrow(/baseLayers/);
  });

  it('rejects a missing calendar.min', () => {
    expect(() => validateAppManifest({ ...valid, calendar: { max: '2030-12-31' } })).toThrow(/calendar/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/manifests/manifests.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/engine/manifests/layer-manifest.ts`**

```ts
import type { LayerSource } from '../data/source-types';

export type LayerKind = 'point' | 'line' | 'polygon' | 'boundary' | 'heatmap';

export interface TaxonomyFieldDef {
  id: string;
  label: string;
  field: string;
  hierarchical?: boolean;
}

export interface LayerManifest {
  id: string;
  title: string;
  kind: LayerKind;
  source: LayerSource;
  temporal?: { defaultVisibility: 'always' | 'time-filtered' };
  taxonomy?: TaxonomyFieldDef[];
  regionRole?: 'boundary' | null;
  style?: Record<string, unknown>;
  panel?: { showInSearch?: boolean; showInInfo?: boolean };
}

const VALID_KINDS: LayerKind[] = ['point', 'line', 'polygon', 'boundary', 'heatmap'];
const VALID_SOURCE_TYPES = ['geojson', 'geojson-sharded'];

export function validateLayerManifest(json: unknown): LayerManifest {
  if (typeof json !== 'object' || json === null) {
    throw new Error('Layer manifest must be a JSON object');
  }
  const obj = json as Record<string, unknown>;

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    throw new Error('Layer manifest missing required string field "id"');
  }
  if (typeof obj.title !== 'string' || obj.title.length === 0) {
    throw new Error(`Layer manifest "${obj.id}" missing required string field "title"`);
  }
  if (!VALID_KINDS.includes(obj.kind as LayerKind)) {
    throw new Error(`Layer manifest "${obj.id}" has invalid "kind": ${String(obj.kind)}`);
  }
  if (typeof obj.source !== 'object' || obj.source === null) {
    throw new Error(`Layer manifest "${obj.id}" missing required "source" object`);
  }
  const source = obj.source as Record<string, unknown>;
  if (!VALID_SOURCE_TYPES.includes(source.type as string)) {
    throw new Error(`Layer manifest "${obj.id}" has unknown source.type: ${String(source.type)}`);
  }

  return json as LayerManifest;
}
```

- [ ] **Step 4: Implement `src/engine/manifests/app-manifest.ts`**

```ts
export interface BaseLayerConfig {
  id: string;
  title: string;
  type: 'raster-tile';
  url: string;
  attribution: string;
}

export interface ParticipateConfig {
  channel: 'email' | 'whatsapp' | 'telegram';
  target: string;
  messageTemplate: string;
}

export interface AppManifest {
  id: string;
  title: string;
  map: { center: [number, number]; zoom: number };
  baseLayers: BaseLayerConfig[];
  dataLayers: string[];
  calendar: { default: 'today' | string; min: string; max: string };
  strings?: string;
  plugins?: { participate?: ParticipateConfig };
}

export function validateAppManifest(json: unknown): AppManifest {
  if (typeof json !== 'object' || json === null) {
    throw new Error('App manifest must be a JSON object');
  }
  const obj = json as Record<string, unknown>;

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    throw new Error('App manifest missing required string field "id"');
  }
  if (!Array.isArray(obj.baseLayers) || obj.baseLayers.length === 0) {
    throw new Error(`App manifest "${obj.id}" requires at least one entry in "baseLayers"`);
  }
  if (!Array.isArray(obj.dataLayers)) {
    throw new Error(`App manifest "${obj.id}" missing required array field "dataLayers"`);
  }
  const calendar = obj.calendar as Record<string, unknown> | undefined;
  if (!calendar || typeof calendar.min !== 'string' || typeof calendar.max !== 'string') {
    throw new Error(`App manifest "${obj.id}" requires "calendar.min" and "calendar.max"`);
  }

  return json as AppManifest;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/engine/manifests/manifests.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/manifests
git commit -m "feat: add layer and app manifest validation"
```

---

### Task 6: Central state store

**Files:**
- Create: `src/engine/state/store.ts`
- Test: `src/engine/state/store.test.ts`

**Interfaces:**
- Produces: generic `createStore<T>(initial: T): Store<T>` with `{ get, set, subscribe }`; `AppState` interface (`selectedDate`, `activeFilters`, `selectedFeatureId`, `activeBaseLayerId`, `panels`). Used by Tasks 10, 13, 14, 15, 16.

- [ ] **Step 1: Write the failing test**

Create `src/engine/state/store.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createStore } from './store';

describe('createStore', () => {
  it('returns the initial state from get()', () => {
    const store = createStore({ count: 0 });
    expect(store.get()).toEqual({ count: 0 });
  });

  it('merges patches with set()', () => {
    const store = createStore({ count: 0, name: 'a' });
    store.set({ count: 1 });
    expect(store.get()).toEqual({ count: 1, name: 'a' });
  });

  it('notifies subscribers with the new state on set()', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ count: 5 });
    expect(listener).toHaveBeenCalledWith({ count: 5 });
  });

  it('stops notifying after unsubscribe', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set({ count: 5 });
    expect(listener).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/state/store.test.ts`
Expected: FAIL — `Cannot find module './store'`.

- [ ] **Step 3: Implement `src/engine/state/store.ts`**

```ts
export type Listener<T> = (state: T) => void;

export interface Store<T> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(listener: Listener<T>): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();

  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      for (const listener of listeners) listener(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export interface AppState {
  selectedDate: string;
  activeFilters: Record<string, Set<string>>;
  selectedFeatureId: string | null;
  activeBaseLayerId: string;
  panels: { left: 'closed' | 'search' | 'info'; right: 'open' | 'closed' };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/state/store.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/state
git commit -m "feat: add generic reactive state store"
```

---

### Task 7: Taxonomy dimension computation and tri-state logic

**Files:**
- Create: `src/engine/taxonomy/compute-dimensions.ts`
- Create: `src/engine/taxonomy/tri-state.ts`
- Test: `src/engine/taxonomy/taxonomy.test.ts`

**Interfaces:**
- Consumes: `GeoFeature`, `isActiveOn` (Tasks 2–3), `LayerManifest` (Task 5).
- Produces: `LoadedLayer` interface (`{ manifest: LayerManifest; features: GeoFeature[] }`, reused by Task 8 and Task 15), `TaxonomyDimension` interface, `computeTaxonomyDimensions(layers: LoadedLayer[], date: Date): TaxonomyDimension[]`, `getTriState(allValues: string[], selected: Set<string>): TriState`, `toggleAll(allValues: string[], selected: Set<string>): Set<string>`. Used by Task 14 (PanelRight).

- [ ] **Step 1: Write the failing test**

Create `src/engine/taxonomy/taxonomy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeTaxonomyDimensions, type LoadedLayer } from './compute-dimensions';
import { getTriState, toggleAll } from './tri-state';
import type { LayerManifest } from '../manifests/layer-manifest';

function layer(): LoadedLayer {
  const manifest: LayerManifest = {
    id: 'poi',
    title: 'POI',
    kind: 'point',
    source: { type: 'geojson', url: '/x' },
    taxonomy: [{ id: 'categoria', label: 'Categoría', field: 'properties.categoria' }],
  };
  return {
    manifest,
    features: [
      { type: 'Feature', id: '1', properties: { categoria: 'shop' }, geometry: { type: 'Point', coordinates: [0, 0] } },
      { type: 'Feature', id: '2', properties: { categoria: 'shop' }, geometry: { type: 'Point', coordinates: [0, 0] } },
      {
        type: 'Feature',
        id: '3',
        properties: { categoria: 'market', temporal: { instant: '2020-01-01' } },
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
    ],
  };
}

describe('computeTaxonomyDimensions', () => {
  it('counts values per dimension for features active on the given date', () => {
    const dims = computeTaxonomyDimensions([layer()], new Date('2026-01-01T00:00:00Z'));
    expect(dims).toEqual([
      { id: 'categoria', label: 'Categoría', values: [{ value: 'shop', count: 2 }] },
    ]);
  });

  it('includes instant-matched features on their exact date', () => {
    const dims = computeTaxonomyDimensions([layer()], new Date('2020-01-01T00:00:00Z'));
    const categoria = dims[0];
    expect(categoria.values).toEqual(
      expect.arrayContaining([
        { value: 'shop', count: 2 },
        { value: 'market', count: 1 },
      ])
    );
  });
});

describe('getTriState', () => {
  it('returns "none" when nothing is selected', () => {
    expect(getTriState(['a', 'b'], new Set())).toBe('none');
  });
  it('returns "all" when everything is selected', () => {
    expect(getTriState(['a', 'b'], new Set(['a', 'b']))).toBe('all');
  });
  it('returns "some" for a partial selection', () => {
    expect(getTriState(['a', 'b'], new Set(['a']))).toBe('some');
  });
});

describe('toggleAll', () => {
  it('selects everything when currently not all-selected', () => {
    expect(toggleAll(['a', 'b'], new Set())).toEqual(new Set(['a', 'b']));
  });
  it('clears the selection when everything is currently selected', () => {
    expect(toggleAll(['a', 'b'], new Set(['a', 'b']))).toEqual(new Set());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/taxonomy/taxonomy.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/engine/taxonomy/compute-dimensions.ts`**

```ts
import type { GeoFeature } from '../time/temporal-types';
import type { LayerManifest } from '../manifests/layer-manifest';
import { isActiveOn } from '../time/is-active-on';

export interface TaxonomyDimension {
  id: string;
  label: string;
  values: { value: string; count: number }[];
}

export interface LoadedLayer {
  manifest: LayerManifest;
  features: GeoFeature[];
}

function readField(feature: GeoFeature, path: string): string[] {
  const parts = path.split('.');
  let value: unknown = feature;
  for (const part of parts) {
    if (value === null || typeof value !== 'object') return [];
    value = (value as Record<string, unknown>)[part];
  }
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null) return [];
  return [String(value)];
}

export function computeTaxonomyDimensions(layers: LoadedLayer[], date: Date): TaxonomyDimension[] {
  const dimensions = new Map<string, TaxonomyDimension>();

  for (const layer of layers) {
    for (const dim of layer.manifest.taxonomy ?? []) {
      const bucket = dimensions.get(dim.id) ?? { id: dim.id, label: dim.label, values: [] };
      const counts = new Map(bucket.values.map((v) => [v.value, v.count]));

      for (const feature of layer.features) {
        if (!isActiveOn(feature, date)) continue;
        for (const value of readField(feature, dim.field)) {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
      }

      bucket.values = Array.from(counts, ([value, count]) => ({ value, count }));
      dimensions.set(dim.id, bucket);
    }
  }

  return Array.from(dimensions.values());
}
```

- [ ] **Step 4: Implement `src/engine/taxonomy/tri-state.ts`**

```ts
export type TriState = 'all' | 'some' | 'none';

export function getTriState(allValues: string[], selected: Set<string>): TriState {
  if (selected.size === 0) return 'none';
  if (allValues.every((v) => selected.has(v))) return 'all';
  return 'some';
}

export function toggleAll(allValues: string[], selected: Set<string>): Set<string> {
  return getTriState(allValues, selected) === 'all' ? new Set() : new Set(allValues);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/engine/taxonomy/taxonomy.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/taxonomy
git commit -m "feat: add taxonomy dimension computation and tri-state helpers"
```

---

### Task 8: Region spatial join

**Files:**
- Create: `src/engine/region/spatial-join.ts`
- Test: `src/engine/region/spatial-join.test.ts`

**Interfaces:**
- Consumes: `GeoFeature`, `isActiveOn` (Tasks 2-3), `LayerManifest`, `LoadedLayer` (Tasks 5, 7), `@turf/boolean-point-in-polygon`.
- Produces: `findContainingRegions(point: [number, number], boundaryLayers: LoadedLayer[], date: Date): GeoFeature[]`. This is the concrete proof that region boundaries are temporal like any other feature — used by Task 14 (PanelRight/info) and demonstrated by the demo dataset in Task 15.

- [ ] **Step 1: Write the failing test**

Create `src/engine/region/spatial-join.test.ts`. The fixture defines two square polygons covering the *same area* but with non-overlapping validity — modeling a boundary that changed on 2023-01-01.

```ts
import { describe, expect, it } from 'vitest';
import { findContainingRegions } from './spatial-join';
import type { LoadedLayer } from '../taxonomy/compute-dimensions';
import type { LayerManifest } from '../manifests/layer-manifest';

function square(id: string, temporal: unknown) {
  return {
    type: 'Feature' as const,
    id,
    properties: { nombre: id, temporal },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
    },
  };
}

function boundaryLayer(): LoadedLayer {
  const manifest: LayerManifest = {
    id: 'regions',
    title: 'Regions',
    kind: 'polygon',
    source: { type: 'geojson', url: '/x' },
    regionRole: 'boundary',
  };
  return {
    manifest,
    features: [
      square('region-old', { range: { to: '2022-12-31' } }),
      square('region-new', { range: { from: '2023-01-01' } }),
    ],
  };
}

describe('findContainingRegions', () => {
  it('finds the old boundary before the change date', () => {
    const matches = findContainingRegions([5, 5], [boundaryLayer()], new Date('2022-06-01T00:00:00Z'));
    expect(matches.map((f) => f.id)).toEqual(['region-old']);
  });

  it('finds the new boundary after the change date', () => {
    const matches = findContainingRegions([5, 5], [boundaryLayer()], new Date('2023-06-01T00:00:00Z'));
    expect(matches.map((f) => f.id)).toEqual(['region-new']);
  });

  it('returns nothing for a point outside every polygon', () => {
    const matches = findContainingRegions([50, 50], [boundaryLayer()], new Date('2023-06-01T00:00:00Z'));
    expect(matches).toEqual([]);
  });

  it('ignores layers not marked as a boundary role', () => {
    const layer = boundaryLayer();
    layer.manifest.regionRole = null;
    const matches = findContainingRegions([5, 5], [layer], new Date('2023-06-01T00:00:00Z'));
    expect(matches).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/region/spatial-join.test.ts`
Expected: FAIL — `Cannot find module './spatial-join'`.

- [ ] **Step 3: Implement `src/engine/region/spatial-join.ts`**

```ts
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import type { LoadedLayer } from '../taxonomy/compute-dimensions';
import type { GeoFeature } from '../time/temporal-types';
import { isActiveOn } from '../time/is-active-on';

export function findContainingRegions(
  point: [number, number],
  boundaryLayers: LoadedLayer[],
  date: Date
): GeoFeature[] {
  const matches: GeoFeature[] = [];

  for (const layer of boundaryLayers) {
    if (layer.manifest.regionRole !== 'boundary') continue;

    for (const feature of layer.features) {
      if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') continue;
      if (!isActiveOn(feature, date)) continue;
      if (booleanPointInPolygon(point, feature.geometry)) {
        matches.push(feature);
      }
    }
  }

  return matches;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/region/spatial-join.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/region
git commit -m "feat: add temporal-aware region spatial join"
```

---

### Task 9: Space pure style helpers

**Files:**
- Create: `src/engine/space/style.ts`
- Test: `src/engine/space/style.test.ts`

**Interfaces:**
- Consumes: `LayerManifest` (Task 5).
- Produces: `MarkerStyle` interface, `resolveMarkerStyle(manifest: LayerManifest): MarkerStyle`. Used by Task 10.

- [ ] **Step 1: Write the failing test**

Create `src/engine/space/style.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveMarkerStyle } from './style';
import type { LayerManifest } from '../manifests/layer-manifest';

function manifest(style?: Record<string, unknown>): LayerManifest {
  return { id: 'poi', title: 'POI', kind: 'point', source: { type: 'geojson', url: '/x' }, style };
}

describe('resolveMarkerStyle', () => {
  it('defaults cluster to false and icon to "default" when style is absent', () => {
    expect(resolveMarkerStyle(manifest())).toEqual({ cluster: false, iconName: 'default' });
  });

  it('reads cluster and icon from the manifest style', () => {
    expect(resolveMarkerStyle(manifest({ cluster: true, icon: 'shop' }))).toEqual({
      cluster: true,
      iconName: 'shop',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/space/style.test.ts`
Expected: FAIL — `Cannot find module './style'`.

- [ ] **Step 3: Implement `src/engine/space/style.ts`**

```ts
import type { LayerManifest } from '../manifests/layer-manifest';

export interface MarkerStyle {
  cluster: boolean;
  iconName: string;
}

export function resolveMarkerStyle(manifest: LayerManifest): MarkerStyle {
  const style = manifest.style ?? {};
  return {
    cluster: style.cluster === true,
    iconName: typeof style.icon === 'string' ? style.icon : 'default',
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/space/style.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/space/style.ts src/engine/space/style.test.ts
git commit -m "feat: add layer style resolution helper"
```

---

### Task 10: Space Leaflet integration (map + data layer rendering)

**Files:**
- Create: `src/types/leaflet-markercluster.d.ts`
- Create: `src/engine/space/map.ts`
- Create: `src/engine/space/data-layer-renderer.ts`

**Interfaces:**
- Consumes: `AppManifest` (Task 5), `LayerManifest`, `GeoFeature`, `isActiveOn` (Tasks 2-3, 5), `resolveMarkerStyle` (Task 9).
- Produces: `createMap(container: HTMLElement, appManifest: AppManifest): L.Map`, `renderDataLayer(map: L.Map, manifest: LayerManifest, features: GeoFeature[], date: Date): L.Layer`. Used by Task 15's bootstrap.

This task is Leaflet/DOM-heavy. Per project convention, it is **verified manually in a browser**, not with jsdom unit tests (Leaflet requires real layout measurement that jsdom does not reliably provide).

- [ ] **Step 1: Declare ambient types for `leaflet.markercluster`**

Create `src/types/leaflet-markercluster.d.ts`:

```ts
import 'leaflet';

declare module 'leaflet' {
  function markerClusterGroup(options?: unknown): L.FeatureGroup;
}
```

- [ ] **Step 2: Implement `src/engine/space/map.ts`**

```ts
import L from 'leaflet';
import type { AppManifest } from '../manifests/app-manifest';

export function createMap(container: HTMLElement, appManifest: AppManifest): L.Map {
  const map = L.map(container).setView(appManifest.map.center, appManifest.map.zoom);

  const baseLayers: Record<string, L.TileLayer> = {};
  appManifest.baseLayers.forEach((config, index) => {
    const layer = L.tileLayer(config.url, { attribution: config.attribution });
    baseLayers[config.title] = layer;
    if (index === 0) layer.addTo(map);
  });
  L.control.layers(baseLayers).addTo(map);

  return map;
}
```

- [ ] **Step 3: Implement `src/engine/space/data-layer-renderer.ts`**

```ts
import L from 'leaflet';
import 'leaflet.markercluster';
import type { GeoFeature } from '../time/temporal-types';
import type { LayerManifest } from '../manifests/layer-manifest';
import { isActiveOn } from '../time/is-active-on';
import { resolveMarkerStyle } from './style';

export function renderDataLayer(
  map: L.Map,
  manifest: LayerManifest,
  features: GeoFeature[],
  date: Date
): L.Layer {
  const active = features.filter((f) => isActiveOn(f, date));
  const geoJsonLayer = L.geoJSON(active as GeoJSON.Feature[]);

  if (manifest.kind === 'point' && resolveMarkerStyle(manifest).cluster) {
    const clusterGroup = L.markerClusterGroup();
    clusterGroup.addLayer(geoJsonLayer);
    clusterGroup.addTo(map);
    return clusterGroup;
  }

  geoJsonLayer.addTo(map);
  return geoJsonLayer;
}
```

- [ ] **Step 4: Manually verify in a browser**

Temporarily add this to `src/main.ts` (it will be replaced wholesale in Task 15, so this is throwaway verification code, not left in place):

```ts
import { createMap } from './engine/space/map';
import { renderDataLayer } from './engine/space/data-layer-renderer';

const map = createMap(document.querySelector('#map')!, {
  id: 'smoke-test',
  title: 'Smoke Test',
  map: { center: [28.29, -16.62], zoom: 12 },
  baseLayers: [
    { id: 'osm', title: 'OSM', type: 'raster-tile', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' },
  ],
  dataLayers: [],
  calendar: { default: 'today', min: '2015-01-01', max: '2030-12-31' },
});

renderDataLayer(
  map,
  { id: 'x', title: 'X', kind: 'point', source: { type: 'geojson', url: '' }, style: { cluster: true } },
  [{ type: 'Feature', id: '1', properties: {}, geometry: { type: 'Point', coordinates: [-16.62, 28.29] } }],
  new Date()
);
```

Run: `npm run dev`, open the printed local URL in a browser.
Expected: an OSM map centered on Tenerife with one marker visible near the center. Confirm no console errors (Leaflet CSS missing would show as a broken/unstyled map — if so, re-check Step 5 of Task 15, which imports Leaflet's CSS).

Revert this temporary snippet from `src/main.ts` after confirming (Task 15 replaces the file's contents anyway).

- [ ] **Step 5: Commit**

```bash
git add src/types/leaflet-markercluster.d.ts src/engine/space/map.ts src/engine/space/data-layer-renderer.ts
git commit -m "feat: add Leaflet map creation and data layer rendering"
```

---

### Task 11: Plugin registry

**Files:**
- Create: `src/engine/plugins/registry.ts`
- Test: `src/engine/plugins/registry.test.ts`

**Interfaces:**
- Consumes: `GeoFeature` (Task 2).
- Produces: `PanelSlot`, `PluginContext`, `PluginHooks` interfaces; `registerPlugin(id, hooks)`, `getPanelSlots()`, `dispatchDateChange(date, ctx)`, `dispatchFilterChange(features, ctx)`, `dispatchFeatureSelect(feature, ctx)`, `_resetPluginsForTest()`. Used by Task 14 (panel-actions area) and Task 16 (`participate` plugin).

- [ ] **Step 1: Write the failing test**

Create `src/engine/plugins/registry.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  registerPlugin,
  getPanelSlots,
  dispatchDateChange,
  dispatchFilterChange,
  dispatchFeatureSelect,
  _resetPluginsForTest,
  type PluginContext,
} from './registry';

const ctx: PluginContext = {
  getSelectedDate: () => '2026-01-01',
  getActiveFeatures: () => [],
  getSelectedFeature: () => null,
};

afterEach(() => {
  _resetPluginsForTest();
});

describe('plugin registry', () => {
  it('lists registered panel slots', () => {
    registerPlugin('a', { panelSlot: { id: 'a', label: 'A', icon: 'x', render: () => {} } });
    expect(getPanelSlots().map((s) => s.id)).toEqual(['a']);
  });

  it('omits plugins with no panel slot', () => {
    registerPlugin('a', {});
    expect(getPanelSlots()).toEqual([]);
  });

  it('dispatches onDateChange to every registered plugin', () => {
    const onDateChange = vi.fn();
    registerPlugin('a', { onDateChange });
    dispatchDateChange('2026-02-01', ctx);
    expect(onDateChange).toHaveBeenCalledWith('2026-02-01', ctx);
  });

  it('dispatches onFilterChange and onFeatureSelect', () => {
    const onFilterChange = vi.fn();
    const onFeatureSelect = vi.fn();
    registerPlugin('a', { onFilterChange, onFeatureSelect });
    dispatchFilterChange([], ctx);
    dispatchFeatureSelect(null, ctx);
    expect(onFilterChange).toHaveBeenCalledWith([], ctx);
    expect(onFeatureSelect).toHaveBeenCalledWith(null, ctx);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/plugins/registry.test.ts`
Expected: FAIL — `Cannot find module './registry'`.

- [ ] **Step 3: Implement `src/engine/plugins/registry.ts`**

```ts
import type { GeoFeature } from '../time/temporal-types';

export interface PluginContext {
  getSelectedDate(): string;
  getActiveFeatures(): GeoFeature[];
  getSelectedFeature(): GeoFeature | null;
}

export interface PanelSlot {
  id: string;
  label: string;
  icon: string;
  render(container: HTMLElement, ctx: PluginContext): void;
}

export interface PluginHooks {
  panelSlot?: PanelSlot;
  onDateChange?(date: string, ctx: PluginContext): void;
  onFilterChange?(activeFeatures: GeoFeature[], ctx: PluginContext): void;
  onFeatureSelect?(feature: GeoFeature | null, ctx: PluginContext): void;
}

const plugins = new Map<string, PluginHooks>();

export function registerPlugin(id: string, hooks: PluginHooks): void {
  plugins.set(id, hooks);
}

export function getPanelSlots(): PanelSlot[] {
  return Array.from(plugins.values())
    .map((hooks) => hooks.panelSlot)
    .filter((slot): slot is PanelSlot => slot !== undefined);
}

export function dispatchDateChange(date: string, ctx: PluginContext): void {
  for (const hooks of plugins.values()) hooks.onDateChange?.(date, ctx);
}

export function dispatchFilterChange(activeFeatures: GeoFeature[], ctx: PluginContext): void {
  for (const hooks of plugins.values()) hooks.onFilterChange?.(activeFeatures, ctx);
}

export function dispatchFeatureSelect(feature: GeoFeature | null, ctx: PluginContext): void {
  for (const hooks of plugins.values()) hooks.onFeatureSelect?.(feature, ctx);
}

export function _resetPluginsForTest(): void {
  plugins.clear();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/plugins/registry.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/plugins
git commit -m "feat: add plugin registry and hook dispatch"
```

---

### Task 12: Strings (i18n seam) loader

**Files:**
- Create: `src/ui/strings.ts`
- Test: `src/ui/strings.test.ts`

**Interfaces:**
- Produces: `loadStrings(path: string | undefined): Promise<Record<string, string>>`, `t(key: string, strings: Record<string, string>): string`. Used by Task 14 (PanelLeft) and Task 15 (bootstrap).

- [ ] **Step 1: Write the failing test**

Create `src/ui/strings.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadStrings, t } from './strings';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadStrings', () => {
  it('returns an empty object when no path is given', async () => {
    expect(await loadStrings(undefined)).toEqual({});
  });

  it('fetches and returns the strings JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ 'a.b': 'Hello' }) })
    );
    expect(await loadStrings('/strings.json')).toEqual({ 'a.b': 'Hello' });
  });

  it('throws a descriptive error on a failed fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }));
    await expect(loadStrings('/missing.json')).rejects.toThrow(/404/);
  });
});

describe('t', () => {
  it('returns the mapped string when the key exists', () => {
    expect(t('a.b', { 'a.b': 'Hello' })).toBe('Hello');
  });
  it('falls back to the key itself when missing', () => {
    expect(t('missing.key', {})).toBe('missing.key');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/strings.test.ts`
Expected: FAIL — `Cannot find module './strings'`.

- [ ] **Step 3: Implement `src/ui/strings.ts`**

```ts
export async function loadStrings(path: string | undefined): Promise<Record<string, string>> {
  if (!path) return {};
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load strings from ${path}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export function t(key: string, strings: Record<string, string>): string {
  return strings[key] ?? key;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ui/strings.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/strings.ts src/ui/strings.test.ts
git commit -m "feat: add strings loader (i18n seam)"
```

---

### Task 13: Panel pure logic — search and temporal status

**Files:**
- Create: `src/ui/panels/search.ts`
- Create: `src/ui/panels/temporal-status.ts`
- Test: `src/ui/panels/search.test.ts`
- Test: `src/ui/panels/temporal-status.test.ts`

**Interfaces:**
- Consumes: `GeoFeature`, `isActiveOn` (Tasks 2-3).
- Produces: `searchFeatures(features: GeoFeature[], query: string, searchableFields: string[]): GeoFeature[]`, `describeTemporalStatus(feature: GeoFeature, date: Date): string`. Used by Task 14 (PanelLeft).

- [ ] **Step 1: Write the failing tests**

Create `src/ui/panels/search.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { searchFeatures } from './search';
import type { GeoFeature } from '../../engine/time/temporal-types';

const features: GeoFeature[] = [
  { type: 'Feature', id: '1', properties: { nombre: 'Panadería Central' }, geometry: { type: 'Point', coordinates: [0, 0] } },
  { type: 'Feature', id: '2', properties: { nombre: 'Ferretería Norte' }, geometry: { type: 'Point', coordinates: [0, 0] } },
];

describe('searchFeatures', () => {
  it('matches case-insensitively on the given fields', () => {
    expect(searchFeatures(features, 'panad', ['nombre']).map((f) => f.id)).toEqual(['1']);
  });

  it('returns nothing for an empty query', () => {
    expect(searchFeatures(features, '  ', ['nombre'])).toEqual([]);
  });

  it('returns nothing when no field matches', () => {
    expect(searchFeatures(features, 'zzz', ['nombre'])).toEqual([]);
  });
});
```

Create `src/ui/panels/temporal-status.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { describeTemporalStatus } from './temporal-status';
import type { GeoFeature } from '../../engine/time/temporal-types';

function feature(temporal?: GeoFeature['properties']['temporal']): GeoFeature {
  return { type: 'Feature', id: '1', properties: { temporal }, geometry: { type: 'Point', coordinates: [0, 0] } };
}

describe('describeTemporalStatus', () => {
  it('describes a feature with no temporal data as always active', () => {
    expect(describeTemporalStatus(feature(undefined), new Date('2026-01-01T00:00:00Z'))).toBe('Always active');
  });

  it('describes an instant feature on and off its date', () => {
    const f = feature({ instant: '2026-03-14' });
    expect(describeTemporalStatus(f, new Date('2026-03-14T00:00:00Z'))).toBe('Active on 2026-03-14');
    expect(describeTemporalStatus(f, new Date('2026-03-15T00:00:00Z'))).toBe('Occurred on 2026-03-14');
  });

  it('describes a ranged feature', () => {
    const f = feature({ range: { from: '2020-01-01', to: '2023-06-30' } });
    expect(describeTemporalStatus(f, new Date('2021-01-01T00:00:00Z'))).toBe('Active (since 2020-01-01 until 2023-06-30)');
    expect(describeTemporalStatus(f, new Date('2024-01-01T00:00:00Z'))).toBe(
      'Not active on selected date (since 2020-01-01 until 2023-06-30)'
    );
  });

  it('describes a recurring feature', () => {
    const f = feature({ range: { from: '2026-03-01' }, recurrence: { rule: 'FREQ=WEEKLY;BYDAY=SU' } });
    expect(describeTemporalStatus(f, new Date('2026-03-01T00:00:00Z'))).toBe(
      'Active today (recurs: FREQ=WEEKLY;BYDAY=SU)'
    );
    expect(describeTemporalStatus(f, new Date('2026-03-02T00:00:00Z'))).toBe(
      'Not active on selected date (recurs: FREQ=WEEKLY;BYDAY=SU)'
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/panels/search.test.ts src/ui/panels/temporal-status.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/ui/panels/search.ts`**

```ts
import type { GeoFeature } from '../../engine/time/temporal-types';

export function searchFeatures(features: GeoFeature[], query: string, searchableFields: string[]): GeoFeature[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return features.filter((feature) =>
    searchableFields.some((field) => {
      const value = feature.properties[field];
      return typeof value === 'string' && value.toLowerCase().includes(normalized);
    })
  );
}
```

- [ ] **Step 4: Implement `src/ui/panels/temporal-status.ts`**

```ts
import type { GeoFeature } from '../../engine/time/temporal-types';
import { isActiveOn } from '../../engine/time/is-active-on';

export function describeTemporalStatus(feature: GeoFeature, date: Date): string {
  const temporal = feature.properties.temporal;
  const active = isActiveOn(feature, date);

  if (!temporal) return 'Always active';

  if (temporal.instant) {
    return active ? `Active on ${temporal.instant}` : `Occurred on ${temporal.instant}`;
  }

  if (temporal.recurrence) {
    const status = active ? 'Active today' : 'Not active on selected date';
    return `${status} (recurs: ${temporal.recurrence.rule})`;
  }

  if (temporal.range) {
    const from = temporal.range.from ? `since ${temporal.range.from}` : '';
    const to = temporal.range.to ? `until ${temporal.range.to}` : '';
    const status = active ? 'Active' : 'Not active on selected date';
    const bounds = [from, to].filter(Boolean).join(' ');
    return bounds ? `${status} (${bounds})` : status;
  }

  return active ? 'Active' : 'Not active';
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/ui/panels/search.test.ts src/ui/panels/temporal-status.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/panels/search.ts src/ui/panels/search.test.ts src/ui/panels/temporal-status.ts src/ui/panels/temporal-status.test.ts
git commit -m "feat: add search and temporal-status panel logic"
```

---

### Task 14: Panel DOM wiring — PanelLeft, PanelRight, CalendarBar

**Files:**
- Create: `src/ui/panels/PanelLeft.ts`
- Create: `src/ui/panels/PanelRight.ts`
- Create: `src/ui/panels/CalendarBar.ts`

**Interfaces:**
- Consumes: `Store<AppState>` (Task 6), `LoadedLayer`, `computeTaxonomyDimensions`, `getTriState`, `toggleAll` (Task 7), `searchFeatures`, `describeTemporalStatus` (Task 13), `t` (Task 12).
- Produces: `mountPanelLeft(container, store, layers, strings)`, `mountPanelRight(container, store, layers)`, `mountCalendarBar(container, store, config)`. Used by Task 15's bootstrap.

DOM wiring is verified manually in the browser as part of Task 15, once all three panels are mounted together against real demo data.

- [ ] **Step 1: Implement `src/ui/panels/CalendarBar.ts`**

```ts
import type { Store } from '../../engine/state/store';
import type { AppState } from '../../engine/state/store';

export interface CalendarConfig {
  default: string;
  min: string;
  max: string;
}

export function mountCalendarBar(container: HTMLElement, store: Store<AppState>, config: CalendarConfig): void {
  container.innerHTML = `
    <button type="button" data-action="prev">&larr;</button>
    <input type="date" data-role="date-input" min="${config.min}" max="${config.max}" />
    <button type="button" data-action="next">&rarr;</button>
  `;

  const dateInput = container.querySelector<HTMLInputElement>('[data-role="date-input"]')!;
  dateInput.value = store.get().selectedDate;

  function stepDate(deltaDays: number): void {
    const current = new Date(`${store.get().selectedDate}T00:00:00Z`);
    current.setUTCDate(current.getUTCDate() + deltaDays);
    const next = current.toISOString().slice(0, 10);
    store.set({ selectedDate: next });
  }

  container.querySelector('[data-action="prev"]')!.addEventListener('click', () => stepDate(-1));
  container.querySelector('[data-action="next"]')!.addEventListener('click', () => stepDate(1));
  dateInput.addEventListener('change', () => store.set({ selectedDate: dateInput.value }));

  store.subscribe((state) => {
    if (dateInput.value !== state.selectedDate) dateInput.value = state.selectedDate;
  });
}
```

- [ ] **Step 2: Implement `src/ui/panels/PanelRight.ts`**

```ts
import type { Store, AppState } from '../../engine/state/store';
import { computeTaxonomyDimensions, type LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { getTriState, toggleAll } from '../../engine/taxonomy/tri-state';

export function mountPanelRight(container: HTMLElement, store: Store<AppState>, layers: LoadedLayer[]): void {
  function render(): void {
    const date = new Date(`${store.get().selectedDate}T00:00:00Z`);
    const dimensions = computeTaxonomyDimensions(layers, date);
    const activeFilters = store.get().activeFilters;

    container.innerHTML = dimensions
      .map((dimension) => {
        const selected = activeFilters[dimension.id] ?? new Set<string>();
        const allValues = dimension.values.map((v) => v.value);
        const triState = getTriState(allValues, selected);
        const options = dimension.values
          .map(
            (v) => `
              <label>
                <input type="checkbox" data-dimension="${dimension.id}" data-value="${v.value}" ${selected.has(v.value) ? 'checked' : ''} />
                ${v.value} (${v.count})
              </label>`
          )
          .join('');

        return `
          <section data-dimension-section="${dimension.id}">
            <label>
              <input type="checkbox" data-select-all="${dimension.id}" ${triState === 'all' ? 'checked' : ''} />
              ${dimension.label}
            </label>
            <div>${options}</div>
          </section>`;
      })
      .join('');

    container.querySelectorAll<HTMLInputElement>('[data-select-all]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const dimensionId = checkbox.dataset.selectAll!;
        const dimension = dimensions.find((d) => d.id === dimensionId)!;
        const allValues = dimension.values.map((v) => v.value);
        const current = store.get().activeFilters[dimensionId] ?? new Set<string>();
        store.set({ activeFilters: { ...store.get().activeFilters, [dimensionId]: toggleAll(allValues, current) } });
      });
    });

    container.querySelectorAll<HTMLInputElement>('input[data-dimension]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const dimensionId = checkbox.dataset.dimension!;
        const value = checkbox.dataset.value!;
        const current = new Set(store.get().activeFilters[dimensionId] ?? new Set<string>());
        if (checkbox.checked) current.add(value);
        else current.delete(value);
        store.set({ activeFilters: { ...store.get().activeFilters, [dimensionId]: current } });
      });
    });
  }

  render();
  store.subscribe(render);
}
```

- [ ] **Step 3: Implement `src/ui/panels/PanelLeft.ts`**

```ts
import type { Store, AppState } from '../../engine/state/store';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { searchFeatures } from './search';
import { describeTemporalStatus } from './temporal-status';
import { t } from '../strings';

export function mountPanelLeft(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>
): void {
  container.innerHTML = `
    <input type="search" data-role="search-input" placeholder="${t('search.placeholder', strings)}" />
    <div data-role="results"></div>
    <div data-role="info" hidden></div>
  `;

  const searchInput = container.querySelector<HTMLInputElement>('[data-role="search-input"]')!;
  const resultsEl = container.querySelector<HTMLDivElement>('[data-role="results"]')!;
  const infoEl = container.querySelector<HTMLDivElement>('[data-role="info"]')!;
  const allFeatures = layers.flatMap((layer) => layer.features);

  function featureLabel(feature: (typeof allFeatures)[number]): string {
    const props = feature.properties;
    return String(props.nombre ?? props.title ?? feature.id ?? 'Untitled');
  }

  searchInput.addEventListener('input', () => {
    const matches = searchFeatures(allFeatures, searchInput.value, ['nombre', 'title']);
    resultsEl.innerHTML = matches
      .map((feature, index) => `<button type="button" data-result-index="${index}">${featureLabel(feature)}</button>`)
      .join('');

    resultsEl.querySelectorAll<HTMLButtonElement>('[data-result-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const feature = matches[Number(button.dataset.resultIndex)];
        store.set({ selectedFeatureId: String(feature.id ?? '') });
      });
    });
  });

  store.subscribe((state) => {
    if (!state.selectedFeatureId) {
      infoEl.hidden = true;
      resultsEl.hidden = false;
      return;
    }
    const feature = allFeatures.find((f) => String(f.id ?? '') === state.selectedFeatureId);
    if (!feature) return;

    const date = new Date(`${state.selectedDate}T00:00:00Z`);
    infoEl.hidden = false;
    resultsEl.hidden = true;
    infoEl.innerHTML = `<h3>${featureLabel(feature)}</h3><p>${describeTemporalStatus(feature, date, strings)}</p>`;
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/panels/CalendarBar.ts src/ui/panels/PanelRight.ts src/ui/panels/PanelLeft.ts
git commit -m "feat: add panel DOM wiring (search/info, filters, calendar bar)"
```

---

### Task 15: Bootstrap and the `demo` app instance

**Files:**
- Modify: `src/main.ts` (replace the Task 1/10 placeholder content entirely)
- Create: `apps/demo/app-manifest.json`
- Create: `apps/demo/strings.json`
- Create: `apps/demo/layers/poi.layer.json`
- Create: `apps/demo/layers/regions.layer.json`
- Create: `apps/demo/data/poi.geojson`
- Create: `apps/demo/data/regions.geojson`

**Interfaces:**
- Consumes: everything from Tasks 2–14.
- Produces: a running end-to-end app. This is the task that proves the whole spec works together and is the reference example for anyone building a second app instance.

- [ ] **Step 1: Create `apps/demo/data/poi.geojson`**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "poi-1",
      "properties": { "nombre": "Ayuntamiento", "categoria": "administracion" },
      "geometry": { "type": "Point", "coordinates": [-16.62, 28.29] }
    },
    {
      "type": "Feature",
      "id": "poi-2",
      "properties": { "nombre": "Feria de Marzo", "categoria": "evento", "temporal": { "instant": "2026-03-14" } },
      "geometry": { "type": "Point", "coordinates": [-16.615, 28.285] }
    },
    {
      "type": "Feature",
      "id": "poi-3",
      "properties": {
        "nombre": "Tienda Antigua",
        "categoria": "comercio",
        "temporal": { "range": { "from": "2018-01-01", "to": "2023-06-30" } }
      },
      "geometry": { "type": "Point", "coordinates": [-16.625, 28.292] }
    },
    {
      "type": "Feature",
      "id": "poi-4",
      "properties": {
        "nombre": "Mercadillo Dominical",
        "categoria": "mercado",
        "temporal": { "recurrence": { "rule": "FREQ=WEEKLY;BYDAY=SU" } }
      },
      "geometry": { "type": "Point", "coordinates": [-16.618, 28.288] }
    },
    {
      "type": "Feature",
      "id": "poi-5",
      "properties": {
        "nombre": "Mercado Temporal",
        "categoria": "mercado",
        "temporal": {
          "range": { "from": "2024-01-01", "to": "2024-12-31" },
          "recurrence": { "rule": "FREQ=WEEKLY;BYDAY=SA" }
        }
      },
      "geometry": { "type": "Point", "coordinates": [-16.63, 28.28] }
    }
  ]
}
```

- [ ] **Step 2: Create `apps/demo/data/regions.geojson`**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "region-old",
      "properties": { "nombre": "Distrito Norte (pre-2023)", "temporal": { "range": { "to": "2022-12-31" } } },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-16.65, 28.27], [-16.60, 28.27], [-16.60, 28.31], [-16.65, 28.31], [-16.65, 28.27]]]
      }
    },
    {
      "type": "Feature",
      "id": "region-new",
      "properties": { "nombre": "Distrito Norte (post-2023)", "temporal": { "range": { "from": "2023-01-01" } } },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-16.65, 28.27], [-16.60, 28.27], [-16.60, 28.31], [-16.65, 28.31], [-16.65, 28.27]]]
      }
    }
  ]
}
```

- [ ] **Step 3: Create `apps/demo/layers/poi.layer.json`**

```json
{
  "id": "poi",
  "title": "Points of Interest",
  "kind": "point",
  "source": { "type": "geojson", "url": "/apps/demo/data/poi.geojson" },
  "temporal": { "defaultVisibility": "time-filtered" },
  "taxonomy": [{ "id": "categoria", "label": "Categoría", "field": "properties.categoria" }],
  "regionRole": null,
  "style": { "cluster": true, "icon": "marker" },
  "panel": { "showInSearch": true, "showInInfo": true }
}
```

- [ ] **Step 4: Create `apps/demo/layers/regions.layer.json`**

```json
{
  "id": "regions",
  "title": "Regions",
  "kind": "polygon",
  "source": { "type": "geojson", "url": "/apps/demo/data/regions.geojson" },
  "temporal": { "defaultVisibility": "time-filtered" },
  "taxonomy": [{ "id": "region", "label": "Región", "field": "properties.nombre" }],
  "regionRole": "boundary",
  "style": {},
  "panel": { "showInSearch": false, "showInInfo": true }
}
```

- [ ] **Step 5: Create `apps/demo/strings.json`**

```json
{
  "search.placeholder": "Search..."
}
```

- [ ] **Step 6: Create `apps/demo/app-manifest.json`**

```json
{
  "id": "demo",
  "title": "Universal Map Demo",
  "map": { "center": [28.29, -16.62], "zoom": 12 },
  "baseLayers": [
    {
      "id": "osm",
      "title": "OpenStreetMap",
      "type": "raster-tile",
      "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      "attribution": "© OpenStreetMap contributors"
    }
  ],
  "dataLayers": ["layers/poi.layer.json", "layers/regions.layer.json"],
  "calendar": { "default": "today", "min": "2015-01-01", "max": "2030-12-31" },
  "strings": "strings.json",
  "plugins": {}
}
```

- [ ] **Step 7: Replace `src/main.ts` with the full bootstrap**

```ts
import './styles.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Layer } from 'leaflet';

import { validateAppManifest } from './engine/manifests/app-manifest';
import { validateLayerManifest, type LayerManifest } from './engine/manifests/layer-manifest';
import { fetchFeatures } from './engine/data/loader-registry';
import { createStore } from './engine/state/store';
import type { AppState } from './engine/state/store';
import { createMap } from './engine/space/map';
import { renderDataLayer } from './engine/space/data-layer-renderer';
import { loadStrings } from './ui/strings';
import { mountPanelLeft } from './ui/panels/PanelLeft';
import { mountPanelRight } from './ui/panels/PanelRight';
import { mountCalendarBar } from './ui/panels/CalendarBar';
import type { GeoFeature } from './engine/time/temporal-types';
import type { LoadedLayer } from './engine/taxonomy/compute-dimensions';

async function bootstrap(): Promise<void> {
  const appManifestResponse = await fetch('/apps/demo/app-manifest.json');
  const appManifest = validateAppManifest(await appManifestResponse.json());

  const strings = await loadStrings(appManifest.strings ? `/apps/demo/${appManifest.strings}` : undefined);

  const loadedLayers: LoadedLayer[] = [];
  for (const layerPath of appManifest.dataLayers) {
    const layerManifestResponse = await fetch(`/apps/demo/${layerPath}`);
    const manifest: LayerManifest = validateLayerManifest(await layerManifestResponse.json());
    const features: GeoFeature[] = await fetchFeatures(manifest.source);
    loadedLayers.push({ manifest, features });
  }

  const store = createStore<AppState>({
    selectedDate: new Date().toISOString().slice(0, 10),
    activeFilters: {},
    selectedFeatureId: null,
    activeBaseLayerId: appManifest.baseLayers[0].id,
    panels: { left: 'closed', right: 'closed' },
  });

  const mapContainer = document.querySelector<HTMLDivElement>('#map')!;
  const map = createMap(mapContainer, appManifest);
  const renderedLayers = new Map<string, Layer>();

  function renderMap(): void {
    const date = new Date(`${store.get().selectedDate}T00:00:00Z`);
    for (const layer of loadedLayers) {
      const existing = renderedLayers.get(layer.manifest.id);
      if (existing) map.removeLayer(existing);
      renderedLayers.set(layer.manifest.id, renderDataLayer(map, layer.manifest, layer.features, date));
    }
  }

  renderMap();
  store.subscribe(renderMap);

  mountCalendarBar(document.querySelector('#calendar-bar')!, store, appManifest.calendar);
  mountPanelRight(document.querySelector('#panel-right')!, store, loadedLayers);
  mountPanelLeft(document.querySelector('#panel-left')!, store, loadedLayers, strings);
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap app', error);
  document.body.innerHTML = `<pre style="color:red">${String(error)}</pre>`;
});
```

Note the `renderedLayers` map: it removes each layer's previous render before adding the new one on every state change, so changing the date doesn't stack duplicate markers on top of each other.

- [ ] **Step 8: Manually verify end to end**

Run: `npm run dev`, open the local URL in a browser.

Expected:
- Map loads centered on Tenerife with OSM tiles, a cluster near the center (5 POI markers, clustered), and one region polygon outline.
- Right panel shows two filter sections: "Categoría" (administracion, evento, comercio, mercado — counts reflect today's date) and "Región" (one region, matching whichever boundary is valid today).
- Left panel search box: typing "ayuntamiento" shows one result; clicking it switches to the info view showing "Always active".
- Calendar bar: moving the date to `2026-03-14` should make "Feria de Marzo" count appear in the Categoría "evento" section; moving before `2018-01-01` or after `2023-06-30` should make "Tienda Antigua" disappear from "comercio"; moving to any Sunday should keep "Mercadillo Dominical" counted, any other weekday should not.
- Setting the date to `2022-06-01` then `2023-06-01` should flip which region name appears in "Región" — this is the concrete proof of the temporal region-boundary behavior.
- No console errors.

- [ ] **Step 9: Commit**

```bash
git add src/main.ts apps/demo
git commit -m "feat: wire full bootstrap and add demo app instance"
```

---

### Task 16: `participate` plugin and README

**Files:**
- Create: `plugins/participate/links.ts`
- Test: `plugins/participate/links.test.ts`
- Create: `plugins/participate/index.ts`
- Modify: `apps/demo/app-manifest.json` (activate the plugin)
- Modify: `src/main.ts` (register the plugin and mount its panel slot)
- Create: `README.md`

**Interfaces:**
- Consumes: `ParticipateConfig` (Task 5), `registerPlugin`, `getPanelSlots`, `PluginContext` (Task 11).
- Produces: `buildParticipateUrl(config: ParticipateConfig, context: { date: string }): string`, `registerParticipatePlugin(config: ParticipateConfig): void`.

- [ ] **Step 1: Write the failing test**

Create `plugins/participate/links.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildParticipateUrl } from './links';

describe('buildParticipateUrl', () => {
  it('builds a mailto link with an encoded subject', () => {
    const url = buildParticipateUrl(
      { channel: 'email', target: 'demo@example.org', messageTemplate: 'Report for {{date}}' },
      { date: '2026-07-26' }
    );
    expect(url).toBe('mailto:demo@example.org?subject=Report%20for%202026-07-26');
  });

  it('builds a WhatsApp deep link', () => {
    const url = buildParticipateUrl(
      { channel: 'whatsapp', target: '34600000000', messageTemplate: 'Hi, re: {{date}}' },
      { date: '2026-07-26' }
    );
    expect(url).toBe('https://wa.me/34600000000?text=Hi%2C%20re%3A%202026-07-26');
  });

  it('builds a Telegram deep link', () => {
    const url = buildParticipateUrl(
      { channel: 'telegram', target: 'demo_bot', messageTemplate: 'Hi {{date}}' },
      { date: '2026-07-26' }
    );
    expect(url).toBe('https://t.me/demo_bot?text=Hi%202026-07-26');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run plugins/participate/links.test.ts`
Expected: FAIL — `Cannot find module './links'`.

- [ ] **Step 3: Implement `plugins/participate/links.ts`**

```ts
import type { ParticipateConfig } from '../../src/engine/manifests/app-manifest';

export function buildParticipateUrl(config: ParticipateConfig, context: { date: string }): string {
  const message = config.messageTemplate.replace('{{date}}', context.date);

  switch (config.channel) {
    case 'email':
      return `mailto:${config.target}?subject=${encodeURIComponent(message)}`;
    case 'whatsapp':
      return `https://wa.me/${config.target}?text=${encodeURIComponent(message)}`;
    case 'telegram':
      return `https://t.me/${config.target}?text=${encodeURIComponent(message)}`;
    default: {
      const exhaustive: never = config.channel;
      throw new Error(`Unknown participate channel: ${String(exhaustive)}`);
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run plugins/participate/links.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Implement `plugins/participate/index.ts`**

```ts
import { registerPlugin } from '../../src/engine/plugins/registry';
import { buildParticipateUrl } from './links';
import type { ParticipateConfig } from '../../src/engine/manifests/app-manifest';

export function registerParticipatePlugin(config: ParticipateConfig): void {
  registerPlugin('participate', {
    panelSlot: {
      id: 'participate',
      label: 'Participate',
      icon: 'pushpin',
      render(container, ctx) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Participate';
        button.addEventListener('click', () => {
          window.open(buildParticipateUrl(config, { date: ctx.getSelectedDate() }), '_blank', 'noopener');
        });
        container.appendChild(button);
      },
    },
  });
}
```

- [ ] **Step 6: Activate the plugin in `apps/demo/app-manifest.json`**

Change the `"plugins": {}` line to:

```json
  "plugins": {
    "participate": {
      "channel": "email",
      "target": "demo@example.org",
      "messageTemplate": "I want to report something on the map (viewing date: {{date}})"
    }
  }
```

- [ ] **Step 7: Wire it into `src/main.ts`**

Add near the top of `bootstrap()`, after `appManifest` is loaded:

```ts
import { registerParticipatePlugin } from '../plugins/participate';
import { getPanelSlots, type PluginContext } from './engine/plugins/registry';
```

Inside `bootstrap()`, after loading `appManifest`:

```ts
  if (appManifest.plugins?.participate) {
    registerParticipatePlugin(appManifest.plugins.participate);
  }
```

After `mountPanelLeft(...)` at the end of `bootstrap()`, mount any registered panel slots into the right panel's action area:

```ts
  const pluginCtx: PluginContext = {
    getSelectedDate: () => store.get().selectedDate,
    getActiveFeatures: () => loadedLayers.flatMap((l) => l.features),
    getSelectedFeature: () =>
      loadedLayers.flatMap((l) => l.features).find((f) => String(f.id ?? '') === store.get().selectedFeatureId) ?? null,
  };
  const actionsContainer = document.querySelector<HTMLDivElement>('#panel-right')!;
  for (const slot of getPanelSlots()) {
    const slotContainer = document.createElement('div');
    slotContainer.dataset.pluginSlot = slot.id;
    actionsContainer.appendChild(slotContainer);
    slot.render(slotContainer, pluginCtx);
  }
```

- [ ] **Step 8: Manually verify in a browser**

Run: `npm run dev`. Confirm a "Participate" button appears in the right panel; clicking it opens a new tab/window to a `mailto:demo@example.org?subject=...` link containing today's date.

- [ ] **Step 9: Create `README.md`**

```markdown
# Universal Map-Time Engine

A static, browser-only map (OpenStreetMap + Leaflet) with a Gregorian calendar as an equal first-class dimension. See `docs/superpowers/specs/2026-07-26-universal-map-time-engine-design.md` for the full design.

## Run locally

    npm install
    npm run dev

Open the printed local URL. No backend, no paid services — `npm run build` produces a static `dist/` you can host anywhere (or serve locally with `npm run preview` or any static file server).

## Run tests

    npm test

## Add a new app instance

1. Create a new folder under `apps/<your-app-id>/`.
2. Add an `app-manifest.json` (see `apps/demo/app-manifest.json` for the shape).
3. Add one `*.layer.json` per data layer under `apps/<your-app-id>/layers/`, and the matching GeoJSON under `apps/<your-app-id>/data/`.
4. Optionally add `strings.json` for your own UI text, and a `plugins` block to activate `participate`.
5. Point `src/main.ts`'s `fetch('/apps/demo/app-manifest.json')` call (and the two other `/apps/demo/` paths) at your new app id, or introduce a build-time/query-param switch — multi-app routing is intentionally out of scope for v1 (see the design spec's non-goals).

No engine code under `src/engine/` needs to change to add a new app instance.
```

- [ ] **Step 10: Commit**

```bash
git add plugins/participate apps/demo/app-manifest.json src/main.ts README.md
git commit -m "feat: add participate plugin (external link launcher) and README"
```

---

## Self-Review Notes

- **Spec coverage:** Section 3 (modules) → Tasks 2-3, 6-11. Section 4 (data standard) → Tasks 2-3, 5. Section 5 (manifests) → Task 5, demonstrated in Task 15. Section 6 (UI/panels) → Tasks 13-14. Section 7 (plugin API) → Task 11, Task 16. Section 8 (i18n seam) → Task 12. Section 9 (migration seam) → Task 4's `fetchFeatures` signature and Global Constraints note. Section 10 (folder/build) → Task 1. Section 11 (non-goals) → respected throughout (no backend, no auto-play, no MONTHLY/YEARLY matching, no locale switcher). Section 12 (reference instance) → Task 15.
- **Placeholder scan:** no TBD/TODO; Task 1's minimal `main.ts` and Task 10's temporary browser-check snippet are explicitly labeled as throwaway scaffolding that later tasks replace, not unfinished work.
- **Type consistency:** `GeoFeature` (with `id?: string | number`) defined once in Task 2 and reused verbatim through Tasks 3-16. `LoadedLayer` defined once in Task 7 and reused in Tasks 8, 14, 15. `LayerManifest`/`AppManifest` defined once in Task 5 and reused everywhere else. `Store<AppState>` defined once in Task 6. Function names (`isActiveOn`, `fetchFeatures`, `computeTaxonomyDimensions`, `getTriState`, `toggleAll`, `findContainingRegions`, `resolveMarkerStyle`, `createMap`, `renderDataLayer`, `registerPlugin`/`getPanelSlots`/`dispatch*`, `loadStrings`/`t`, `searchFeatures`, `describeTemporalStatus`, `mountPanelLeft`/`mountPanelRight`/`mountCalendarBar`, `buildParticipateUrl`/`registerParticipatePlugin`) are each defined in exactly one task and referenced by identical name everywhere they're reused.
