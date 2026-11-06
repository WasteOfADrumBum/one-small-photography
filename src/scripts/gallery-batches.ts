/**
 * Long galleries (the All photos page) render their first batch of photos and
 * keep the rest in `<template data-gallery-batch>` elements, so a visitor only
 * gets the markup and image requests for what they scroll near. When the
 * `[data-gallery-sentinel]` after the gallery comes within a screen or two of
 * view, the next batch is put into the page. The photos inside still lazy load
 * on their own, and every one declares its size, so nothing jumps.
 */

const BATCH = 'template[data-gallery-batch]';

/** Puts the next waiting batch into the page. Returns false when none is left. */
export function revealNextBatch(doc: Document = document): boolean {
  const template = doc.querySelector<HTMLTemplateElement>(BATCH);
  if (!template) return false;
  template.replaceWith(template.content.cloneNode(true));
  return true;
}

export function hasMoreBatches(doc: Document = document): boolean {
  return doc.querySelector(BATCH) !== null;
}

export function initGalleryBatches(doc: Document = document): void {
  const sentinel = doc.querySelector<HTMLElement>('[data-gallery-sentinel]');
  if (!sentinel || !hasMoreBatches(doc)) {
    sentinel?.remove();
    return;
  }
  const view = doc.defaultView;
  if (!view || !('IntersectionObserver' in view)) {
    while (revealNextBatch(doc));
    sentinel.remove();
    return;
  }
  const observer = new view.IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      revealNextBatch(doc);
      if (!hasMoreBatches(doc)) {
        observer.disconnect();
        sentinel.remove();
        return;
      }
      // The sentinel may still be in range after a short batch: look again.
      observer.unobserve(sentinel);
      observer.observe(sentinel);
    },
    { rootMargin: '0px 0px 1200px 0px' },
  );
  observer.observe(sentinel);
}
