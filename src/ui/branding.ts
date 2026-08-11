import type { AppManifest } from '../engine/manifests/app-manifest';

// Sets the page title and, if the manifest specifies one, swaps the
// favicon. `doc` defaults to the global `document` — parameterized so this
// stays testable without a DOM environment, matching the rest of `src/ui/`.
export function applyBranding(manifest: AppManifest, appId: string, doc: Document = document): void {
  doc.title = manifest.title ?? doc.title;

  if (!manifest.favicon) return;

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
