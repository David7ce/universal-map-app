# Isolated per-domain world builds + branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a single `worlds/<id>/` package be built as a standalone static site — own default world (no `?world=` needed), own bundled data only (no other world's data shipped), own page title/favicon — so it can be deployed on its own domain.

**Architecture:** Vite's `--mode <world-id>` doubles as the world selector. A new pure function `resolveWorldId` picks the world from `?world=` first, then falls back to `import.meta.env.MODE` when that mode isn't `development`/`production`, else `'demo'`. `copyWorldsDirPlugin` (`vite.config.ts`) becomes mode-aware: in an isolated mode it copies only that one world's folder into `dist/worlds/`, instead of the whole `worlds/` tree. A new `applyBranding` function sets `document.title` from the manifest's existing (already-present, currently-unused-for-this) `title` field and, if a new optional `favicon` field is set, swaps the `<link rel="icon">`.

**Tech Stack:** TypeScript, Vite, Vitest. No new dependencies.

## Global Constraints

- No new npm dependencies (spec section 2: "no `cross-env` needed").
- `npm run dev` and plain `npm run build` (modes `development`/`production`) must behave exactly as today — default world `demo`, all worlds present in `dist/worlds/` (spec section 2, 3).
- `?world=` query param must still work as an override in every mode (spec section 2).
- Backward compatible: `worlds/demo/world.json` is not required to change (spec section 5).
- `title` is already a required field on `AppManifest` (`src/engine/manifests/app-manifest.ts:14`) and already present in `worlds/demo/world.json`, but nothing currently applies it to `document.title` — this plan wires up the existing field rather than adding a new one. `favicon` is genuinely new.

---

### Task 1: `resolveWorldId` — extract and test the mode-fallback selector

**Files:**
- Create: `src/engine/manifests/resolve-world-id.ts`
- Create: `src/engine/manifests/resolve-world-id.test.ts`
- Modify: `src/main.ts:30-36` (replace inline `resolveAppId` with the new import)

**Interfaces:**
- Produces: `resolveWorldId(searchParams: URLSearchParams, mode: string): string` — used by `src/main.ts`'s `bootstrap()`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/engine/manifests/resolve-world-id.test.ts
import { describe, expect, it } from 'vitest';
import { resolveWorldId } from './resolve-world-id';

describe('resolveWorldId', () => {
  it('uses the "world" query param when present and valid', () => {
    expect(resolveWorldId(new URLSearchParams('world=tenerife-events'), 'production')).toBe('tenerife-events');
  });

  it('ignores a query param with invalid characters', () => {
    expect(resolveWorldId(new URLSearchParams('world=../etc'), 'production')).toBe('demo');
  });

  it('falls back to "demo" in development mode with no query param', () => {
    expect(resolveWorldId(new URLSearchParams(''), 'development')).toBe('demo');
  });

  it('falls back to "demo" in production mode with no query param', () => {
    expect(resolveWorldId(new URLSearchParams(''), 'production')).toBe('demo');
  });

  it('falls back to the mode name in an isolated per-world build mode', () => {
    expect(resolveWorldId(new URLSearchParams(''), 'paranormal-espana')).toBe('paranormal-espana');
  });

  it('query param still overrides an isolated build mode', () => {
    expect(resolveWorldId(new URLSearchParams('world=demo'), 'paranormal-espana')).toBe('demo');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/manifests/resolve-world-id.test.ts`
Expected: FAIL — `Cannot find module './resolve-world-id'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/engine/manifests/resolve-world-id.ts

// Which `worlds/<id>/` instance to load. `?world=<id>` always wins when
// present and safe (a plain path segment — no traversal via the query
// string). Otherwise, an isolated per-world build (`vite build --mode
// <world-id>`) makes that mode name double as the default world; the
// generic `development`/`production` modes (plain `npm run dev` / `npm run
// build`) fall back to `demo`, same as before isolated builds existed.
export function resolveWorldId(searchParams: URLSearchParams, mode: string): string {
  const requested = searchParams.get('world');
  if (requested && /^[a-zA-Z0-9_-]+$/.test(requested)) {
    return requested;
  }
  return mode === 'development' || mode === 'production' ? 'demo' : mode;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/manifests/resolve-world-id.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Wire it into `main.ts`, removing the old inline function**

In `src/main.ts`, delete the existing `resolveAppId` function (lines 30-36) and its call site, replacing with:

```typescript
import { resolveWorldId } from './engine/manifests/resolve-world-id';
```

(added near the other engine imports at the top of the file), and in `bootstrap()`:

```typescript
const appId = resolveWorldId(new URLSearchParams(window.location.search), import.meta.env.MODE);
```

replacing the old `const appId = resolveAppId();`.

- [ ] **Step 6: Run full test suite and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no errors

- [ ] **Step 7: Commit**

```bash
git add src/engine/manifests/resolve-world-id.ts src/engine/manifests/resolve-world-id.test.ts src/main.ts
git commit -m "refactor: extract resolveWorldId, fall back to build mode for isolated world builds"
```

---

### Task 2: `copyWorldsDirPlugin` — scope the copy to one world in isolated modes

**Files:**
- Modify: `vite.config.ts:20-38`
- Modify: `package.json` (add one build script)

**Interfaces:**
- Consumes: nothing from Task 1 (independent).
- Produces: `dist/worlds/` containing only `worlds/<mode>/` when built with an isolated `--mode <world-id>`; unchanged (full `worlds/` tree) when built with `development`/`production` mode.

- [ ] **Step 1: Modify `copyWorldsDirPlugin` to be mode-aware**

Replace the plugin body in `vite.config.ts`:

```typescript
function copyWorldsDirPlugin(): Plugin {
  let rootDir = process.cwd();
  let outDir = 'dist';
  let mode = 'production';

  return {
    name: 'copy-worlds-dir',
    apply: 'build',
    configResolved(resolvedConfig) {
      rootDir = resolvedConfig.root;
      outDir = resolvedConfig.build.outDir;
      mode = resolvedConfig.mode;
    },
    async closeBundle() {
      const isolatedWorld = mode === 'development' || mode === 'production' ? null : mode;
      const srcDir = resolve(rootDir, 'worlds', ...(isolatedWorld ? [isolatedWorld] : []));
      if (!existsSync(srcDir)) return;
      const destDir = resolve(rootDir, outDir, 'worlds', ...(isolatedWorld ? [isolatedWorld] : []));
      await cp(srcDir, destDir, { recursive: true });
    },
  };
}
```

Update the doc comment above the function (currently lines 7-19) to add, after the existing paragraph:

```typescript
/**
 * ... (existing comment unchanged) ...
 *
 * In an isolated per-world build (`vite build --mode <world-id>`, see
 * `resolveWorldId`), only that one world's folder is copied — every other
 * world's data is absent from `dist/`, so a domain built for one world
 * never ships another world's content.
 */
```

- [ ] **Step 2: Add a scoped build script to `package.json`**

In the `"scripts"` section, add (next to the existing `"build"` script):

```json
"build:demo-only": "vite build --mode demo --outDir dist/demo-only"
```

- [ ] **Step 3: Verify default build is unchanged**

Run: `npx vite build`
Expected: succeeds, `dist/worlds/demo/world.json` exists (full `worlds/` tree copied, same as before this task).

- [ ] **Step 4: Verify isolated build only copies one world**

Run:
```bash
npm run build:demo-only
```

Then check: `dist/demo-only/worlds/` contains only a `demo/` subdirectory (no sibling world folders — there's only `demo/` under `worlds/` today, so this run proves the isolated-copy code path executes correctly and produces the same single-folder result either way).

Expected: `dist/demo-only/worlds/demo/world.json` exists; `dist/demo-only/worlds/` has exactly one entry.

- [ ] **Step 5: Run full test suite and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no errors

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts package.json
git commit -m "feat: scope copy-worlds-dir plugin to one world in isolated build modes"
```

---

### Task 3: `favicon` field on `world.json`

**Files:**
- Modify: `src/engine/manifests/app-manifest.ts:12-22` (interface), `:55-57` area (validation)
- Modify: `src/engine/manifests/manifests.test.ts` (add cases to the existing `describe('validateAppManifest', ...)` block)
- Modify: `docs/schemas/world.schema.json`
- Modify: `docs/json-reference.md`

**Interfaces:**
- Consumes: nothing from Tasks 1-2 (independent).
- Produces: `AppManifest.favicon?: string`, used by Task 4's `applyBranding`.

- [ ] **Step 1: Write the failing tests**

Add to the `describe('validateAppManifest', ...)` block in `src/engine/manifests/manifests.test.ts` (after the existing `strings` tests around line 135):

```typescript
  it('accepts a valid "favicon" path', () => {
    const withFavicon = { ...valid, favicon: 'assets/favicon.png' };
    expect(validateAppManifest(withFavicon)).toEqual(withFavicon);
  });

  it('rejects a non-string "favicon" path', () => {
    expect(() => validateAppManifest({ ...valid, favicon: 42 })).toThrow(/favicon/);
  });

  it('accepts a manifest with no "favicon" field at all', () => {
    expect(validateAppManifest(valid)).toEqual(valid);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/manifests/manifests.test.ts`
Expected: FAIL — "accepts a valid favicon path" fails because `validateAppManifest` currently returns the object unchanged and doesn't reject it either, so the *rejects* test is the one that actually fails first (no error thrown for `favicon: 42`).

- [ ] **Step 3: Add the field to the interface and validation**

In `src/engine/manifests/app-manifest.ts`, add to the `AppManifest` interface (after `strings?: string;` on line 19):

```typescript
  favicon?: string;
```

Add validation, right after the existing `strings` check (currently lines 55-57):

```typescript
  if (obj.favicon !== undefined && typeof obj.favicon !== 'string') {
    throw new Error(`App manifest "${obj.id}" "favicon" must be a string path when present`);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/manifests/manifests.test.ts`
Expected: PASS (all tests, including the 3 new ones)

- [ ] **Step 5: Update `docs/schemas/world.schema.json`**

Add a new property inside `"properties"`, after the existing `"strings"` entry (currently lines 63-66):

```json
    "favicon": {
      "type": "string",
      "description": "Relative path (inside the world's folder) to a favicon image. If omitted, the app's default favicon (set in index.html) is kept."
    },
```

- [ ] **Step 6: Update `docs/json-reference.md`**

Add a row to the `world.json` field table (after the `strings` row, currently line 27):

```markdown
| `favicon`                       | `string`                                           | no                                                                | Relative path (inside the world's folder) to a favicon image, e.g. `"assets/favicon.png"`. If omitted, the default favicon (set in `index.html`) is kept.                                                                                                                                |
```

- [ ] **Step 7: Run full test suite and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no errors

- [ ] **Step 8: Commit**

```bash
git add src/engine/manifests/app-manifest.ts src/engine/manifests/manifests.test.ts docs/schemas/world.schema.json docs/json-reference.md
git commit -m "feat: add optional favicon field to world.json"
```

---

### Task 4: Apply branding (title + favicon) at bootstrap

**Files:**
- Create: `src/ui/branding.ts`
- Modify: `src/main.ts` (call the new function in `bootstrap()`)

**Interfaces:**
- Consumes: `AppManifest` from Task 3 (`favicon?: string`, and the already-existing `title: string`), `appId: string` from Task 1's `resolveWorldId` result (already available in `bootstrap()` as the existing `appId` local).
- Produces: `applyBranding(manifest: AppManifest, appId: string, doc?: Document): void`.

- [ ] **Step 1: Write `applyBranding`**

```typescript
// src/ui/branding.ts
import type { AppManifest } from '../engine/manifests/app-manifest';

// Sets the page title and, if the manifest specifies one, swaps the
// favicon. `doc` defaults to the global `document` — parameterized so this
// stays testable without a DOM environment, matching the rest of `src/ui/`.
export function applyBranding(manifest: AppManifest, appId: string, doc: Document = document): void {
  doc.title = manifest.title;

  if (!manifest.favicon) return;

  const href = `worlds/${appId}/${manifest.favicon}`;
  let link = doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = doc.createElement('link');
    link.rel = 'icon';
    doc.head.appendChild(link);
  }
  link.href = href;
}
```

- [ ] **Step 2: Wire it into `main.ts`**

In `src/main.ts`'s `bootstrap()`, right after `const appManifest = validateAppManifest(...)` (line 40), add:

```typescript
applyBranding(appManifest, appId);
```

and add the import near the other `./ui/*` imports:

```typescript
import { applyBranding } from './ui/branding';
```

- [ ] **Step 3: Run type-check**

Run: `npx tsc --noEmit`
Expected: PASS, no errors

(No automated test for `applyBranding` itself — the project's test environment is `node`, not `jsdom` (see `vite.config.ts`'s `test.environment`), and no other DOM-manipulating `src/ui/*.ts` file in this codebase has one either; the existing convention is manual verification via the dev server, done next.)

- [ ] **Step 4: Manually verify default behavior (dev server, mode `development`)**

Run: `npm run dev`, open the app in a browser at the default URL.
Expected: browser tab title is "Universal Map Demo" (from `worlds/demo/world.json`'s existing `title` field); favicon unchanged from the current pin-drop SVG (since `worlds/demo/world.json` has no `favicon` field).

- [ ] **Step 5: Manually verify an isolated build picks up branding**

Add a temporary `"favicon": "https://vitejs.dev/logo.svg"` to `worlds/demo/world.json` (a full URL works fine as a relative-fallback test — `applyBranding` just concatenates it after `worlds/${appId}/`, so use a temporary relative-looking dummy instead to match real usage: create `worlds/demo/favicon-test.svg` with any placeholder SVG content, set `"favicon": "favicon-test.svg"`), run `npm run build:demo-only`, serve `dist/demo-only` locally (e.g. `npx serve dist/demo-only` or any static server), open it in a browser.
Expected: tab title "Universal Map Demo", favicon shows the placeholder SVG. Then revert `worlds/demo/world.json` and delete the temporary SVG — this was a manual check, not a permanent change to the demo world.

- [ ] **Step 6: Run full test suite one more time**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no errors

- [ ] **Step 7: Commit**

```bash
git add src/ui/branding.ts src/main.ts
git commit -m "feat: apply page title and favicon from world.json at bootstrap"
```

---

### Task 5: Changelog entry

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add a new entry at the top of `CHANGELOG.md`**

Following the existing entry format (a `##` heading, then a paragraph), add above the current first entry:

```markdown
## Isolated per-domain world builds, plus `favicon`

`vite build --mode <world-id>` now makes that mode name double as the default world (`resolveWorldId`, `src/engine/manifests/resolve-world-id.ts` — `?world=` still overrides it) and scopes `copyWorldsDirPlugin`'s output to only that world's folder, so a domain-specific build (e.g. `npm run build:demo-only`) ships none of another world's data. Plain `npm run dev`/`npm run build` (modes `development`/`production`) are unaffected — still default to `demo` with every world present. `world.json` gains an optional `favicon` field (validated alongside the existing `strings` field in `validateAppManifest`); a new `applyBranding()` (`src/ui/branding.ts`) sets `document.title` from the manifest's existing `title` field and swaps the favicon at bootstrap, both previously unused/hardcoded.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog entry for isolated per-domain world builds"
```
