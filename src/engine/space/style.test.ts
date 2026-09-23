import { describe, expect, it } from 'vitest';
import {
  resolveMarkerBadge,
  resolveMarkerColor,
  resolveMarkerImage,
  resolveMarkerStyle,
  resolvePolygonStyle,
  resolveTaxonomyIcon,
} from './style';
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

describe('resolveMarkerColor', () => {
  const colorMap = { Baja: 'green', Media: 'orange', Alta: 'red' };

  it('returns undefined when no colorMap is configured', () => {
    expect(resolveMarkerColor(undefined, 'gray', 'Baja')).toBeUndefined();
  });

  it('returns the exact-match color for a known value', () => {
    expect(resolveMarkerColor(colorMap, 'gray', 'Baja')).toBe('green');
  });

  it('matches on the part before " - " for a descriptive value', () => {
    expect(resolveMarkerColor(colorMap, 'gray', 'Media - Zona poco iluminada')).toBe('orange');
  });

  it('falls back to defaultColor for an unmatched value', () => {
    expect(resolveMarkerColor(colorMap, 'gray', 'Desconocido')).toBe('gray');
  });

  it('falls back to defaultColor when the value is not a string', () => {
    expect(resolveMarkerColor(colorMap, 'gray', undefined)).toBe('gray');
  });
});

describe('resolveMarkerBadge', () => {
  const badgeMap = { Gratis: '🆓' };

  it('returns undefined when no badgeMap is configured', () => {
    expect(resolveMarkerBadge(undefined, 'Gratis')).toBeUndefined();
  });

  it('returns the badge for a known value', () => {
    expect(resolveMarkerBadge(badgeMap, 'Gratis')).toBe('🆓');
  });

  it('returns undefined for a value with no badge entry (most values)', () => {
    expect(resolveMarkerBadge(badgeMap, '18 €')).toBeUndefined();
  });

  it('matches on the part before " - " for a descriptive value', () => {
    expect(resolveMarkerBadge({ Media: '⚠️' }, 'Media - Zona poco iluminada')).toBe('⚠️');
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

describe('resolveMarkerImage', () => {
  it('returns undefined when value is not a string', () => {
    expect(resolveMarkerImage(undefined)).toBeUndefined();
    expect(resolveMarkerImage(123)).toBeUndefined();
    expect(resolveMarkerImage(null)).toBeUndefined();
  });

  it('recognizes absolute http/https URLs', () => {
    expect(resolveMarkerImage('https://example.com/portrait.jpg')).toBe('https://example.com/portrait.jpg');
    expect(resolveMarkerImage('http://example.com/photo.png')).toBe('http://example.com/photo.png');
  });

  it('recognizes relative assets or worlds paths', () => {
    expect(resolveMarkerImage('assets/leaders/pm.jpg')).toBe('assets/leaders/pm.jpg');
    expect(resolveMarkerImage('worlds/world-leaders/assets/pm.webp')).toBe('worlds/world-leaders/assets/pm.webp');
  });

  it('recognizes files by image extension', () => {
    expect(resolveMarkerImage('some/path/photo.svg')).toBe('some/path/photo.svg');
    expect(resolveMarkerImage('image.png?size=thumb')).toBe('image.png?size=thumb');
  });

  it('returns undefined for non-image strings', () => {
    expect(resolveMarkerImage('plain text')).toBeUndefined();
    expect(resolveMarkerImage('President')).toBeUndefined();
    expect(resolveMarkerImage('🏛️')).toBeUndefined();
  });
});
