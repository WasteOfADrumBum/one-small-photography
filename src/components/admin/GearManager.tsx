import { useState, type SyntheticEvent } from 'react';
import { Camera, Plus, Trash2 } from 'lucide-react';
import { LensIcon } from '@/components/PhotoSettingsLine';
import type { GearKind } from '@/lib/gear';
import { api, send } from './api';
import { Button, SaveToast, useSaveStatus } from './ui';

type Item = { id: string; name: string };

const field =
  'w-full min-w-0 rounded-md border border-sand/30 bg-espresso px-3 py-2 text-paper focus:border-gold';

/** Cameras and lenses to pick from on each photo. */
export default function GearManager({
  initialCameras,
  initialLenses,
}: {
  initialCameras: Item[];
  initialLenses: Item[];
}) {
  const { state, track, dismiss } = useSaveStatus();
  return (
    <section>
      <SaveToast state={state} onDismiss={dismiss} />
      <p className="text-sm text-sand">
        Add the cameras and lenses you shoot with. Each photo can then pick from these lists.
      </p>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <GearList
          kind="cameras"
          title="Cameras"
          icon={<Camera aria-hidden size={20} strokeWidth={1.5} />}
          placeholder="Nikon Z 7II"
          initial={initialCameras}
          track={track}
        />
        <GearList
          kind="lenses"
          title="Lenses"
          icon={<LensIcon size={20} />}
          placeholder="NIKKOR Z 50mm f/1.8 S"
          initial={initialLenses}
          track={track}
        />
      </div>
    </section>
  );
}

function GearList({
  kind,
  title,
  icon,
  placeholder,
  initial,
  track,
}: {
  kind: GearKind;
  title: string;
  icon: React.ReactNode;
  placeholder: string;
  initial: Item[];
  track: ReturnType<typeof useSaveStatus>['track'];
}) {
  const [items, setItems] = useState(initial);
  const [name, setName] = useState('');
  const sort = (list: Item[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));

  async function add(e: SyntheticEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const item = await track(
      () => api<Item>(`/api/admin/gear/${kind}`, send('POST', { name: trimmed })),
      `Added ${trimmed}`,
    );
    if (item) {
      setItems((list) => sort([...list, item]));
      setName('');
    }
  }

  const rename = (item: Item, next: string) => {
    const trimmed = next.trim();
    if (!trimmed || trimmed === item.name) return;
    void track(async () => {
      const saved = await api<Item>(
        `/api/admin/gear/${kind}/${item.id}`,
        send('PATCH', { name: trimmed }),
      );
      setItems((list) => sort(list.map((i) => (i.id === item.id ? saved : i))));
    });
  };

  const remove = (item: Item) => {
    if (!window.confirm(`Remove "${item.name}"? Photos that used it will just stop showing it.`))
      return;
    void track(async () => {
      await api(`/api/admin/gear/${kind}/${item.id}`, { method: 'DELETE' });
      setItems((list) => list.filter((i) => i.id !== item.id));
    }, `Removed ${item.name}`);
  };

  return (
    <div className="rounded-xl border border-sand/20 bg-moss p-5">
      <h3 className="flex items-center gap-2 font-serif text-xl">
        {icon}
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-sand">None yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <input
                aria-label={`${title} name`}
                defaultValue={item.name}
                maxLength={120}
                onBlur={(e) => rename(item, e.target.value)}
                className={field}
              />
              <Button
                variant="danger"
                icon={Trash2}
                aria-label={`Remove ${item.name}`}
                title="Remove"
                onClick={() => remove(item)}
                className="shrink-0 px-3"
              />
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-4 flex items-center gap-2 border-t border-sand/15 pt-4">
        <input
          aria-label={`New ${title.toLowerCase().replace(/s$/, '')}`}
          placeholder={placeholder}
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          className={field}
        />
        <Button
          type="submit"
          variant="primary"
          icon={Plus}
          disabled={!name.trim()}
          className="shrink-0"
        >
          Add
        </Button>
      </form>
    </div>
  );
}
