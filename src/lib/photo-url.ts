import type { PhotoSize } from '@/lib/storage';

type PhotoRef = { id: string; format: string };

/** Public URL for one size of a photo, served through /img from the private bucket. */
export const photoUrl = (photo: PhotoRef, size: PhotoSize) =>
  `/img/${photo.id}/${size}.${photo.format}`;

export const photoSrcset = (photo: PhotoRef) =>
  `${photoUrl(photo, 'sm')} 480w, ${photoUrl(photo, 'md')} 1280w, ${photoUrl(photo, 'lg')} 2400w`;
