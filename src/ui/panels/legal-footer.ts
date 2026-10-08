import { escapeHtml } from '../escape-html';
import type { Language } from '../language';
import { legalHref } from '../legal-links';
import { t } from '../strings';

// The legal-links row (privacy / cookies / terms, from public/*.html or the
// `.es.html` variants, plus copyright) shown under the Home view.
export function renderLegalFooter(title: string, strings: Record<string, string>, lang: Language = 'en'): string {
  return `
    <p class="legal-footer">
      ${escapeHtml(t('welcome.legal.rights', strings, { year: String(new Date().getFullYear()), title }))}
      <a class="legal-footer__link" href="${legalHref('privacy', lang)}">${escapeHtml(t('welcome.legal.privacy', strings))}</a>
      <a class="legal-footer__link" href="${legalHref('cookies', lang)}">${escapeHtml(t('welcome.legal.cookies', strings))}</a>
      <a class="legal-footer__link" href="${legalHref('terms', lang)}">${escapeHtml(t('welcome.legal.terms', strings))}</a>
    </p>`;
}
