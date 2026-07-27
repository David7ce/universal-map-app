# Referencia de los formatos JSON

Referencia de campo por campo de los tres tipos de JSON que usa el motor: el manifiesto de app, el manifiesto de capa, y los datos GeoJSON (con la extensión `temporal`). Todos viven bajo `apps/<app-id>/` — ver `apps/demo/` como instancia de referencia funcionando.

Validados en runtime por `validateAppManifest` (`src/engine/manifests/app-manifest.ts`) y `validateLayerManifest` (`src/engine/manifests/layer-manifest.ts`) — la validación actual es mínima (comprueba los campos obligatorios de nivel superior, no valida en profundidad los campos opcionales ni sus formas internas; ver `ROADMAP.md`/ledger para ese hueco conocido).

---

## `app-manifest.json`

Un objeto por app instance, referenciado desde `src/main.ts` (hoy con la ruta `/apps/demo/app-manifest.json` hardcodeada — ver "Añadir una app nueva" en `README.md`).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `string` | sí | Identificador de la app. No vacío. |
| `title` | `string` | no (validación no lo exige, pero úsalo siempre) | Título mostrado de la app. |
| `map.center` | `[lat, lng]` | no (no validado) | Centro inicial del mapa, en formato Leaflet `[lat, lng]` (**ojo:** orden distinto al de coordenadas GeoJSON, que es `[lng, lat]`). |
| `map.zoom` | `number` | no (no validado) | Nivel de zoom inicial. |
| `baseLayers` | `BaseLayerConfig[]` | sí, mínimo 1 entrada | Capas base del mapa (ver tabla abajo). El primer elemento del array es el que se activa por defecto (`createMap()`, `src/engine/space/map.ts`). Si hay más de una entrada, Leaflet añade automáticamente un selector de capas (`L.control.layers`). |
| `dataLayers` | `string[]` | sí (debe ser array; puede estar vacío) | Rutas relativas a los `layer.json` de esta app, p.ej. `"layers/poi.layer.json"`. |
| `calendar.default` | `"today" \| string` | sí (min/max obligatorios; `default` no validado) | Fecha inicial. **No implementado todavía** — `src/main.ts` siempre siembra la fecha con `new Date()`, ignora este campo pase lo que pase (ver `ROADMAP.md`). |
| `calendar.min` / `calendar.max` | `string` (ISO `YYYY-MM-DD`) | sí | Límites del selector de fecha en `CalendarBar.ts`. |
| `strings` | `string` | no | Ruta relativa (dentro de la carpeta de la app) a su `strings.json`. Si se omite, `t()` cae siempre al fallback (mostrar la propia key). |
| `plugins.participate` | `ParticipateConfig \| undefined` | no | Ver tabla abajo. Si se omite, el botón "Participate" no aparece. |

### `BaseLayerConfig` (elemento de `baseLayers`)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador de la capa base. Hoy no se lee en ningún sitio salvo como valor inicial de `store.activeBaseLayerId` — ese estado no está sincronizado con el selector de Leaflet todavía (ver `ROADMAP.md`). |
| `title` | `string` | Se usa como key interna del control de capas de Leaflet — dos capas con el mismo `title` colisionarían silenciosamente (limitación conocida, no validada). |
| `type` | `"raster-tile"` | Único valor soportado hoy. |
| `url` | `string` | URL de tiles, con los placeholders `{z}/{x}/{y}` que espera Leaflet. |
| `attribution` | `string` | Texto de atribución mostrado en la esquina del mapa. |

### `ParticipateConfig` (`plugins.participate`)

| Campo | Tipo | Descripción |
|---|---|---|
| `channel` | `"email" \| "whatsapp" \| "telegram"` | Determina el esquema del link generado (`mailto:`, `https://wa.me/`, `https://t.me/`). |
| `target` | `string` | Email, número de WhatsApp (sin `+`), o usuario/bot de Telegram, según `channel`. |
| `messageTemplate` | `string` | Texto del mensaje. El placeholder `{{date}}` se sustituye por la fecha seleccionada (formato `YYYY-MM-DD`). Solo la primera ocurrencia se sustituye (ver limitación en el ledger de Task 16). |

---

## `layer.json`

Un archivo por capa de datos, referenciado desde `app-manifest.json`'s `dataLayers`.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `string` | sí | Identificador de la capa. |
| `title` | `string` | sí | Título de la capa. |
| `kind` | `"point" \| "line" \| "polygon" \| "boundary" \| "heatmap"` | sí | **Renderer dedicado hoy: `point`** (agrupa en clusters si `style.cluster` es `true`) y **`heatmap`** (capa de densidad vía `leaflet.heat`, solo usa las features con geometría `Point`; otras geometrías en una capa heatmap se ignoran). `line`, `polygon` y `boundary` se dibujan de forma genérica vía `L.geoJSON`, sin lógica especial por kind — funciona porque su geometría GeoJSON se pinta igual que cualquier otra. Ver `apps/demo/layers/heatmap.layer.json` como ejemplo. |
| `source` | `LayerSource` | sí | Ver tabla abajo. |
| `temporal.defaultVisibility` | `"always" \| "time-filtered"` | no | **Declarado pero no leído por ningún código todavía** — el filtrado por `isActiveOn` se aplica siempre igual, independientemente de este valor. |
| `taxonomy` | `TaxonomyFieldDef[]` | no | Dimensiones de filtro que esta capa aporta al panel derecho. Ver tabla abajo. |
| `regionRole` | `"boundary" \| null` | no | Si es `"boundary"`, esta capa participa en `findContainingRegions()` (`src/engine/region/spatial-join.ts`) — sus features actúan como límites administrativos con validez temporal, como cualquier otro feature. |
| `style` | `Record<string, unknown>` | no | Hoy solo se lee `style.cluster: boolean` y `style.icon: string` (`resolveMarkerStyle()`, `src/engine/space/style.ts`), y solo tienen efecto si `kind: "point"`. Cualquier otra clave se acepta pero se ignora. |
| `panel.showInSearch` | `boolean` | no | `false` excluye por completo las features de esa capa del panel izquierdo (ni aparecen en resultados de búsqueda ni son seleccionables) — ver `PanelLeft.ts`. Por defecto (ausente o `true`) sí se incluyen. Útil para capas puramente visuales como `regions` (límites) o una capa `heatmap`. |
| `panel.showInInfo` | `boolean` | no | **Declarado pero no leído por ningún código todavía** — no tiene efecto observable hoy porque no existe ninguna vía de selección que no pase ya por `showInSearch` (p.ej. no hay "click en el mapa para seleccionar"). |
| `panel.infoFields` | `{ field, label }[]` | no | Propiedades extra que se muestran en el panel izquierdo al seleccionar un feature de esta capa, además de nombre/estado temporal/región. `field` es una ruta con puntos dentro de `properties` (igual que `taxonomy[].field`); `label` es el texto mostrado junto al valor. Ver `PanelLeft.ts` (usa el `readField()` de `compute-dimensions.ts`, ahora exportado) y `apps/demo/layers/poi.layer.json` como ejemplo. |

### `LayerSource` (campo `source`)

| `type` | Campos adicionales | Descripción |
|---|---|---|
| `"geojson"` | `url: string` | Un único archivo GeoJSON, cargado entero con `fetch()`. |
| `"geojson-sharded"` | `urls: string[]` | Varios archivos GeoJSON, cargados y concatenados. |
| `"api"` | — | **Reservado, no implementado.** Seam documentado para un futuro loader contra un backend — `fetchFeatures(source, bounds?, dateRange?)` (`src/engine/data/loader-registry.ts`) ya acepta `bounds`/`dateRange` opcionales aunque los loaders actuales los ignoran, precisamente para no tener que cambiar esa firma cuando se implemente. |

### `TaxonomyFieldDef` (elemento de `taxonomy`)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador de la dimensión de filtro — es la key que se usa en `activeFilters` del store. Si dos capas declaran el mismo `id` con `label` distinto, gana la primera capa procesada (limitación conocida). |
| `label` | `string` | Etiqueta mostrada en el panel derecho. |
| `field` | `string` | Ruta con puntos dentro de `properties` del feature (p.ej. `"properties.categoria"`). Así es como el motor evita hardcodear nombres de campo — ver `readField()`/`featureMatchesFilters()` en `src/engine/taxonomy/compute-dimensions.ts`. |
| `hierarchical` | `boolean` | **Declarado pero no leído por ningún código todavía.** |

---

## Datos: GeoJSON + `properties.temporal`

Los datos son `FeatureCollection` GeoJSON estándar. La única extensión propia del motor es `properties.temporal`, opcional en cada `Feature`.

```json
{
  "type": "Feature",
  "id": "poi-5",
  "properties": {
    "nombre": "Mercado Temporal",
    "categoria": "mercado",
    "temporal": {
      "range": { "from": "2024-01-01", "to": "2024-12-31" },
      "recurrence": { "rule": "FREQ=WEEKLY;BYDAY=SA" }
    }
  },
  "geometry": { "type": "Point", "coordinates": [-16.63, 28.28] }
}
```

- **Coordenadas en orden GeoJSON estándar:** `[lng, lat]` — al revés que `map.center` del app manifest, que usa el orden de Leaflet `[lat, lng]`. Fuente de bugs frecuente si se mezclan.
- `properties` puede llevar cualquier campo propio de la app (`nombre`, `categoria`, etc. en el demo) — esos nombres nunca están hardcodeados en `src/engine/`, siempre vienen de `taxonomy[].field` en el `layer.json`.
- `properties.temporal` es opcional. Si no está, el feature se considera activo siempre (`isActiveOn` devuelve `true`).

### `temporal` (objeto)

Sus tres claves son cada una independientemente opcionales y combinables — no son mutuamente excluyentes:

| Campo | Tipo | Semántica |
|---|---|---|
| `instant` | `string` (`YYYY-MM-DD`) | El feature solo está activo ese día exacto. |
| `range.from` | `string` (`YYYY-MM-DD`), opcional | Fecha de inicio de validez. Si se omite, no hay límite inferior. |
| `range.to` | `string` (`YYYY-MM-DD`), opcional | Fecha de fin de validez (inclusive). Si se omite, no hay límite superior. |
| `recurrence.rule` | `string` (subconjunto de RRULE, RFC 5545) | Ver tabla abajo. |
| `recurrence.duration` | `string`, opcional | **Declarado en el tipo (`TemporalRecurrence`, `src/engine/time/temporal-types.ts`) pero no leído por `isActiveOn`/`matchesRule` todavía.** |
| `recurrence.exceptions` | `string[]` (fechas `YYYY-MM-DD`), opcional | Fechas concretas excluidas aunque la regla las incluiría. |

Si `range` y `recurrence` están ambas presentes (como en el ejemplo de arriba), `range` actúa como ventana de validez general y además como ancla para `INTERVAL`/`COUNT` de la recurrencia (`range.from` es el ancla; si `recurrence.rule` usa `COUNT` y no hay `range.from`, `isActiveOn` lanza un error en vez de dar una respuesta silenciosamente incorrecta).

### `recurrence.rule` — subconjunto de RRULE soportado

Parser en `src/engine/time/rrule-subset.ts`. Solo estas claves, todas opcionales salvo `FREQ`:

| Clave | Valores soportados |
|---|---|
| `FREQ` | `DAILY`, `WEEKLY` — funcionan. `MONTHLY`, `YEARLY` — el parser los acepta pero `matchesRule` lanza un error al intentar hacer match (no implementados). |
| `BYDAY` | Lista separada por comas de `MO,TU,WE,TH,FR,SA,SU`. |
| `INTERVAL` | Entero. Cada cuántas unidades de `FREQ` se repite, anclado en `range.from`. |
| `UNTIL` | Fecha `YYYYMMDD` (formato RRULE, sin guiones) — fin de la recurrencia. |
| `COUNT` | Entero. Número de ocurrencias, anclado en `range.from` (obligatorio si se usa `COUNT`). |

No soportado: `BYSETPOS`, `BYMONTHDAY`, ni el resto de RFC 5545.

---

## `strings.json`

Diccionario plano `{ "clave.con.puntos": "texto" }`, cargado por `loadStrings()` (`src/ui/strings.ts`) desde la ruta indicada en `app-manifest.json`'s `strings`. Consumido vía `t(key, strings, params?)`:

- Si la key no existe en el diccionario, `t()` devuelve la propia key tal cual (fallback silencioso — útil en desarrollo, pero significa que una key mal escrita no avisa de nada).
- `params` (opcional) interpola `{nombreParam}` dentro del texto ya resuelto (o dentro de la key, si cayó al fallback) — ver `apps/demo/strings.json` para el listado completo de keys que usa hoy el motor (`search.*`, `participate.*`, `info.*`, `temporalStatus.*`).

---

## Campos declarados pero no implementados todavía (resumen)

Para no repetir la app-manifest y buscar cada uno: estos campos existen en los tipos TypeScript y pasan la validación si están presentes, pero ningún código los lee actualmente. Están para uso futuro, no fallan si los pones, simplemente no hacen nada:

- `app-manifest.json`: `calendar.default`, `baseLayers[].id` (como estado sincronizado — sí se usa como semilla inicial de `activeBaseLayerId`, pero ese estado no se conecta a nada más).
- `layer.json`: `temporal.defaultVisibility`, `taxonomy[].hierarchical`, `panel.showInInfo`.
- Datos: `properties.temporal.recurrence.duration`.
