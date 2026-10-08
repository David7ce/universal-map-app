# Shared Site Strings, Language Switch and Translated Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project-level UI text lives once in shared `site.{en,es}.json` files merged under each world's strings; the Home gets a visible EN | ES toggle, translated world cards and legal links; Spanish legal pages exist.

**Architecture:** `public/strings/site.<lang>.json` is fetched next to the world strings at bootstrap and merged (`{ ...site, ...world }`). `worlds.ts` keeps only `id` + `icon`; labels/descriptions come from `worlds.<id>.*` strings. Pure helpers (`site-strings.ts`, `language.ts`, `language-toggle.ts`, `legal-links.ts`) carry the testable logic; DOM changes are small edits to `HomeView.ts`, `SettingsControl.ts`, `app-chrome.ts`, `main.ts`.

**Tech Stack:** TypeScript, Vite (`public/` is copied into every build, including `--mode <world>` builds), Vitest (`environment: 'node'`, no DOM), plain CSS.

**Spec:** `docs/superpowers/specs/2026-10-08-shared-site-strings-design.md`

## Global Constraints

- Languages: `en` and `es` only (`Language` in `src/ui/language.ts`). Switching language stores it and reloads the page; no reactive switching.
- Shared site strings are served from `strings/site.<lang>.json` (source: `public/strings/`), so they ship in every build including isolated world builds.
- A world strings file overrides a shared key (`{ ...site, ...world }`).
- `t()` fallback to the raw key is unchanged.
- World data content (bios, names, event text) is NOT translated.
- Format only files you touch: `pnpm prettier --write <paths>` (never repo-wide `pnpm format`; it reformats unrelated files).
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work on a feature branch off `master` (`feat/shared-site-strings`).

## Review Focus

- An isolated build (`pnpm build:world-leaders`) must output `strings/site.en.json` and `strings/site.es.json`, and the app must load there (Task 6 verification).
- A world key that overrides a shared key must win in the merge (Task 1 test).
- A missing/failed `site.<lang>.json` must throw a message naming the file, not silently render raw keys (Task 1 test).
- The map-screen world title and `document.title` follow the language, falling back to `world.json` `title` when no `worlds.<id>.label` exists (Task 1 test for `worldLabel`).
- The Home legal footer must link to the `.es.html` pages when the language is `es` and to `.html` otherwise (Task 5 test).
- World strings files must not re-duplicate a shared key with an identical value, and every `AVAILABLE_WORLDS` id must have label + description in both languages (Task 2 data tests).

## File Structure

- Create `src/ui/site-strings.ts` (+ `.test.ts`): `loadSiteStrings`, `mergeStrings`, `worldLabel`, plus data-consistency tests.
- Create `src/ui/language-toggle.ts` (+ `.test.ts`): `renderLanguageToggle`.
- Create `src/ui/legal-links.ts` (+ `.test.ts`): `legalHref`.
- Create `public/strings/site.en.json`, `public/strings/site.es.json`.
- Create `public/privacy.es.html`, `public/cookies.es.html`, `public/terms.es.html`.
- Modify `src/ui/language.ts` (+ test): `LANGUAGES`, `resolveLanguage`.
- Modify `src/main.ts`, `src/ui/worlds.ts`, `src/ui/panels/HomeView.ts`, `src/ui/panels/SettingsControl.ts`, `src/ui/app-chrome.ts`, `src/ui/panels/legal-footer.ts`, `src/styles.css`, `public/{privacy,cookies,terms}.html`, `worlds/*/strings.*.json`, `README.md`, `CHANGELOG.md`.

Scratch dir for one-off scripts (not committed): `$SCRATCH` =
`C:/Users/tener/AppData/Local/Temp/claude/c--Users-tener-Workspaces-repos-universal-map-app/f4673b25-699f-4fbd-a9b2-641005477237/scratchpad`.

---

### Task 1: Pure helpers

**Files:**

- Create: `src/ui/site-strings.ts`, `src/ui/language-toggle.ts`, `src/ui/legal-links.ts` and a `.test.ts` for each
- Modify: `src/ui/language.ts`, `src/ui/language.test.ts`

**Interfaces:**

- Produces:
  - `loadSiteStrings(lang: Language): Promise<Record<string, string>>`
  - `mergeStrings(site: Record<string, string>, world: Record<string, string>): Record<string, string>`
  - `worldLabel(id: string, strings: Record<string, string>, fallback: string): string`
  - `LANGUAGES: readonly Language[]`, `resolveLanguage(stored: Language | undefined, navigatorLanguage: string): Language`
  - `renderLanguageToggle(languages: readonly Language[], active: Language, groupLabel: string): string`
  - `type LegalPage = 'privacy' | 'cookies' | 'terms'`, `legalHref(page: LegalPage, lang: Language): string`
- Consumes: `loadStrings` from `src/ui/strings.ts`, `escapeHtml` from `src/ui/escape-html.ts`, `detectDefaultLanguage` from `src/ui/language.ts`.

- [ ] **Step 1: Write the failing tests**

`src/ui/site-strings.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSiteStrings, mergeStrings, worldLabel } from './site-strings';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadSiteStrings', () => {
  it('fetches strings/site.en.json for English', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ a: 'A' }) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await loadSiteStrings('en')).toEqual({ a: 'A' });
    expect(fetchMock).toHaveBeenCalledWith('strings/site.en.json');
  });

  it('fetches strings/site.es.json for Spanish', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    await loadSiteStrings('es');
    expect(fetchMock).toHaveBeenCalledWith('strings/site.es.json');
  });

  it('throws an error naming the file when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }));
    await expect(loadSiteStrings('es')).rejects.toThrow(/strings\/site\.es\.json.*404/);
  });
});

describe('mergeStrings', () => {
  it('lets a world key override a shared key', () => {
    expect(mergeStrings({ a: 'site', b: 'site' }, { a: 'world' })).toEqual({ a: 'world', b: 'site' });
  });

  it('keeps world-only keys', () => {
    expect(mergeStrings({}, { x: '1' })).toEqual({ x: '1' });
  });
});

describe('worldLabel', () => {
  it('uses worlds.<id>.label when present', () => {
    expect(worldLabel('moon', { 'worlds.moon.label': 'Moon' }, 'Luna')).toBe('Moon');
  });

  it('falls back to the manifest title', () => {
    expect(worldLabel('moon', {}, 'Luna')).toBe('Luna');
  });
});
```

`src/ui/language-toggle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderLanguageToggle } from './language-toggle';

describe('renderLanguageToggle', () => {
  it('renders one button per language with aria-pressed only on the active one', () => {
    const html = renderLanguageToggle(['en', 'es'], 'es', 'Language');
    expect(html).toContain('data-lang="en" aria-pressed="false"');
    expect(html).toContain('data-lang="es" aria-pressed="true"');
    expect(html).toContain('>EN<');
    expect(html).toContain('>ES<');
  });

  it('puts the group label in aria-label, escaped', () => {
    expect(renderLanguageToggle(['en'], 'en', 'A "b"')).toContain('aria-label="A &quot;b&quot;"');
  });
});
```

`src/ui/legal-links.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { legalHref } from './legal-links';

describe('legalHref', () => {
  it('links the English page for en', () => {
    expect(legalHref('privacy', 'en')).toBe('privacy.html');
  });

  it('links the Spanish page for es', () => {
    expect(legalHref('cookies', 'es')).toBe('cookies.es.html');
    expect(legalHref('terms', 'es')).toBe('terms.es.html');
  });
});
```

Append to `src/ui/language.test.ts` (keep existing imports; add `resolveLanguage` to its import from `./language`):

```ts
describe('resolveLanguage', () => {
  it('prefers the stored language', () => {
    expect(resolveLanguage('en', 'es-ES')).toBe('en');
  });

  it('falls back to the detected browser language', () => {
    expect(resolveLanguage(undefined, 'es-ES')).toBe('es');
    expect(resolveLanguage(undefined, 'fr-FR')).toBe('en');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/ui/site-strings.test.ts src/ui/language-toggle.test.ts src/ui/legal-links.test.ts src/ui/language.test.ts`
Expected: FAIL — modules `./site-strings`, `./language-toggle`, `./legal-links` not found; `resolveLanguage` not exported.

- [ ] **Step 3: Implement**

`src/ui/site-strings.ts`:

```ts
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
```

`src/ui/language-toggle.ts`:

```ts
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
```

`src/ui/legal-links.ts`:

```ts
import type { Language } from './language';

export type LegalPage = 'privacy' | 'cookies' | 'terms';

// English pages are `<page>.html`; Spanish are `<page>.es.html` (public/).
export function legalHref(page: LegalPage, lang: Language): string {
  return lang === 'es' ? `${page}.es.html` : `${page}.html`;
}
```

In `src/ui/language.ts`, after the `Language` type add `export const LANGUAGES: readonly Language[] = ['en', 'es'];` and at the end:

```ts
export function resolveLanguage(stored: Language | undefined, navigatorLanguage: string): Language {
  return stored ?? detectDefaultLanguage(navigatorLanguage);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/ui/site-strings.test.ts src/ui/language-toggle.test.ts src/ui/legal-links.test.ts src/ui/language.test.ts`
Expected: PASS. Then `pnpm test && pnpm typecheck` — all green.

- [ ] **Step 5: Commit**

```bash
pnpm prettier --write src/ui/site-strings.ts src/ui/site-strings.test.ts src/ui/language-toggle.ts src/ui/language-toggle.test.ts src/ui/legal-links.ts src/ui/legal-links.test.ts src/ui/language.ts src/ui/language.test.ts
git add src/ui
git commit -m "feat: add pure helpers for shared strings, language toggle and legal links

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Move common strings to shared site files and load them

**Files:**

- Create: `public/strings/site.en.json`, `public/strings/site.es.json`
- Modify: `worlds/*/strings.{en,es}.json`, `src/main.ts`
- Test: add data tests to `src/ui/site-strings.test.ts`

**Interfaces:**

- Consumes: `loadSiteStrings`, `mergeStrings` (Task 1), `resolveLanguage` (Task 1).
- Produces: `strings/site.<lang>.json` containing every key that is identical across all worlds (both languages) plus `worlds.<id>.label|description` for the four worlds and `home.languageLabel`; `main.ts` builds `strings = mergeStrings(site, world)` and sets `<html lang>`.

- [ ] **Step 1: Write the failing data tests**

Append to `src/ui/site-strings.test.ts` (add imports `readFileSync, readdirSync, existsSync` from `node:fs` and `AVAILABLE_WORLDS` from `./worlds`):

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { AVAILABLE_WORLDS } from './worlds';

function readJson(path: string): Record<string, string> {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('site strings data', () => {
  const en = () => readJson('public/strings/site.en.json');
  const es = () => readJson('public/strings/site.es.json');

  it('defines the same keys in English and Spanish', () => {
    expect(Object.keys(es()).sort()).toEqual(Object.keys(en()).sort());
  });

  it('defines a label and description for every available world in both languages', () => {
    for (const strings of [en(), es()]) {
      for (const world of AVAILABLE_WORLDS) {
        expect(strings[`worlds.${world.id}.label`], world.id).toBeTruthy();
        expect(strings[`worlds.${world.id}.description`], world.id).toBeTruthy();
      }
    }
  });

  it('does not repeat a shared value inside a world strings file', () => {
    for (const lang of ['en', 'es'] as const) {
      const site = lang === 'en' ? en() : es();
      for (const dir of readdirSync('worlds')) {
        const file = `worlds/${dir}/strings.${lang}.json`;
        if (!existsSync(file)) continue;
        for (const [key, value] of Object.entries(readJson(file))) {
          expect(site[key] === value, `${file} repeats shared key ${key}`).toBe(false);
        }
      }
    }
  });
});
```

Note: `AVAILABLE_WORLDS` still has `label`/`description` at this point; the test only reads `id`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/ui/site-strings.test.ts`
Expected: FAIL — `ENOENT ... public/strings/site.en.json`.

- [ ] **Step 3: Write and run the one-off migration script**

Create `$SCRATCH/migrate-strings.mjs` (run from the repo root; it is NOT committed):

```js
import fs from 'node:fs';

const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const worlds = fs.readdirSync('worlds').filter((d) => fs.existsSync(`worlds/${d}/strings.en.json`));
const data = Object.fromEntries(
  worlds.map((d) => [d, { en: read(`worlds/${d}/strings.en.json`), es: read(`worlds/${d}/strings.es.json`) }]),
);

const identicalEverywhere = (key) =>
  ['en', 'es'].every((lang) => {
    const values = worlds.map((d) => data[d][lang][key]);
    return values.every((v) => v !== undefined) && new Set(values).size === 1;
  });

const first = data[worlds[0]];
const shared = Object.keys(first.en).filter(identicalEverywhere);

const site = { en: {}, es: {} };
for (const lang of ['en', 'es']) for (const key of shared) site[lang][key] = first[lang][key];

fs.mkdirSync('public/strings', { recursive: true });
let failures = 0;
for (const lang of ['en', 'es']) {
  for (const d of worlds) {
    const original = data[d][lang];
    const rest = Object.fromEntries(Object.entries(original).filter(([k]) => !shared.includes(k)));
    const merged = { ...site[lang], ...rest };
    const sameKeys = Object.keys(merged).length === Object.keys(original).length;
    const sameValues = Object.keys(original).every((k) => merged[k] === original[k]);
    if (!sameKeys || !sameValues) {
      failures++;
      console.error('MISMATCH', d, lang);
    }
    fs.writeFileSync(`worlds/${d}/strings.${lang}.json`, JSON.stringify(rest, null, 2) + '\n');
  }
  fs.writeFileSync(`public/strings/site.${lang}.json`, JSON.stringify(site[lang], null, 2) + '\n');
}
console.log('shared keys moved:', shared.length, 'mismatches:', failures);
if (failures) process.exit(1);
```

Run: `node "$SCRATCH/migrate-strings.mjs"`
Expected: `shared keys moved: <~90> mismatches: 0`. If mismatches > 0, run `git checkout -- worlds public/strings` (these are uncommitted outputs of this step), fix the script, rerun.

- [ ] **Step 4: Add the new site keys**

Create `$SCRATCH/add-site-keys.mjs`:

```js
import fs from 'node:fs';

const add = {
  en: {
    'home.languageLabel': 'Language',
    'home.addWorld.step3':
      'Register it with one entry in `AVAILABLE_WORLDS` (`src/ui/worlds.ts`) and add its `worlds.<id>.label` and `worlds.<id>.description` to `public/strings/site.*.json`.',
    'worlds.world-leaders.label': 'World Leaders',
    'worlds.world-leaders.description':
      'Portraits and details of the heads of state and government of the main nations.',
    'worlds.paranormal-spain.label': 'Paranormal Spain',
    'worlds.paranormal-spain.description': 'Mysterious places and legends across Spain.',
    'worlds.events-canary-islands.label': 'Canary Islands Events',
    'worlds.events-canary-islands.description':
      'Festivals, pilgrimages and cultural events across the Canary archipelago.',
    'worlds.moon-map-photos.label': 'Moon Photos',
    'worlds.moon-map-photos.description': 'A lunar map with photographs and data for each region.',
  },
  es: {
    'home.languageLabel': 'Idioma',
    'home.addWorld.step3':
      'Regístralo con una entrada en `AVAILABLE_WORLDS` (`src/ui/worlds.ts`) y añade sus `worlds.<id>.label` y `worlds.<id>.description` en `public/strings/site.*.json`.',
    'worlds.world-leaders.label': 'Líderes del Mundo',
    'worlds.world-leaders.description':
      'Retratos e información de los jefes de estado y gobierno de las principales naciones.',
    'worlds.paranormal-spain.label': 'Paranormal España',
    'worlds.paranormal-spain.description': 'Lugares misteriosos y leyendas de la geografía española.',
    'worlds.events-canary-islands.label': 'Eventos de Canarias',
    'worlds.events-canary-islands.description': 'Festivales, romerías y citas culturales del archipiélago canario.',
    'worlds.moon-map-photos.label': 'Fotos de la Luna',
    'worlds.moon-map-photos.description': 'Un mapa lunar con fotografías y datos de cada región.',
  },
};

for (const lang of ['en', 'es']) {
  const path = `public/strings/site.${lang}.json`;
  const site = JSON.parse(fs.readFileSync(path, 'utf8'));
  fs.writeFileSync(path, JSON.stringify({ ...site, ...add[lang] }, null, 2) + '\n');
}
console.log('ok');
```

Run: `node "$SCRATCH/add-site-keys.mjs"`. Expected: `ok`.

- [ ] **Step 5: Run data tests**

Run: `pnpm vitest run src/ui/site-strings.test.ts`
Expected: PASS (all). Note: the `home.addWorld.step3` key was moved by the migration and is overwritten by this step, so the world files no longer carry it.

- [ ] **Step 6: Load and merge in `main.ts`**

In `src/main.ts`:

- Replace the import line `import { detectDefaultLanguage, getStoredLanguage } from './ui/language';` with `import { getStoredLanguage, resolveLanguage } from './ui/language';`.
- Add `import { loadSiteStrings, mergeStrings } from './ui/site-strings';` next to the `loadStrings` import.
- Replace the block

```ts
const language = getStoredLanguage() ?? detectDefaultLanguage(navigator.language);
const strings = await loadStrings(appManifest.strings ? `worlds/${appId}/${appManifest.strings}` : undefined, language);
```

with

```ts
const language = resolveLanguage(getStoredLanguage(), navigator.language);
document.documentElement.lang = language;
const [siteStrings, worldStrings] = await Promise.all([
  loadSiteStrings(language),
  loadStrings(appManifest.strings ? `worlds/${appId}/${appManifest.strings}` : undefined, language),
]);
const strings = mergeStrings(siteStrings, worldStrings);
```

- [ ] **Step 7: Full verification and commit**

Run: `pnpm prettier --write public/strings/site.en.json public/strings/site.es.json worlds/*/strings.*.json src/main.ts src/ui/site-strings.test.ts && pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.
Run `pnpm dev` and open `http://localhost:5173/moon-map-photos/` — Home and map labels still show (no raw keys like `filters.title`).

```bash
git add public/strings worlds src/main.ts src/ui/site-strings.test.ts
git commit -m "feat: move common UI strings to shared site strings, merge at bootstrap

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Translated world cards, Settings list and world title

**Files:**

- Modify: `src/ui/worlds.ts`, `src/ui/panels/HomeView.ts`, `src/ui/panels/SettingsControl.ts`, `src/ui/app-chrome.ts`

**Interfaces:**

- Consumes: `worldLabel` (Task 1), `worlds.<id>.label|description` keys (Task 2).
- Produces: `WorldEntry` is `{ id: string; icon: string }`.

- [ ] **Step 1: Slim `WorldEntry`**

In `src/ui/worlds.ts`, change the interface and entries to:

```ts
export interface WorldEntry {
  id: string;
  // Emoji shown on the Home card — no icon font or asset files needed.
  // The card's label and description are `worlds.<id>.label|description` in
  // `public/strings/site.<lang>.json`.
  icon: string;
}

export const AVAILABLE_WORLDS: readonly WorldEntry[] = [
  { id: 'world-leaders', icon: '🏛️' },
  { id: 'paranormal-spain', icon: '👻' },
  { id: 'events-canary-islands', icon: '🎉' },
  { id: 'moon-map-photos', icon: '🌕' },
] as const;
```

Update the comment above `AVAILABLE_WORLDS` to say "Adding a world means adding one entry here, its `worlds/<id>/` folder, and its label/description in `public/strings/site.*.json`."

- [ ] **Step 2: Home cards read strings**

In `src/ui/panels/HomeView.ts` add `import { t } from '../strings';` and in the `cards` map replace `escapeHtml(world.label)` with `escapeHtml(t(`worlds.${world.id}.label`, strings))` and `escapeHtml(world.description)` with `escapeHtml(t(`worlds.${world.id}.description`, strings))`.

- [ ] **Step 3: Settings world select reads strings**

In `src/ui/panels/SettingsControl.ts` replace

```ts
const worldOptions = AVAILABLE_WORLDS.map((w) => `<option value="${w.id}">${escapeHtml(w.label)}</option>`).join('');
```

with

```ts
const worldOptions = AVAILABLE_WORLDS.map(
  (w) => `<option value="${w.id}">${escapeHtml(t(`worlds.${w.id}.label`, strings))}</option>`,
).join('');
```

- [ ] **Step 4: World title follows the language**

In `src/ui/app-chrome.ts`: add `import { worldLabel } from './site-strings';`; change `mountWorldTitle` to take `strings` and use the label:

```ts
function mountWorldTitle(
  store: Store<AppState>,
  appManifest: AppManifest,
  mapAdapter: MapAdapter,
  strings: Record<string, string>,
): void {
  const titleEl = document.querySelector<HTMLElement>('#world-title')!;
  const appEl = document.querySelector<HTMLElement>('#app')!;
  const worldTitle = worldLabel(appManifest.id, strings, appManifest.title);
  titleEl.textContent = worldTitle;
```

and in its `render()` replace `appManifest.title` with `worldTitle` (the `document.title` assignment). Update the call in `mountAppChrome` to `mountWorldTitle(store, appManifest, mapAdapter, strings);`.

- [ ] **Step 5: Verify**

Run: `pnpm prettier --write src/ui/worlds.ts src/ui/panels/HomeView.ts src/ui/panels/SettingsControl.ts src/ui/app-chrome.ts && pnpm typecheck && pnpm lint && pnpm test`
Expected: all green (the data test from Task 2 still passes; it reads only `world.id`).
Browser: with `localStorage['universal-map-app:lang']='en'` open `http://localhost:5173/` — card titles read "World Leaders", "Paranormal Spain", etc. and the map's bottom title is in English; with `es` they are Spanish.

- [ ] **Step 6: Commit**

```bash
git add src/ui
git commit -m "feat: translate world cards, settings world list and world title

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: EN | ES toggle on the Home

**Files:**

- Modify: `src/ui/panels/HomeView.ts`, `src/main.ts`, `src/styles.css`

**Interfaces:**

- Consumes: `renderLanguageToggle`, `LANGUAGES`, `setStoredLanguage`, `Language` (Tasks 1), key `home.languageLabel` (Task 2).
- Produces: `mountHomeView(container, store, currentWorldId, strings, language: Language)`.

- [ ] **Step 1: Wire the toggle in `HomeView.ts`**

Add imports:

```ts
import { LANGUAGES, setStoredLanguage, type Language } from '../language';
import { renderLanguageToggle } from '../language-toggle';
```

Add the parameter `language: Language` after `strings` in `mountHomeView`. In the `container.innerHTML` template, put as the first element (before `<header ...>`):

```ts
    ${renderLanguageToggle(LANGUAGES, language, t('home.languageLabel', strings))}
```

After the existing card click handler block, add:

```ts
// Switching language stores it and reloads: strings are read once at
// bootstrap (see SettingsControl's language select, same behavior).
container.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((button) => {
  button.addEventListener('click', () => {
    const next = button.dataset.lang as Language;
    if (next === language) return;
    setStoredLanguage(next);
    location.reload();
  });
});
```

In `src/main.ts` update the call to `mountHomeView(document.querySelector('#home-view')!, store, appId, strings, language);`.

- [ ] **Step 2: Style the toggle**

Add to `src/styles.css` next to the other `.home-view__*` rules (before `.home-view__cta`):

```css
.home-view__lang {
  position: absolute;
  top: var(--control-btn-offset);
  right: var(--control-btn-offset);
  display: flex;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-white);
  box-shadow: var(--shadow-md);
}
.home-view__lang-btn {
  border: 0;
  background: transparent;
  padding: 0.35rem 0.75rem;
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  cursor: pointer;
}
.home-view__lang-btn.is-active {
  background: var(--color-primary);
  color: var(--color-white);
}
```

- [ ] **Step 3: Verify**

Run: `pnpm prettier --write src/ui/panels/HomeView.ts src/main.ts src/styles.css && pnpm typecheck && pnpm lint && pnpm test`
Expected: green.
Browser (desktop and 375px) on `http://localhost:5173/`: the toggle sits top-right; clicking EN reloads with all Home text English (title, intro, world cards, how-to steps, legal footer text) and `document.documentElement.lang === 'en'`; clicking ES gives Spanish; the choice survives another reload; no text of the other language remains on the Home.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "feat: add EN | ES language toggle to the Home

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Spanish legal pages and language-aware footer links

**Files:**

- Create: `public/privacy.es.html`, `public/cookies.es.html`, `public/terms.es.html`
- Modify: `public/privacy.html`, `public/cookies.html`, `public/terms.html`, `src/ui/panels/legal-footer.ts`, `src/ui/panels/HomeView.ts`
- Test: `src/ui/panels/legal-footer.test.ts`

**Interfaces:**

- Consumes: `legalHref` (Task 1), `Language`.
- Produces: `renderLegalFooter(title: string, strings: Record<string, string>, lang?: Language): string` (default `'en'`).

- [ ] **Step 1: Write the failing footer test**

`src/ui/panels/legal-footer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderLegalFooter } from './legal-footer';

describe('renderLegalFooter', () => {
  it('links the English pages by default', () => {
    const html = renderLegalFooter('X', {});
    expect(html).toContain('href="privacy.html"');
    expect(html).toContain('href="cookies.html"');
    expect(html).toContain('href="terms.html"');
  });

  it('links the Spanish pages for es', () => {
    const html = renderLegalFooter('X', {}, 'es');
    expect(html).toContain('href="privacy.es.html"');
    expect(html).toContain('href="cookies.es.html"');
    expect(html).toContain('href="terms.es.html"');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/ui/panels/legal-footer.test.ts`
Expected: FAIL — the `es` case still renders `privacy.html`.

- [ ] **Step 3: Implement the footer**

Replace `src/ui/panels/legal-footer.ts` with:

```ts
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
```

In `src/ui/panels/HomeView.ts` change the footer call to `renderLegalFooter(SITE_TITLE, strings, language)`.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/ui/panels/legal-footer.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Generate the Spanish pages**

Create `$SCRATCH/gen-legal-es.mjs` and run it from the repo root (script is not committed; the generated HTML is):

```js
import fs from 'node:fs';

const shell = ({ file, title, body }) => `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="legal.css" />
  </head>
  <body>
    <header class="site-header">
      <a class="site-header__brand" href="./">Universal Calendar Map</a>
      <nav class="site-header__nav">
        <a href="./">Inicio</a>
        <a href="privacy.es.html">Privacidad</a>
        <a href="cookies.es.html">Cookies</a>
        <a href="terms.es.html">Términos</a>
        <a href="${file}.html" hreflang="en" lang="en">English</a>
      </nav>
    </header>
    <main>
${body}
    </main>
    <footer class="site-footer">
      © 2026 Universal Calendar Map.
      <a href="privacy.es.html">Privacidad</a>
      <a href="cookies.es.html">Cookies</a>
      <a href="terms.es.html">Términos</a>
    </footer>
  </body>
</html>
`;

const pages = {
  privacy: {
    title: 'Política de privacidad',
    body: `      <h1>Política de privacidad</h1>
      <p class="legal-updated">Última actualización: 2026</p>

      <h2>Qué recopilamos</h2>
      <p>
        Este sitio muestra datos geográficos y de eventos de acceso público sobre un mapa. Cuando se ofrece un
        formulario (por ejemplo, para informar o sugerir un lugar), solo se envía la información que decidas aportar, por
        el canal indicado en ese formulario (correo electrónico, WhatsApp o Telegram). No se almacena nada en nuestros
        servidores, porque este sitio no tiene: es una aplicación estática que funciona solo en el navegador.
      </p>

      <h2>Analítica</h2>
      <p>
        Este sitio puede usar analítica agregada y respetuosa con la privacidad para entender el uso general. No se
        recopilan ni se venden datos que identifiquen personalmente.
      </p>

      <h2>Teselas de mapa de terceros</h2>
      <p>
        Las teselas del mapa se cargan desde proveedores externos (por ejemplo, OpenStreetMap o Esri). Al cargar una
        tesela se envía tu dirección IP a ese proveedor, sujeta a su propia política de privacidad.
      </p>

      <h2>Contacto</h2>
      <p>Las dudas sobre esta política pueden enviarse por el canal de contacto indicado en el sitio, si existe.</p>`,
  },
  cookies: {
    title: 'Política de cookies',
    body: `      <h1>Política de cookies</h1>
      <p class="legal-updated">Última actualización: 2026</p>

      <h2>Qué usamos</h2>
      <p>
        Este sitio no establece cookies propias de seguimiento. Puede usar <code>localStorage</code> en tu navegador para
        recordar tus preferencias (por ejemplo, las capas del mapa seleccionadas, la fecha elegida o el idioma), que se
        quedan en tu dispositivo y nunca se envían a un servidor.
      </p>

      <h2>Terceros</h2>
      <p>
        Los proveedores de teselas de mapa y cualquier analítica incorporada pueden establecer sus propias cookies,
        regidas por sus propias políticas; este sitio no las controla.
      </p>

      <h2>Gestión de cookies</h2>
      <p>
        Puedes borrar las cookies y el almacenamiento local en cualquier momento desde los ajustes de tu navegador; al
        hacerlo, simplemente se restablecen tus preferencias guardadas en este sitio.
      </p>`,
  },
  terms: {
    title: 'Términos de uso',
    body: `      <h1>Términos de uso</h1>
      <p class="legal-updated">Última actualización: 2026</p>

      <h2>Uso de este sitio</h2>
      <p>
        Este sitio se ofrece con fines informativos. Los datos y contenidos del mapa se muestran «tal cual», sin garantía
        de exactitud ni de que estén completos. Las ubicaciones, fechas y descripciones pueden cambiar o ser incorrectas.
      </p>

      <h2>Fuentes de datos</h2>
      <p>
        Las teselas del mapa y los datos subyacentes son © de sus respectivos proveedores, indicados en la línea de
        atribución del mapa. El contenido específico de cada capa pertenece a su fuente original cuando se indica.
      </p>

      <h2>Uso aceptable</h2>
      <p>
        No uses este sitio para extraer, republicar o tergiversar sus datos a gran escala sin el permiso de las licencias
        de las fuentes de datos correspondientes.
      </p>

      <h2>Cambios</h2>
      <p>
        Estos términos pueden actualizarse de vez en cuando; seguir usando el sitio supone aceptar la versión vigente.
      </p>`,
  },
};

for (const [file, page] of Object.entries(pages)) {
  fs.writeFileSync(`public/${file}.es.html`, shell({ file, ...page }));
}

// Add a "Español" link to the English pages' header nav (idempotent).
for (const file of Object.keys(pages)) {
  const path = `public/${file}.html`;
  const html = fs.readFileSync(path, 'utf8');
  const link = `        <a href="${file}.es.html" hreflang="es" lang="es">Español</a>\n`;
  if (html.includes(link)) continue;
  const marker = '        <a href="terms.html">Terms</a>\n      </nav>';
  if (!html.includes(marker)) throw new Error(`nav marker not found in ${path}`);
  fs.writeFileSync(path, html.replace(marker, `        <a href="terms.html">Terms</a>\n${link}      </nav>`));
}
console.log('ok');
```

Note: the English pages use CRLF or LF line endings; if the `marker` is not found because of CRLF, the script throws — re-run after `sed -i 's/\r$//'` on the three English pages, or adjust the marker to `\r\n`.

Run: `node "$SCRATCH/gen-legal-es.mjs"`. Expected: `ok`.

- [ ] **Step 6: Verify and commit**

Run: `pnpm prettier --write public/privacy.html public/cookies.html public/terms.html public/privacy.es.html public/cookies.es.html public/terms.es.html src/ui/panels/legal-footer.ts src/ui/panels/legal-footer.test.ts src/ui/panels/HomeView.ts && pnpm typecheck && pnpm lint && pnpm test`
Expected: green.
Browser: in `es`, the Home footer links open `privacy.es.html` etc. (Spanish, `lang="es"`, header link "English" returns to the English page); in `en`, the English pages with a "Español" link.

```bash
git add public src
git commit -m "feat: add Spanish legal pages and language-aware legal footer links

Spanish text is a straight translation for owner review, not legal advice.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docs and final verification

**Files:**

- Modify: `README.md`, `CHANGELOG.md`

- [ ] **Step 1: Docs**

In `README.md`, in "Add a new world instance" add to step 4 (or a new step after it): "Add its Home card text to `public/strings/site.en.json` and `site.es.json` as `worlds.<id>.label` and `worlds.<id>.description`, and one entry to `AVAILABLE_WORLDS` in `src/ui/worlds.ts`. Shared UI text lives in those two files; a world's own `strings.*.json` only needs keys that differ or are world-specific (a world key overrides a shared one)." Keep the existing README formatting.

In `CHANGELOG.md` add at the top (above the most recent section), following the existing format:

```md
## Shared site strings, language toggle, translated Home

Project-level text now lives once in `public/strings/site.{en,es}.json` (served at `strings/site.<lang>.json`, shipped in every build including isolated world builds) and is merged under each world's strings (`{ ...site, ...world }`, `src/ui/site-strings.ts`); ~90 keys that were copied into all 8 world files moved there. World cards and the Settings world list read `worlds.<id>.label|description`, and the map's world title follows the language. The Home has an EN | ES toggle (top-right; stores the language and reloads), `<html lang>` follows the active language, and the legal pages exist in Spanish (`*.es.html`, a translation for owner review) with language-aware footer links. World data content (bios, names, event text) is not translated.
```

- [ ] **Step 2: Full verification**

Run: `pnpm prettier --check README.md CHANGELOG.md` (fix only your own additions if flagged; both files had pre-existing formatting issues) then `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
Expected: all green.

Isolated build check: run `pnpm build:world-leaders` and confirm `builds/world-leaders/strings/site.en.json` and `site.es.json` exist (`ls builds/world-leaders/strings`). Serve it (`npx serve builds/world-leaders` or `pnpm preview --outDir builds/world-leaders`) and open the page: Home and map render with real text (no raw keys), toggle works.

Browser matrix (desktop and 375px, `es` and `en`): Home has no text of the other language; map screen labels, filters, toolbar, Settings and world selector follow the language; legal links match the language.

- [ ] **Step 3: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: document shared site strings, language toggle and Spanish legal pages

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
