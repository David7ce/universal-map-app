import type { InfoFieldDef } from '../../engine/manifests/layer-manifest';
import { escapeHtml } from '../escape-html';

const ALLOWED_URL_SCHEMES = ['http:', 'https:', 'mailto:'];

/**
 * `link`/`image` types interpolate a data-derived value into an `href`/`src`
 * attribute — restrict to schemes that can't execute script (blocks
 * `javascript:` URLs planted in feature properties). A value with no scheme
 * at all (no `:`) can't be a `javascript:`/`data:` URI either — accept it as
 * a same-origin relative path, e.g. a bundled world asset like
 * `assets/photos/thumbs/x.jpg`, as long as it doesn't contain whitespace
 * (a clear sign it's not a path/URL at all, just arbitrary text).
 */
export function isAllowedUrl(value: string): boolean {
  try {
    return ALLOWED_URL_SCHEMES.includes(new URL(value).protocol);
  } catch {
    return !value.includes(':') && !/\s/.test(value) && value.length > 0;
  }
}

export function formatInfoFieldHtml(def: InfoFieldDef, values: string[]): string {
  if (values.length === 0) return '';
  const label = escapeHtml(def.label);

  if (def.type === 'link' && isAllowedUrl(values[0])) {
    return `<p><a href="${escapeHtml(values[0])}" target="_blank" rel="noopener">${label}</a></p>`;
  }
  if (def.type === 'image') {
    const safeValues = values.filter(isAllowedUrl);
    if (safeValues.length > 1) {
      const images = safeValues.map((src) => ({ src, alt: def.label }));
      const thumbs = safeValues
        .map(
          (src, i) =>
            `<button type="button" class="search-info__gallery-thumb" data-gallery-index="${i}"><img src="${escapeHtml(src)}" alt="${escapeHtml(def.label)} ${i + 1}"></button>`,
        )
        .join('');
      return `<p><strong>${label}</strong></p><div class="search-info__gallery" data-gallery-images="${escapeHtml(JSON.stringify(images))}">${thumbs}</div>`;
    }
    if (safeValues.length === 1) {
      return `<p><strong>${label}</strong></p><img class="search-info__image" src="${escapeHtml(safeValues[0])}" alt="${label}">`;
    }
  }
  return `<p><strong>${label}:</strong> ${escapeHtml(values.join(', '))}</p>`;
}

export function formatCoordinates(coordinates: [number, number]): { lat: string; lng: string } {
  const [lng, lat] = coordinates;
  return { lat: lat.toFixed(5), lng: lng.toFixed(5) };
}
