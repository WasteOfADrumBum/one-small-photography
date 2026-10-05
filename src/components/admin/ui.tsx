import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

type Variant = 'primary' | 'quiet' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-sage text-espresso hover:bg-gold',
  quiet: 'border border-sand/30 text-paper hover:border-gold',
  danger: 'border border-red-400/40 text-red-200 hover:bg-red-400/10',
};

export function Button({
  variant = 'quiet',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'rounded-full px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
    />
  );
}

const field =
  'mt-1 w-full rounded-md border border-sand/30 bg-espresso px-3 py-2 text-paper focus:border-gold';

export function TextField({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="text-sm text-sand">{label}</span>
      <input {...props} className={field} />
    </label>
  );
}

export function TextArea({
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block">
      <span className="text-sm text-sand">{label}</span>
      <textarea rows={3} {...props} className={field} />
    </label>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm">
      {message}
    </p>
  );
}

export function Badge({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        'rounded-full px-2 py-0.5 text-xs',
        on ? 'bg-sage/30 text-paper' : 'bg-sand/10 text-sand',
      )}
    >
      {children}
    </span>
  );
}

/** Moves the item at `index` one place up or down. */
export function move<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
