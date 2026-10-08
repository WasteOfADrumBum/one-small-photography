import { useEffect, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react';
import { Camera, Images, Mail, type LucideIcon } from 'lucide-react';
import AlbumsManager from './AlbumsManager';
import GearManager from './GearManager';
import MessagesInbox from './MessagesInbox';

const TABS = [
  { id: 'albums', label: 'Albums', icon: Images },
  { id: 'gear', label: 'Gear', icon: Camera },
  { id: 'messages', label: 'Messages', icon: Mail },
] as const satisfies readonly { id: string; label: string; icon: LucideIcon }[];
type TabId = (typeof TABS)[number]['id'];

const fromHash = (): TabId => {
  const hash = window.location.hash.slice(1);
  return TABS.find((t) => t.id === hash)?.id ?? 'albums';
};

/**
 * The admin home page as three tabs. The open tab lives in the URL (#gear, #messages), so a
 * refresh or a link lands on the same one. Panels stay mounted so switching keeps any typing.
 */
export default function AdminTabs({
  albums,
  gear,
  messages,
}: {
  albums: ComponentProps<typeof AlbumsManager>['initialAlbums'];
  gear: Pick<ComponentProps<typeof GearManager>, 'initialCameras' | 'initialLenses'>;
  messages: ComponentProps<typeof MessagesInbox>['initialMessages'];
}) {
  const [tab, setTab] = useState<TabId>('albums');
  const [unread, setUnread] = useState(() => messages.filter((m) => !m.readAt).length);
  const buttons = useRef(new Map<TabId, HTMLButtonElement>());

  useEffect(() => {
    const sync = () => setTab(fromHash());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  function open(id: TabId, focus = false) {
    setTab(id);
    history.replaceState(null, '', id === 'albums' ? window.location.pathname : `#${id}`);
    if (focus) buttons.current.get(id)?.focus();
  }

  // Left and right arrows move between tabs, as screen reader users expect.
  function onKeyDown(e: KeyboardEvent) {
    const i = TABS.findIndex((t) => t.id === tab);
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    open(TABS[(i + step + TABS.length) % TABS.length]!.id, true);
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="Admin sections"
        onKeyDown={onKeyDown}
        className="mb-10 flex gap-1 overflow-x-auto border-b border-sand/20"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              ref={(el) => {
                if (el) buttons.current.set(id, el);
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={selected}
              aria-controls={`panel-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => open(id)}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-base transition-colors ${
                selected
                  ? 'border-gold text-paper'
                  : 'border-transparent text-sand hover:border-sand/40 hover:text-paper'
              }`}
            >
              <Icon aria-hidden size={18} strokeWidth={1.75} />
              {label}
              {id === 'messages' && unread > 0 && (
                <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-medium text-espresso">
                  {unread} new
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="panel-albums" aria-labelledby="tab-albums" hidden={tab !== 'albums'}>
        <AlbumsManager initialAlbums={albums} />
      </div>
      <div role="tabpanel" id="panel-gear" aria-labelledby="tab-gear" hidden={tab !== 'gear'}>
        <GearManager {...gear} />
      </div>
      <div
        role="tabpanel"
        id="panel-messages"
        aria-labelledby="tab-messages"
        hidden={tab !== 'messages'}
      >
        <MessagesInbox initialMessages={messages} onUnreadChange={setUnread} />
      </div>
    </>
  );
}
