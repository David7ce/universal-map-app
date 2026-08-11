import { CALENDAR_SYSTEMS, type CalendarSystem } from '../time/calendar-systems';
import { isValidMapCrsConfig, type MapCrsConfig } from '../space/map-crs';

export interface BaseLayerConfig {
  id: string;
  title: string;
  type: 'raster-tile';
  url: string;
  attribution: string;
  // Optional second tile source rendered on top of `url` — e.g. a
  // labels/reference layer over unlabeled satellite imagery, so place
  // names still show. Defaults to `attribution` when omitted.
  labelsUrl?: string;
  labelsAttribution?: string;
}

export interface AppManifest {
  id: string;
  title: string;
  map: { center: [number, number]; zoom: number; crs?: MapCrsConfig };
  baseLayers: BaseLayerConfig[];
  dataLayers: string[];
  calendar: { system?: CalendarSystem; default: 'today' | string; min: string; max: string };
  strings?: string;
  favicon?: string;
  plugins?: Record<string, unknown>;
  systems?: { time?: boolean };
  welcome?: {
    title: string;
    tagline: string;
    ctaLabel: string;
    heroImage?: string;
    itemNoun?: string;
    links?: { label: string; world: string }[];
  };
}

export function validateAppManifest(json: unknown): AppManifest {
  if (typeof json !== 'object' || json === null) {
    throw new Error('App manifest must be a JSON object');
  }
  const obj = json as Record<string, unknown>;

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    throw new Error('App manifest missing required string field "id"');
  }
  if (!Array.isArray(obj.baseLayers) || obj.baseLayers.length === 0) {
    throw new Error(`App manifest "${obj.id}" requires at least one entry in "baseLayers"`);
  }
  if (!Array.isArray(obj.dataLayers)) {
    throw new Error(`App manifest "${obj.id}" missing required array field "dataLayers"`);
  }
  const calendar = obj.calendar as Record<string, unknown> | undefined;
  if (!calendar || typeof calendar.min !== 'string' || typeof calendar.max !== 'string') {
    throw new Error(`App manifest "${obj.id}" requires "calendar.min" and "calendar.max"`);
  }
  if (calendar.default !== 'today' && !/^\d{4}-\d{2}-\d{2}$/.test(calendar.default as string)) {
    throw new Error(`App manifest "${obj.id}" "calendar.default" must be "today" or an ISO date (YYYY-MM-DD)`);
  }
  if (calendar.system !== undefined && !CALENDAR_SYSTEMS.includes(calendar.system as CalendarSystem)) {
    throw new Error(`App manifest "${obj.id}" has invalid "calendar.system": ${String(calendar.system)}`);
  }

  const map = obj.map as Record<string, unknown> | undefined;
  if (map?.crs !== undefined && !isValidMapCrsConfig(map.crs)) {
    throw new Error(`App manifest "${obj.id}" has invalid "map.crs": ${JSON.stringify(map.crs)}`);
  }

  if (obj.strings !== undefined && typeof obj.strings !== 'string') {
    throw new Error(`App manifest "${obj.id}" "strings" must be a string path when present`);
  }

  if (obj.favicon !== undefined && typeof obj.favicon !== 'string') {
    throw new Error(`App manifest "${obj.id}" "favicon" must be a string path when present`);
  }

  if (obj.plugins !== undefined) {
    if (typeof obj.plugins !== 'object' || obj.plugins === null || Array.isArray(obj.plugins)) {
      throw new Error(`App manifest "${obj.id}" "plugins" must be a plain object mapping plugin id to config`);
    }
  }

  if (obj.systems !== undefined) {
    if (typeof obj.systems !== 'object' || obj.systems === null || Array.isArray(obj.systems)) {
      throw new Error(`App manifest "${obj.id}" "systems" must be a plain object`);
    }
    const systems = obj.systems as Record<string, unknown>;
    if (systems.time !== undefined && typeof systems.time !== 'boolean') {
      throw new Error(`App manifest "${obj.id}" "systems.time" must be a boolean`);
    }
  }

  if (obj.welcome !== undefined) {
    if (typeof obj.welcome !== 'object' || obj.welcome === null || Array.isArray(obj.welcome)) {
      throw new Error(`App manifest "${obj.id}" "welcome" must be a plain object`);
    }
    const welcome = obj.welcome as Record<string, unknown>;
    if (typeof welcome.title !== 'string' || welcome.title.length === 0) {
      throw new Error(`App manifest "${obj.id}" "welcome.title" is required and must be a non-empty string`);
    }
    if (typeof welcome.tagline !== 'string' || welcome.tagline.length === 0) {
      throw new Error(`App manifest "${obj.id}" "welcome.tagline" is required and must be a non-empty string`);
    }
    if (typeof welcome.ctaLabel !== 'string' || welcome.ctaLabel.length === 0) {
      throw new Error(`App manifest "${obj.id}" "welcome.ctaLabel" is required and must be a non-empty string`);
    }
    if (welcome.heroImage !== undefined && typeof welcome.heroImage !== 'string') {
      throw new Error(`App manifest "${obj.id}" "welcome.heroImage" must be a string path when present`);
    }
    if (welcome.itemNoun !== undefined && typeof welcome.itemNoun !== 'string') {
      throw new Error(`App manifest "${obj.id}" "welcome.itemNoun" must be a string when present`);
    }
    if (welcome.links !== undefined) {
      if (!Array.isArray(welcome.links)) {
        throw new Error(`App manifest "${obj.id}" "welcome.links" must be an array when present`);
      }
      welcome.links.forEach((link: unknown, index: number) => {
        const entry = link as Record<string, unknown>;
        if (typeof entry?.label !== 'string' || entry.label.length === 0) {
          throw new Error(
            `App manifest "${obj.id}" "welcome.links[${index}].label" is required and must be a non-empty string`,
          );
        }
        if (typeof entry?.world !== 'string' || entry.world.length === 0) {
          throw new Error(
            `App manifest "${obj.id}" "welcome.links[${index}].world" is required and must be a non-empty string`,
          );
        }
      });
    }
  }

  return json as AppManifest;
}
