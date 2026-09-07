import type { Store, AppState } from '../../engine/state/store';
import type { AppManifest } from '../../engine/manifests/app-manifest';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { escapeHtml } from '../escape-html';
import { renderLegalFooter } from './legal-footer';

// Thematic splash, only mounted when the manifest declares `welcome` (see
// app-manifest.ts) — main.ts seeds AppState.view to 'welcome' in exactly
// that case, 'map' otherwise, so a world with no `welcome` field never
// mounts anything here differently than before this feature existed. The
// header's Home link (app-chrome.ts) can always navigate back to it.
export function mountWelcomeView(
  container: HTMLElement,
  store: Store<AppState>,
  appId: string,
  welcome: NonNullable<AppManifest['welcome']>,
  loadedLayers: LoadedLayer[],
  strings: Record<string, string>,
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

  // Plain <a href> links, not a click handler that calls
  // resolveWorldId/re-bootstraps in place — a different world is a
  // completely different manifest/data set, so this is a real navigation
  // (full reload), same as typing the URL by hand. A link with its own
  // "domain" navigates straight to that world's standalone site; without
  // one it falls back to the shared-build `?world=` override.
  const worldLinks = welcome.links?.length
    ? `<nav class="welcome-view__links">
        ${welcome.links
          .map((link) => {
            const href = link.domain
              ? `https://${encodeURIComponent(link.domain)}`
              : `?world=${encodeURIComponent(link.world)}`;
            return `<a class="welcome-view__link" href="${href}">${escapeHtml(link.label)}</a>`;
          })
          .join('')}
      </nav>`
    : '';

  const legalRow = renderLegalFooter(welcome.title, strings);

  container.innerHTML = `
    <header class="welcome-view__header">
      ${heroImage}
      <h1 class="welcome-view__title">${escapeHtml(welcome.title)}</h1>
      <p class="welcome-view__tagline">${escapeHtml(welcome.tagline)}</p>
    </header>
    <main class="welcome-view__content">
      ${countLine}
      <button type="button" class="welcome-view__cta">${escapeHtml(welcome.ctaLabel)}</button>
    </main>
    <footer class="welcome-view__footer">
      ${worldLinks}
      ${legalRow}
    </footer>
  `;

  container.querySelector<HTMLButtonElement>('.welcome-view__cta')!.addEventListener('click', () => {
    store.set({ view: 'map' });
  });
}
