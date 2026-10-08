import { useState, type ChangeEvent, type DragEvent } from 'react';
import type { Album as DbAlbum, Photo as DbPhoto } from '@/db/schema';
import { photoUrl } from '@/lib/photo-url';
import { api, send } from './api';
import { settingsFromExif } from '@/lib/camera-settings';
import { preparePhoto, titleFromFilename, type PreparedPhoto } from './prepare-photo';
import SettingsFields, {
  CollapsedSettingsFields,
  type GearOptions,
  type Settings,
} from './SettingsFields';
import { Sortable, useSortableItem } from './sortable';
import { ExternalLink, Star, Trash2, Upload } from 'lucide-react';
import {
  Badge,
  Button,
  SaveToast,
  TextArea,
  TextField,
  VisibilityToggle,
  useSaveStatus,
} from './ui';

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
  settings: Settings;
  status: 'preparing' | 'ready' | 'uploading' | 'error';
  error?: string;
};

const settingsOf = (photo: Photo): Settings => ({
  cameraId: photo.cameraId,
  lensId: photo.lensId,
  aperture: photo.aperture,
  shutterSpeed: photo.shutterSpeed,
  iso: photo.iso,
});

export default function AlbumEditor({
  initialAlbum,
  otherAlbums,
  gear,
}: {
  initialAlbum: Album;
  otherAlbums: AlbumOption[];
  gear: GearOptions;
}) {
  const [album, setAlbum] = useState(initialAlbum);
  const [details, setDetails] = useState({
    title: initialAlbum.title,
    description: initialAlbum.description,
  });
  const [photos, setPhotos] = useState(initialAlbum.photos);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  // Settings for the whole upload batch, since a shoot usually uses one kit and often one
  // exposure. Camera and lens start from the album's most recent photo. Each photo can still
  // be changed on its own.
  const [batch, setBatch] = useState<Settings>(() => {
    const recent = initialAlbum.photos.findLast((p) => p.cameraId || p.lensId);
    return {
      cameraId: recent?.cameraId ?? null,
      lensId: recent?.lensId ?? null,
      aperture: null,
      shutterSpeed: null,
      iso: null,
    };
  });
  const { state: saveState, track: run, dismiss } = useSaveStatus();

  const updateAlbum = (
    changes: Partial<Pick<DbAlbum, 'title' | 'description' | 'published' | 'coverPhotoId'>>,
  ) =>
    run(async () => {
      const next = await api<Album>(`/api/admin/albums/${album.id}`, send('PATCH', changes));
      setAlbum((a) => ({ ...a, ...next }));
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
      settings: { ...batch },
      status: 'preparing',
    }));
    setPending((list) => [...list, ...entries]);
    // Resize one at a time to keep memory down with big camera files.
    void (async () => {
      for (const [i, entry] of entries.entries()) {
        try {
          const prepared = await preparePhoto(images[i]!);
          // Pre-fill aperture, shutter and ISO from the camera's EXIF; anything already picked wins.
          const fromExif = settingsFromExif(prepared.exif);
          setPending((list) =>
            list.map((p) =>
              p.key === entry.key
                ? {
                    ...p,
                    prepared,
                    status: 'ready',
                    settings: {
                      ...p.settings,
                      aperture: p.settings.aperture ?? fromExif.aperture,
                      shutterSpeed: p.settings.shutterSpeed ?? fromExif.shutterSpeed,
                      iso: p.settings.iso ?? fromExif.iso,
                    },
                  }
                : p,
            ),
          );
        } catch (err) {
          patchPending(entry.key, { status: 'error', error: (err as Error).message });
        }
      }
    })();
  }

  /** Changes a batch setting and applies it to every photo waiting to upload. */
  function changeBatch(changes: Partial<Settings>) {
    setBatch((b) => ({ ...b, ...changes }));
    setPending((list) => list.map((p) => ({ ...p, settings: { ...p.settings, ...changes } })));
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
      form.set('settings', JSON.stringify(item.settings));
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
    changes: Partial<
      Pick<DbPhoto, 'title' | 'description' | 'alt' | 'published' | 'albumId'> & Settings
    >,
  ) =>
    run(async () => {
      const photo = await api<Photo>(`/api/admin/photos/${id}`, send('PATCH', changes));
      if (changes.albumId && changes.albumId !== album.id) {
        setPhotos((list) => list.filter((p) => p.id !== id));
        if (album.coverPhotoId === id) setAlbum((a) => ({ ...a, coverPhotoId: null }));
      } else {
        setPhotos((list) => list.map((p) => (p.id === id ? photo : p)));
      }
    });

  const deletePhoto = (photo: Photo) => {
    if (!window.confirm(`Delete "${photo.title || 'this photo'}"? This can't be undone.`)) return;
    void run(async () => {
      await api(`/api/admin/photos/${photo.id}`, { method: 'DELETE' });
      setPhotos((list) => list.filter((p) => p.id !== photo.id));
      if (album.coverPhotoId === photo.id) setAlbum((a) => ({ ...a, coverPhotoId: null }));
    }, 'Photo deleted');
  };

  const reorderPhotos = (next: Photo[]) => {
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
    }, 'Order saved');
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
    }, 'Album deleted');
  };

  const readyCount = pending.filter((p) => p.status === 'ready').length;

  return (
    <div className="space-y-12">
      <SaveToast state={saveState} onDismiss={dismiss} />

      {/* Album details */}
      <section className="space-y-5 rounded-xl border border-sand/20 bg-moss p-6">
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
          <p className="text-xs text-sand">
            There's no save button. Changes save on their own when you click away from a field, and
            a note in the bottom corner confirms each save.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-sand/15 pt-5">
          <VisibilityToggle
            noun="album"
            visible={album.published}
            onToggle={() => updateAlbum({ published: !album.published })}
          />
          {album.published && (
            <a
              href={`/portfolio/${album.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm"
            >
              View on the site <ExternalLink aria-hidden size={14} />
            </a>
          )}
          <Button variant="danger" icon={Trash2} onClick={deleteAlbum} className="ml-auto">
            Delete album
          </Button>
        </div>
      </section>

      {/* Upload */}
      <section>
        <h2 className="text-2xl">Add photos</h2>
        <div className="mt-4 rounded-xl bg-moss">
          <SettingsFields
            value={batch}
            gear={gear}
            onChange={changeBatch}
            wide
            legend="Settings for every photo you add"
            hint="Changing these updates every photo waiting below. Leave a setting blank to read it from each photo's own data. You can still change any single photo, before or after it uploads."
          />
        </div>
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
                    <CollapsedSettingsFields
                      value={item.settings}
                      gear={gear}
                      onChange={(changes) => {
                        setPending((list) =>
                          list.map((p) =>
                            p.key === item.key
                              ? { ...p, settings: { ...p.settings, ...changes } }
                              : p,
                          ),
                        );
                      }}
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
            <Button variant="primary" icon={Upload} disabled={readyCount === 0} onClick={uploadAll}>
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
          <>
            <div className="mt-4 rounded-xl border border-sand/20 bg-moss p-4">
              <h3 className="font-serif text-lg">Order</h3>
              <p className="mt-1 text-sm text-sand">
                Drag a photo to move it. This is the order on the site. Click one to jump to its
                details.
              </p>
              <Sortable items={photos} onReorder={reorderPhotos} layout="grid">
                <ol className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
                  {photos.map((photo, i) => (
                    <OrderTile
                      key={photo.id}
                      photo={photo}
                      position={i + 1}
                      cover={album.coverPhotoId === photo.id}
                    />
                  ))}
                </ol>
              </Sortable>
            </div>

            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {photos.map((photo, i) => (
                <li
                  key={photo.id}
                  id={`photo-${photo.id}`}
                  className="scroll-mt-24 space-y-3 rounded-xl border border-sand/20 bg-moss p-4"
                >
                  <div className="flex gap-4">
                    <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded bg-espresso">
                      <img
                        src={photoUrl(photo, 'sm')}
                        alt={photo.alt}
                        loading="lazy"
                        className={`h-full w-full object-cover ${photo.published ? '' : 'opacity-40'}`}
                      />
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-espresso/80 px-2 py-0.5 text-xs text-paper">
                        {i + 1}
                      </span>
                      <div className="absolute bottom-1.5 left-1.5 flex gap-1">
                        {album.coverPhotoId === photo.id && <Badge on>Cover</Badge>}
                        {!photo.published && <Badge on={false}>Hidden</Badge>}
                      </div>
                    </div>
                    <PhotoFields
                      photo={photo}
                      onSave={(changes) => updatePhoto(photo.id, changes)}
                    />
                  </div>
                  <PhotoDescription
                    photo={photo}
                    onSave={(changes) => updatePhoto(photo.id, changes)}
                  />
                  <CollapsedSettingsFields
                    value={settingsOf(photo)}
                    gear={gear}
                    onChange={(changes) => {
                      // Show the pick right away; the saved photo replaces it when the server answers.
                      setPhotos((list) =>
                        list.map((p) => (p.id === photo.id ? { ...p, ...changes } : p)),
                      );
                      void updatePhoto(photo.id, changes);
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <VisibilityToggle
                      noun="photo"
                      visible={photo.published}
                      onToggle={() => updatePhoto(photo.id, { published: !photo.published })}
                      className="px-3 py-1.5"
                    />
                    <Button
                      icon={Star}
                      disabled={album.coverPhotoId === photo.id}
                      onClick={() => updateAlbum({ coverPhotoId: photo.id })}
                      title="Use this photo on the album's Polaroid stack"
                      className="px-3 py-1.5"
                    >
                      {album.coverPhotoId === photo.id ? 'Cover' : 'Make cover'}
                    </Button>
                    {otherAlbums.length > 0 && (
                      <select
                        aria-label="Move to another album"
                        className="min-w-0 flex-1 rounded-full border border-sand/30 bg-espresso px-3 py-1.5 text-sm text-paper"
                        value=""
                        onChange={(e) =>
                          e.target.value && updatePhoto(photo.id, { albumId: e.target.value })
                        }
                      >
                        <option value="">Move to album…</option>
                        {otherAlbums.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.title}
                          </option>
                        ))}
                      </select>
                    )}
                    <Button
                      variant="danger"
                      icon={Trash2}
                      aria-label="Delete photo"
                      title="Delete photo"
                      onClick={() => deletePhoto(photo)}
                      className="ml-auto px-3 py-1.5"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

type TextChanges = Partial<Pick<DbPhoto, 'title' | 'description' | 'alt'>>;

/** Title and alt text, beside the thumbnail. Each saves when you leave the field. */
function PhotoFields({ photo, onSave }: { photo: Photo; onSave: (changes: TextChanges) => void }) {
  const [values, setValues] = useState({ title: photo.title, alt: photo.alt });
  const save = (key: keyof typeof values) => {
    if (values[key] !== photo[key]) onSave({ [key]: values[key] });
  };
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <TextField
        label="Title"
        value={values.title}
        onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
        onBlur={() => save('title')}
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

function PhotoDescription({
  photo,
  onSave,
}: {
  photo: Photo;
  onSave: (changes: TextChanges) => void;
}) {
  const [description, setDescription] = useState(photo.description);
  return (
    <TextArea
      label="Description"
      rows={2}
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      onBlur={() => description !== photo.description && onSave({ description })}
    />
  );
}

/** A small draggable thumbnail in the Order grid. A click jumps to the photo's card. */
function OrderTile({ photo, position, cover }: { photo: Photo; position: number; cover: boolean }) {
  const { ref, style, handle, isDragging } = useSortableItem(photo.id);
  return (
    <li ref={ref} style={style}>
      <button
        type="button"
        {...handle}
        aria-label={`${photo.title || 'Photo'}, position ${position}. Drag to move, or click to jump to it.`}
        title={photo.title || undefined}
        onClick={() =>
          document
            .getElementById(`photo-${photo.id}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        className={`relative block aspect-square w-full cursor-grab touch-none overflow-hidden rounded-md bg-espresso active:cursor-grabbing ${
          isDragging
            ? 'shadow-2xl ring-2 shadow-black/60 ring-gold'
            : 'hover:ring-2 hover:ring-gold/60'
        }`}
      >
        <img
          src={photoUrl(photo, 'sm')}
          alt=""
          loading="lazy"
          draggable={false}
          className={`h-full w-full object-cover ${photo.published ? '' : 'opacity-40'}`}
        />
        <span className="absolute top-1 left-1 rounded-full bg-espresso/80 px-1.5 text-xs text-paper">
          {position}
        </span>
        {cover && (
          <Star
            aria-label="Cover"
            size={14}
            className="absolute top-1.5 right-1.5 fill-gold text-gold"
          />
        )}
      </button>
    </li>
  );
}
