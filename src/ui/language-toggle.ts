import type { Language } from './language';
import { escapeHtml } from './escape-html';

// EN | ES buttons for the Home view. Clicking is wired by HomeView.
export function renderLanguageToggle(languages: readonly Language[], active: Language, groupLabel: string): string {
  const buttons = languages
    .map(
      (lang) =>
        `<button type="button" class="home-view__lang-btn${lang === active ? ' is-active' : ''}" data-lang="${lang}" aria-pressed="${lang === active}">${lang.toUpperCase()}</button>`,
    )
    .join('');
  return `<div class="home-view__lang" role="group" aria-label="${escapeHtml(groupLabel)}">${buttons}</div>`;
}
