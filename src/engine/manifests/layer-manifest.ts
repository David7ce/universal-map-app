import type { LayerSource } from '../data/source-types';

export type LayerKind = 'point' | 'line' | 'polygon' | 'boundary' | 'heatmap';

export interface TaxonomyFieldDef {
  id: string;
  label: string;
  field: string;
  hierarchical?: boolean;
  // Optional emoji/glyph per value — when present, both the filter list and
  // (for `point` layers) the map marker show it. `defaultIcon` covers values
  // with no entry in `icons`; a dimension with no `icons` at all gets no
  // icon anywhere, same as today.
  icons?: Record<string, string>;
  defaultIcon?: string;
}

export interface InfoFieldDef {
  field: string;
  label: string;
  type?: 'text' | 'link' | 'image';
}

export interface LayerManifest {
  id: string;
  title: string;
  kind: LayerKind;
  source: LayerSource;
  temporal?: { defaultVisibility: 'always' | 'time-filtered' };
  taxonomy?: TaxonomyFieldDef[];
  regionRole?: 'boundary' | null;
  style?: Record<string, unknown>;
  panel?: {
    showInSearch?: boolean;
    showInInfo?: boolean;
    infoFields?: InfoFieldDef[];
    // `false` makes the layer opt-in: hidden until toggled on via the layer
    // control's "map details" group (same mechanism `heatmap` layers already
    // use). Defaults to `true` (always rendered, subject to the usual
    // temporal/filter checks).
    showByDefault?: boolean;
  };
}

const VALID_KINDS: LayerKind[] = ['point', 'line', 'polygon', 'boundary', 'heatmap'];
const VALID_SOURCE_TYPES = ['geojson', 'geojson-sharded'];
const VALID_INFO_FIELD_TYPES = ['text', 'link', 'image'];

export function validateLayerManifest(json: unknown): LayerManifest {
  if (typeof json !== 'object' || json === null) {
    throw new Error('Layer manifest must be a JSON object');
  }
  const obj = json as Record<string, unknown>;

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    throw new Error('Layer manifest missing required string field "id"');
  }
  if (typeof obj.title !== 'string' || obj.title.length === 0) {
    throw new Error(`Layer manifest "${obj.id}" missing required string field "title"`);
  }
  if (!VALID_KINDS.includes(obj.kind as LayerKind)) {
    throw new Error(`Layer manifest "${obj.id}" has invalid "kind": ${String(obj.kind)}`);
  }
  if (typeof obj.source !== 'object' || obj.source === null) {
    throw new Error(`Layer manifest "${obj.id}" missing required "source" object`);
  }
  const source = obj.source as Record<string, unknown>;
  if (!VALID_SOURCE_TYPES.includes(source.type as string)) {
    throw new Error(`Layer manifest "${obj.id}" has unknown source.type: ${String(source.type)}`);
  }

  if (obj.regionRole !== undefined && obj.regionRole !== null && obj.regionRole !== 'boundary') {
    throw new Error(`Layer manifest "${obj.id}" has invalid "regionRole": ${String(obj.regionRole)}`);
  }

  const temporal = obj.temporal as Record<string, unknown> | undefined;
  if (temporal !== undefined && !['always', 'time-filtered'].includes(temporal.defaultVisibility as string)) {
    throw new Error(
      `Layer manifest "${obj.id}" has invalid "temporal.defaultVisibility": ${String(temporal.defaultVisibility)}`,
    );
  }

  if (obj.taxonomy !== undefined) {
    if (!Array.isArray(obj.taxonomy)) {
      throw new Error(`Layer manifest "${obj.id}" "taxonomy" must be an array`);
    }
    obj.taxonomy.forEach((entry: unknown, index: number) => {
      const field = entry as Record<string, unknown>;
      if (typeof field.id !== 'string' || field.id.length === 0) {
        throw new Error(`Layer manifest "${obj.id}" taxonomy[${index}] missing required string field "id"`);
      }
      if (typeof field.label !== 'string' || field.label.length === 0) {
        throw new Error(`Layer manifest "${obj.id}" taxonomy[${index}] missing required string field "label"`);
      }
      if (typeof field.field !== 'string' || field.field.length === 0) {
        throw new Error(`Layer manifest "${obj.id}" taxonomy[${index}] missing required string field "field"`);
      }
    });
  }

  const panel = obj.panel as Record<string, unknown> | undefined;
  if (panel !== undefined) {
    for (const key of ['showInSearch', 'showInInfo', 'showByDefault'] as const) {
      if (panel[key] !== undefined && typeof panel[key] !== 'boolean') {
        throw new Error(`Layer manifest "${obj.id}" "panel.${key}" must be a boolean when present`);
      }
    }
    if (panel.infoFields !== undefined) {
      if (!Array.isArray(panel.infoFields)) {
        throw new Error(`Layer manifest "${obj.id}" "panel.infoFields" must be an array`);
      }
      panel.infoFields.forEach((entry: unknown, index: number) => {
        const def = entry as Record<string, unknown>;
        if (typeof def.field !== 'string' || def.field.length === 0) {
          throw new Error(
            `Layer manifest "${obj.id}" panel.infoFields[${index}] missing required string field "field"`,
          );
        }
        if (typeof def.label !== 'string' || def.label.length === 0) {
          throw new Error(
            `Layer manifest "${obj.id}" panel.infoFields[${index}] missing required string field "label"`,
          );
        }
        if (def.type !== undefined && !VALID_INFO_FIELD_TYPES.includes(def.type as string)) {
          throw new Error(
            `Layer manifest "${obj.id}" panel.infoFields[${index}] has invalid "type": ${String(def.type)}`,
          );
        }
      });
    }
  }

  return json as LayerManifest;
}
