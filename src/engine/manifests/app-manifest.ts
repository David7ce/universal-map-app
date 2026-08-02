import { CALENDAR_SYSTEMS, type CalendarSystem } from '../time/calendar-systems';
import { isValidMapCrsConfig, type MapCrsConfig } from '../space/map-crs';

export interface BaseLayerConfig {
  id: string;
  title: string;
  type: 'raster-tile';
  url: string;
  attribution: string;
}

export interface ParticipateConfig {
  channel: 'email' | 'whatsapp' | 'telegram';
  target: string;
  messageTemplate: string;
}

export interface AppManifest {
  id: string;
  title: string;
  map: { center: [number, number]; zoom: number; crs?: MapCrsConfig };
  baseLayers: BaseLayerConfig[];
  dataLayers: string[];
  calendar: { system?: CalendarSystem; default: 'today' | string; min: string; max: string };
  strings?: string;
  plugins?: { participate?: ParticipateConfig };
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

  const plugins = obj.plugins as Record<string, unknown> | undefined;
  const participate = plugins?.participate as Record<string, unknown> | undefined;
  if (participate !== undefined) {
    const validChannels = ['email', 'whatsapp', 'telegram'];
    if (!validChannels.includes(participate.channel as string)) {
      throw new Error(`App manifest "${obj.id}" has invalid "plugins.participate.channel": ${String(participate.channel)}`);
    }
    if (typeof participate.target !== 'string' || participate.target.length === 0) {
      throw new Error(`App manifest "${obj.id}" "plugins.participate.target" must be a non-empty string`);
    }
    if (typeof participate.messageTemplate !== 'string' || participate.messageTemplate.length === 0) {
      throw new Error(`App manifest "${obj.id}" "plugins.participate.messageTemplate" must be a non-empty string`);
    }
  }

  return json as AppManifest;
}
