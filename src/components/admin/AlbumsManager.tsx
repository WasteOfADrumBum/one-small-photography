import { useState, type SyntheticEvent } from 'react';
import type { AlbumSummary } from '@/lib/albums';
import { GripVertical, ImageOff, Plus, Star } from 'lucide-react';
import { photoUrl } from '@/lib/photo-url';
import { FEATURED_ALBUM_COUNT } from '@/lib/featured';
import { api, send } from './api';
import { Sortable, useSortableItem } from './sortable';
import {
  Button,
  ErrorNote,
  SaveToast,
  TextArea,
  TextField,
  VisibilityToggle,
  useSaveStatus,
} from './ui';

type Album = Omit<AlbumSummary, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

/** The saved order is always every visible album first, then every hidden one. */
const grouped = (list: Album[]) => [
  ...list.filter((a) => a.published),
  ...list.filter((a) => !a.published),
];

export default function AlbumsManager({ initialAlbums }: { initialAlbums: Album[] }) {
  const [albums, setAlbums] = useState(() => grouped(initialAlbums));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { state: saveState, track, dismiss } = useSaveStatus();

  const visible = albums.filter((a) => a.published);
  const hidden = albums.filter((a) => !a.published);
  const featuredIds = new Set(visible.slice(0, FEATURED_ALBUM_COUNT).map((a) => a.id));

  async function create(e: SyntheticEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const album = await api<Album>('/api/admin/albums', send('POST', { title, description }));
      window.location.href = `/admin/albums/${album.id}`;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  /** Shows the new order right away, saves it, and puts the old one back if the save fails. */
  function saveOrder(next: Album[], message = 'Order saved', before?: () => Promise<unknown>) {
    const previous = albums;
    setAlbums(next);
    void track(async () => {
      try {
        await before?.();
        await api('/api/admin/albums/reorder', send('POST', { ids: next.map((a) => a.id) }));
      } catch (err) {
        setAlbums(previous);
        throw err;
      }
    }, message);
  }

  /**
   * Flips an album between the two lists. A newly visible album goes to the end of the visible
   * list, so it doesn't bump a featured one; a newly hidden album goes to the top of the hidden list.
   */
  function toggle(album: Album) {
    const published = !album.published;
    const rest = albums.filter((a) => a.id !== album.id);
    const at = rest.filter((a) => a.published).length;
    const next = [...rest.slice(0, at), { ...album, published }, ...rest.slice(at)];
    saveOrder(next, published ? 'Album is visible' : 'Album is hidden', () =>
      api(`/api/admin/albums/${album.id}`, send('PATCH', { published })),
    );
  }

  return (
    <div className="space-y-12">
      <SaveToast state={saveState} onDismiss={dismiss} />

      <form onSubmit={create} className="space-y-4 rounded-xl border border-sand/20 bg-moss p-6">
        <div>
          <h2 className="text-2xl">New album</h2>
          <p className="mt-1 text-sm text-sand">
            New albums start hidden until you make them visible.
          </p>
        </div>
        <TextField
          label="Name"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextArea
          label="Description"
          rows={2}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <ErrorNote message={error} />
        <Button type="submit" variant="primary" icon={Plus} disabled={busy || !title.trim()}>
          {busy ? 'Creating…' : 'Create album'}
        </Button>
      </form>

      <section>
        <h2 className="text-2xl">Visible albums</h2>
        <p className="mt-1 text-sm text-sand">
          This is the order of the Polaroid stacks on the portfolio page. The first{' '}
          {FEATURED_ALBUM_COUNT} are also featured on your home page, marked with a gold star. Drag
          an album by its handle to move it.
        </p>
        <AlbumList
          albums={visible}
          featuredIds={featuredIds}
          empty="No visible albums. Click Hidden on an album below to show it on the site."
          onReorder={(next) => saveOrder([...next, ...hidden])}
          onToggle={toggle}
        />
      </section>

      <section>
        <h2 className="text-2xl">Hidden albums</h2>
        <p className="mt-1 text-sm text-sand">
          Only you can see these. Click Hidden on an album to put it on the site.
        </p>
        <AlbumList
          albums={hidden}
          featuredIds={featuredIds}
          empty="Nothing hidden."
          onReorder={(next) => saveOrder([...visible, ...next])}
          onToggle={toggle}
        />
      </section>
    </div>
  );
}

function AlbumList({
  albums,
  featuredIds,
  empty,
  onReorder,
  onToggle,
}: {
  albums: Album[];
  featuredIds: Set<string>;
  empty: string;
  onReorder: (next: Album[]) => void;
  onToggle: (album: Album) => void;
}) {
  if (albums.length === 0) return <p className="mt-6 text-sand">{empty}</p>;
  return (
    <Sortable items={albums} onReorder={onReorder}>
      <ol className="mt-6 divide-y divide-sand/15 rounded-xl border border-sand/20 bg-moss">
        {albums.map((album) => (
          <AlbumRow
            key={album.id}
            album={album}
            featured={featuredIds.has(album.id)}
            onToggle={() => onToggle(album)}
          />
        ))}
      </ol>
    </Sortable>
  );
}

function AlbumRow({
  album,
  featured,
  onToggle,
}: {
  album: Album;
  featured: boolean;
  onToggle: () => void;
}) {
  const { ref, style, handle, isDragging } = useSortableItem(album.id);
  return (
    <li
      ref={ref}
      style={style}
      className={`flex items-center gap-4 p-4 ${featured ? 'bg-gold/[0.07]' : ''} ${
        isDragging ? 'rounded-xl bg-moss shadow-2xl ring-1 shadow-black/60 ring-gold/50' : ''
      }`}
    >
      <button
        type="button"
        {...handle}
        aria-label={`Drag to move ${album.title}`}
        title="Drag to move"
        className="-ml-1 cursor-grab touch-none rounded-md p-1.5 text-sand hover:text-gold active:cursor-grabbing"
      >
        <GripVertical aria-hidden size={20} />
      </button>
      <a
        href={`/admin/albums/${album.id}`}
        className="flex min-w-0 flex-1 items-center gap-4 no-underline"
      >
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-espresso">
          {album.coverPhotoId && album.coverFormat ? (
            <img
              src={photoUrl({ id: album.coverPhotoId, format: album.coverFormat }, 'sm')}
              alt=""
              loading="lazy"
              draggable={false}
              className={`h-full w-full object-cover ${album.published ? '' : 'opacity-50'}`}
            />
          ) : (
            <ImageOff aria-hidden size={22} className="text-sand/60" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-xl text-paper">{album.title}</span>
          <span className="block text-sm text-sand">
            {album.photoCount} {album.photoCount === 1 ? 'photo' : 'photos'}
          </span>
          {album.description && (
            <span className="mt-1 line-clamp-2 text-sm text-sand/80">{album.description}</span>
          )}
        </span>
      </a>
      {featured && (
        <span
          className="hidden shrink-0 items-center gap-1.5 rounded-full border border-gold/50 px-3 py-1 text-xs text-gold sm:inline-flex"
          title="Shown on your home page"
        >
          <Star aria-hidden size={14} className="fill-gold" />
          Featured
        </span>
      )}
      <VisibilityToggle
        noun="album"
        visible={album.published}
        onToggle={onToggle}
        className="shrink-0 px-3 py-1 text-xs"
      />
    </li>
  );
}
