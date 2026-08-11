import { describe, expect, it } from 'vitest';
import { formatCoordinates, formatInfoFieldHtml, isAllowedUrl } from './info-field-format';

describe('isAllowedUrl', () => {
  it('accepts http(s) and mailto', () => {
    expect(isAllowedUrl('https://example.org')).toBe(true);
    expect(isAllowedUrl('http://example.org')).toBe(true);
    expect(isAllowedUrl('mailto:a@example.org')).toBe(true);
  });

  it('rejects javascript: and malformed values', () => {
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedUrl('not a url')).toBe(false);
  });

  it('accepts a same-origin relative path (e.g. a bundled world asset)', () => {
    expect(isAllowedUrl('assets/photos/thumbs/x.jpg')).toBe(true);
    expect(isAllowedUrl('/assets/photos/thumbs/x.jpg')).toBe(true);
  });

  it('rejects a relative-looking value with whitespace', () => {
    expect(isAllowedUrl('not a url')).toBe(false);
  });
});

describe('formatInfoFieldHtml', () => {
  it('returns empty string when there are no values', () => {
    expect(formatInfoFieldHtml({ field: 'x', label: 'X' }, [])).toBe('');
  });

  it('renders text type as a labeled paragraph, joining multiple values', () => {
    expect(formatInfoFieldHtml({ field: 'x', label: 'Category' }, ['a', 'b'])).toBe(
      '<p><strong>Category:</strong> a, b</p>',
    );
  });

  it('renders link type as an anchor using the label as link text', () => {
    expect(formatInfoFieldHtml({ field: 'web', label: 'Website', type: 'link' }, ['https://example.org'])).toBe(
      '<p><a href="https://example.org" target="_blank" rel="noopener">Website</a></p>',
    );
  });

  it('falls back to text rendering for a link with an unsafe scheme', () => {
    expect(formatInfoFieldHtml({ field: 'web', label: 'Website', type: 'link' }, ['javascript:alert(1)'])).toBe(
      '<p><strong>Website:</strong> javascript:alert(1)</p>',
    );
  });

  it('renders image type as a label paragraph plus an img tag', () => {
    expect(formatInfoFieldHtml({ field: 'foto', label: 'Photo', type: 'image' }, ['https://example.org/x.png'])).toBe(
      '<p><strong>Photo</strong></p><img class="search-info__image" src="https://example.org/x.png" alt="Photo">',
    );
  });

  it('renders image type with multiple values as a clickable gallery, not a single img', () => {
    const html = formatInfoFieldHtml({ field: 'photos', label: 'Photos', type: 'image' }, [
      'https://example.org/a.png',
      'https://example.org/b.png',
    ]);
    expect(html).toContain('search-info__gallery');
    expect(html).not.toContain('search-info__image');
    expect(html).toContain('data-gallery-index="0"');
    expect(html).toContain('data-gallery-index="1"');
    expect(html).toContain('data-gallery-images=');
    // The images payload the gallery buttons hand to the lightbox on click.
    expect(html).toContain('https://example.org/a.png');
    expect(html).toContain('https://example.org/b.png');
  });

  it('drops unsafe values from a gallery but keeps the safe ones', () => {
    const html = formatInfoFieldHtml({ field: 'photos', label: 'Photos', type: 'image' }, [
      'https://example.org/a.png',
      'javascript:alert(1)',
      'https://example.org/b.png',
    ]);
    expect(html).toContain('search-info__gallery');
    expect(html).not.toContain('javascript:alert');
  });

  it('escapes HTML-significant characters in label and value', () => {
    expect(formatInfoFieldHtml({ field: 'x', label: '<b>X</b>' }, ['<script>'])).toBe(
      '<p><strong>&lt;b&gt;X&lt;/b&gt;:</strong> &lt;script&gt;</p>',
    );
  });
});

describe('formatCoordinates', () => {
  it('formats [lng, lat] GeoJSON order into labeled lat/lng strings', () => {
    expect(formatCoordinates([-16.62, 28.29])).toEqual({ lat: '28.29000', lng: '-16.62000' });
  });
});
