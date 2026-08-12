import type { AppManifest } from '../engine/manifests/app-manifest';
import { applyTheme, deriveTheme } from './theme';

// Sets the page title, swaps the favicon, and applies the accent color —
// each independently optional in the manifest, each a no-op when absent.
// `doc` defaults to the global `document` — parameterized so this stays
// testable without a DOM environment, matching the rest of `src/ui/`.
export function applyBranding(manifest: AppManifest, appId: string, doc: Document = document): void {
  doc.title = manifest.title ?? doc.title;

  if (manifest.favicon) {
    const href = `worlds/${appId}/${manifest.favicon}`;
    let link = doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = doc.createElement('link');
      link.rel = 'icon';
      doc.head.appendChild(link);
    }
    link.removeAttribute('type');
    link.href = href;
  }

  if (manifest.theme?.primary) {
    applyTheme(deriveTheme(manifest.theme.primary), doc);
  }
}
