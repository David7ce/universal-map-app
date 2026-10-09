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
    const ids = new Set(geojson.features.map((f: { id: string }) => String(f.id)));
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
