/**
 * The kinds of photography an album can be tagged with. The list is fixed on purpose:
 * the admin picks from it, so the portfolio filter never fills up with near-duplicates
 * ("Portraits", "portrait", "Portraiture").
 *
 * Albums store the `id`. To add a tag, add a line here. To rename one, change its
 * `label` and leave the `id` alone, or albums that already use it lose the tag.
 */

export const ALBUM_TAG_GROUPS = [
  {
    label: 'People',
    tags: [
      { id: 'portrait', label: 'Portrait' },
      { id: 'headshot', label: 'Headshot' },
      { id: 'senior', label: 'Senior' },
      { id: 'couple', label: 'Couple' },
      { id: 'family', label: 'Family' },
      { id: 'maternity', label: 'Maternity' },
      { id: 'children', label: 'Newborn & Children' },
      { id: 'group', label: 'Group / Multiple Models' },
    ],
  },
  {
    label: 'Modeling',
    tags: [
      { id: 'modeling', label: 'Modeling' },
      { id: 'fashion', label: 'Fashion' },
      { id: 'editorial', label: 'Editorial' },
      { id: 'glamour', label: 'Glamour' },
      { id: 'boudoir', label: 'Boudoir' },
      { id: 'fitness', label: 'Fitness' },
      { id: 'cosplay', label: 'Cosplay' },
      { id: 'fine-art', label: 'Fine Art' },
    ],
  },
  {
    label: 'Music & Events',
    tags: [
      { id: 'band-promo', label: 'Band Promo' },
      { id: 'live-music', label: 'Live Music' },
      { id: 'event', label: 'Event' },
      { id: 'wedding', label: 'Wedding' },
      { id: 'engagement', label: 'Engagement' },
      { id: 'sports', label: 'Sports & Action' },
    ],
  },
  {
    label: 'Places & Nature',
    tags: [
      { id: 'landscape', label: 'Landscape' },
      { id: 'nature', label: 'Nature & Wildlife' },
      { id: 'city', label: 'City & Architecture' },
      { id: 'street', label: 'Street' },
      { id: 'travel', label: 'Travel' },
      { id: 'night', label: 'Night & Astro' },
    ],
  },
  {
    label: 'Other',
    tags: [
      { id: 'pets', label: 'Pets' },
      { id: 'automotive', label: 'Automotive' },
      { id: 'product', label: 'Product & Food' },
      { id: 'black-and-white', label: 'Black & White' },
      { id: 'studio', label: 'Studio' },
      { id: 'behind-the-scenes', label: 'Behind the Scenes' },
    ],
  },
] as const;

export type AlbumTagId = (typeof ALBUM_TAG_GROUPS)[number]['tags'][number]['id'];
export type AlbumTag = { id: AlbumTagId; label: string };

/** Every tag, in the order the dropdowns list them. */
export const ALBUM_TAGS: readonly AlbumTag[] = ALBUM_TAG_GROUPS.flatMap((g) => [...g.tags]);

/** The ids on their own, as a tuple for `z.enum`. */
export const ALBUM_TAG_IDS = ALBUM_TAGS.map((t) => t.id) as [AlbumTagId, ...AlbumTagId[]];

/** An album can carry this many tags; more than that stops being a useful filter. */
export const MAX_ALBUM_TAGS = 8;

const labels = new Map<string, string>(ALBUM_TAGS.map((t) => [t.id, t.label]));
const order = new Map<string, number>(ALBUM_TAGS.map((t, i) => [t.id, i]));

export const isAlbumTag = (value: unknown): value is AlbumTagId =>
  typeof value === 'string' && labels.has(value);

export const albumTagLabel = (id: string): string => labels.get(id) ?? id;

/**
 * Known tags only, each once, in list order. Tolerates anything stored: a tag later
 * removed from the list simply stops showing, and a non-array reads as no tags.
 */
export function cleanAlbumTags(value: unknown): AlbumTagId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isAlbumTag))].sort((a, b) => order.get(a)! - order.get(b)!);
}

/** The tags used by at least one of the given albums, in list order, with how many use each. */
export function tagsInUse(albums: readonly { tags: unknown }[]): (AlbumTag & { count: number })[] {
  const counts = new Map<AlbumTagId, number>();
  for (const album of albums) {
    for (const id of cleanAlbumTags(album.tags)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return ALBUM_TAGS.filter((t) => counts.has(t.id)).map((t) => ({
    ...t,
    count: counts.get(t.id)!,
  }));
}
