# apps/ -> worlds/ Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `apps/` to `worlds/`, `app-manifest.json` to `world.json`, and the `?app=` URL switcher to `?world=`, with zero behavioral change — pure reorg, sub-project 1 of `feature-request-world-def.md`.

**Architecture:** Physical directory/file rename (`git mv`) plus updating every literal path string that references the old names — in demo data files, the two places `src/main.ts` builds fetch URLs, `vite.config.ts`'s build-copy plugin, the manifest JSON Schema file, and forward-looking docs. No TypeScript identifier renames (`AppManifest`, `validateAppManifest`, `appManifest.ts`, `resolveAppId()` all stay as-is — internal naming, out of scope per the design doc).

**Tech Stack:** No new dependencies. Plain `git mv`, JSON edits, TypeScript string-literal edits.

## Global Constraints

- Design doc: `docs/superpowers/specs/2026-08-04-worlds-rename-design.md` — read it before starting.
- Hard cutover, no alias/fallback for the old `apps/`/`app-manifest.json`/`?app=` names.
- Internal TypeScript identifiers (`AppManifest` interface, `validateAppManifest()`, `appManifest.ts` filename, every `appManifest`/`appId`-named variable, `resolveAppId()`) are NOT renamed — only external paths/filenames/URL param.
- Do NOT edit `CHANGELOG.md`'s existing entries, any file under `docs/superpowers/specs/`/`docs/superpowers/plans/` dated before 2026-08-04, `feature-request-world-def.md`, `tree.md`, or `docs/api-reference.md` — all explicitly out of scope per the design doc (historical records or describing the unrenamed internal API).
- Run `npx vitest run`, `npx tsc --noEmit`, `npx vite build`, and `npx prettier --check .` before every commit in this plan — zero tolerance for any of the four failing (`prettier --write .` if the check fails).

---

### Task 1: Move the filesystem, update path literals inside the moved files

**Files:**
- Move: `apps/` -> `worlds/` (`git mv`)
- Move: `worlds/demo/app-manifest.json` -> `worlds/demo/world.json` (`git mv`, after the directory move above)
- Move: `docs/schemas/app-manifest.schema.json` -> `docs/schemas/world.schema.json` (`git mv`)
- Modify: `worlds/demo/world.json`
- Modify: `worlds/demo/layers/poi.layer.json`
- Modify: `worlds/demo/layers/regions.layer.json`
- Modify: `worlds/demo/layers/heatmap.layer.json`
- Modify: `docs/schemas/world.schema.json`

**Interfaces:** None — this task only moves/edits data files, no code. Task 2 depends on these paths existing at their new location.

- [ ] **Step 1: Move the directory and rename the manifest**

```bash
git mv apps worlds
git mv worlds/demo/app-manifest.json worlds/demo/world.json
git mv docs/schemas/app-manifest.schema.json docs/schemas/world.schema.json
```

- [ ] **Step 2: Update `worlds/demo/world.json`'s `$schema` pointer**

Current content (first line only needs to change):
```json
{
  "$schema": "../../docs/schemas/app-manifest.schema.json",
  "id": "demo",
```
Change the `$schema` line to:
```json
  "$schema": "../../docs/schemas/world.schema.json",
```
Nothing else in this file changes — `id`, `title`, `map`, `baseLayers`, `dataLayers`, `calendar`, `strings`, `plugins` all stay exactly as they are.

- [ ] **Step 3: Update the three layer files' `source.url`**

`worlds/demo/layers/poi.layer.json` and `worlds/demo/layers/heatmap.layer.json` both currently have:
```json
  "source": { "type": "geojson", "url": "apps/demo/data/poi.geojson" },
```
Change to:
```json
  "source": { "type": "geojson", "url": "worlds/demo/data/poi.geojson" },
```

`worlds/demo/layers/regions.layer.json` currently has:
```json
  "source": { "type": "geojson", "url": "apps/demo/data/regions.geojson" },
```
Change to:
```json
  "source": { "type": "geojson", "url": "worlds/demo/data/regions.geojson" },
```
Every other field in all three layer files (`id`, `title`, `kind`, `temporal`, `taxonomy`, `regionRole`, `style`, `panel`, and each file's own `$schema` — which stays `"../../../docs/schemas/layer.schema.json"`, unchanged, since `apps`->`worlds` doesn't change path depth) is untouched.

- [ ] **Step 4: Update `docs/schemas/world.schema.json`'s title**

Current (lines 3-5):
```json
  "$id": "https://universal-map-app/schemas/app-manifest.schema.json",
  "title": "Universal Map app-manifest.json",
  "description": "See docs/json-reference.md for the full field-by-field reference. Mirrors the runtime checks in src/engine/manifests/app-manifest.ts (validateAppManifest) - keep both in sync when either changes.",
```
Change to:
```json
  "$id": "https://universal-map-app/schemas/world.schema.json",
  "title": "Universal Map world.json",
  "description": "See docs/json-reference.md for the full field-by-field reference. Mirrors the runtime checks in src/engine/manifests/app-manifest.ts (validateAppManifest) - keep both in sync when either changes.",
```
Note: the description's reference to `app-manifest.ts`/`validateAppManifest` is correct and unchanged — those internal names are not renamed (Global Constraints). Every other field in this schema file (the `properties` object, `definitions`, etc.) is untouched — this task only touches the three lines above.

- [ ] **Step 5: Verify the moves and edits**

Run: `git status --short`
Expected: renames shown for the directory move and the two file renames (git detects `git mv` as a rename when content is >50% similar — the schema/manifest edits are small enough that this should still show as `R`, but `A`/`D` pairs are equally fine, no action needed either way), plus modified markers for the 4 edited JSON files.

Run: `node -e "JSON.parse(require('fs').readFileSync('worlds/demo/world.json','utf8')); JSON.parse(require('fs').readFileSync('worlds/demo/layers/poi.layer.json','utf8')); JSON.parse(require('fs').readFileSync('worlds/demo/layers/regions.layer.json','utf8')); JSON.parse(require('fs').readFileSync('worlds/demo/layers/heatmap.layer.json','utf8')); JSON.parse(require('fs').readFileSync('docs/schemas/world.schema.json','utf8')); console.log('all valid JSON')"`
Expected: `all valid JSON`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move apps/ to worlds/, app-manifest.json to world.json"
```

---

### Task 2: Update `src/main.ts` and `vite.config.ts` to read/copy the new paths

**Files:**
- Modify: `src/main.ts:29-52`
- Modify: `vite.config.ts` (whole file — it's 51 lines, small enough to show in full)

**Interfaces:**
- Consumes: `worlds/demo/world.json` and `worlds/demo/layers/*.layer.json` existing at their new paths (Task 1).
- Produces: nothing new — `resolveAppId()`, `bootstrap()`, and `copyAppsDirPlugin()` keep their existing names/signatures, per Global Constraints. No other file in the codebase calls these differently after this task.

- [ ] **Step 1: Update `src/main.ts`'s comment, query param, and path literals**

Current (lines 29-52):
```ts
// Which `apps/<id>/` instance to load. Defaults to "demo"; override with
// `?app=<id>` (e.g. during local development or a multi-app static host).
// Restricted to a safe path segment — no traversal via the query string.
function resolveAppId(): string {
  const requested = new URLSearchParams(window.location.search).get('app');
  return requested && /^[a-zA-Z0-9_-]+$/.test(requested) ? requested : 'demo';
}

async function bootstrap(): Promise<void> {
  const appId = resolveAppId();
  const appManifest = validateAppManifest(await fetchJson(`apps/${appId}/app-manifest.json`));

  // Only islamic/hebrew calendars pull in @js-temporal/polyfill (a sizable
  // dependency); kick the load off now so it runs in parallel with the
  // fetches below, and await it right before the first consumer needs it.
  const calendarSystemLoaded = ensureCalendarSystemLoaded(appManifest.calendar.system ?? 'gregorian');

  const strings = await loadStrings(appManifest.strings ? `apps/${appId}/${appManifest.strings}` : undefined);

  await activatePlugins(appManifest.plugins, strings);

  const loadedLayers: LoadedLayer[] = await Promise.all(
    appManifest.dataLayers.map(async (layerPath): Promise<LoadedLayer> => {
      const manifest: LayerManifest = validateLayerManifest(await fetchJson(`apps/${appId}/${layerPath}`));
      const features: GeoFeature[] = await fetchFeatures(manifest.source);
      return { manifest, features };
    }),
  );
```

Change to:
```ts
// Which `worlds/<id>/` instance to load. Defaults to "demo"; override with
// `?world=<id>` (e.g. during local development or a multi-world static host).
// Restricted to a safe path segment — no traversal via the query string.
function resolveAppId(): string {
  const requested = new URLSearchParams(window.location.search).get('world');
  return requested && /^[a-zA-Z0-9_-]+$/.test(requested) ? requested : 'demo';
}

async function bootstrap(): Promise<void> {
  const appId = resolveAppId();
  const appManifest = validateAppManifest(await fetchJson(`worlds/${appId}/world.json`));

  // Only islamic/hebrew calendars pull in @js-temporal/polyfill (a sizable
  // dependency); kick the load off now so it runs in parallel with the
  // fetches below, and await it right before the first consumer needs it.
  const calendarSystemLoaded = ensureCalendarSystemLoaded(appManifest.calendar.system ?? 'gregorian');

  const strings = await loadStrings(appManifest.strings ? `worlds/${appId}/${appManifest.strings}` : undefined);

  await activatePlugins(appManifest.plugins, strings);

  const loadedLayers: LoadedLayer[] = await Promise.all(
    appManifest.dataLayers.map(async (layerPath): Promise<LoadedLayer> => {
      const manifest: LayerManifest = validateLayerManifest(await fetchJson(`worlds/${appId}/${layerPath}`));
      const features: GeoFeature[] = await fetchFeatures(manifest.source);
      return { manifest, features };
    }),
  );
```

Note: `resolveAppId()`'s function name and every variable name (`appId`, `appManifest`, `loadedLayers`) are unchanged — only the query-param key (`'app'` -> `'world'`), the comment wording, and the three template-literal path strings (`apps/` -> `worlds/`, `app-manifest.json` -> `world.json`) change.

- [ ] **Step 2: Replace `vite.config.ts` in full**

```ts
/// <reference types="vitest/config" />
import { existsSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * `worlds/` (world manifests, layer manifests, strings, and .geojson data —
 * see design spec Section 10) lives at the project root, sibling to `src/`,
 * not inside `publicDir` (this repo has no `public/` directory). Vite's dev
 * server happens to serve any file under the project root, so
 * `fetch('/worlds/demo/...')` works fine under `npm run dev` — but the
 * production build only emits the bundled module graph plus a copy of
 * `publicDir`, so `worlds/` is otherwise absent from `dist/` and every one of
 * `main.ts`'s runtime `fetch()` calls 404s once deployed as a static site.
 * This plugin copies `worlds/` into the build output directory after the
 * bundle is written, without requiring a new dependency or moving `worlds/`
 * out of the documented folder structure.
 */
function copyWorldsDirPlugin(): Plugin {
  let rootDir = process.cwd();
  let outDir = 'dist';

  return {
    name: 'copy-worlds-dir',
    apply: 'build',
    configResolved(resolvedConfig) {
      rootDir = resolvedConfig.root;
      outDir = resolvedConfig.build.outDir;
    },
    async closeBundle() {
      const srcDir = resolve(rootDir, 'worlds');
      if (!existsSync(srcDir)) return;
      const destDir = resolve(rootDir, outDir, 'worlds');
      await cp(srcDir, destDir, { recursive: true });
    },
  };
}

export default defineConfig({
  // Relative, not an absolute '/...' path: this app is deployed as a GitHub
  // Pages project site (served from '/<repo>/', not the domain root), and a
  // relative base keeps the built asset references correct there without
  // hardcoding the repo name — same build also works served from a domain
  // root or any other subpath.
  base: './',
  plugins: [copyWorldsDirPlugin()],
  test: {
    environment: 'node',
  },
});
```

Note: `copyAppsDirPlugin` -> `copyWorldsDirPlugin` and the Vite plugin's own `name: 'copy-apps-dir'` -> `'copy-worlds-dir'` DO change here, unlike `AppManifest`/`resolveAppId` — this function's entire purpose is copying the literal `apps`/`worlds` directory, so its name is describing the external artifact (per the design doc's Section 3, this plugin is explicitly called out as moving with the rename).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests passing — `manifests.test.ts` tests `validateAppManifest()`/`validateLayerManifest()` against in-memory fixture objects, not real file fetches, so this task doesn't change any test's expected outcome.

- [ ] **Step 5: Build and verify the output**

Run: `npx vite build`
Expected: build succeeds.

Run: `node -e "if (!require('fs').existsSync('dist/worlds/demo/world.json')) { console.error('MISSING dist/worlds/demo/world.json'); process.exit(1); } console.log('dist/worlds/demo/world.json present')"`
Expected: `dist/worlds/demo/world.json present` — proves `copyWorldsDirPlugin` actually copied the renamed directory into the build output.

- [ ] **Step 6: Format**

Run: `npx prettier --check src/main.ts vite.config.ts`
If it warns: run `npx prettier --write src/main.ts vite.config.ts` and re-check.

- [ ] **Step 7: Commit**

```bash
git add src/main.ts vite.config.ts
git commit -m "refactor: read worlds/<id>/world.json and ?world= in main.ts, vite.config.ts"
```

---

### Task 3: Update forward-looking docs, add a CHANGELOG entry

**Files:**
- Modify: `README.md:16-24`
- Modify: `docs/json-reference.md:3,5,11,13`
- Modify: `CHANGELOG.md` (add a new entry — do not touch any existing entry)

**Interfaces:** None — documentation only.

- [ ] **Step 1: Update `README.md`'s "Add a new app instance" section**

Current (lines 16-24):
```markdown
## Add a new app instance

1. Create a new folder under `apps/<your-app-id>/`.
2. Add an `app-manifest.json` (see `apps/demo/app-manifest.json` for the shape).
3. Add one `*.layer.json` per data layer under `apps/<your-app-id>/layers/`, and the matching GeoJSON under `apps/<your-app-id>/data/`.
4. Optionally add `strings.json` for your own UI text, and a `plugins` block to activate `participate`.
5. Load it with `?app=<your-app-id>` in the URL (e.g. `http://localhost:5173/?app=my-app`), or leave the query param off to get `apps/demo/` by default. Full multi-app routing (an app switcher UI, per-app subdomains, etc.) is still intentionally out of scope for v1 (see the design spec's non-goals) — this is just a static id lookup, resolved once at page load.

No engine code under `src/engine/` needs to change to add a new app instance.
```

Change to:
```markdown
## Add a new world instance

1. Create a new folder under `worlds/<your-world-id>/`.
2. Add a `world.json` (see `worlds/demo/world.json` for the shape).
3. Add one `*.layer.json` per data layer under `worlds/<your-world-id>/layers/`, and the matching GeoJSON under `worlds/<your-world-id>/data/`.
4. Optionally add `strings.json` for your own UI text, and a `plugins` block to activate `participate`.
5. Load it with `?world=<your-world-id>` in the URL (e.g. `http://localhost:5173/?world=my-world`), or leave the query param off to get `worlds/demo/` by default. Full multi-world routing (a world switcher UI, per-world subdomains, etc.) is still intentionally out of scope for v1 (see the design spec's non-goals) — this is just a static id lookup, resolved once at page load.

No engine code under `src/engine/` needs to change to add a new world instance.
```

- [ ] **Step 2: Update `docs/json-reference.md`'s intro and `world.json` heading**

Current (line 3):
```markdown
Field-by-field reference for the three JSON shapes the engine uses: the app manifest, the layer manifest, and the GeoJSON data (with the `temporal` extension). All of these live under `apps/<app-id>/` — see `apps/demo/` as a working reference instance.
```
Change to:
```markdown
Field-by-field reference for the three JSON shapes the engine uses: the world manifest, the layer manifest, and the GeoJSON data (with the `temporal` extension). All of these live under `worlds/<world-id>/` — see `worlds/demo/` as a working reference instance.
```

Current (line 11):
```markdown
## `app-manifest.json`
```
Change to:
```markdown
## `world.json`
```

Current (line 13):
```markdown
One object per app instance, referenced from `src/main.ts` (currently with the path `/apps/demo/app-manifest.json` hardcoded — see "Add a new app instance" in `README.md`).
```
Change to:
```markdown
One object per world instance, referenced from `src/main.ts` (currently with the path `/worlds/demo/world.json` hardcoded — see "Add a new world instance" in `README.md`).
```

Note: line 5 (`Validated at runtime by \`validateAppManifest\` ...`) is NOT changed — `validateAppManifest` is the correct, unrenamed internal function name per Global Constraints.

- [ ] **Step 3: Add a CHANGELOG entry**

Add to the top of `CHANGELOG.md`, right after the `# Changelog` header and its intro paragraph (before whatever is currently the first entry — do not modify that existing entry or any other):

```markdown
## `apps/` renamed to `worlds/`, `app-manifest.json` to `world.json`

Pure rename, no behavior change — `worlds/<id>/` and `worlds/<id>/world.json` replace `apps/<id>/` and `apps/<id>/app-manifest.json`, and the URL switcher is now `?world=<id>` instead of `?app=<id>`. Matches the vocabulary `feature-request-world-def.md`'s "World Definition Package System" is specified in; this is sub-project 1 of that effort (see `docs/superpowers/specs/2026-08-04-worlds-rename-design.md`). Internal TypeScript naming (`AppManifest`, `validateAppManifest()`, `appManifest.ts`, `resolveAppId()`) deliberately stays as-is — external rename only, hard cutover, no alias for the old paths.
```

- [ ] **Step 4: Format**

Run: `npx prettier --check README.md docs/json-reference.md CHANGELOG.md`
If it warns: run `npx prettier --write README.md docs/json-reference.md CHANGELOG.md` and re-check.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/json-reference.md CHANGELOG.md
git commit -m "docs: update README/json-reference for worlds/ rename, log in CHANGELOG"
```

---

### Task 4: Final verification

**Files:** None — verification only.

**Interfaces:** None.

- [ ] **Step 1: Full verification pass**

Run in order, all must pass:

```bash
npx vitest run
npx tsc --noEmit
npx vite build
npx prettier --check .
```

- [ ] **Step 2: Confirm no stray `apps/`/`app-manifest.json`/`?app=` references remain in files this plan touches**

Run: `grep -rn "apps/\|app-manifest\.json\|?app=" src/main.ts vite.config.ts README.md docs/json-reference.md worlds/ 2>/dev/null`
Expected: no output (empty). If anything prints, it's a missed reference from Tasks 1-3 — fix it, re-run Step 1, and re-run this check before proceeding.

Note: this check is deliberately scoped to the files this plan touches, not the whole repo — `CHANGELOG.md`'s pre-existing entries, `docs/superpowers/specs/`/`plans/` dated before 2026-08-04, `feature-request-world-def.md`, `tree.md`, and `docs/api-reference.md` are all supposed to still reference the old names (Global Constraints) and must not be "fixed" by this step.

- [ ] **Step 3: Manual browser verification (if available)**

Run: `npx vite --port 5173` in the background.

Open `http://localhost:5173` — confirm the demo map loads (proves `worlds/demo/world.json` fetches correctly at the default id).
Open `http://localhost:5173/?world=demo` — confirm it also loads (proves the renamed query param works).
Open `http://localhost:5173/?app=demo` — confirm this now falls back to the `demo` default rather than trying to load a nonexistent `worlds/demo/` via the old param name (it will still resolve to `demo` since `?app=` is simply not read anymore and `resolveAppId()` falls back to `'demo'` — this is expected, not a bug, since there's no `apps/` directory left to 404 against).

Stop the dev server (`Ctrl+C` or kill the process) when done.

If a real browser isn't reliably available in this environment, note that explicitly instead of claiming this step passed — same caveat as the rest of this project's session history (Playwright MCP tool needed a session restart to pick up its Chromium executable-path fix).

- [ ] **Step 4: No commit needed**

This task is verification-only — if Steps 1-2 pass and Step 3 is either confirmed or explicitly noted as skipped, the plan is complete. Nothing to commit here (Tasks 1-3 already committed their own changes).
