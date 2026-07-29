import type { LayerSource } from '../data/source-types';

export type LayerKind = 'point' | 'line' | 'polygon' | 'boundary' | 'heatmap';

export interface TaxonomyFieldDef {
  id: string;
  label: string;
  field: string;
  hierarchical?: boolean;
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
  panel?: { showInSearch?: boolean; showInInfo?: boolean; infoFields?: InfoFieldDef[] };
}

const VALID_KINDS: LayerKind[] = ['point', 'line', 'polygon', 'boundary', 'heatmap'];
const VALID_SOURCE_TYPES = ['geojson', 'geojson-sharded'];

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

  return json as LayerManifest;
}
