import { useState, type SyntheticEvent } from 'react';
import type { AlbumSummary } from '@/lib/albums';
import { api, send } from './api';
import { Badge, Button, ErrorNote, TextArea, TextField, move } from './ui';

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

  async function reorder(index: number, delta: -1 | 1) {
    const next = move(albums, index, delta);
    if (next === albums) return;
    const previous = albums;
    setAlbums(next);
    try {
      await api('/api/admin/albums/reorder', send('POST', { ids: next.map((a) => a.id) }));
    } catch (err) {
      setAlbums(previous);
      setError((err as Error).message);
    }
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
      <section>
        <h2 className="text-2xl">Albums</h2>
        <p className="mt-1 text-sm text-sand">
          This is the order of the Polaroid stack on the portfolio page.
        </p>
        <ErrorNote message={error} />
        {albums.length === 0 ? (
          <p className="mt-8 text-sand">No albums yet. Create your first one.</p>
        ) : (
          <ol className="mt-6 divide-y divide-sand/15 rounded-xl border border-sand/20 bg-moss">
            {albums.map((album, i) => (
              <li key={album.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex flex-col gap-1">
                  <Button
                    aria-label={`Move ${album.title} up`}
                    disabled={i === 0}
                    onClick={() => reorder(i, -1)}
                    className="px-2 py-0.5"
                  >
                    ↑
                  </Button>
                  <Button
                    aria-label={`Move ${album.title} down`}
                    disabled={i === albums.length - 1}
                    onClick={() => reorder(i, 1)}
                    className="px-2 py-0.5"
                  >
                    ↓
                  </Button>
                </div>
                <div className="min-w-0 flex-1">
                  <a href={`/admin/albums/${album.id}`} className="font-serif text-xl">
                    {album.title}
                  </a>
                  <p className="text-sm text-sand">
                    {album.photoCount} {album.photoCount === 1 ? 'photo' : 'photos'}
                  </p>
                </div>
                <Badge on={album.published}>{album.published ? 'Visible' : 'Hidden'}</Badge>
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
          <Button type="submit" variant="primary" disabled={busy || !title.trim()}>
            {busy ? 'Creating…' : 'Create album'}
          </Button>
        </form>
      </section>
    </div>
  );
}
