import { describe, expect, it } from 'vitest';
import { PHOTO_SIZES, isPhotoSize, photoSrcset, photoUrl } from './photo-url';
import { photoKey } from './storage';

const photo = { id: '0b6d8a8e-7f43-4c3e-9a51-2a4f7c0f3e11', format: 'webp' };

describe('photo URLs', () => {
  it('points at the /img route for each size', () => {
    expect(photoUrl(photo, 'md')).toBe(`/img/${photo.id}/md.webp`);
  });

  it('lists every size with its width', () => {
    expect(photoSrcset(photo)).toBe(
      Object.entries(PHOTO_SIZES)
        .map(([size, w]) => `/img/${photo.id}/${size}.webp ${w}w`)
        .join(', '),
    );
  });

  it('knows which sizes exist', () => {
    expect(isPhotoSize('lg')).toBe(true);
    expect(isPhotoSize('xl')).toBe(false);
  });

  it('stores files under the same names the URLs use', () => {
    expect(photoKey(photo.id, 'sm', 'jpg')).toBe(`photos/${photo.id}/sm.jpg`);
  });
});
