// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyright } from '@/lib/copyright';
import { ANNOUNCE_DELAY_MS, NOTICE_DURATION_MS, initPhotoProtection } from './protect-photos';

let destroy: () => void;

function rightClick(target: Element) {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
  target.dispatchEvent(event);
  return event;
}

function drag(target: Element) {
  const event = new Event('dragstart', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function press(key: string, target: Element = document.body) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

const notices = () => document.querySelectorAll<HTMLElement>('[data-copyright-notice]');
const notice = () => notices()[0]!;
const isOpen = () => notice().dataset.state === 'open';

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = `
    <button data-gallery-item data-protected>
      <img id="photo" src="/img/a/md.webp" alt="A photo" data-protected draggable="false" />
    </button>
    <a id="link" href="/portfolio">Portfolio</a>
    <p id="text">Some text</p>
    <img id="logo" src="/logo.webp" alt="Logo" />
    <form><input id="field" /></form>
    <dialog id="viewer"><img id="large" src="/img/a/lg.webp" alt="" data-protected /></dialog>
  `;
  destroy = initPhotoProtection();
});

afterEach(() => {
  destroy();
  vi.useRealTimers();
});

describe('right-click on a protected photo', () => {
  it('blocks the browser menu and shows the copyright notice', () => {
    const event = rightClick(document.getElementById('photo')!);
    expect(event.defaultPrevented).toBe(true);
    expect(isOpen()).toBe(true);
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(notice().textContent).toContain(copyright.protectedMessage);
  });

  it('uses the exact wording from the copyright settings', () => {
    expect(copyright.protectedMessage).toBe(
      '© One Small Photo. This photograph is protected by copyright. Unauthorized downloading, copying, or redistribution is prohibited.',
    );
  });

  it('covers photos added to the page later', () => {
    const added = document.createElement('img');
    added.setAttribute('data-protected', '');
    document.body.append(added);
    expect(rightClick(added).defaultPrevented).toBe(true);
  });

  it('blocks dragging a protected photo out of the page', () => {
    expect(drag(document.getElementById('photo')!).defaultPrevented).toBe(true);
    expect(isOpen()).toBe(false);
  });
});

describe('content that is not protected', () => {
  it.each(['link', 'text', 'logo', 'field'])('keeps the normal menu on the %s', (id) => {
    const event = rightClick(document.getElementById(id)!);
    expect(event.defaultPrevented).toBe(false);
    expect(isOpen()).toBe(false);
  });

  it('can still be dragged', () => {
    expect(drag(document.getElementById('link')!).defaultPrevented).toBe(false);
  });

  it('leaves keyboard shortcuts alone', () => {
    const photo = document.getElementById('photo')!;
    for (const key of ['s', 'c', 'p', 'F12', 'PrintScreen']) {
      expect(press(key, photo).defaultPrevented).toBe(false);
    }
  });
});

describe('the notice', () => {
  it('hides itself after about four seconds', () => {
    rightClick(document.getElementById('photo')!);
    vi.advanceTimersByTime(NOTICE_DURATION_MS - 1);
    expect(isOpen()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isOpen()).toBe(false);
  });

  it('never stacks: repeat right-clicks reuse one notice and restart its timer', () => {
    const photo = document.getElementById('photo')!;
    rightClick(photo);
    vi.advanceTimersByTime(3000);
    rightClick(photo);
    rightClick(photo);
    expect(notices()).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(isOpen()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(isOpen()).toBe(false);
  });

  it('closes with its dismiss button', () => {
    rightClick(document.getElementById('photo')!);
    const close = notice().querySelector('button')!;
    expect(close.getAttribute('aria-label')).toBe('Dismiss copyright notice');
    close.click();
    expect(isOpen()).toBe(false);
  });

  it('closes with Escape, and only that Escape is held back from the page', () => {
    rightClick(document.getElementById('photo')!);
    expect(press('Escape').defaultPrevented).toBe(true);
    expect(isOpen()).toBe(false);
    expect(press('Escape').defaultPrevented).toBe(false);
  });

  it('is announced to screen readers without taking focus', () => {
    const photo = document.getElementById('photo')!;
    photo.closest('button')!.focus();
    rightClick(photo);
    expect(notice().getAttribute('role')).toBe('status');
    expect(notice().getAttribute('aria-live')).toBe('polite');
    expect(document.activeElement).toBe(photo.closest('button'));
  });

  it('works from the keyboard menu key on a focused gallery photo', () => {
    const item = document.querySelector<HTMLButtonElement>('[data-gallery-item]')!;
    item.focus();
    expect(rightClick(item).defaultPrevented).toBe(true);
    expect(isOpen()).toBe(true);
  });

  it('stays open while focused, so keyboard users have time to read it', () => {
    rightClick(document.getElementById('photo')!);
    notice().querySelector('button')!.focus();
    vi.advanceTimersByTime(NOTICE_DURATION_MS * 3);
    expect(isOpen()).toBe(true);
    notice().querySelector('button')!.blur();
    vi.advanceTimersByTime(NOTICE_DURATION_MS);
    expect(isOpen()).toBe(false);
  });

  it('appears inside the open photo viewer so it is not hidden behind it', () => {
    const viewer = document.getElementById('viewer') as HTMLDialogElement;
    viewer.setAttribute('open', '');
    rightClick(document.getElementById('large')!);
    expect(notice().parentElement).toBe(viewer);
    expect(notices()).toHaveLength(1);
  });
});

describe('setup', () => {
  it('adds its listeners once, however many times it runs', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const again = initPhotoProtection();
    expect(again).toBe(destroy);
    expect(add).not.toHaveBeenCalled();
    expect(notices()).toHaveLength(1);
  });

  it('removes its listeners and notice when torn down', () => {
    destroy();
    expect(notices()).toHaveLength(0);
    expect(rightClick(document.getElementById('photo')!).defaultPrevented).toBe(false);
    destroy = initPhotoProtection();
  });
});
