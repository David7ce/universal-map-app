# `apps/` → `worlds/` rename — Design

Status: approved
Date: 2026-08-04

## 1. Purpose

Sub-project 1 of `feature-request-world-def.md`'s "World Definition Package System" — the foundational rename everything else builds on. Turns `apps/<id>/` into `worlds/<id>/`, `app-manifest.json` into `world.json`, and the `?app=` URL switcher into `?world=`, matching the vocabulary the rest of the feature (world loader, rule system, plugin-driven layers) is specified in. Pure reorg — the manifest's actual field shape, validation logic, and every other engine behavior are untouched. `AppManifest`/`appManifest`/`validateAppManifest` stay as the internal TypeScript names; only the on-disk paths, the JSON filename, and the URL query parameter change.

## 2. Scope decision: external rename only, hard cutover

Two decisions already made with the user, both final for this sub-project:

- **Hard cutover, no alias.** `apps/demo/` moves to `worlds/demo/` outright — no fallback path, no dual support. Single demo app, no external consumers, nothing to break by cutting over cleanly.
- **External rename only.** Directory name, JSON filename, URL query param, and the schema file describing that JSON's shape all change (they're artifacts a user of this repo actually sees/touches). Internal TypeScript identifiers — the `AppManifest` interface, `validateAppManifest()`, `appManifest.ts`'s filename, every `appManifest`-named variable, `resolveAppId()`, the `appId` variable — stay exactly as they are. Renaming those is a real refactor (6+ source files) with no external benefit, and is explicitly deferred to whenever it's actually needed (if ever) rather than bundled here.

## 3. File-by-file changes

**Filesystem:**

- `apps/demo/` → `worlds/demo/` (directory move, `git mv`).
- `worlds/demo/app-manifest.json` → `worlds/demo/world.json` (rename within the moved directory). Content unchanged except its own `$schema` pointer (see below).
- `worlds/demo/layers/*.layer.json` (all three): their `source.url` fields (`"apps/demo/data/....geojson"`) update to `"worlds/demo/data/....geojson"`. Nothing else in these files changes — their own `$schema` relative path (`../../../docs/schemas/layer.schema.json`) stays valid unchanged, since `apps`→`worlds` is a same-depth single-segment swap.

**`src/main.ts`:**

- Comments referencing `apps/<id>/` and `?app=` updated to `worlds/<id>/` / `?world=`.
- `.get('app')` → `.get('world')` (still assigned to the existing `appId` variable — that name isn't part of the external surface).
- The three template-literal paths (`` `apps/${appId}/app-manifest.json` ``, `` `apps/${appId}/${appManifest.strings}` ``, `` `apps/${appId}/${layerPath}` ``) become `` `worlds/${appId}/world.json` `` etc.
- `resolveAppId()`'s function name, its regex validation, and its `'demo'` fallback are unchanged — only the literal strings it reads from/builds change.

**`vite.config.ts`:**

- `copyAppsDirPlugin()`, the `'copy-apps-dir'` plugin name, and `resolve(rootDir, 'apps')`/`resolve(rootDir, outDir, 'apps')` all become their `worlds` equivalents — this is a literal directory-copy path, not a business-logic identifier, so it moves with the physical rename (otherwise the built `dist/` would silently stop shipping the demo data).

**`docs/schemas/`:**

- `app-manifest.schema.json` → `world.schema.json` (`git mv`), its `"title"` field text updated to match.
- `worlds/demo/world.json`'s own `"$schema"` value updates from `"../../docs/schemas/app-manifest.schema.json"` to `"../../docs/schemas/world.schema.json"`.

**Forward-looking docs** (describe current/future state, so they get updated): `README.md` ("Add a new app instance" section: `apps/<your-app-id>/`, `app-manifest.json`, `?app=<your-app-id>` all become their `worlds`/`world.json`/`?world=` equivalents), `docs/json-reference.md` (`## app-manifest.json` heading and its path references).

## 4. Explicitly out of scope (not touched)

- **`CHANGELOG.md`** — a historical record of what shipped and when. Past entries described `apps/`/`app-manifest.json` because that's what existed at the time; rewriting them to say `worlds/` would misrepresent history. This rename gets its own new entry once implemented, describing itself in its own terms — it does not edit old ones.
- **`docs/superpowers/specs/*.md` and `docs/superpowers/plans/*.md`** (all dated before this one) — same reasoning: point-in-time design records of decisions already made and shipped. Left as-written.
- **`feature-request-world-def.md`** — the user's own planning document; its "Migration Strategy" section deliberately contrasts old (`apps/demo`) vs. new (`worlds/example-world`) as an explanation, not a bug.
- **`tree.md`** — a generated snapshot from earlier in this project's history, not a source of truth; regenerable on demand via the commands embedded in it.
- **`docs/api-reference.md`** — its `AppManifest`/`validateAppManifest`/`createMap(container, appManifest)` references describe the internal API, which (per Section 2) isn't renamed.
- **Internal TypeScript naming** — covered in Section 2, restated here because it's the single biggest thing this rename deliberately does _not_ touch.

## 5. Testing

No behavioral change, so no new tests. Verification is: `npx vitest run` (existing suite must stay green — `manifests.test.ts` tests `validateAppManifest()` against in-memory fixtures, not real file paths, so it's unaffected either way), `npx tsc --noEmit`, `npx vite build` followed by a check that `dist/worlds/demo/world.json` exists (proves `vite.config.ts`'s renamed copy plugin actually ran), and loading the app in a browser at both the default URL and `?world=demo` to confirm the manifest fetch resolves. Real-browser verification is the same known gap as the rest of this session (Playwright MCP tool needs a session restart to pick up its Chromium fix) — note explicitly rather than skip silently if a browser still isn't available when this is implemented.

## 6. Follow-on (not this sub-project)

Sub-projects 2 (`world.json` schema extension: `systems`/`calendar.available`/etc.), 3 (data source abstraction), 4 (rule system), 5 (plugin config extension), 6 (engine orchestration) all build on this rename but are separately specced and planned, per the decomposition agreed before this design.
