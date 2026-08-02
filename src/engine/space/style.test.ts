import { describe, expect, it } from 'vitest';
import { resolveMarkerStyle, resolvePolygonStyle } from './style';
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
