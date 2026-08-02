import { describe, expect, it } from 'vitest';
import { resolveMarkerStyle, resolvePolygonStyle, resolveTaxonomyIcon } from './style';
import type { LayerManifest } from '../manifests/layer-manifest';

function manifest(style?: Record<string, unknown>): LayerManifest {
  return { id: 'poi', title: 'POI', kind: 'point', source: { type: 'geojson', url: '/x' }, style };
}

describe('resolveMarkerStyle', () => {
  it('defaults cluster to false and icon to "default" when style is absent', () => {
    expect(resolveMarkerStyle(manifest())).toEqual({ cluster: false, iconName: 'default' });
  });

  it('reads cluster and icon from the manifest style', () => {
    expect(resolveMarkerStyle(manifest({ cluster: true, icon: 'shop' }))).toEqual({
      cluster: true,
      iconName: 'shop',
    });
  });
});

describe('resolvePolygonStyle', () => {
  it('falls back to a visible default fill/border when style is absent', () => {
    expect(resolvePolygonStyle(manifest())).toEqual({
      color: '#e08a3e',
      weight: 2,
      fillColor: '#e08a3e',
      fillOpacity: 0.18,
    });
  });

  it('reads color/weight/fillColor/fillOpacity from the manifest style', () => {
    expect(
      resolvePolygonStyle(manifest({ color: '#123456', weight: 4, fillColor: '#abcdef', fillOpacity: 0.5 })),
    ).toEqual({ color: '#123456', weight: 4, fillColor: '#abcdef', fillOpacity: 0.5 });
  });

  it('ignores wrong-typed style values and falls back to defaults per field', () => {
    expect(resolvePolygonStyle(manifest({ color: 42, weight: '4', fillColor: null, fillOpacity: 'x' }))).toEqual({
      color: '#e08a3e',
      weight: 2,
      fillColor: '#e08a3e',
      fillOpacity: 0.18,
    });
  });
});

describe('resolveTaxonomyIcon', () => {
  const icons = { park: '🌳', restaurant: '🍴' };

  it('returns undefined when the dimension has no icons configured', () => {
    expect(resolveTaxonomyIcon(undefined, undefined, 'park')).toBeUndefined();
  });

  it('returns the matching icon for a known value', () => {
    expect(resolveTaxonomyIcon(icons, undefined, 'park')).toBe('🌳');
  });

  it('falls back to defaultIcon for an unknown value', () => {
    expect(resolveTaxonomyIcon(icons, '📍', 'theatre')).toBe('📍');
  });

  it('falls back to a built-in default when no defaultIcon is set either', () => {
    expect(resolveTaxonomyIcon(icons, undefined, 'theatre')).toBe('📍');
  });
});
