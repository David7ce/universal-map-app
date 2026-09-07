import { escapeHtml } from '../escape-html';
import { t } from '../strings';

// Shared by WelcomeView and AboutView — the same legal-links row (privacy /
// cookies / terms, from public/*.html, plus copyright) regardless of which
// full-screen view is showing it.
export function renderLegalFooter(title: string, strings: Record<string, string>): string {
  return `
    <p class="legal-footer">
      ${escapeHtml(t('welcome.legal.rights', strings, { year: String(new Date().getFullYear()), title }))}
      <a class="legal-footer__link" href="privacy.html">${escapeHtml(t('welcome.legal.privacy', strings))}</a>
      <a class="legal-footer__link" href="cookies.html">${escapeHtml(t('welcome.legal.cookies', strings))}</a>
      <a class="legal-footer__link" href="terms.html">${escapeHtml(t('welcome.legal.terms', strings))}</a>
    </p>`;
}
