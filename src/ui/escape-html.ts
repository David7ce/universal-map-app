const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes the five HTML-significant characters in a data-derived string so it
 * is safe to interpolate into `innerHTML`, whether the interpolation lands in
 * a text node or inside an HTML attribute value.
 *
 * This is for genuinely data-derived values (feature names, taxonomy labels,
 * filter values) — not for strings returned by `t()` / `describeTemporalStatus()`,
 * which are trusted, already-controlled UI copy.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}
