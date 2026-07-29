# Changelog

Registro de lo ya implementado más allá del v1 original (ver `docs/superpowers/specs/2026-07-26-universal-map-time-engine-design.md` para el diseño base). Trabajo futuro vive en `ROADMAP.md`, no aquí.

## Rediseño de interfaz (mobile-first, siguiendo referencia visual)

Reconstruido siguiendo una referencia visual concreta (captura + código fuente de un sitio Astro existente, con sus CSS de tokens/layout/controles). Cambios de arquitectura de UI, no solo estilos:

- **Mapa a pantalla completa**, todo lo demás flota encima (`position: fixed`/`absolute`), en vez del grid de 4 columnas anterior.
- **Búsqueda** (`src/ui/panels/SearchOverlay.ts`, reemplaza al antiguo `PanelLeft.ts`): botón circular arriba-izquierda en móvil (abre un modal con fondo oscurecido); en desktop (`≥64rem`) el campo de búsqueda queda siempre visible, acoplado a esa esquina, sin botón.
- **Selección de un lugar** (`src/ui/panels/SelectionCard.ts`): tarjeta flotante independiente (bottom-sheet en móvil, tarjeta anclada abajo-derecha en desktop), visible en cualquier momento sin depender de si la búsqueda está abierta.
- **Filtros** (`PanelRight.ts`): cajón deslizante desde la derecha, botón circular de apertura arriba-derecha y fondo oscurecido; cada dimensión de filtro es una sección colapsable con flecha; el checkbox "seleccionar todo" usa `.indeterminate` de verdad para el estado "algunos seleccionados".
- **Selector de capas** (`src/ui/panels/LayerControl.ts`, nuevo): reemplaza el control nativo de Leaflet — botón abajo-izquierda con el nombre de la capa base activa, popover con radios de capa base y checkboxes de "detalles del mapa" (capas `heatmap`).
- **Zoom**: control real de Leaflet, reposicionado abajo-derecha y por encima de la barra de atribución.
- **Iconos**: set mínimo de SVG propios (`src/ui/icons.ts`), sin CDN ni fuente de iconos externa.
- Breakpoint mobile-first en `src/styles.css`.

No se copió el logo/marca del sitio de referencia (es de otra organización) ni su vista de "Informe" (gráficas/CSV/PDF) — descartada como no-core al principio de este proyecto.

## Búsqueda con caja vacía = explorar todo

Caja vacía lista todos los lugares visibles (respetando `activeFilters`); al escribir se filtra por texto; al hacer click se cierra la búsqueda y aparece la tarjeta de selección. `searchFeatures()` (función pura) conserva su contrato original de "query vacía → `[]`" — la decisión de "mostrar todo" vive en `SearchOverlay.ts`, no en esa función. Al implementar `panel.showInSearch: false` (para excluir capas de la búsqueda) se corrigió de paso un bug latente: las regiones ya tenían ese flag en el demo original pero nunca se leía, así que llevaban apareciendo en los resultados.

## Info ampliada del lugar seleccionado

`layer.json` acepta `panel.infoFields: [{ field, label }]` — cada app decide qué propiedades extra mostrar en la tarjeta de selección, sin hardcodear nombres de campo (reutiliza `readField()` de `compute-dimensions.ts`, ahora exportado). Ver `docs/json-reference.md`.

## Selector de capa base: calle / satélite

`apps/demo/app-manifest.json` declara dos `baseLayers` (OpenStreetMap + Esri World Imagery como satélite, tile gratuito). El selector cambia la capa realmente añadida/quitada del mapa vía `LayerControl.ts` y sincroniza `store.activeBaseLayerId` directamente.

## Mapa de calor

`kind: "heatmap"` con renderer dedicado en `src/engine/space/data-layer-renderer.ts` vía `leaflet.heat` (dependencia nueva, documentada en el plan). Solo usa features `Point`; respeta `isActiveOn` y `activeFilters`. Se trata automáticamente como "detalle del mapa": checkbox opcional en `LayerControl.ts`, oculto por defecto (`AppState.hiddenLayerIds`). Ejemplo: `apps/demo/layers/heatmap.layer.json`.

## Isocrónico (patrón documentado, sin código de engine)

Documentado en `README.md` ("Isochrone (travel-time) layers"): polígonos isocrónicos precalculados como una capa `kind: "polygon"` normal, igual que `regions` — no hace falta código nuevo de engine.

## `calendar.default` conectado

`main.ts` ya no ignora el manifiesto: `selectedDate` se siembra desde `appManifest.calendar.default` (`"today"` → fecha actual, o una fecha ISO literal). `validateAppManifest()` rechaza valores que no sean `"today"` ni `YYYY-MM-DD`.

## Info ampliada del lugar seleccionado: coordenadas, enlace, imagen

`SelectionCard.ts` ahora muestra automáticamente `lat, lng` (5 decimales) para cualquier feature con geometría `Point`, sin configuración. Además, `panel.infoFields` acepta un `type` opcional (`"text"` por defecto, `"link"`, `"image"`) — igual que el resto del engine, el nombre del campo sigue viniendo del manifiesto, nunca hardcodeado. Por seguridad, `"link"`/`"image"` solo renderizan como `<a>`/`<img>` si el valor es una URL `http(s):`/`mailto:` (`isAllowedUrl()` en `src/ui/panels/info-field-format.ts`); cualquier otro esquema (p.ej. `javascript:` inyectado vía datos del feature) cae a texto plano. Ejemplo en `apps/demo/layers/poi.layer.json` (`web/foto` en `poi.geojson`).

## Barra de calendario: granularidad + slider

`CalendarBar.ts` tiene selector de granularidad (día/semana/mes/año, controla el paso de los botones ← →) y una barra deslizante (`<input type="range">`) acotada por `calendar.min`/`calendar.max`.

## Calendario multi-sistema (display): gregoriano, juliano, islámico, hebreo

`app-manifest.json` acepta un `calendar.system` opcional (`"gregorian"` por defecto, o `"julian" | "islamic" | "hebrew"`). El almacenamiento y todo el cómputo temporal (`isActiveOn`, RRULE, `calendar.min`/`max`/`default`) siguen siendo 100% gregoriano/ISO 8601 — la conversión ocurre solo en la capa de presentación (`src/engine/time/calendar-conversion.ts`), nunca hacia el store. `islamic`/`hebrew` usan `@js-temporal/polyfill` (dependencia nueva); `julian` no está en el registro de calendarios Unicode/ICU que usan Temporal/Intl, así que se implementó a mano (algoritmo de número de día juliano de Fliegel & Van Flandern, `src/engine/time/julian-calendar.ts`). El selector de fecha nativo (`<input type="date">`) sigue siendo siempre gregoriano — no hay widget de calendario propio (ver "Known v1 deviations" en `README.md`).
