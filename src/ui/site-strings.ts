import type { Language } from './language';
import { loadStrings } from './strings';

// Project-level strings shared by every world (Home, world list, common UI).
// Lives in `public/` so it ships in every build, including isolated
// `--mode <world>` builds.
export function loadSiteStrings(lang: Language): Promise<Record<string, string>> {
  return loadStrings('strings/site.en.json', lang);
}

// A world's own strings win over the shared ones.
export function mergeStrings(site: Record<string, string>, world: Record<string, string>): Record<string, string> {
  return { ...site, ...world };
}

// A world's display name in the active language, else the manifest's own title.
export function worldLabel(id: string, strings: Record<string, string>, fallback: string): string {
  return strings[`worlds.${id}.label`] ?? fallback;
}
