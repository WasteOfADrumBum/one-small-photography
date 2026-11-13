/**
 * The tag filter on the portfolio page. A dropdown adds a tag; each active tag shows
 * underneath as a chip with a remove button; albums that carry none of the active tags
 * are hidden. With no tags active, every album shows.
 *
 * The choice lives in the address (`?tags=portrait,live-music`), so a filtered view can
 * be shared or bookmarked. The whole control starts hidden in the markup and is revealed
 * here, so without JavaScript the page is simply unfiltered.
 */

export const ROOT_SELECTOR = '[data-album-filter]';
export const SELECT_SELECTOR = '[data-album-filter-select]';
export const CHIPS_SELECTOR = '[data-album-filter-chips]';
export const CLEAR_SELECTOR = '[data-album-filter-clear]';
export const STATUS_SELECTOR = '[data-album-filter-status]';
export const ALBUM_SELECTOR = '[data-album-tags]';
export const PARAM = 'tags';

/** The tags named in a query string, keeping only ones the page offers, each once. */
export function parseTags(search: string, offered: ReadonlySet<string>): string[] {
  const raw = new URLSearchParams(search).get(PARAM) ?? '';
  return [...new Set(raw.split(',').map((t) => t.trim()))].filter((t) => offered.has(t));
}

/** An album shows when no tag is active, or when it carries at least one active tag. */
export function albumMatches(albumTags: readonly string[], active: readonly string[]): boolean {
  return active.length === 0 || active.some((tag) => albumTags.includes(tag));
}

const CHIP_CLASS =
  'inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 py-1 pr-2.5 pl-3 text-sm text-paper transition-colors hover:border-gold hover:bg-gold/20';

const active = new WeakMap<Document, () => void>();

export function initAlbumFilter(doc: Document = document): () => void {
  const existing = active.get(doc);
  if (existing) return existing;

  const root = doc.querySelector<HTMLElement>(ROOT_SELECTOR);
  const select = root?.querySelector<HTMLSelectElement>(SELECT_SELECTOR);
  const chips = root?.querySelector<HTMLElement>(CHIPS_SELECTOR);
  if (!root || !select || !chips) return () => {};
  const clear = root.querySelector<HTMLButtonElement>(CLEAR_SELECTOR);
  const status = root.querySelector<HTMLElement>(STATUS_SELECTOR);
  const albums = [...doc.querySelectorAll<HTMLElement>(ALBUM_SELECTOR)];
  const win = doc.defaultView!;

  const options = [...select.options].filter((o) => o.value);
  const labels = new Map(options.map((o) => [o.value, o.dataset.label ?? o.text]));
  const offered = new Set(labels.keys());
  let selected = parseTags(win.location.search, offered);
  let touched = false;

  function render() {
    for (const option of options) {
      const on = selected.includes(option.value);
      option.hidden = on;
      option.disabled = on;
    }
    select!.value = '';

    chips!.replaceChildren(
      ...selected.map((tag) => {
        const label = labels.get(tag) ?? tag;
        const item = doc.createElement('li');
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = CHIP_CLASS;
        button.dataset.albumFilterRemove = tag;
        button.setAttribute('aria-label', `Remove the ${label} filter`);
        const cross = doc.createElement('span');
        cross.setAttribute('aria-hidden', 'true');
        cross.textContent = '✕';
        button.append(label, cross);
        item.append(button);
        return item;
      }),
    );
    chips!.hidden = selected.length === 0;
    if (clear) clear.hidden = selected.length < 2;

    let shown = 0;
    for (const album of albums) {
      const tags = (album.dataset.albumTags ?? '').split(' ').filter(Boolean);
      const match = albumMatches(tags, selected);
      album.hidden = !match;
      if (match) shown += 1;
      // An album hidden before it scrolled into view never got its reveal animation.
      if (match && touched) {
        album.style.opacity = '1';
        album.style.transform = 'none';
      }
    }
    if (status) {
      status.textContent =
        selected.length === 0
          ? ''
          : `Showing ${shown} of ${albums.length} ${albums.length === 1 ? 'album' : 'albums'}.`;
    }
  }

  function update(next: string[]) {
    selected = next;
    touched = true;
    const url = new URL(win.location.href);
    if (selected.length) url.searchParams.set(PARAM, selected.join(','));
    else url.searchParams.delete(PARAM);
    // Commas read better unescaped, and they are allowed in a query string.
    win.history.replaceState(win.history.state, '', url.href.replace(/%2C/gi, ','));
    render();
  }

  const onPick = () => {
    if (select.value && !selected.includes(select.value)) update([...selected, select.value]);
  };
  const onChipClick = (event: Event) => {
    const button = (event.target as Element | null)?.closest<HTMLElement>(
      '[data-album-filter-remove]',
    );
    if (!button) return;
    update(selected.filter((t) => t !== button.dataset.albumFilterRemove));
    // The chip is gone; keep keyboard focus somewhere sensible.
    select.focus();
  };
  const onClear = () => {
    update([]);
    select.focus();
  };

  select.addEventListener('change', onPick);
  chips.addEventListener('click', onChipClick);
  clear?.addEventListener('click', onClear);
  root.hidden = false;
  render();

  const destroy = () => {
    select.removeEventListener('change', onPick);
    chips.removeEventListener('click', onChipClick);
    clear?.removeEventListener('click', onClear);
    active.delete(doc);
  };
  active.set(doc, destroy);
  return destroy;
}
