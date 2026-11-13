import { z } from 'zod';
import { ALBUM_TAG_IDS, MAX_ALBUM_TAGS, cleanAlbumTags } from './album-tags';

/**
 * An album's tags as the admin API accepts them: ids from the fixed list only,
 * saved once each and in list order.
 */
export const AlbumTags = z
  .array(z.enum(ALBUM_TAG_IDS, 'Pick tags from the list.'))
  .max(MAX_ALBUM_TAGS, `An album can have up to ${MAX_ALBUM_TAGS} tags.`)
  .transform((tags) => cleanAlbumTags(tags));
