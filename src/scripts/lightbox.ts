import { hasMoreBatches, revealNextBatch } from '@/scripts/gallery-batches';

/**
 * The full-screen photo viewer on album pages. Each `[data-gallery-item]` button
 * opens the `[data-lightbox]` dialog on its photo; arrow buttons, arrow keys and
 * swipes step through the album, and closing returns focus to the photo you
 * opened. Screen readers hear which photo is showing ("Photo 2 of 12").
 *
 * Long galleries put their photos into the page in batches (see
 * gallery-batches.ts), so the items are looked up each time, clicks are
 * delegated, and stepping past the last photo in the page brings in the next
 * batch. `data-gallery-total` on `[data-gallery]` gives the full count.
 */
export function initLightbox(doc: Document = document): void {
  const dialog = doc.querySelector<HTMLDialogElement>('[data-lightbox]');
  const items = () => [...doc.querySelectorAll<HTMLButtonElement>('[data-gallery-item]')];
  if (!dialog || items().length === 0) return;

  const image = dialog.querySelector<HTMLImageElement>('[data-image]')!;
  const part = (name: string) => dialog.querySelector<HTMLElement>(`[data-${name}]`);
  const total = () =>
    Number(doc.querySelector<HTMLElement>('[data-gallery]')?.dataset.galleryTotal) ||
    items().length;
  /** The item at `index`, bringing in batches until it is in the page. */
  const itemAt = (index: number) => {
    let list = items();
    while (list.length <= index && hasMoreBatches(doc)) {
      revealNextBatch(doc);
      list = items();
    }
    return list[index];
  };
  let current = 0;

  const show = (index: number) => {
    const count = total();
    current = (index + count) % count;
    const item = itemAt(current);
    if (!item) return;
    const { src = '', title = '', description = '', alt = '', album = '' } = item.dataset;
    image.src = src;
    image.alt = alt;
    part('title')!.textContent = title;
    part('description')!.textContent = description;
    const albumLine = part('album');
    if (albumLine) albumLine.textContent = album ? `From ${album}` : '';
    part('position')!.textContent = `Photo ${current + 1} of ${count}`;
    part('settings')!.innerHTML =
      doc.querySelector(`[data-settings-for="${current}"]`)?.innerHTML ?? '';
  };

  doc.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof doc.defaultView!.Element)) return;
    const item = target.closest<HTMLButtonElement>('[data-gallery-item]');
    if (!item) return;
    show(items().indexOf(item));
    dialog.showModal();
  });
  part('prev')!.addEventListener('click', () => show(current - 1));
  part('next')!.addEventListener('click', () => show(current + 1));
  part('close')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => itemAt(current)?.focus());
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });

  // Swipe on phones.
  let startX = 0;
  dialog.addEventListener('touchstart', (e) => (startX = e.touches[0]!.clientX), {
    passive: true,
  });
  dialog.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0]!.clientX - startX;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
  });
}
