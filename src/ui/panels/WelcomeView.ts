import type { Store, AppState } from '../../engine/state/store';
import type { AppManifest } from '../../engine/manifests/app-manifest';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { escapeHtml } from '../escape-html';

// One-way thematic splash shown only as the initial view, only when the
// manifest declares `welcome` (see app-manifest.ts) — main.ts seeds
// AppState.view to 'welcome' in exactly that case, 'map' otherwise, so a
// world with no `welcome` field never mounts anything here differently
// than before this feature existed.
export function mountWelcomeView(
  container: HTMLElement,
  store: Store<AppState>,
  appId: string,
  welcome: NonNullable<AppManifest['welcome']>,
  loadedLayers: LoadedLayer[],
): void {
  // Only layers whose features are real, user-facing content — the same
  // flag that excludes them from search (e.g. a heatmap re-visualizing
  // another layer's same source data, or a regionRole:"boundary" layer)
  // also excludes them here, so the count doesn't double-count or include
  // administrative boundaries.
  const itemCount = loadedLayers
    .filter((layer) => layer.manifest.panel?.showInSearch !== false)
    .reduce((total, layer) => total + layer.features.length, 0);
  const countLine =
    welcome.itemNoun && itemCount > 0
      ? `<p class="welcome-view__count">${itemCount} ${escapeHtml(welcome.itemNoun)}</p>`
      : '';
  const heroImage = welcome.heroImage
    ? `<img class="welcome-view__hero" src="worlds/${appId}/${escapeHtml(welcome.heroImage)}" alt="">`
    : '';

  // Plain <a href="?world=..."> links, not a click handler that calls
  // resolveWorldId/re-bootstraps in place — a different world is a
  // completely different manifest/data set, so this is a real navigation
  // (full reload), same as typing the URL by hand.
  const linksSection = welcome.links?.length
    ? `<nav class="welcome-view__links">
        ${welcome.links
          .map(
            (link) =>
              `<a class="welcome-view__link" href="?world=${encodeURIComponent(link.world)}">${escapeHtml(link.label)}</a>`,
          )
          .join('')}
      </nav>`
    : '';

  container.innerHTML = `
    ${heroImage}
    <div class="welcome-view__content">
      <h1 class="welcome-view__title">${escapeHtml(welcome.title)}</h1>
      <p class="welcome-view__tagline">${escapeHtml(welcome.tagline)}</p>
      ${countLine}
      <button type="button" class="welcome-view__cta">${escapeHtml(welcome.ctaLabel)}</button>
      ${linksSection}
    </div>
  `;

  container.querySelector<HTMLButtonElement>('.welcome-view__cta')!.addEventListener('click', () => {
    store.set({ view: 'map' });
  });
}
