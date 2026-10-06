import { useState, type SyntheticEvent } from 'react';
import type { AlbumSummary } from '@/lib/albums';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImageOff, Plus } from 'lucide-react';
import { photoUrl } from '@/lib/photo-url';
import { api, send } from './api';
import { Button, ErrorNote, SaveToast, TextArea, TextField, move, useSaveStatus } from './ui';

type Album = Omit<AlbumSummary, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export default function AlbumsManager({ initialAlbums }: { initialAlbums: Album[] }) {
  const [albums, setAlbums] = useState(initialAlbums);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { state: saveState, track, dismiss } = useSaveStatus();

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

  function reorder(index: number, delta: -1 | 1) {
    const next = move(albums, index, delta);
    if (next === albums) return;
    const previous = albums;
    setAlbums(next);
    void track(async () => {
      try {
        await api('/api/admin/albums/reorder', send('POST', { ids: next.map((a) => a.id) }));
      } catch (err) {
        setAlbums(previous);
        throw err;
      }
    }, 'Order saved');
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
      <section>
        <h2 className="text-2xl">Albums</h2>
        <p className="mt-1 text-sm text-sand">
          This is the order of the Polaroid stack on the portfolio page.
        </p>
        <SaveToast state={saveState} onDismiss={dismiss} />
        {albums.length === 0 ? (
          <p className="mt-8 text-sand">No albums yet. Create your first one.</p>
        ) : (
          <ol className="mt-6 divide-y divide-sand/15 rounded-xl border border-sand/20 bg-moss">
            {albums.map((album, i) => (
              <li key={album.id} className="flex items-center gap-4 p-4">
                <div className="flex flex-col gap-1">
                  <Button
                    icon={ArrowUp}
                    aria-label={`Move ${album.title} up`}
                    title="Move up"
                    disabled={i === 0}
                    onClick={() => reorder(i, -1)}
                    className="px-2 py-1"
                  />
                  <Button
                    icon={ArrowDown}
                    aria-label={`Move ${album.title} down`}
                    title="Move down"
                    disabled={i === albums.length - 1}
                    onClick={() => reorder(i, 1)}
                    className="px-2 py-1"
                  />
                </div>
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
                        className={`h-full w-full object-cover ${album.published ? '' : 'opacity-50'}`}
                      />
                    ) : (
                      <ImageOff aria-hidden size={22} className="text-sand/60" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-xl text-paper">
                      {album.title}
                    </span>
                    <span className="block text-sm text-sand">
                      {album.photoCount} {album.photoCount === 1 ? 'photo' : 'photos'}
                    </span>
                    {album.description && (
                      <span className="mt-1 line-clamp-1 block text-sm text-sand/80">
                        {album.description}
                      </span>
                    )}
                  </span>
                </a>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                    album.published
                      ? 'bg-sage/30 text-paper'
                      : 'border border-dashed border-sand/40 text-sand'
                  }`}
                >
                  {album.published ? (
                    <Eye aria-hidden size={14} />
                  ) : (
                    <EyeOff aria-hidden size={14} />
                  )}
                  {album.published ? 'Visible' : 'Hidden'}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <form onSubmit={create} className="space-y-4 rounded-xl border border-sand/20 bg-moss p-6">
          <h2 className="text-2xl">New album</h2>
          <TextField
            label="Name"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextArea
            label="Description"
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <p className="text-xs text-sand">New albums start hidden until you make them visible.</p>
          <ErrorNote message={error} />
          <Button type="submit" variant="primary" icon={Plus} disabled={busy || !title.trim()}>
            {busy ? 'Creating…' : 'Create album'}
          </Button>
        </form>
      </section>
    </div>
  );
}
