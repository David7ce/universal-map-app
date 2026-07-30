import { describe, expect, it } from 'vitest';
import { searchFeatures } from './search';
import type { GeoFeature } from '../../engine/time/temporal-types';

const features: GeoFeature[] = [
  { type: 'Feature', id: '1', properties: { name: 'Central Bakery' }, geometry: { type: 'Point', coordinates: [0, 0] } },
  { type: 'Feature', id: '2', properties: { name: 'North Hardware Store' }, geometry: { type: 'Point', coordinates: [0, 0] } },
];

describe('searchFeatures', () => {
  it('matches case-insensitively on the given fields', () => {
    expect(searchFeatures(features, 'bake', ['name']).map((f) => f.id)).toEqual(['1']);
  });

  it('returns nothing for an empty query', () => {
    expect(searchFeatures(features, '  ', ['name'])).toEqual([]);
  });

  it('returns nothing when no field matches', () => {
    expect(searchFeatures(features, 'zzz', ['name'])).toEqual([]);
  });
});
