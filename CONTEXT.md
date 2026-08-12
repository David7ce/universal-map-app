# Universal Map App — AI Agent Context

## Project Identity

Universal Map App is not just a web map application.

It should be treated as a **spatio-temporal engine with a web interface**.

The long-term vision is to build a platform combining:

- Geographic space
- Time systems
- Cultural calendars
- Data layers
- Extensible plugins
- Multiple visualization targets

The application is a manifestation of the engine, not the other way around.

---

# Core Architectural Principle

Maintain a strict separation between:

```
ENGINE
  ↓
DOMAIN LOGIC
  ↓
ADAPTERS
  ↓
UI
```

The engine should not depend on UI frameworks or visualization libraries.

The UI should consume capabilities from the engine.

Avoid designs where:

- Leaflet logic leaks into domain models.
- UI components contain business rules.
- Data formats dictate core architecture.

---

# Current Architecture

```
src/

engine/
    data/
    manifests/
    plugins/       (registry + activation only — see plugins/ below for implementations)
    region/
    space/
    state/
    taxonomy/
    time/

ui/
    app-chrome.ts  (application shell: Map/Calendar switcher, layer control, settings, search)
    panels/        (Calendar view, filter panel, search overlay, lightbox, ...)

plugins/
    <plugin-id>/   (e.g. participate/ — registered via engine/plugins, not hardcoded in main.ts)

worlds/
    <world-id>/    (world.json manifest + layers/*.layer.json + data/*.geojson — the declarative
                    packages the engine renders; see Data Philosophy below)
```

## Engine Responsibilities

The engine represents the internal world model.

Examples:

- Coordinate systems
- Map projections
- Calendar calculations
- Spatial relationships
- Data loading
- Plugin registration
- Application state

---

# Space Domain

The space subsystem should remain independent from Leaflet.

Current abstraction:

```
Space Core

      ↓

Map Adapter

      ↓

Leaflet Implementation
```

Future possible adapters:

- WebGL renderer
- Desktop renderer
- Mobile renderer
- 3D globe renderer
- WebAssembly accelerated modules

---

# Time Domain

Time is a first-class concept.

Do not treat dates as simple JavaScript Date objects.

The system should support concepts such as:

- Multiple calendar systems
- Calendar conversion
- Historical dates
- Recurring events
- Cultural representations of time

Shipped calendar systems (`CalendarSystem`, `src/engine/time/calendar-systems.ts`):

- Gregorian
- Julian
- Islamic
- Hebrew

Possible future systems:

- Persian
- Chinese
- Other cultural calendars

---

# Plugin Philosophy

The system should evolve as a platform.

Prefer:

```
Core Engine

+
Plugins

+
Data Packages
```

instead of hardcoding every feature.

New capabilities should ideally be introduced through:

- plugins
- manifests
- data layers
- extensions

Concretely: `plugins/<plugin-id>/index.ts` exports `register(config, strings)`; `src/engine/plugins/activate.ts` looks it up by id from `world.json`'s `plugins` map via `import.meta.glob` — no `main.ts`/manifest-validator edits needed to add a second plugin. `participate/` (email/WhatsApp/Telegram report links) is the only one shipped so far.

---

# Data Philosophy

Data should be declarative whenever possible.

Prefer:

```
JSON / GeoJSON / manifests

        ↓

Generic engine processing

        ↓

Visualization
```

Avoid coupling features directly to code when configuration is enough.

Concretely, this is `worlds/<world-id>/`: a `world.json` manifest (validated by `validateAppManifest`, `src/engine/manifests/app-manifest.ts`) plus `layers/*.layer.json` (validated by `validateLayerManifest`) referencing `data/*.geojson`. A new world is data-only — no code changes — as long as it fits the existing taxonomy/temporal/panel field vocabulary; see `docs/json-reference.md` and `docs/schemas/*.schema.json`.

---

# Development Principles

## Prefer:

- Small focused modules.
- Explicit interfaces.
- Strong typing.
- Tests for algorithms.
- Clear domain boundaries.
- Readable code.

## Avoid:

- Premature frameworks.
- Adding dependencies without necessity.
- Coupling to vendors.
- Large abstractions without real use cases.

---

# AI Coding Rules

When modifying the project:

1. Understand the architecture before coding.
2. Do not introduce frameworks unless explicitly requested.
3. Preserve engine/UI separation.
4. Prefer improving existing abstractions over adding shortcuts.
5. Add tests for non-trivial algorithms.
6. Explain architectural trade-offs.
7. Avoid unnecessary dependencies.

---

# Learning Objective

This project is also a learning laboratory.

Important goals:

- Understand algorithms deeply.
- Understand mathematical foundations.
- Learn software architecture.
- Improve programming without depending entirely on AI generation.

When possible:

Prefer explaining:

- why a solution works;
- algorithm complexity;
- alternative approaches;
- design trade-offs.

Do not only provide code.

---

# Possible Future Rust / WebAssembly Boundary

Rust should not be introduced prematurely.

Possible future candidates:

```
Rust + WASM

    ↓

Pure computational cores

Examples:

- Spatial indexing
- Geometry algorithms
- Projection calculations
- Heavy calendar conversions
- Large data processing
```

TypeScript remains suitable for:

- UI
- Application logic
- Browser integration
- User interaction

The goal is not rewriting the project.

The goal is introducing Rust only where it provides architectural value.

---

# Long-Term Vision

The project should evolve toward:

```
Universal Engine

    ├── Space
    │     ├── Coordinates
    │     ├── Projections
    │     ├── Geometry
    │     └── Maps
    │
    ├── Time
    │     ├── Calendars
    │     ├── Events
    │     └── Temporal Systems
    │
    ├── Data
    │     ├── Layers
    │     └── Sources
    │
    └── Plugins
          └── Extensions
```

The objective is not only to build an application.

The objective is to build a clean, extensible model of the relationship between **space, time and information**.
