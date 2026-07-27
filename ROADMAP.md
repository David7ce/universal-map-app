# Roadmap

Tareas futuras no incluidas en el v1 (ver `docs/superpowers/specs/2026-07-26-universal-map-time-engine-design.md` para el diseño base y `README.md` para las desviaciones ya conocidas del v1). Ninguna de estas tareas está implementada todavía.

## Panel izquierdo: más información del lugar seleccionado

Hoy `PanelLeft.ts` solo muestra nombre + estado temporal (+ región contenedora si aplica) al seleccionar un feature. Ampliar la vista de info para mostrar el resto de propiedades relevantes del feature (categoría, descripción, cualquier campo que el manifiesto de la capa marque como visible), sin hardcodear nombres de campo en `src/engine/` ni en `src/ui/` — igual que `taxonomy` en el layer manifest, añadir algo tipo `panel.infoFields: [{ field, label }]` para que cada app decida qué mostrar. Candidatos adicionales: coordenadas, enlace/imagen si el feature lo trae en `properties`.

## Capas base del mapa: selector calle / satélite

`createMap()` (`src/engine/space/map.ts`) ya soporta múltiples `baseLayers` desde el manifiesto — el control de capas de Leaflet ya aparece si hay más de una entrada en `appManifest.baseLayers`. Falta:
- Añadir una segunda entrada de ejemplo (satélite, p.ej. Esri World Imagery, tile gratuito) a `apps/demo/app-manifest.json` para demostrarlo.
- `store.activeBaseLayerId` (`src/engine/state/store.ts`) existe pero no está sincronizado con el evento `baselayerchange` de Leaflet — hoy es estado muerto, igual que el caso ya detectado de `calendar.default`. Conectarlo si algún plugin/panel necesita saber qué capa base está activa.

## Nuevos tipos de mapa: mapa de calor e isocrónico

Añadir como nuevos `kind` de capa (junto a `point`/`polygon` actuales en el layer manifest), manteniendo el enfoque manifest-driven:

- **Mapa de calor (heatmap):** capa de densidad sobre los puntos de una capa existente. Viable con `leaflet.heat` (dependencia nueva, pequeña) — requeriría actualizar la lista de dependencias permitidas en el plan. Filtrado temporal (`isActiveOn`) y por `activeFilters` debería aplicar igual que en el resto de capas.
- **Mapa isocrónico:** dos enfoques con implicaciones distintas:
  1. **Estático** (recomendado, encaja con la arquitectura actual): la propia app instancia provee los polígonos isocrónicos precalculados como una capa GeoJSON normal (`kind: "polygon"`), sin código nuevo de engine — igual que ya funciona `regions`. Solo hace falta documentarlo como patrón en el README.
  2. **Dinámico** (calculado en el momento, p.ej. al hacer clic en un punto): requeriría un servicio de rutas/isócronas externo (Mapbox Isochrone API, openrouteservice, etc.), lo cual choca con el non-goal "no backend, no paid services" del spec (Sección 11) salvo que se use un servicio gratuito con límites aceptables. Si se quiere esto, hay que decidirlo explícitamente como excepción al non-goal antes de implementarlo.
