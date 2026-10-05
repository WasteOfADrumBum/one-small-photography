import { useState, type ChangeEvent, type DragEvent } from 'react';
import type { Album as DbAlbum, Photo as DbPhoto } from '@/db/schema';
import { photoUrl } from '@/lib/photo-url';
import { api, send } from './api';
import { preparePhoto, titleFromFilename, type PreparedPhoto } from './prepare-photo';
import { Badge, Button, ErrorNote, TextArea, TextField, move } from './ui';

type Dated<T> = Omit<T, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt?: string };
type Photo = Dated<DbPhoto>;
type Album = Dated<DbAlbum> & { photos: Photo[] };
type AlbumOption = { id: string; title: string };

type Pending = {
  key: string;
  fileName: string;
  title: string;
  description: string;
  alt: string;
  prepared?: PreparedPhoto;
  status: 'preparing' | 'ready' | 'uploading' | 'error';
  error?: string;
};

export default function AlbumEditor({
  initialAlbum,
  otherAlbums,
}: {
  initialAlbum: Album;
  otherAlbums: AlbumOption[];
}) {
  const [album, setAlbum] = useState(initialAlbum);
  const [details, setDetails] = useState({
    title: initialAlbum.title,
    description: initialAlbum.description,
  });
  const [photos, setPhotos] = useState(initialAlbum.photos);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const flash = (message: string) => {
    setSaved(message);
    setTimeout(() => setSaved(null), 2500);
  };

  async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    setError(null);
    try {
      return await task();
    } catch (err) {
      setError((err as Error).message);
      return undefined;
    }
  }

  const updateAlbum = (
    changes: Partial<Pick<DbAlbum, 'title' | 'description' | 'published' | 'coverPhotoId'>>,
  ) =>
    run(async () => {
      const next = await api<Album>(`/api/admin/albums/${album.id}`, send('PATCH', changes));
      setAlbum((a) => ({ ...a, ...next }));
      flash('Saved');
    });

  // ---- New uploads -------------------------------------------------------
  const patchPending = (key: string, changes: Partial<Pending>) =>
    setPending((list) => list.map((p) => (p.key === key ? { ...p, ...changes } : p)));

  function addFiles(files: FileList | File[]) {
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    const entries: Pending[] = images.map((file) => ({
      key: crypto.randomUUID(),
      fileName: file.name,
      title: titleFromFilename(file.name),
      description: '',
      alt: '',
      status: 'preparing',
    }));
    setPending((list) => [...list, ...entries]);
    // Resize one at a time to keep memory down with big camera files.
    void (async () => {
      for (const [i, entry] of entries.entries()) {
        try {
          patchPending(entry.key, { prepared: await preparePhoto(images[i]!), status: 'ready' });
        } catch (err) {
          patchPending(entry.key, { status: 'error', error: (err as Error).message });
        }
      }
    })();
  }

  async function uploadAll() {
    for (const item of pending) {
      if (item.status !== 'ready' || !item.prepared) continue;
      patchPending(item.key, { status: 'uploading' });
      const { prepared } = item;
      const form = new FormData();
      form.set('title', item.title);
      form.set('description', item.description);
      form.set('alt', item.alt || item.title);
      form.set('width', String(prepared.width));
      form.set('height', String(prepared.height));
      form.set('exif', JSON.stringify(prepared.exif));
      for (const [size, blob] of Object.entries(prepared.files)) {
        form.set(size, blob, `${size}.${prepared.format}`);
      }
      try {
        const photo = await api<Photo>(`/api/admin/albums/${album.id}/photos`, {
          method: 'POST',
          body: form,
        });
        URL.revokeObjectURL(prepared.previewUrl);
        setPhotos((list) => [...list, photo]);
        setPending((list) => list.filter((p) => p.key !== item.key));
        setAlbum((a) => (a.coverPhotoId ? a : { ...a, coverPhotoId: photo.id }));
      } catch (err) {
        patchPending(item.key, { status: 'error', error: (err as Error).message });
      }
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  // ---- Existing photos ---------------------------------------------------
  const updatePhoto = (
    id: string,
    changes: Partial<Pick<DbPhoto, 'title' | 'description' | 'alt' | 'published' | 'albumId'>>,
  ) =>
    run(async () => {
      const photo = await api<Photo>(`/api/admin/photos/${id}`, send('PATCH', changes));
      if (changes.albumId && changes.albumId !== album.id) {
        setPhotos((list) => list.filter((p) => p.id !== id));
        if (album.coverPhotoId === id) setAlbum((a) => ({ ...a, coverPhotoId: null }));
      } else {
        setPhotos((list) => list.map((p) => (p.id === id ? photo : p)));
      }
      flash('Saved');
    });

  const deletePhoto = (photo: Photo) => {
    if (!window.confirm(`Delete "${photo.title || 'this photo'}"? This can't be undone.`)) return;
    void run(async () => {
      await api(`/api/admin/photos/${photo.id}`, { method: 'DELETE' });
      setPhotos((list) => list.filter((p) => p.id !== photo.id));
      if (album.coverPhotoId === photo.id) setAlbum((a) => ({ ...a, coverPhotoId: null }));
    });
  };

  const reorderPhoto = (index: number, delta: -1 | 1) => {
    const next = move(photos, index, delta);
    if (next === photos) return;
    const previous = photos;
    setPhotos(next);
    void run(async () => {
      try {
        await api(
          `/api/admin/albums/${album.id}/photos`,
          send('PUT', { ids: next.map((p) => p.id) }),
        );
      } catch (err) {
        setPhotos(previous);
        throw err;
      }
    });
  };

  const deleteAlbum = () => {
    if (
      !window.confirm(
        `Delete the album "${album.title}" and all ${photos.length} photos in it? This can't be undone.`,
      )
    )
      return;
    void run(async () => {
      await api(`/api/admin/albums/${album.id}`, { method: 'DELETE' });
      window.location.href = '/admin';
    });
  };

  const readyCount = pending.filter((p) => p.status === 'ready').length;

  return (
    <div className="space-y-12">
      <div className="sticky top-16 z-30 flex min-h-8 items-center gap-3">
        <ErrorNote message={error} />
        {saved && <span className="rounded-full bg-sage/30 px-3 py-1 text-sm">{saved}</span>}
      </div>

      {/* Album details */}
      <section className="grid gap-6 rounded-xl border border-sand/20 bg-moss p-6 lg:grid-cols-[1fr_16rem]">
        <div className="space-y-4">
          <TextField
            label="Album name"
            maxLength={120}
            value={details.title}
            onChange={(e) => setDetails((d) => ({ ...d, title: e.target.value }))}
            onBlur={() =>
              details.title.trim() &&
              details.title !== album.title &&
              updateAlbum({ title: details.title })
            }
          />
          <TextArea
            label="Description"
            maxLength={2000}
            value={details.description}
            onChange={(e) => setDetails((d) => ({ ...d, description: e.target.value }))}
            onBlur={() =>
              details.description !== album.description &&
              updateAlbum({ description: details.description })
            }
          />
          <p className="text-xs text-sand">Changes save when you click away from a field.</p>
        </div>
        <div className="flex flex-col gap-3">
          <Badge on={album.published}>
            {album.published ? 'Visible on the site' : 'Hidden from the site'}
          </Badge>
          <Button variant="primary" onClick={() => updateAlbum({ published: !album.published })}>
            {album.published ? 'Hide album' : 'Make album visible'}
          </Button>
          {album.published && (
            <a
              href={`/portfolio/${album.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm"
            >
              View on the site ↗
            </a>
          )}
          <Button variant="danger" onClick={deleteAlbum} className="mt-auto">
            Delete album
          </Button>
        </div>
      </section>

      {/* Upload */}
      <section>
        <h2 className="text-2xl">Add photos</h2>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            dragging ? 'border-gold bg-gold/10' : 'border-sand/30 hover:border-gold'
          }`}
        >
          <span className="font-serif text-xl">Drop photos here, or click to choose</span>
          <span className="mt-2 text-sm text-sand">
            JPEGs straight from Lightroom are fine. They're resized on your computer before
            uploading.
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>

        {pending.length > 0 && (
          <div className="mt-6 space-y-4">
            <ul className="grid gap-4 md:grid-cols-2">
              {pending.map((item) => (
                <li
                  key={item.key}
                  className="flex gap-4 rounded-xl border border-sand/20 bg-moss p-4"
                >
                  <div className="h-28 w-28 shrink-0 overflow-hidden rounded bg-espresso">
                    {item.prepared && (
                      <img
                        src={item.prepared.previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="truncate text-xs text-sand">
                      {item.fileName} ·{' '}
                      {item.status === 'preparing'
                        ? 'resizing…'
                        : item.status === 'uploading'
                          ? 'uploading…'
                          : item.status === 'error'
                            ? item.error
                            : 'ready'}
                    </p>
                    <TextField
                      label="Title"
                      value={item.title}
                      onChange={(e) => patchPending(item.key, { title: e.target.value })}
                    />
                    <TextArea
                      label="Description"
                      rows={2}
                      value={item.description}
                      onChange={(e) => patchPending(item.key, { description: e.target.value })}
                    />
                    <TextField
                      label="Alt text (what's in the photo, for screen readers)"
                      value={item.alt}
                      onChange={(e) => patchPending(item.key, { alt: e.target.value })}
                    />
                    <Button
                      variant="quiet"
                      onClick={() => setPending((list) => list.filter((p) => p.key !== item.key))}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="primary" disabled={readyCount === 0} onClick={uploadAll}>
              Upload {readyCount} {readyCount === 1 ? 'photo' : 'photos'}
            </Button>
          </div>
        )}
      </section>

      {/* Existing photos */}
      <section>
        <h2 className="text-2xl">Photos in this album</h2>
        {photos.length === 0 ? (
          <p className="mt-4 text-sand">No photos yet.</p>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {photos.map((photo, i) => (
              <li key={photo.id} className="space-y-3 rounded-xl border border-sand/20 bg-moss p-4">
                <div className="relative aspect-[4/3] overflow-hidden rounded bg-espresso">
                  <img
                    src={photoUrl(photo, 'sm')}
                    alt={photo.alt}
                    loading="lazy"
                    className={`h-full w-full object-cover ${photo.published ? '' : 'opacity-40'}`}
                  />
                  <div className="absolute top-2 left-2 flex gap-2">
                    {album.coverPhotoId === photo.id && <Badge on>Cover</Badge>}
                    {!photo.published && <Badge on={false}>Hidden</Badge>}
                  </div>
                </div>
                <PhotoFields photo={photo} onSave={(changes) => updatePhoto(photo.id, changes)} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    aria-label="Move earlier"
                    disabled={i === 0}
                    onClick={() => reorderPhoto(i, -1)}
                  >
                    ←
                  </Button>
                  <Button
                    aria-label="Move later"
                    disabled={i === photos.length - 1}
                    onClick={() => reorderPhoto(i, 1)}
                  >
                    →
                  </Button>
                  {album.coverPhotoId !== photo.id && (
                    <Button onClick={() => updateAlbum({ coverPhotoId: photo.id })}>
                      Make cover
                    </Button>
                  )}
                  <Button onClick={() => updatePhoto(photo.id, { published: !photo.published })}>
                    {photo.published ? 'Hide' : 'Show'}
                  </Button>
                  <Button variant="danger" onClick={() => deletePhoto(photo)}>
                    Delete
                  </Button>
                </div>
                {otherAlbums.length > 0 && (
                  <label className="block text-sm text-sand">
                    Move to album
                    <select
                      className="mt-1 w-full rounded-md border border-sand/30 bg-espresso px-3 py-2 text-paper"
                      value=""
                      onChange={(e) =>
                        e.target.value && updatePhoto(photo.id, { albumId: e.target.value })
                      }
                    >
                      <option value="">Choose…</option>
                      {otherAlbums.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PhotoFields({
  photo,
  onSave,
}: {
  photo: Photo;
  onSave: (changes: Partial<Pick<DbPhoto, 'title' | 'description' | 'alt'>>) => void;
}) {
  const [values, setValues] = useState({
    title: photo.title,
    description: photo.description,
    alt: photo.alt,
  });
  const save = (key: keyof typeof values) => {
    if (values[key] !== photo[key]) onSave({ [key]: values[key] });
  };
  return (
    <div className="space-y-2">
      <TextField
        label="Title"
        value={values.title}
        onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
        onBlur={() => save('title')}
      />
      <TextArea
        label="Description"
        rows={2}
        value={values.description}
        onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
        onBlur={() => save('description')}
      />
      <TextField
        label="Alt text"
        value={values.alt}
        onChange={(e) => setValues((v) => ({ ...v, alt: e.target.value }))}
        onBlur={() => save('alt')}
      />
    </div>
  );
}
