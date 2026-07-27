# Roadmap

Tareas futuras no incluidas en el v1 original (ver `docs/superpowers/specs/2026-07-26-universal-map-time-engine-design.md` para el diseño base y `README.md` para las desviaciones ya conocidas del v1). Cada sección indica su estado — varias ya están implementadas.

## Rediseño responsive del layout (mobile-first) — hecho

Reconstruido siguiendo una referencia visual concreta (captura + código fuente de un sitio Astro existente, con sus CSS de tokens/layout/controles) que sí llegó a la conversación. Cambios reales de arquitectura de UI, no solo estilos:

- **Mapa a pantalla completa**, todo lo demás flota encima (`position: fixed`/`absolute`), en vez del grid de 4 columnas anterior.
- **Búsqueda** (`src/ui/panels/SearchOverlay.ts`, reemplaza al antiguo `PanelLeft.ts`): botón circular arriba-izquierda en móvil (abre un modal con fondo oscurecido); en desktop (`≥64rem`) el campo de búsqueda queda siempre visible, acoplado a esa esquina, sin botón.
- **Selección de un lugar** (`src/ui/panels/SelectionCard.ts`, la otra mitad de lo que antes era `PanelLeft.ts`): ya no aparece "dentro del panel izquierdo" — es una tarjeta flotante independiente (bottom-sheet en móvil, tarjeta anclada abajo-derecha en desktop), visible en cualquier momento sin depender de si la búsqueda está abierta.
- **Filtros** (`PanelRight.ts`): cajón deslizante desde la derecha, con botón circular de apertura arriba-derecha y fondo oscurecido; cada dimensión de filtro es ahora una sección colapsable con flecha (antes iban todas expandidas), y el checkbox "seleccionar todo" usa `.indeterminate` de verdad para el estado "algunos seleccionados" (cerraba un hallazgo menor pendiente desde la revisión final).
- **Selector de capas** (`src/ui/panels/LayerControl.ts`, nuevo): reemplaza el control nativo de Leaflet — botón abajo-izquierda con el nombre de la capa base activa, que abre un popover con radios de capa base y checkboxes de "detalles del mapa" (capas `heatmap`, ver más abajo).
- **Zoom**: sigue siendo el control real de Leaflet, pero reposicionado abajo-derecha y por encima de la barra de atribución (no se solapan).
- **Iconos**: un set mínimo de SVG propios (`src/ui/icons.ts`), sin CDN ni fuente de iconos externa — todo local, coherente con "no CDN" pedido explícitamente.
- Breakpoint mobile-first en `src/styles.css` para las diferencias móvil/desktop de cada componente.

No se copió el logo/marca del sitio de referencia (es de otra organización, no del motor genérico) ni su vista de "Informe" (gráficas/CSV/PDF) — ese "informe" ya se había descartado explícitamente como no-core al principio de este proyecto.

## Panel izquierdo → búsqueda + tarjeta de selección — hecho

Buscador con la caja vacía listando todos los lugares visibles (respetando `activeFilters`); al escribir se filtra por texto; al hacer click en un resultado se cierra la búsqueda y aparece la tarjeta de selección (`SelectionCard.ts`) con la info del lugar. `searchFeatures()` (la función pura) conserva su contrato original de "query vacía → `[]`" — la decisión de "mostrar todo con query vacía" vive en `SearchOverlay.ts`, no en esa función. Una capa puede excluirse por completo de la búsqueda con `panel.showInSearch: false` (ver `docs/json-reference.md`) — implementarlo de paso corrigió un bug latente: las regiones (que ya tenían `showInSearch: false` desde el demo original) llevaban apareciendo en los resultados de búsqueda porque ese campo nunca se leía.

## Más información del lugar seleccionado — hecho

`layer.json` acepta `panel.infoFields: [{ field, label }]` (ver `src/engine/manifests/layer-manifest.ts` y el ejemplo en `apps/demo/layers/poi.layer.json`) — cada app decide qué propiedades extra mostrar en la tarjeta de selección (`SelectionCard.ts`), sin hardcodear nombres de campo (reutiliza el `readField()` de `compute-dimensions.ts`, ahora exportado). Ver `docs/json-reference.md`. Pendiente si se quiere más adelante: coordenadas, enlace/imagen.

## Capas base del mapa: selector calle / satélite — hecho

`apps/demo/app-manifest.json` declara dos `baseLayers` (OpenStreetMap + Esri World Imagery como satélite, tile gratuito). El selector ya no es el control nativo de Leaflet — es el popover custom de `LayerControl.ts` (radios "Base layers"), que cambia la capa realmente añadida/quitada del mapa y sincroniza `store.activeBaseLayerId` directamente (ya no depende del evento `baselayerchange` de Leaflet).

## Nuevos tipos de mapa: mapa de calor e isocrónico — hecho (heatmap); isocrónico solo documentado

- **Mapa de calor:** `kind: "heatmap"` tiene renderer dedicado en `src/engine/space/data-layer-renderer.ts` vía `leaflet.heat` (nueva dependencia — añadida y documentada en el plan, `docs/superpowers/plans/2026-07-26-core-engine-implementation.md`). Solo usa features con geometría `Point`; respeta `isActiveOn` y `activeFilters` igual que el resto de capas. Se trata automáticamente como "detalle del mapa": aparece como checkbox opcional en el popover de `LayerControl.ts`, **oculto por defecto** (`AppState.hiddenLayerIds`) — un mapa de calor cubriendo todo desde el primer segundo taparía el resto de datos. Ejemplo funcionando: `apps/demo/layers/heatmap.layer.json` (reusa `poi.geojson`; excluido de la búsqueda con `panel.showInSearch: false` para no duplicar resultados con la capa `poi`).
- **Mapa isocrónico:** documentado en `README.md` ("Isochrone (travel-time) layers") el patrón **estático** — polígonos isocrónicos precalculados como una capa `kind: "polygon"` normal, sin código nuevo de engine, igual que `regions`. No se implementó el enfoque **dinámico** (requiere un servicio de rutas/isócronas externo, lo cual choca con el non-goal "no backend, no paid services" salvo excepción explícita) — sigue pendiente si se quiere en el futuro.

## Barra de calendario: slider inferior día/semana/mes/año — hecho

`CalendarBar.ts` tiene ahora un selector de granularidad (día/semana/mes/año, controla el paso de los botones ← →) y una barra deslizante (`<input type="range">`) acotada por `calendar.min`/`calendar.max` para moverse rápido por todo el rango. `calendar.default` sigue sin usarse (`main.ts` siempre siembra con la fecha de hoy) — eso queda pendiente aparte.

## Sin implementar: multi-calendario y multi-proyección

Las dos secciones siguientes siguen sin código, a propósito. Ambas exigen una decisión de arquitectura real (qué librería de conversión de calendarios, o qué CRS/proyecciones concretas soportar) sin un segundo caso de uso real que la ejerza todavía — construir la abstracción ahora sería exactamente el tipo de "diseñar para un requisito hipotético" que este proyecto evita deliberadamente en el resto del código (ver Global Constraints del plan). Antes de tocar código aquí hace falta una sesión de diseño dedicada: qué sistemas de calendario/proyección concretos hay que soportar primero, y si añadir una librería nueva es aceptable dado el enfoque "dependencias mínimas" del proyecto.

## Calendario: soporte para más de un sistema de calendario

Hoy todo `src/engine/time/` asume calendario gregoriano (parseo ISO 8601, `Date` de JS). Soportar otros sistemas (juliano, islámico, hebreo, etc.) es un cambio de arquitectura, no un ajuste de UI: requiere una capa de conversión de fechas entre el sistema de almacenamiento (gregoriano/ISO, para no romper `isActiveOn`/RRULE) y el sistema de visualización elegido por cada app, más el `strings.json` de cada app para nombres de meses/días si aplica. Necesita su propio diseño (brainstorming) antes de tocar código — no es una tarea pequeña.

## Mapa: soporte para más de una proyección

Hoy el mapa asume Web Mercator (EPSG:3857), la proyección por defecto de Leaflet/OSM. Soportar otras proyecciones requiere un CRS personalizado en Leaflet (plugin `Proj4Leaflet` o similar) expuesto desde el manifiesto (p.ej. `map.crs`), y verificar que los tiles base elegidos realmente se sirven en esa proyección (no todos los proveedores ofrecen tiles fuera de EPSG:3857) y que las coordenadas de los datos (GeoJSON) se transforman correctamente. También necesita diseño propio antes de implementar.
