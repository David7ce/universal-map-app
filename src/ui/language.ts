export type Language = 'en' | 'es';

const STORAGE_KEY = 'universal-map-app:lang';

// Only English/Spanish strings exist today (see worlds/*/strings.{en,es}.json)
// — any other browser language falls back to English, same as an unknown
// t() key falls back to its raw key.
export function detectDefaultLanguage(navigatorLanguage: string): Language {
  return navigatorLanguage.toLowerCase().startsWith('es') ? 'es' : 'en';
}

// `localStorage` isn't available in the Vitest "node" test environment
// (see vite.config.ts) — callers that need this at bootstrap already run in
// a browser, but the guard keeps this importable from unit tests too.
export function getStoredLanguage(): Language | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'en' || stored === 'es' ? stored : undefined;
}

export function setStoredLanguage(lang: Language): void {
  localStorage.setItem(STORAGE_KEY, lang);
}
