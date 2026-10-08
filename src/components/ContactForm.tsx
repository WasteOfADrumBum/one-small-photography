import { useState, type SubmitEvent } from 'react';
import { Check, LoaderCircle, Send } from 'lucide-react';

const field =
  'mt-1 w-full rounded-md border border-sand/30 bg-espresso px-3 py-2 text-paper focus:border-gold';

type Status =
  { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };

/** The "say hello" form. Messages are saved for Joshua to read in the admin panel. */
export default function ContactForm() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const value = (key: string) => String(data.get(key) ?? '').trim();
    setStatus({ kind: 'sending' });
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: value('name'),
          email: value('email'),
          body: value('body'),
          website: value('website'),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'That did not go through. Try again in a moment.');
      }
      setStatus({ kind: 'sent' });
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message });
    }
  }

  if (status.kind === 'sent') {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-sand/20 bg-moss p-6"
      >
        <Check aria-hidden className="mt-1 shrink-0 text-gold" size={20} />
        <div>
          <p className="font-serif text-2xl text-paper">Thanks, it's on its way.</p>
          <p className="mt-1 text-sand">
            I read every note and will write back to the email you gave.
          </p>
        </div>
      </div>
    );
  }

  const sending = status.kind === 'sending';
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-xl border border-sand/20 bg-moss p-6 sm:p-8"
    >
      {status.kind === 'error' && (
        <p role="alert" className="rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm">
          {status.message}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-sand">Your name</span>
          <input name="name" required maxLength={120} autoComplete="name" className={field} />
        </label>
        <label className="block">
          <span className="text-sm text-sand">Email, so I can write back</span>
          <input
            name="email"
            type="email"
            required
            maxLength={200}
            autoComplete="email"
            className={field}
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm text-sand">Message</span>
        <textarea name="body" required rows={6} maxLength={5000} className={field} />
      </label>
      {/* Left empty by people; bots tend to fill it. */}
      <label className="sr-only" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <button
        disabled={sending}
        className="inline-flex items-center gap-2 rounded-full bg-sage px-6 py-3 text-espresso transition-colors hover:bg-gold disabled:opacity-60"
      >
        {sending ? (
          <LoaderCircle aria-hidden size={18} className="animate-spin" />
        ) : (
          <Send aria-hidden size={18} />
        )}
        {sending ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}
