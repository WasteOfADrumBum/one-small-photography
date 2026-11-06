// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasMoreBatches, initGalleryBatches, revealNextBatch } from './gallery-batches';

const page = (batches: number) => {
  const button = (i: number) => `<button data-gallery-item="${i}"></button>`;
  document.body.innerHTML = `
    <div data-gallery data-gallery-total="${batches * 2}">
      <div>${button(0)}${button(1)}</div>
      ${Array.from(
        { length: batches - 1 },
        (_, b) =>
          `<template data-gallery-batch><div>${button(b * 2 + 2)}${button(b * 2 + 3)}</div></template>`,
      ).join('')}
      <div data-gallery-sentinel></div>
    </div>`;
};
const count = () => document.querySelectorAll('[data-gallery-item]').length;

afterEach(() => vi.unstubAllGlobals());

describe('gallery batches', () => {
  it('puts the waiting batches into the page one at a time, in order', () => {
    page(3);
    expect(count()).toBe(2);
    expect(revealNextBatch()).toBe(true);
    expect(count()).toBe(4);
    expect(
      document.querySelectorAll('[data-gallery-item]')[3]!.getAttribute('data-gallery-item'),
    ).toBe('3');
    expect(revealNextBatch()).toBe(true);
    expect(hasMoreBatches()).toBe(false);
    expect(revealNextBatch()).toBe(false);
    expect(count()).toBe(6);
  });

  it('brings in the next batch when the end of the gallery comes near', () => {
    page(3);
    let fire: (hit: boolean) => void = () => {};
    class FakeObserver {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        fire = (hit) => cb([{ isIntersecting: hit }]);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    initGalleryBatches();
    expect(count()).toBe(2);
    fire(false);
    expect(count()).toBe(2);
    fire(true);
    expect(count()).toBe(4);
    fire(true);
    expect(count()).toBe(6);
    expect(document.querySelector('[data-gallery-sentinel]')).toBeNull();
  });

  it('shows everything when the browser cannot watch scrolling', () => {
    page(3);
    const saved = window.IntersectionObserver;
    // @ts-expect-error simulating an old browser
    delete window.IntersectionObserver;
    initGalleryBatches();
    window.IntersectionObserver = saved;
    expect(count()).toBe(6);
  });

  it('removes the sentinel when nothing is waiting', () => {
    page(1);
    initGalleryBatches();
    expect(document.querySelector('[data-gallery-sentinel]')).toBeNull();
  });
});
