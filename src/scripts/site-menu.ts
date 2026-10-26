/**
 * The phone-width header menu: a disclosure button that shows and hides the
 * main nav links. On wider screens the button is hidden by CSS and the links
 * always show, so none of this has any effect there.
 *
 * Escape and a click outside close the menu (Escape hands focus back to the
 * button), as does following a link or widening the window past the phone
 * breakpoint. Coming back to a page from the back/forward cache starts closed.
 */

export const TOGGLE_SELECTOR = '[data-site-menu-toggle]';
export const MENU_SELECTOR = '[data-site-menu]';
/** Matches Tailwind's `sm` breakpoint, where the full nav returns. */
export const WIDE_QUERY = '(min-width: 40rem)';

const active = new WeakMap<Document, () => void>();

export function initSiteMenu(doc: Document = document): () => void {
  const existing = active.get(doc);
  if (existing) return existing;

  const toggle = doc.querySelector<HTMLButtonElement>(TOGGLE_SELECTOR);
  const menu = doc.querySelector<HTMLElement>(MENU_SELECTOR);
  if (!toggle || !menu) return () => {};

  const win = doc.defaultView!;
  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

  const setOpen = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.toggleAttribute('data-open', open);
  };

  const onToggle = () => setOpen(!isOpen());
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    setOpen(false);
    toggle.focus();
  };
  const onDocClick = (event: MouseEvent) => {
    if (!isOpen()) return;
    const target = event.target as Node | null;
    if (target && (menu.contains(target) || toggle.contains(target))) {
      if (target instanceof win.Element && target.closest('a')) setOpen(false);
      return;
    }
    setOpen(false);
  };
  const close = () => setOpen(false);
  const onWide = (event: MediaQueryListEvent) => {
    if (event.matches) close();
  };

  toggle.addEventListener('click', onToggle);
  doc.addEventListener('keydown', onKeyDown);
  doc.addEventListener('click', onDocClick);
  win.addEventListener('pageshow', close);
  const wide = win.matchMedia?.(WIDE_QUERY);
  wide?.addEventListener?.('change', onWide);

  const destroy = () => {
    toggle.removeEventListener('click', onToggle);
    doc.removeEventListener('keydown', onKeyDown);
    doc.removeEventListener('click', onDocClick);
    win.removeEventListener('pageshow', close);
    wide?.removeEventListener?.('change', onWide);
    active.delete(doc);
  };
  active.set(doc, destroy);
  return destroy;
}
