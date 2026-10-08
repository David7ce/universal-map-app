import { escapeHtml } from './escape-html';

// Escapes `text` for innerHTML, then turns `backtick spans` into <code>. Lets
// UI strings (strings.*.json) mark file names and commands without carrying
// raw HTML.
export function renderInlineCode(text: string): string {
  return text
    .split(/(`[^`]+`)/)
    .map((part) =>
      part.length > 2 && part.startsWith('`') && part.endsWith('`')
        ? `<code>${escapeHtml(part.slice(1, -1))}</code>`
        : escapeHtml(part),
    )
    .join('');
}
