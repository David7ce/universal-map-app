# Feature: World Definition Package System — open items

Most of the original feature request has shipped (world package structure, `world.json`, data-driven layer definitions, generic plugin integration, an engine with no world-specific knowledge — see `CHANGELOG.md`). Two pieces remain, both deliberately deferred as YAGNI: no current world needs either yet.

---

## Rule System

A lightweight, declarative rule layer — not a programming language.

```json
{
  "condition": {
    "year": { "between": [0, 500] }
  },
  "action": {
    "showLayer": "roman-borders"
  }
}
```

Would eventually control visibility, styling, filtering, or temporal behavior beyond what `layer.json`'s existing `taxonomy`/`temporal`/`style` fields already express. Revisit when a world needs conditional behavior those fields can't cover.

---

## Data Source Abstraction: external APIs

`LayerSource`'s `"api"` type (`docs/json-reference.md`) is a documented no-op stub — `fetchFeatures()` (`src/engine/data/loader-registry.ts`) already accepts `bounds`/`dateRange` parameters for it, unused by the current `geojson`/`geojson-sharded` loaders.

```ts
interface WorldDataSource {
  load(): Promise<unknown>;
}
```

Ties into the "future massive refactor to own Map Server and PostgreSQL" item in `ROADMAP.md` — a live API loader only makes sense once there's a real backend to call. Revisit together.
