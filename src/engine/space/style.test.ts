import { describe, expect, it } from 'vitest';
import { resolveMarkerStyle } from './style';
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
