import { useId } from 'react';
import { X } from 'lucide-react';
import {
  ALBUM_TAG_GROUPS,
  MAX_ALBUM_TAGS,
  albumTagLabel,
  cleanAlbumTags,
  type AlbumTagId,
} from '@/lib/album-tags';

/**
 * Picks an album's tags from the fixed list: a dropdown adds one, and each picked tag
 * shows underneath as a chip with a remove button. Picked tags leave the dropdown, so it
 * only ever offers what can still be added.
 */
export default function TagPicker({
  value,
  onChange,
}: {
  value: readonly string[];
  onChange: (next: AlbumTagId[]) => void;
}) {
  const id = useId();
  const picked = cleanAlbumTags(value);
  const full = picked.length >= MAX_ALBUM_TAGS;

  return (
    <div>
      <label htmlFor={id} className="text-sm text-sand">
        Tags (kinds of photography in this album)
      </label>
      <select
        id={id}
        value=""
        disabled={full}
        onChange={(e) => {
          if (e.target.value) onChange(cleanAlbumTags([...picked, e.target.value]));
        }}
        className="mt-1 w-full rounded-md border border-sand/60 bg-espresso px-3 py-2 text-paper focus:border-gold disabled:opacity-50 sm:w-80"
      >
        <option value="">{full ? `That's the most an album can have` : 'Add a tag…'}</option>
        {ALBUM_TAG_GROUPS.map((group) => {
          const left = group.tags.filter((t) => !picked.includes(t.id));
          return (
            left.length > 0 && (
              <optgroup key={group.label} label={group.label}>
                {left.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            )
          );
        })}
      </select>
      {picked.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tags on this album">
          {picked.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => onChange(picked.filter((t) => t !== tag))}
                aria-label={`Remove the ${albumTagLabel(tag)} tag`}
                title="Remove"
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 py-1 pr-2 pl-3 text-sm text-paper transition-colors hover:border-gold hover:bg-gold/20"
              >
                {albumTagLabel(tag)}
                <X aria-hidden size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-sand">
          No tags yet. Visitors filter the portfolio by these, so an untagged album only shows when
          no filter is on.
        </p>
      )}
    </div>
  );
}
