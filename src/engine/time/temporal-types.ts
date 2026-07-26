export interface TemporalRecurrence {
  rule: string;
  duration?: string;
  exceptions?: string[];
}

export interface Temporal {
  instant?: string;
  range?: { from?: string; to?: string };
  recurrence?: TemporalRecurrence;
}

export interface GeoFeature {
  type: 'Feature';
  id?: string | number;
  geometry: GeoJSON.Geometry;
  properties: Record<string, unknown> & { temporal?: Temporal };
}
