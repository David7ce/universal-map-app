# Roadmap

Tareas futuras no incluidas en el v1 original (ver `docs/superpowers/specs/2026-07-26-universal-map-time-engine-design.md` para el diseño base y `README.md` para las desviaciones ya conocidas del v1). Cada sección indica su estado — varias ya están implementadas.

## Rediseño responsive del layout (mobile-first) — hecho

Paneles laterales colapsables (`AppState.panels`, botón `☰` en el izquierdo y "Filters" en el derecho), controles del mapa reubicados (capa base arriba-izquierda, zoom abajo-izquierda — `src/engine/space/map.ts`), breakpoint mobile-first en `src/styles.css` (apila panel izq. / mapa / panel der. / calendario en columna única por debajo de 700px), y un pase de diseño visual completo (`src/styles.css`: paleta con acento azul cartográfico, tipografía del sistema, buscador tipo píldora, secciones de filtro con encabezado y checkboxes con `accent-color`, calendario con controles circulares/píldora y slider acentuado) — sin mockup de referencia (nunca llegó adjunto a la conversación), así que es un acabado propio razonable, no un match pixel a pixel de ningún diseño externo. Retomar si aparece esa referencia visual.

## Panel izquierdo: patrón búsqueda → resultados → info — hecho

Campo de búsqueda arriba; con la caja vacía se listan todos los lugares visibles (respetando `activeFilters`); al escribir se filtra por texto; al hacer click en un resultado, ese listado se sustituye por la info del lugar seleccionado. `searchFeatures()` (la función pura) conserva su contrato original de "query vacía → `[]`" — la decisión de "mostrar todo con query vacía" vive en `PanelLeft.ts`, no en esa función. Una capa puede excluirse por completo del panel izquierdo con `panel.showInSearch: false` (ver `docs/json-reference.md`) — implementarlo de paso corrigió un bug latente: las regiones (que ya tenían `showInSearch: false` desde el demo original) llevaban apareciendo en los resultados de búsqueda porque ese campo nunca se leía.

## Panel izquierdo: más información del lugar seleccionado — hecho

`layer.json` acepta ahora `panel.infoFields: [{ field, label }]` (ver `src/engine/manifests/layer-manifest.ts` y el ejemplo en `apps/demo/layers/poi.layer.json`) — cada app decide qué propiedades extra mostrar en el panel izquierdo al seleccionar un feature, sin hardcodear nombres de campo (`PanelLeft.ts` reutiliza el `readField()` de `compute-dimensions.ts`, ahora exportado). Ver `docs/json-reference.md`. Pendiente si se quiere más adelante: coordenadas, enlace/imagen.

## Capas base del mapa: selector calle / satélite — hecho

`apps/demo/app-manifest.json` ahora declara dos `baseLayers` (OpenStreetMap + Esri World Imagery como satélite, tile gratuito) — el selector de Leaflet aparece automáticamente. `store.activeBaseLayerId` está sincronizado con el evento `baselayerchange` de Leaflet (`src/main.ts`).

## Nuevos tipos de mapa: mapa de calor e isocrónico — hecho (heatmap); isocrónico solo documentado

- **Mapa de calor:** `kind: "heatmap"` ya tiene renderer dedicado en `src/engine/space/data-layer-renderer.ts` vía `leaflet.heat` (nueva dependencia — añadida y documentada en el plan, `docs/superpowers/plans/2026-07-26-core-engine-implementation.md`). Solo usa features con geometría `Point`; respeta `isActiveOn` y `activeFilters` igual que el resto de capas. Ejemplo funcionando: `apps/demo/layers/heatmap.layer.json` (reusa `poi.geojson`; se excluyó del panel izquierdo con `panel.showInSearch: false` para no duplicar resultados de búsqueda con la capa `poi`).
- **Mapa isocrónico:** documentado en `README.md` ("Isochrone (travel-time) layers") el patrón **estático** — polígonos isocrónicos precalculados como una capa `kind: "polygon"` normal, sin código nuevo de engine, igual que `regions`. No se implementó el enfoque **dinámico** (requiere un servicio de rutas/isócronas externo, lo cual choca con el non-goal "no backend, no paid services" salvo excepción explícita) — sigue pendiente si se quiere en el futuro.

## Barra de calendario: slider inferior día/semana/mes/año — hecho

`CalendarBar.ts` tiene ahora un selector de granularidad (día/semana/mes/año, controla el paso de los botones ← →) y una barra deslizante (`<input type="range">`) acotada por `calendar.min`/`calendar.max` para moverse rápido por todo el rango. `calendar.default` sigue sin usarse (`main.ts` siempre siembra con la fecha de hoy) — eso queda pendiente aparte.

## Sin implementar: multi-calendario y multi-proyección

Las dos secciones siguientes siguen sin código, a propósito. Ambas exigen una decisión de arquitectura real (qué librería de conversión de calendarios, o qué CRS/proyecciones concretas soportar) sin un segundo caso de uso real que la ejerza todavía — construir la abstracción ahora sería exactamente el tipo de "diseñar para un requisito hipotético" que este proyecto evita deliberadamente en el resto del código (ver Global Constraints del plan). Antes de tocar código aquí hace falta una sesión de diseño dedicada: qué sistemas de calendario/proyección concretos hay que soportar primero, y si añadir una librería nueva es aceptable dado el enfoque "dependencias mínimas" del proyecto.

## Calendario: soporte para más de un sistema de calendario

Hoy todo `src/engine/time/` asume calendario gregoriano (parseo ISO 8601, `Date` de JS). Soportar otros sistemas (juliano, islámico, hebreo, etc.) es un cambio de arquitectura, no un ajuste de UI: requiere una capa de conversión de fechas entre el sistema de almacenamiento (gregoriano/ISO, para no romper `isActiveOn`/RRULE) y el sistema de visualización elegido por cada app, más el `strings.json` de cada app para nombres de meses/días si aplica. Necesita su propio diseño (brainstorming) antes de tocar código — no es una tarea pequeña.

## Mapa: soporte para más de una proyección

Hoy el mapa asume Web Mercator (EPSG:3857), la proyección por defecto de Leaflet/OSM. Soportar otras proyecciones requiere un CRS personalizado en Leaflet (plugin `Proj4Leaflet` o similar) expuesto desde el manifiesto (p.ej. `map.crs`), y verificar que los tiles base elegidos realmente se sirven en esa proyección (no todos los proveedores ofrecen tiles fuera de EPSG:3857) y que las coordenadas de los datos (GeoJSON) se transforman correctamente. También necesita diseño propio antes de implementar.
