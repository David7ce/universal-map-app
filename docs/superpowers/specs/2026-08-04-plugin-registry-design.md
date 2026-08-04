# Generic, manifest-driven plugin activation — Design

Status: approved
Date: 2026-08-04

## 1. Purpose

Replace the hardcoded `if (appManifest.plugins?.participate) registerParticipatePlugin(...)` in `src/main.ts` with a generic activation path: any `plugins/<id>/` folder self-registers when its id appears in an app manifest's `plugins` object, with zero edits to `main.ts` or the manifest validator. This is the first sub-project of the larger `feature-request-world-def.md` initiative — the plugin system is the clearest existing violation of `CONTEXT.md`'s "the engine must not contain world-specific knowledge" rule, and cleaning it up first gives the later rule-system and `systems`-toggle work a real extension point to build on instead of another hardcoded branch.

## 2. Current state and problem

- `AppManifest.plugins` (`src/engine/manifests/app-manifest.ts`) is typed as `{ participate?: ParticipateConfig }` — a hand-written object with one specific optional key. A second plugin means editing this interface again.
- `validateAppManifest` has `participate`-specific field checks (`channel`/`target`/`messageTemplate`) inlined directly in the generic manifest validator.
- `src/main.ts` imports `registerParticipatePlugin` by name and calls it behind an `if` checking that one specific key. A second plugin means a second hardcoded import-and-`if` block in `main.ts`.
- The original core design spec (`docs/superpowers/specs/2026-07-26-universal-map-time-engine-design.md`, Section 7) already described the intent — "plugin code lives under `/plugins/<id>/` and self-registers on import," activated by an app manifest's `plugins` list — but the v1 implementation diverged from that into the single hardcoded check above. This spec is that seam catching up to the original intent.
- The low-level registration/dispatch API in `src/engine/plugins/registry.ts` (`registerPlugin`, `PluginHooks`, `dispatchDateChange`/`dispatchFilterChange`/`dispatchFeatureSelect`, `getPanelSlots`) already is generic and does not change in this work — only how a plugin gets *triggered* into calling `registerPlugin` changes.

## 3. Manifest shape

`AppManifest.plugins` becomes:

```ts
plugins?: Record<string, unknown>;
```

An open id → opaque-config bag. `validateAppManifest` no longer knows what any specific plugin id means — it only checks, when `plugins` is present, that it is a plain object whose keys are strings (i.e. a JSON object, not an array or primitive). It does not inspect any key's value.

`ParticipateConfig` moves out of `app-manifest.ts` — it becomes an internal type owned by `plugins/participate/`, since the engine's manifest module no longer needs to know it exists.

`apps/demo/app-manifest.json`'s `"plugins": { "participate": {...} }` requires no change — it already matches this shape.

## 4. Plugin module contract

Every plugin folder `plugins/<id>/` must export, from `index.ts`, a default function:

```ts
export default function register(config: unknown, strings: Record<string, string>): void
```

`register` is responsible for:

1. Validating `config`'s shape and throwing a specific, named error if it's malformed (this is where `participate`'s channel/target/messageTemplate checks move to, out of `app-manifest.ts` — same error messages, new home).
2. Calling the existing `registerPlugin(id, hooks)` from `src/engine/plugins/registry.ts` to wire up whatever `PluginHooks` it provides (panel slot, lifecycle callbacks).

`plugins/participate/index.ts`'s current export (`registerParticipatePlugin`) is renamed to a default-exported `register` matching this contract. `plugins/participate/links.ts` (`buildParticipateUrl`) is unchanged.

## 5. Discovery: `src/engine/plugins/activate.ts`

A new module does the generic id → module lookup, using Vite's build-time `import.meta.glob` to enumerate every `plugins/*/index.ts` without listing any plugin by name:

```ts
const modules = import.meta.glob('/plugins/*/index.ts');

export async function activatePlugins(
  plugins: Record<string, unknown> | undefined,
  strings: Record<string, string>,
): Promise<void> {
  for (const [id, config] of Object.entries(plugins ?? {})) {
    const path = `/plugins/${id}/index.ts`;
    const loadModule = modules[path];
    if (!loadModule) {
      throw new Error(`App manifest declares unknown plugin "${id}" (no plugins/${id}/index.ts found)`);
    }
    const mod = (await loadModule()) as { default: (config: unknown, strings: Record<string, string>) => void };
    mod.default(config, strings);
  }
}
```

An unrecognized plugin id fails bootstrap loudly, with a message naming the id — consistent with how every other malformed-manifest condition in this codebase behaves (`validateAppManifest`/`validateLayerManifest` throw named errors rather than warning and continuing). A world/app package that declares a plugin it forgot to ship is a configuration bug, not a degraded-but-working state.

## 6. Bootstrap wiring

`src/main.ts` changes from:

```ts
if (appManifest.plugins?.participate) {
  registerParticipatePlugin(appManifest.plugins.participate, strings);
}
```

to:

```ts
await activatePlugins(appManifest.plugins, strings);
```

at the same point in the sequence (immediately after `strings` loads, before layer loading and store creation) — activation timing relative to the rest of bootstrap does not change, only the dispatch mechanism.

## 7. Testing

- `src/engine/plugins/activate.test.ts` (new): an unknown plugin id throws with a message naming that id; a known id's module has its `register` called with exactly the config object from the manifest; multiple declared plugins are all activated.
- `plugins/participate/index.test.ts` (new — behavior moves here from what `manifests.test.ts` covered): each malformed-config case (invalid channel, missing/empty `target`, missing/empty `messageTemplate`) throws the same error it throws today; valid config still registers the plugin and its panel slot.
- `src/engine/manifests/manifests.test.ts`: loses its `plugins.participate.*` validation cases; gains generic cases for "`plugins` must be a plain object" (rejecting an array, a string, `null`) — it no longer has anything to say about what's inside that object.
- `plugins/participate/links.test.ts`: unchanged.
- `src/engine/plugins/registry.test.ts`: unchanged — the registry/dispatch API itself doesn't change.

## 8. Non-goals

- No change to `PluginHooks`, `PluginContext`, `PanelSlot`, or any dispatch function in `registry.ts`.
- No plugin dependency ordering, versioning, or inter-plugin communication — activation order is simply `Object.entries()` order of the manifest's `plugins` object, matching today's single-plugin behavior (order was never a concern with one plugin, and isn't addressed here).
- No sandboxing or permission model for plugin code — plugins are trusted, first-party code shipped in the same repo, same as today.
- No dynamic (runtime, non-bundled) plugin loading — `import.meta.glob` resolves at build time; adding a plugin still requires a rebuild, just not an edit to engine or `main.ts` code.
