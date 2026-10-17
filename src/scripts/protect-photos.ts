import { copyright } from '@/lib/copyright';

/**
 * Discourages casual saving of photographs marked `data-protected`.
 *
 * Right-clicking (or long-pressing on Android) a protected photo skips the
 * browser's "Save image" menu and shows a short copyright notice instead, and
 * protected photos can't be dragged out of the page. Everything else on the
 * page, links and text included, keeps its normal menu. Keyboard shortcuts,
 * developer tools, screenshots and accessibility tools are left alone: this
 * only discourages copying, it can't prevent it.
 *
 * The listeners are delegated from the document, so photos added later (the
 * lightbox, for one) are covered without wiring each image.
 */

export const PROTECTED_SELECTOR = '[data-protected]';
export const NOTICE_DURATION_MS = 4000;
export const ANNOUNCE_DELAY_MS = 50;

const active = new WeakMap<Document, () => void>();

export interface ProtectionOptions {
  message?: string;
  duration?: number;
}

export function initPhotoProtection(
  doc: Document = document,
  { message = copyright.protectedMessage, duration = NOTICE_DURATION_MS }: ProtectionOptions = {},
): () => void {
  const existing = active.get(doc);
  if (existing) return existing;

  const notice = createNotice(doc, message, duration);

  const isProtected = (target: EventTarget | null) =>
    target instanceof doc.defaultView!.Element && target.closest(PROTECTED_SELECTOR) !== null;

  const onContextMenu = (event: MouseEvent) => {
    if (!isProtected(event.target)) return;
    event.preventDefault();
    notice.show(event.target as Element);
  };
  const onDragStart = (event: DragEvent) => {
    if (isProtected(event.target)) event.preventDefault();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    // The first Escape closes the notice; the next one reaches the photo viewer.
    if (event.key === 'Escape' && notice.isOpen()) {
      event.preventDefault();
      event.stopPropagation();
      notice.hide();
    }
  };

  doc.addEventListener('contextmenu', onContextMenu);
  doc.addEventListener('dragstart', onDragStart);
  doc.addEventListener('keydown', onKeyDown, true);

  const destroy = () => {
    doc.removeEventListener('contextmenu', onContextMenu);
    doc.removeEventListener('dragstart', onDragStart);
    doc.removeEventListener('keydown', onKeyDown, true);
    notice.destroy();
    active.delete(doc);
  };
  active.set(doc, destroy);
  return destroy;
}

/**
 * One reusable notice. Showing it again while it's open restarts its timer
 * instead of stacking a second copy. It never takes focus, and its timer
 * pauses while the pointer or keyboard focus is on it.
 */
function createNotice(doc: Document, message: string, duration: number) {
  const el = doc.createElement('div');
  el.className = 'copyright-notice';
  el.dataset.copyrightNotice = '';
  el.dataset.state = 'closed';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');

  const text = doc.createElement('p');
  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'copyright-notice__close';
  close.setAttribute('aria-label', 'Dismiss copyright notice');
  close.textContent = '✕';
  el.append(text, close);
  doc.body.append(el);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let announce: ReturnType<typeof setTimeout> | undefined;
  let hovered = false;
  let focused = false;

  const stopTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const startTimer = () => {
    stopTimer();
    if (!hovered && !focused) timer = setTimeout(hide, duration);
  };

  function show(target: Element) {
    // A modal <dialog> sits above everything else on the page, so a notice
    // for a photo in the viewer has to live inside the viewer to be seen.
    const host = target.closest('dialog[open]') ?? doc.body;
    if (el.parentElement !== host) host.append(el);
    if (!isOpen()) {
      // Screen readers announce a live region when its text changes, so the
      // message goes in a moment after the region is in place.
      text.textContent = '';
      clearTimeout(announce);
      announce = setTimeout(() => (text.textContent = message), ANNOUNCE_DELAY_MS);
    }
    el.dataset.state = 'open';
    startTimer();
  }

  function hide() {
    stopTimer();
    if (el.contains(doc.activeElement)) (doc.activeElement as HTMLElement).blur();
    focused = false;
    el.dataset.state = 'closed';
  }

  close.addEventListener('click', hide);
  // Hovering or focusing the notice holds it open; leaving restarts the timer.
  const hold = () => (hovered || focused ? stopTimer() : isOpen() && startTimer());
  el.addEventListener('pointerenter', () => {
    hovered = true;
    hold();
  });
  el.addEventListener('pointerleave', () => {
    hovered = false;
    hold();
  });
  el.addEventListener('focusin', () => {
    focused = true;
    hold();
  });
  el.addEventListener('focusout', () => {
    focused = false;
    hold();
  });

  function isOpen() {
    return el.dataset.state === 'open';
  }

  return {
    show,
    hide,
    isOpen,
    destroy: () => {
      stopTimer();
      clearTimeout(announce);
      el.remove();
    },
  };
}
