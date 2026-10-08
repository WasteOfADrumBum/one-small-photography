import { useEffect, useState } from 'react';
import { Mail, MailOpen, Trash2 } from 'lucide-react';
import { api, send } from './api';
import { Button, SaveToast, useSaveStatus } from './ui';

type Message = {
  id: string;
  name: string;
  email: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

/** Notes sent from the contact page, newest first. */
export default function MessagesInbox({
  initialMessages,
  onUnreadChange,
}: {
  initialMessages: Message[];
  /** Lets the tab label keep its "new" count current. */
  onUnreadChange?: (unread: number) => void;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const { state, track, dismiss } = useSaveStatus();
  const unread = messages.filter((m) => !m.readAt).length;
  useEffect(() => onUnreadChange?.(unread), [unread, onUnreadChange]);

  const markRead = (message: Message, read: boolean) =>
    track(
      async () => {
        const row = await api<Message>(
          `/api/admin/messages/${message.id}`,
          send('PATCH', { read }),
        );
        setMessages((list) => list.map((m) => (m.id === row.id ? row : m)));
      },
      read ? 'Marked as read' : 'Marked as unread',
    );

  const remove = (message: Message) => {
    if (!confirm(`Delete the message from ${message.name}?`)) return;
    void track(async () => {
      await api(`/api/admin/messages/${message.id}`, { method: 'DELETE' });
      setMessages((list) => list.filter((m) => m.id !== message.id));
    }, 'Message deleted');
  };

  return (
    <section>
      <SaveToast state={state} onDismiss={dismiss} />
      <p className="text-sm text-sand">Notes people send from the contact page, newest first.</p>
      {messages.length === 0 ? (
        <p className="mt-4 text-sand">Nothing yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`rounded-xl border p-5 ${m.readAt ? 'border-sand/15 bg-moss/50' : 'border-gold/40 bg-moss'}`}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-serif text-xl text-paper">{m.name}</span>
                <a href={`mailto:${m.email}`} className="text-sm">
                  {m.email}
                </a>
                <span className="ml-auto text-xs text-sand">{when(m.createdAt)}</span>
              </div>
              <p className="mt-3 whitespace-pre-line text-sand">{m.body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  icon={m.readAt ? Mail : MailOpen}
                  onClick={() => void markRead(m, !m.readAt)}
                >
                  {m.readAt ? 'Mark unread' : 'Mark read'}
                </Button>
                <Button variant="danger" icon={Trash2} onClick={() => remove(m)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
