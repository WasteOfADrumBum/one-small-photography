/**
 * The full-screen photo viewer on album pages. Each `[data-gallery-item]` button
 * opens the `[data-lightbox]` dialog on its photo; arrow buttons, arrow keys and
 * swipes step through the album, and closing returns focus to the photo you
 * opened. Screen readers hear which photo is showing ("Photo 2 of 12").
 */
export function initLightbox(doc: Document = document): void {
  const dialog = doc.querySelector<HTMLDialogElement>('[data-lightbox]');
  const items = [...doc.querySelectorAll<HTMLButtonElement>('[data-gallery-item]')];
  if (!dialog || items.length === 0) return;

  const image = dialog.querySelector<HTMLImageElement>('[data-image]')!;
  const part = (name: string) => dialog.querySelector<HTMLElement>(`[data-${name}]`)!;
  let current = 0;

  const show = (index: number) => {
    current = (index + items.length) % items.length;
    const { src = '', title = '', description = '', alt = '' } = items[current]!.dataset;
    image.src = src;
    image.alt = alt;
    part('title').textContent = title;
    part('description').textContent = description;
    part('position').textContent = `Photo ${current + 1} of ${items.length}`;
    part('settings').innerHTML =
      doc.querySelector(`[data-settings-for="${current}"]`)?.innerHTML ?? '';
  };

  items.forEach((item, index) =>
    item.addEventListener('click', () => {
      show(index);
      dialog.showModal();
    }),
  );
  part('prev').addEventListener('click', () => show(current - 1));
  part('next').addEventListener('click', () => show(current + 1));
  part('close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => items[current]?.focus());
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
