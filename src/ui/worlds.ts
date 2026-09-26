// The project's own name — shown on the Home page and in the legal footer,
// independent of whichever world happens to be loaded. A world's own
// `title` is its card label, not the site title.
export const SITE_TITLE = 'Universal Calendar Map';

// The set of worlds this build knows about, for the shared Home view and the
// Settings world switcher. A single source of truth so the two can't drift.
// Adding a world means adding one entry here (plus its `worlds/<id>/` folder).
// The first entry is the default world (see `DEFAULT_WORLD_ID`).
export interface WorldEntry {
  id: string;
  label: string;
  description: string;
  // Emoji shown on the Home card — no icon font or asset files needed.
  icon: string;
}

export const AVAILABLE_WORLDS: readonly WorldEntry[] = [
  {
    id: 'world-leaders',
    label: 'Líderes del Mundo',
    description: 'Retratos e información de los jefes de estado y gobierno de las principales naciones.',
    icon: '🏛️',
  },
  {
    id: 'paranormal-spain',
    label: 'Paranormal España',
    description: 'Lugares misteriosos y leyendas de la geografía española.',
    icon: '👻',
  },
  {
    id: 'events-canary-islands',
    label: 'Eventos de Canarias',
    description: 'Festivales, romerías y citas culturales del archipiélago canario.',
    icon: '🎉',
  },
  {
    id: 'moon-map-photos',
    label: 'Fotos de la Luna',
    description: 'Un mapa lunar con fotografías y datos de cada región.',
    icon: '🌕',
  },
] as const;

// URL for a world: a real path (`/world-leaders/`), which `vite.config.ts`'s
// `worldRoutesPlugin` makes resolvable on a static host. Relative to the
// current page so it works from the site root and from a nested world page
// alike; `base` is Vite's configured base (e.g. `/universal-map-app/` on a
// GitHub Pages project site).
export function worldHref(id: string, base = import.meta.env.BASE_URL): string {
  return `${base}${encodeURIComponent(id)}/`;
}
