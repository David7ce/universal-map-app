import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateLayerManifest } from '../manifests/layer-manifest';
import { mergeLayerOverride } from './layer-override';

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

describe('world-leaders English translation', () => {
  const geojson = read('worlds/world-leaders/data/leaders.geojson');
  const data = read('worlds/world-leaders/data/leaders.en.json') as Record<string, Record<string, string>>;
  const base = read('worlds/world-leaders/layers/leaders.layer.json');
  const override = read('worlds/world-leaders/layers/leaders.layer.en.json');
  const merged = validateLayerManifest(mergeLayerOverride(base, override));

  it('has an English override with every translated field for every leader', () => {
    for (const feature of geojson.features) {
      const entry = data[String(feature.id)];
      expect(entry, `missing override for ${feature.id}`).toBeDefined();
      for (const field of ['role', 'roleGroup', 'country', 'continent', 'bio']) {
        expect(entry[field]?.trim(), `${feature.id}.${field}`).toBeTruthy();
      }
    }
  });

  it('only overrides leaders that exist', () => {
    const ids = new Set<string>(geojson.features.map((f: { id: string }) => String(f.id)));
    for (const id of Object.keys(data)) expect(ids.has(id), `unknown id ${id}`).toBe(true);
  });

  it('has an icon for every English role group and continent', () => {
    const taxonomy = (id: string) => merged.taxonomy?.find((t) => t.id === id);
    for (const entry of Object.values(data)) {
      expect(taxonomy('role')?.icons?.[entry.roleGroup], `role icon ${entry.roleGroup}`).toBeTruthy();
      expect(taxonomy('continent')?.icons?.[entry.continent], `continent icon ${entry.continent}`).toBeTruthy();
    }
  });

  it('colours every English continent and keeps no Spanish colour keys', () => {
    const colorMap = (merged.style as { colorMap: Record<string, string> }).colorMap;
    for (const entry of Object.values(data)) expect(colorMap[entry.continent], entry.continent).toBeTruthy();
    expect(Object.keys(colorMap).sort()).toEqual(['Africa', 'Americas', 'Asia', 'Europe', 'Oceania']);
  });

  it('keeps structural fields from the base layer', () => {
    expect(merged.id).toBe(base.id);
    expect(merged.source).toEqual(base.source);
    expect(merged.taxonomy?.[0].field).toBe('properties.roleGroup');
    expect(merged.title).toBe('World Leaders');
  });
});

// Every world that declares `translations: ["en"]` must ship complete overrides.
describe.each([
  {
    world: 'events-canary-islands',
    layer: 'events',
    data: 'events',
    required: ['name', 'description', 'category', 'price'],
    iconFields: { category: 'category' },
  },
  {
    world: 'moon-map-photos',
    layer: 'photos',
    data: 'photos',
    required: ['moonPhaseLabel'],
    iconFields: { moonPhase: 'moonPhaseLabel' },
  },
  {
    world: 'paranormal-spain',
    layer: 'lugares',
    data: 'lugares',
    required: [
      'category',
      'verificationLevel',
      'era',
      'activityHours',
      'dangerLevel',
      'accessibility',
      'bestSeason',
      'phenomena',
      'howToGetThere',
      'recommendations',
      'fullHistory',
    ],
    iconFields: { category: 'category', verification: 'verificationLevel' },
  },
])('$world English translation', ({ world, layer, data, required, iconFields }) => {
  const manifest = read(`worlds/${world}/world.json`);
  const geojson = read(`worlds/${world}/data/${data}.geojson`);
  const overrides = read(`worlds/${world}/data/${data}.en.json`) as Record<string, Record<string, unknown>>;
  const base = read(`worlds/${world}/layers/${layer}.layer.json`);
  const merged = validateLayerManifest(mergeLayerOverride(base, read(`worlds/${world}/layers/${layer}.layer.en.json`)));

  it('is declared in world.json', () => {
    expect(manifest.contentLanguage).toBe('es');
    expect(manifest.translations).toContain('en');
  });

  it('overrides every required field for every feature, and only existing features', () => {
    const ids = new Set<string>(geojson.features.map((f: { id: string }) => String(f.id)));
    for (const id of ids) {
      const entry = overrides[id];
      expect(entry, `missing override for ${id}`).toBeDefined();
      for (const field of required) {
        const value = entry[field];
        const filled = Array.isArray(value)
          ? value.length > 0 && value.every((v) => String(v).trim())
          : String(value ?? '').trim();
        expect(filled, `${id}.${field}`).toBeTruthy();
      }
    }
    for (const id of Object.keys(overrides)) expect(ids.has(id), `unknown id ${id}`).toBe(true);
  });

  it('has an icon for every translated taxonomy value', () => {
    for (const [taxonomyId, field] of Object.entries(iconFields)) {
      const icons = merged.taxonomy?.find((t) => t.id === taxonomyId)?.icons ?? {};
      for (const [id, entry] of Object.entries(overrides)) {
        expect(icons[String(entry[field])], `${id} ${field}=${String(entry[field])}`).toBeTruthy();
      }
    }
  });

  it('keeps structure from the base layer', () => {
    expect(merged.id).toBe(base.id);
    expect(merged.source).toEqual(base.source);
    expect(merged.panel?.infoFields?.length).toBe(base.panel.infoFields.length);
    const fields = merged.panel?.infoFields ?? [];
    for (const [i, field] of fields.entries()) expect(field.field).toBe(base.panel.infoFields[i].field);
    // Most labels change language (a few, like "Video", are spelled the same in both).
    const changed = fields.filter((field, i) => field.label !== base.panel.infoFields[i].label).length;
    expect(changed).toBeGreaterThanOrEqual(Math.ceil(fields.length / 2));
  });
});
