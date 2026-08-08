# Feature: World Definition Package System

## Objective

Transform Universal Map App from a single configurable application into a reusable **world/atlas rendering engine**.

The engine should be able to load different thematic experiences from external "World Definition Packages" without changing engine source code.

A World Definition Package describes:

- what data exists;
- what systems are enabled;
- how layers are displayed;
- what temporal models are used;
- what plugins are active;
- what rules affect visibility or behaviour.

The engine provides the capabilities.
The world package provides the content.

---

# Core Concept

A world is not an application.

A world is a declarative description of:

- space;
- time;
- entities;
- information layers;
- visualization rules.

Architecture:

```
World Package

      |
      v

World Loader

      |
      v

Universal Engine

      |
      +----------------+
      |                |
    Space           Time
    Engine          Engine

      |
      v

Renderer / UI
```

---

# World Package Structure

Recommended structure:

```
worlds/

  example-world/

    world.json

    data/
      *.json
      *.geojson

    layers/
      *.json

    rules/
      *.json

    plugins/
      references

    assets/
      icons
      images
```

---

# Main World Definition

Example:

```json
{
  "id": "roman-empire",
  "title": "Roman Empire Atlas",

  "version": "1.0",

  "systems": {
    "space": true,
    "time": true,
    "calendar": true,
    "events": true
  },

  "map": {
    "projection": "EPSG:3857",
    "center": [41.9, 12.5],
    "zoom": 5
  },

  "calendar": {
    "default": "gregorian",
    "available": ["gregorian", "julian"]
  },

  "layers": ["cities", "borders", "roads"],

  "plugins": ["historical-events"]
}
```

---

# Layer Definition

Layers must be data-driven.

Example:

```json
{
  "id": "roman-cities",

  "type": "geojson",

  "source": "data/cities.geojson",

  "style": {
    "icon": "city"
  },

  "visibility": {
    "timeRange": [-753, 476]
  }
}
```

The engine should know how to load and render the layer.

The layer should not require custom code.

---

# Data Source Abstraction

Create a generic loader system.

Existing loader architecture should be reused.

Supported sources:

- GeoJSON;
- JSON;
- external APIs;
- future database adapters.

Interface:

```ts
interface WorldDataSource {
  load(): Promise<unknown>;
}
```

---

# Rule System

Introduce a lightweight rule layer.

Do not create a programming language yet.

Rules should be declarative.

Example:

```json
{
  "condition": {
    "year": {
      "between": [0, 500]
    }
  },

  "action": {
    "showLayer": "roman-borders"
  }
}
```

Future rules may control:

- visibility;
- styling;
- filtering;
- temporal behaviour.

---

# Plugin Integration

World packages can activate plugins.

Example:

```json
{
  "plugins": [
    {
      "id": "historical-events",
      "config": {
        "timeline": true
      }
    }
  ]
}
```

Reuse existing plugin registry.

---

# Engine Requirements

The engine must:

- load a world package;
- validate the definition;
- initialize enabled systems;
- load data sources;
- register plugins;
- create the application instance.

The engine must not contain world-specific knowledge.

Bad:

```
if romanEmpire then load roman cities
```

Good:

```
load layers defined by world package
```

---

# Migration Strategy

Do not rewrite existing architecture.

Map existing concepts:

Current:

```
apps/demo
    |
    data/
    layers/
    app-manifest.json
```

Evolve into:

```
worlds/demo/

    world.json
    data/
    layers/
```

Reuse:

- app manifests;
- layer manifests;
- loader registry;
- plugin registry;
- calendar engine;
- map adapters.

---

# Success Criteria

The feature is complete when:

A developer can create a completely different application by only adding:

```
worlds/new-world/

    world.json
    layers/
    data/
```

without modifying engine code.

Examples:

Same engine:

```
Roman Empire Atlas

+
Climate Explorer

+
Tourism Map

+
Fantasy World

+
Scientific Dataset Viewer
```

---

# Design Philosophy

Universal Map App should evolve from:

"an application that displays maps"

into:

"a general engine for representing knowledge in space and time."
