import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import reactRenderer from '@astrojs/react/server.js';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import Gallery from '@/components/Gallery.astro';
import type { GalleryPhoto } from '@/lib/albums';
import { initLightbox } from '@/scripts/lightbox';

const ATTACK = '"><img src=x onerror=alert(1)><script>alert(2)</script>';

const photo = {
  id: '00000000-0000-4000-8000-000000000001',
  format: 'webp',
  width: 1200,
  height: 800,
  title: ATTACK,
  description: ATTACK,
  alt: ATTACK,
  aperture: null,
  shutterSpeed: null,
  iso: null,
  camera: { id: 'c1', name: ATTACK },
  lens: { id: 'l1', name: ATTACK },
} as unknown as GalleryPhoto;

describe('XSS', () => {
  it('shows markup in titles, descriptions, alt text and gear names as text, in the viewer too', async () => {
    const container = await AstroContainer.create();
    container.addServerRenderer({ renderer: reactRenderer });
    const { document } = new Window();
    document.body.innerHTML = await container.renderToString(Gallery, {
      props: { photos: [photo], albumTitle: ATTACK },
    });

    initLightbox(document as unknown as Document);
    document.querySelector<HTMLButtonElement>('[data-gallery-item]')!.click();

    const viewer = document.querySelector('[data-lightbox]')!;
    // The only images are the gallery photo and the viewer's; no scripts but Astro's module.
    expect(document.querySelectorAll('img')).toHaveLength(2);
    expect(document.querySelectorAll('script:not([type="module"])')).toHaveLength(0);
    expect(viewer.querySelector('[data-image]')!.getAttribute('alt')).toBe(ATTACK);
    expect(viewer.querySelector('[data-title]')!.textContent).toBe(ATTACK);
    expect(viewer.querySelector('[data-description]')!.textContent).toBe(ATTACK);
    expect(viewer.querySelector('[data-settings]')!.textContent).toContain(ATTACK);
  });
});
