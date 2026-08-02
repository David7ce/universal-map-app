export interface CustomCrsConfig {
  proj4def: string;
  resolutions: number[];
  origin: [number, number];
  bounds?: [[number, number], [number, number]];
}

export type MapCrsConfig = 'EPSG:3857' | 'EPSG:4326' | CustomCrsConfig;

export const KNOWN_CRS_IDS = ['EPSG:3857', 'EPSG:4326'] as const;

function isNumberPair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number';
}

export function isValidMapCrsConfig(value: unknown): value is MapCrsConfig {
  if (typeof value === 'string') {
    return (KNOWN_CRS_IDS as readonly string[]).includes(value);
  }
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;
  if (typeof obj.proj4def !== 'string' || obj.proj4def.length === 0) return false;
  if (
    !Array.isArray(obj.resolutions) ||
    obj.resolutions.length === 0 ||
    !obj.resolutions.every((r) => typeof r === 'number')
  ) {
    return false;
  }
  if (!isNumberPair(obj.origin)) return false;
  if (obj.bounds !== undefined) {
    if (!Array.isArray(obj.bounds) || obj.bounds.length !== 2) return false;
    if (!isNumberPair(obj.bounds[0]) || !isNumberPair(obj.bounds[1])) return false;
  }
  return true;
}
