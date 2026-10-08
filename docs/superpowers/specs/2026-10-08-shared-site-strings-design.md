# Shared site strings, language switch and translated Home

## Goal

Every piece of UI text a visitor reads on the Home and map screens should come
from a language-aware strings file, the visitor can change language from a
visible control on the Home, and the project-level text (Home, world list,
legal footer, common UI labels) is written once instead of copied into every
world.

## Audience and success

- Audience: public visitors, Spanish or English speaking.
- Success:
  - Opening the Home in `es` or `en` shows no text in the other language, except
    world data content (see Non-goals).
  - A visible control on the Home switches language; the choice persists.
  - Adding a new world needs no copy of the common UI strings.

## Non-goals

- Translating world data (leader bios and names, event descriptions, place
  names). These stay in the language they were written in; per-language data
  is a separate effort.
- More than two languages (`en`, `es`) or reactive (no-reload) switching;
  switching keeps the existing "store language, reload" behavior.
- Translating `docs/`.

## Current state (verified)

- `loadStrings(path, lang)` (`src/ui/strings.ts`) loads one file per world,
  swapping `.en.json` for `.es.json`; `t(key, strings)` falls back to the key.
- Four worlds x two languages = 8 strings files with ~104 keys each; ~102 keys
  are in every file and 88 (en) / 92 (es) are identical across all of them.
- `AVAILABLE_WORLDS` (`src/ui/worlds.ts`) holds Spanish-only `label` and
  `description`; `world.json` `title` is Spanish-only.
- Language can only be changed from the Settings drawer `<select>`; the Home
  has no control. `<html lang="en">` is fixed in `index.html` and the legal
  pages. Legal pages are English-only static HTML in `public/`.
- `public/` is copied as-is into every build (including per-world isolated
  builds); `worlds/<id>/` is copied by `copyWorldsDirPlugin` (only the isolated
  world in `--mode <id>` builds).

## Design

### Shared strings

- New files `public/strings/site.en.json` and `public/strings/site.es.json`,
  served at `strings/site.<lang>.json` (so they ship in every build, isolated
  ones included).
- They hold: the ~90 keys that are identical across worlds today (common UI:
  filters, layerControl, calendar, settings, toolbar, panel, search, legal
  footer, welcome.legal.\*), all `home.*` keys, and new
  `worlds.<id>.label` / `worlds.<id>.description` keys for every entry of
  `AVAILABLE_WORLDS`.
- `loadStrings` gains a sibling `loadSiteStrings(lang)` and `main.ts` merges:
  `{ ...site, ...world }` — a world file overrides a shared key, so a world can
  still re-word any label.
- The 8 world files keep only keys that differ from the shared value or are
  world-specific (e.g. field labels, `search.placeholder`, `participate.*`).
  A one-off script moves the identical keys; the verification is a test that
  every world still resolves every key it resolved before.
- Fetch failure of a shared file is an error like a world file failure today
  (descriptive message, no silent fallback).

### Worlds list and titles

- `WorldEntry` keeps `id` and `icon` only. Card label and description are read
  with `t('worlds.<id>.label')` / `t('worlds.<id>.description')`; the Settings
  world `<select>` uses the same labels.
- The world title (`#world-title`, `document.title`) uses `t('world.title')`
  if the strings define it, else `world.json` `title`. Shared site strings
  define `worlds.<id>.label`; `mountWorldTitle` prefers that label for the
  loaded world, so the title follows the language.
- Missing translation behavior is unchanged (`t()` returns the key), covered by
  a test that both site files define the same key set.

### Language switch on the Home

- A small two-option toggle `EN | ES` (a `role="group"` of buttons with
  `aria-pressed`) at the top-right of the Home view, inside `#home-view`.
- Choosing a language calls `setStoredLanguage` and reloads (same as the
  Settings select), and the active option is the stored or detected language.
- The Settings drawer select stays for the map screen.
- `document.documentElement.lang` is set to the active language at bootstrap.

### Legal pages

- Add `public/privacy.es.html`, `public/cookies.es.html`, `public/terms.es.html`
  as Spanish versions with `lang="es"`, translated nav/header, and a link to
  the English version (and vice versa).
- The Home legal footer (`legal-footer.ts`) links to the variant matching the
  active language.
- The Spanish text is a straight translation for review; it is not legal
  advice and should be reviewed by the site owner.

## Files

- Create `public/strings/site.{en,es}.json`, `public/{privacy,cookies,terms}.es.html`.
- Create `src/ui/site-strings.ts` (+ test): load and merge helpers.
- Modify `src/ui/strings.ts`, `src/main.ts`, `src/ui/worlds.ts`,
  `src/ui/panels/HomeView.ts`, `src/ui/panels/SettingsControl.ts`,
  `src/ui/app-chrome.ts`, `src/ui/panels/legal-footer.ts`, `src/styles.css`,
  `index.html`, `public/{privacy,cookies,terms}.html` (alternate-language
  link), `worlds/*/strings.*.json`.

## Testing

- Unit: merge precedence (world overrides site), `loadSiteStrings` path per
  language and error on failed fetch, `en`/`es` site files define identical
  key sets, every `AVAILABLE_WORLDS` id has `label` and `description` in both
  languages, legal-footer link per language.
- Regression: a script-assisted check that, for each world and language, the
  merged strings resolve every key the old world file resolved, to the same
  value unless intentionally changed.
- Browser (desktop and 375px): Home in `es` and `en` shows no text from the
  other language; toggle persists across reload; map screen labels follow the
  language; legal links open the right language; isolated build
  (`pnpm build:world-leaders`) still finds `strings/site.*.json`.

## Open decisions (defaults chosen)

- Spanish legal pages are written by translation and flagged for owner review.
- Reload on language change (not reactive), as today.
