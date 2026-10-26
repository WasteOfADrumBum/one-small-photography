/** Photo sizes stored per photo, by longest edge in pixels. Safe to import in the browser. */
export const PHOTO_SIZES = { sm: 480, md: 1280, lg: 2400 } as const;
export type PhotoSize = keyof typeof PHOTO_SIZES;
export const isPhotoSize = (value: string): value is PhotoSize => value in PHOTO_SIZES;

type PhotoRef = { id: string; format: string };

/** Public URL for one size of a photo, served through /img from the private bucket. */
export const photoUrl = (photo: PhotoRef, size: PhotoSize) =>
  `/img/${photo.id}/${size}.${photo.format}`;

export const photoSrcset = (photo: PhotoRef) =>
  `${photoUrl(photo, 'sm')} 480w, ${photoUrl(photo, 'md')} 1280w, ${photoUrl(photo, 'lg')} 2400w`;
