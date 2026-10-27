/**
 * Tooltips on icon-only links ([data-icon-tip]). CSS shows the label on hover
 * and keyboard focus; this adds Escape to hide it without moving focus or the
 * pointer (WCAG 1.4.13). It shows again on the next hover or focus.
 */

export const TIP_SELECTOR = '[data-icon-tip]';

const active = new WeakMap<Document, () => void>();

export function initIconTips(doc: Document = document): () => void {
  const existing = active.get(doc);
  if (existing) return existing;

  const tips = [...doc.querySelectorAll<HTMLElement>(TIP_SELECTOR)];
  const show = (event: Event) =>
    (event.currentTarget as HTMLElement).removeAttribute('data-dismissed');
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    for (const tip of tips) tip.setAttribute('data-dismissed', '');
  };

  for (const tip of tips) {
    tip.addEventListener('pointerenter', show);
    tip.addEventListener('focusin', show);
  }
  doc.addEventListener('keydown', onKeyDown);

  const destroy = () => {
    for (const tip of tips) {
      tip.removeEventListener('pointerenter', show);
      tip.removeEventListener('focusin', show);
    }
    doc.removeEventListener('keydown', onKeyDown);
    active.delete(doc);
  };
  active.set(doc, destroy);
  return destroy;
}
