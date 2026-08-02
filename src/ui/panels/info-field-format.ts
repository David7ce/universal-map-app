import type { InfoFieldDef } from '../../engine/manifests/layer-manifest';
import { escapeHtml } from '../escape-html';

const ALLOWED_URL_SCHEMES = ['http:', 'https:', 'mailto:'];

/**
 * `link`/`image` types interpolate a data-derived value into an `href`/`src`
 * attribute — restrict to schemes that can't execute script (blocks
 * `javascript:` URLs planted in feature properties).
 */
export function isAllowedUrl(value: string): boolean {
  try {
    return ALLOWED_URL_SCHEMES.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function formatInfoFieldHtml(def: InfoFieldDef, values: string[]): string {
  if (values.length === 0) return '';
  const label = escapeHtml(def.label);

  if (def.type === 'link' && isAllowedUrl(values[0])) {
    return `<p><a href="${escapeHtml(values[0])}" target="_blank" rel="noopener">${label}</a></p>`;
  }
  if (def.type === 'image' && isAllowedUrl(values[0])) {
    return `<p><strong>${label}</strong></p><img class="search-info__image" src="${escapeHtml(values[0])}" alt="${label}">`;
  }
  return `<p><strong>${label}:</strong> ${escapeHtml(values.join(', '))}</p>`;
}

export function formatCoordinates(coordinates: [number, number]): { lat: string; lng: string } {
  const [lng, lat] = coordinates;
  return { lat: lat.toFixed(5), lng: lng.toFixed(5) };
}
