import type { Store, AppState } from '../../engine/state/store';
import type { AppManifest } from '../../engine/manifests/app-manifest';
import { escapeHtml } from '../escape-html';
import { renderLegalFooter } from './legal-footer';

// Full-screen "About Us" view — only mounted when the manifest declares
// `about` (main.ts), same conditional pattern as WelcomeView. Cheap
// render-guard + store.subscribe, same as CalendarView: no teardown, just a
// no-op when `view !== 'about'`.
export function mountAboutView(
  container: HTMLElement,
  store: Store<AppState>,
  siteTitle: string,
  about: NonNullable<AppManifest['about']>,
  strings: Record<string, string>,
): void {
  function render(): void {
    if (store.get().view !== 'about') return;

    const paragraphs = about.body.map((p) => `<p class="about-view__paragraph">${escapeHtml(p)}</p>`).join('');
    const links = about.links?.length
      ? `<nav class="about-view__links">
          ${about.links.map((link) => `<a class="about-view__link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.label)}</a>`).join('')}
        </nav>`
      : '';

    container.innerHTML = `
      <div class="about-view__content">
        <h1 class="about-view__title">${escapeHtml(about.title)}</h1>
        ${paragraphs}
        ${links}
      </div>
      <footer class="about-view__footer">${renderLegalFooter(siteTitle, strings)}</footer>
    `;
  }

  render();
  store.subscribe(render);
}
