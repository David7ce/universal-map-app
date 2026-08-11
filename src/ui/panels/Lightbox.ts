import { t } from '../strings';
import { escapeHtml } from '../escape-html';
import { icons } from '../icons';

export interface GalleryImage {
  src: string;
  alt: string;
}

export interface LightboxApi {
  open(images: GalleryImage[], startIndex: number): void;
}

// A single reusable full-screen viewer, mounted once at bootstrap — any
// gallery info field (see info-field-format.ts) opens it via `open()`
// rather than each info card growing its own lightbox markup/state.
export function mountLightbox(container: HTMLElement, strings: Record<string, string>): LightboxApi {
  container.innerHTML = `
    <div class="lightbox" hidden role="dialog" aria-modal="true" aria-label="${escapeHtml(t('lightbox.label', strings))}">
      <div class="lightbox__backdrop" data-action="close"></div>
      <button type="button" class="lightbox__close" data-action="close" aria-label="${escapeHtml(t('lightbox.closeLabel', strings))}">${icons.close}</button>
      <button type="button" class="lightbox__nav lightbox__nav--prev" data-action="prev" aria-label="${escapeHtml(t('lightbox.prevLabel', strings))}">‹</button>
      <img class="lightbox__image" alt="" />
      <button type="button" class="lightbox__nav lightbox__nav--next" data-action="next" aria-label="${escapeHtml(t('lightbox.nextLabel', strings))}">›</button>
      <p class="lightbox__counter"></p>
    </div>
  `;

  const overlay = container.querySelector<HTMLElement>('.lightbox')!;
  const imageEl = container.querySelector<HTMLImageElement>('.lightbox__image')!;
  const counterEl = container.querySelector<HTMLElement>('.lightbox__counter')!;
  const prevBtn = container.querySelector<HTMLButtonElement>('.lightbox__nav--prev')!;
  const nextBtn = container.querySelector<HTMLButtonElement>('.lightbox__nav--next')!;
  const closeBtn = container.querySelector<HTMLButtonElement>('.lightbox__close')!;

  let images: GalleryImage[] = [];
  let index = 0;

  function render(): void {
    const image = images[index];
    imageEl.src = image.src;
    imageEl.alt = image.alt;
    counterEl.textContent = `${index + 1} / ${images.length}`;
    const single = images.length <= 1;
    prevBtn.hidden = single;
    nextBtn.hidden = single;
  }

  function close(): void {
    overlay.hidden = true;
  }

  function step(delta: number): void {
    index = (index + delta + images.length) % images.length;
    render();
  }

  function open(newImages: GalleryImage[], startIndex: number): void {
    images = newImages;
    index = startIndex;
    overlay.hidden = false;
    render();
    closeBtn.focus();
  }

  container.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'close') close();
    else if (action === 'prev') step(-1);
    else if (action === 'next') step(1);
  });

  document.addEventListener('keydown', (event) => {
    if (overlay.hidden) return;
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
  });

  return { open };
}
