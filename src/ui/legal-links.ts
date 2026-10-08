import type { Language } from './language';

export type LegalPage = 'privacy' | 'cookies' | 'terms';

// English pages are `<page>.html`; Spanish are `<page>.es.html` (public/).
export function legalHref(page: LegalPage, lang: Language): string {
  return lang === 'es' ? `${page}.es.html` : `${page}.html`;
}
