import type { Language } from './language';

// A world's `strings` manifest field always names the English file (e.g.
// "strings.en.json") — for any other language, that suffix is swapped for
// the requested one (e.g. "strings.es.json"). A world with no ".en.json"
// suffix (or a language with no translated file) just loads `path` as-is,
// so this stays backward compatible with a world that only ships one
// strings file under any name.
function resolveStringsPath(path: string, lang: Language): string {
  if (lang === 'en') return path;
  return path.replace(/\.en\.json$/, `.${lang}.json`);
}

export async function loadStrings(path: string | undefined, lang: Language = 'en'): Promise<Record<string, string>> {
  if (!path) return {};
  const resolvedPath = resolveStringsPath(path, lang);
  const response = await fetch(resolvedPath);
  if (!response.ok) {
    throw new Error(`Failed to load strings from ${resolvedPath}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export function t(key: string, strings: Record<string, string>, params?: Record<string, string>): string {
  const resolved = strings[key] ?? key;
  if (!params) return resolved;
  return resolved.replace(/\{(\w+)\}/g, (match, paramName: string) =>
    Object.prototype.hasOwnProperty.call(params, paramName) ? params[paramName] : match,
  );
}
