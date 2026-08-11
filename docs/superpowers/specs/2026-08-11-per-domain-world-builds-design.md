# Isolated per-domain world builds + branding — Design

Status: approved
Date: 2026-08-11

## 1. Purpose

Sub-project of `feature-request-world-def.md`'s "World Definition Package System": lets a single `worlds/<id>/` package be deployed as its own standalone static site on its own domain — e.g. `paranormal-espana.com` loading only `worlds/paranormal-espana/`, with no other world's data present in that bundle and no `?world=` query param needed. Motivated by three planned worlds (paranormal-espana, tenerife-events, moon-photos) that may each want a separate domain rather than living behind one shared multi-world URL.

Infra only. Creating those three worlds' actual content (real geojson, real events, real photos) is separate follow-up work per world, done once real data exists — not part of this spec.

## 2. Mechanism: Vite `--mode <world-id>` as the world selector

- `resolveAppId()` (`src/main.ts`) currently reads `?world=` and falls back to the literal `'demo'`. It changes to fall back to `import.meta.env.MODE` whenever that mode isn't `development` or `production` — so `vite build --mode paranormal-espana` makes `paranormal-espana` load by default, no query param needed. `?world=` still works as an override in every mode (harmless in an isolated build: requesting an id whose data isn't in that bundle just 404s on the manifest fetch, same as today requesting a nonexistent world).
- `npm run dev` (mode `development`) and plain `npm run build` (mode `production`) are unaffected — both still fall back to `'demo'`, exactly today's behavior.
- No `.env` files, no new dependency (no `cross-env` needed): Vite exposes `import.meta.env.MODE` from the `--mode` flag automatically, and it's read the same way on Windows/macOS/Linux.

## 3. `copyWorldsDirPlugin` — scoped copy in isolated mode

- Today (`vite.config.ts`) it copies the entire `worlds/` directory into `dist/worlds/` unconditionally.
- It gains mode-awareness via `configResolved`'s `resolvedConfig.mode`: when mode is `development` or `production`, behavior is unchanged (copy everything). In any other mode (an isolated per-world build), it copies only `worlds/<mode>/` into `dist/worlds/<mode>/` — every other world's data is simply absent from that `dist/`.
- `outDir` stays whatever Vite resolves (respects `--outDir` CLI overrides), so each domain's build can be pointed at its own output folder, e.g. `vite build --mode paranormal-espana --outDir dist/paranormal-espana`.

## 4. `package.json` scripts

One `build:<world-id>` script added per world, only once that world actually exists under `worlds/`:

```json
"build:demo-only": "vite build --mode demo --outDir dist/demo-only"
```

(shown using `demo` since it's the only real world today — proves the mechanism without waiting on real content). Equivalent `build:paranormal-espana`, `build:tenerife-events`, `build:moon-photos` scripts get added when those worlds are created.

## 5. Branding: `title` / `favicon` in `world.json`

Two new optional top-level fields:

```json
{
  "title": "Paranormal España",
  "favicon": "assets/favicon.png"
}
```

- `title`: optional string, shown as the page `<title>`.
- `favicon`: optional string, path relative to that world's folder (same convention as the existing `strings` field) — a `<link rel="icon">` is pointed at `worlds/${appId}/${favicon}`.
- `validateAppManifest` (`src/engine/manifests/app-manifest.ts`) gets the same "if present, must be a non-empty string" check it already applies to `strings`.
- `src/main.ts` bootstrap sets `document.title = appManifest.title ?? document.title` (leaves `index.html`'s static title alone when absent) and, only if `favicon` is present, creates or updates a `<link rel="icon">` element.
- `docs/schemas/world.schema.json` and `docs/json-reference.md` document both fields as optional.
- Fully backward compatible: `worlds/demo/world.json` is untouched, gets neither field, keeps today's static title/favicon.

## 6. Explicitly out of scope

- Real content for paranormal-espana / tenerife-events / moon-photos — separate work per world once data exists.
- Rule system, data source abstraction beyond geojson, `systems`/`calendar.available` schema extensions — other sub-projects of `feature-request-world-def.md`, not touched here.
- A world switcher UI, DNS/hosting setup, CI pipeline per domain — deployment mechanics outside this repo's concern.

## 7. Testing

- Unit test `resolveAppId`'s fallback: mode `development` → `demo`, mode `production` → `demo`, mode `paranormal-espana` → `paranormal-espana`.
- Extend `copyWorldsDirPlugin`'s existing coverage: isolated mode copies only `worlds/<mode>/`; default mode behavior (copy everything) stays covered and unchanged.
- Unit test `validateAppManifest` accepting/rejecting `title`/`favicon` shapes (present-and-valid, present-and-wrong-type, absent).
- End-to-end proof without waiting on real worlds: `vite build --mode demo --outDir dist/demo-only`, then confirm `dist/demo-only/worlds/` contains only `demo/` and nothing else.
- `npx tsc --noEmit` and full `npx vitest run` stay green.
