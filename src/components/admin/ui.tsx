import {
  useCallback,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { CircleAlert, Check, Eye, EyeOff, LoaderCircle, X, type LucideIcon } from 'lucide-react';

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

type Variant = 'primary' | 'quiet' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-sage text-espresso hover:bg-gold',
  quiet: 'border border-sand/30 text-paper hover:border-gold',
  danger: 'border border-red-400/40 text-red-200 hover:bg-red-400/10',
};

export function Button({
  variant = 'quiet',
  icon: Icon,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: LucideIcon }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        variants[variant],
        className,
      )}
    >
      {Icon && <Icon aria-hidden size={16} strokeWidth={1.75} />}
      {children}
    </button>
  );
}

/**
 * Shows whether something is visible on the site and flips it when clicked.
 * Solid with an open eye when visible, outlined with a crossed-out eye when hidden.
 */
export function VisibilityToggle({
  visible,
  onToggle,
  noun,
  className,
}: {
  visible: boolean;
  onToggle: () => void;
  noun: string;
  className?: string;
}) {
  return (
    <Button
      variant={visible ? 'primary' : 'quiet'}
      icon={visible ? Eye : EyeOff}
      aria-pressed={visible}
      title={
        visible
          ? `Visible on the site. Click to hide this ${noun}.`
          : `Hidden. Click to show this ${noun}.`
      }
      onClick={onToggle}
      className={cx(!visible && 'border-dashed text-sand', className)}
    >
      {visible ? 'Visible' : 'Hidden'}
    </Button>
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

export function Badge({ on, children }: { on: boolean; children: ReactNode }) {
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

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; message: string }
  | { kind: 'error'; message: string };

/**
 * Tracks background saves for the toast. `track` wraps any save: the toast shows a
 * spinner while saves are in flight, then a check mark, or the error if one failed.
 */
export function useSaveStatus() {
  const [state, setState] = useState<SaveState>({ kind: 'idle' });
  const inFlight = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const track = useCallback(
    async <T,>(task: () => Promise<T>, message = 'Changes saved'): Promise<T | undefined> => {
      clearTimeout(hideTimer.current);
      inFlight.current += 1;
      setState({ kind: 'saving' });
      try {
        const result = await task();
        inFlight.current -= 1;
        if (inFlight.current === 0) {
          setState({ kind: 'saved', message });
          hideTimer.current = setTimeout(() => setState({ kind: 'idle' }), 2200);
        }
        return result;
      } catch (err) {
        inFlight.current -= 1;
        setState({ kind: 'error', message: (err as Error).message });
        return undefined;
      }
    },
    [],
  );

  const dismiss = useCallback(() => setState({ kind: 'idle' }), []);
  return { state, track, dismiss };
}

export function SaveToast({ state, onDismiss }: { state: SaveState; onDismiss: () => void }) {
  if (state.kind === 'idle') return null;
  const error = state.kind === 'error';
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={cx(
        'fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-full border px-4 py-2.5 text-sm shadow-2xl shadow-black/50',
        error ? 'border-red-400/40 bg-espresso text-red-100' : 'border-sand/20 bg-moss text-paper',
      )}
    >
      {state.kind === 'saving' && (
        <LoaderCircle aria-hidden size={18} className="animate-spin text-sand" />
      )}
      {state.kind === 'saved' && <Check aria-hidden size={18} className="text-gold" />}
      {error && <CircleAlert aria-hidden size={18} className="shrink-0 text-red-300" />}
      <span>{state.kind === 'saving' ? 'Saving…' : state.message}</span>
      {error && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-sand hover:text-paper"
        >
          <X aria-hidden size={16} />
        </button>
      )}
    </div>
  );
}
