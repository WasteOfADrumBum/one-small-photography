// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { initLightbox } from './lightbox';

const photos = [
  { src: '/img/a/lg.webp', title: 'Dusty', description: 'A horse.', alt: 'A chestnut horse' },
  { src: '/img/b/lg.webp', title: 'Studio', description: '', alt: 'Five portraits' },
  { src: '/img/c/lg.webp', title: '', description: '', alt: 'A field' },
];

beforeEach(() => {
  document.body.innerHTML = `
    ${photos
      .map(
        (p, i) =>
          `<button data-gallery-item="${i}" data-src="${p.src}" data-title="${p.title}" data-description="${p.description}" data-alt="${p.alt}"></button>`,
      )
      .join('')}
    <div hidden>${photos.map((_, i) => `<div data-settings-for="${i}"><ul><li>ISO ${i}</li></ul></div>`).join('')}</div>
    <dialog data-lightbox>
      <button data-prev></button><button data-next></button><button data-close></button>
      <img data-image alt="" />
      <p data-position></p><p data-title></p><p data-description></p><div data-settings></div>
    </dialog>`;
  const dialog = document.querySelector('dialog')!;
  // happy-dom's <dialog> may not implement these.
  dialog.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  initLightbox();
});

const dialog = () => document.querySelector<HTMLDialogElement>('[data-lightbox]')!;
const part = (name: string) => dialog().querySelector<HTMLElement>(`[data-${name}]`)!;
const item = (i: number) =>
  document.querySelector<HTMLButtonElement>(`[data-gallery-item="${i}"]`)!;
const key = (k: string) => dialog().dispatchEvent(new KeyboardEvent('keydown', { key: k }));

describe('initLightbox', () => {
  it('opens on the photo that was clicked, with its details', () => {
    item(1).click();
    expect(dialog().open).toBe(true);
    expect(part('image').getAttribute('src')).toBe('/img/b/lg.webp');
    expect(part('image').getAttribute('alt')).toBe('Five portraits');
    expect(part('title').textContent).toBe('Studio');
    expect(part('position').textContent).toBe('Photo 2 of 3');
    expect(part('settings').textContent).toBe('ISO 1');
  });

  it('steps with the buttons and arrow keys, wrapping at the ends', () => {
    item(0).click();
    part('prev').click();
    expect(part('position').textContent).toBe('Photo 3 of 3');
    part('next').click();
    expect(part('title').textContent).toBe('Dusty');
    key('ArrowRight');
    expect(part('position').textContent).toBe('Photo 2 of 3');
    key('ArrowLeft');
    expect(part('position').textContent).toBe('Photo 1 of 3');
  });

  it('returns focus to the photo you were on when it closes', () => {
    item(0).click();
    part('next').click();
    dialog().dispatchEvent(new Event('close'));
    expect(document.activeElement).toBe(item(1));
  });

  it('does nothing on a page without a gallery', () => {
    document.body.innerHTML = '';
    expect(() => initLightbox()).not.toThrow();
  });
});
