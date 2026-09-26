import type { Store, AppState } from '../../engine/state/store';
import { escapeHtml } from '../escape-html';
import { renderLegalFooter } from './legal-footer';
import { AVAILABLE_WORLDS, SITE_TITLE, worldHref } from '../worlds';

// The single shared Home view for every world — the project's landing page.
// It explains what the app is, then lists every world this build ships as a
// clickable card (each opening that world directly). The page is about the
// *project*, not the loaded world: the heading is `SITE_TITLE`, and a world's
// own title appears only as its card label. Only mounted when the manifest
// declares `welcome` (main.ts), which signals "start on Home".
export function mountHomeView(
  container: HTMLElement,
  store: Store<AppState>,
  currentWorldId: string,
  strings: Record<string, string>,
): void {
  const cards = AVAILABLE_WORLDS.map((world) => {
    const isCurrent = world.id === currentWorldId;
    return `<a class="home-view__card${isCurrent ? ' is-current' : ''}" href="${worldHref(world.id)}" data-world="${escapeHtml(world.id)}">
      <span class="home-view__card-icon" aria-hidden="true">${world.icon}</span>
      <span class="home-view__card-body">
        <span class="home-view__card-title">${escapeHtml(world.label)}</span>
        <span class="home-view__card-desc">${escapeHtml(world.description)}</span>
      </span>
    </a>`;
  }).join('');

  container.innerHTML = `
    <header class="home-view__header">
      <h1 class="home-view__title">${escapeHtml(SITE_TITLE)}</h1>
      <p class="home-view__tagline">${escapeHtml(strings['home.tagline'] ?? '')}</p>
    </header>
    <main class="home-view__content">
      <p class="home-view__intro">${escapeHtml(strings['home.intro'] ?? '')}</p>
      <h2 class="home-view__worlds-title">${escapeHtml(strings['home.worldsLabel'] ?? 'Worlds')}</h2>
      <nav class="home-view__grid" aria-label="${escapeHtml(strings['home.worldsLabel'] ?? 'Worlds')}">${cards}</nav>
    </main>
    <footer class="home-view__footer">${renderLegalFooter(SITE_TITLE, strings)}</footer>
  `;

  // Clicking a card opens that world. The *current* world's card is already
  // loaded, so it just switches to the map in place (no reload); any other
  // world is a real navigation, since it's a different manifest/data set.
  container.querySelectorAll<HTMLAnchorElement>('[data-world]').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (card.dataset.world === currentWorldId) {
        event.preventDefault();
        store.set({ view: 'map' });
      }
    });
  });
}
