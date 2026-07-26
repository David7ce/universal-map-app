export type LayerSource =
  | { type: 'geojson'; url: string }
  | { type: 'geojson-sharded'; urls: string[] };

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface DateRange {
  from?: string;
  to?: string;
}
