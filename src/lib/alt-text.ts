/**
 * Every photo on the site gets alt text, even when none was typed in. The order:
 * the alt text you wrote, then the photo's title (unless it's just the camera's
 * file name, like "DSC 0042"), then the album and the photo's place in it.
 *
 * The fallback is worked out each time a page renders rather than saved, so
 * renaming a photo or album, or adding real alt text later, takes effect at once.
 */

/** Titles that are only a camera or phone file name, which tell a listener nothing. */
const FILE_NAME =
  /^(?:_?DSC[FN]?|_?IMG|IMG_E|PXL|DJI|GOPR|GH\d{2}|MVIMG|_?MG|P\d{3}|Z\d{2})[\s_-]*\d+[\s\w-]*$/i;

export const isFileNameTitle = (title: string) => FILE_NAME.test(title.trim());

/** The last-resort description of a photo in an album. `position` counts from 1. */
export const albumPhotoAlt = (albumTitle: string, position: number) =>
  `Photo ${position} from the ${albumTitle} album`;

/** The cover's last-resort description, on the album's Polaroid stack. */
export const albumCoverAlt = (albumTitle: string) => `Cover photo of the ${albumTitle} album`;

/** The alt text to use for a photo, with `fallback` when it has no alt text or useful title. */
export function photoAlt(photo: { alt: string; title: string }, fallback: string): string {
  // Older uploads saved the file-name title as alt text, so those count as blank too.
  const alt = photo.alt.trim();
  if (alt && !isFileNameTitle(alt)) return alt;
  const title = photo.title.trim();
  if (title && !isFileNameTitle(title)) return title;
  return fallback;
}
