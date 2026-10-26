// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initSiteMenu } from './site-menu';

let destroy: () => void;

const toggle = () => document.querySelector<HTMLButtonElement>('[data-site-menu-toggle]')!;
const menu = () => document.querySelector<HTMLElement>('[data-site-menu]')!;
const isOpen = () => toggle().getAttribute('aria-expanded') === 'true';

function press(key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  document.body.dispatchEvent(event);
}

beforeEach(() => {
  document.body.innerHTML = `
    <nav aria-label="Main">
      <button type="button" aria-expanded="false" aria-controls="site-menu" data-site-menu-toggle>
        <span>Menu</span>
      </button>
      <ul id="site-menu" data-site-menu>
        <li><a id="portfolio" href="#portfolio">Portfolio</a></li>
      </ul>
    </nav>
    <p id="outside">Elsewhere</p>
  `;
  destroy = initSiteMenu();
});

afterEach(() => destroy());

describe('site menu', () => {
  it('starts closed', () => {
    expect(isOpen()).toBe(false);
    expect(menu().hasAttribute('data-open')).toBe(false);
  });

  it('opens and closes from the button, keeping aria-expanded in step', () => {
    toggle().click();
    expect(isOpen()).toBe(true);
    expect(menu().hasAttribute('data-open')).toBe(true);
    toggle().click();
    expect(isOpen()).toBe(false);
    expect(menu().hasAttribute('data-open')).toBe(false);
  });

  it('closes on Escape and hands focus back to the button', () => {
    toggle().click();
    document.getElementById('portfolio')!.focus();
    press('Escape');
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(toggle());
  });

  it('leaves focus alone on Escape when the menu is already closed', () => {
    document.getElementById('portfolio')!.focus();
    press('Escape');
    expect(document.activeElement).toBe(document.getElementById('portfolio'));
  });

  it('closes when a link in it is followed', () => {
    toggle().click();
    document.getElementById('portfolio')!.click();
    expect(isOpen()).toBe(false);
  });

  it('closes on a click outside, but not on a click inside that misses the links', () => {
    toggle().click();
    menu().click();
    expect(isOpen()).toBe(true);
    document.getElementById('outside')!.click();
    expect(isOpen()).toBe(false);
  });

  it('starts closed again when the page comes back from the back/forward cache', () => {
    toggle().click();
    window.dispatchEvent(new Event('pageshow'));
    expect(isOpen()).toBe(false);
  });

  it('wires up only once per document', () => {
    expect(initSiteMenu()).toBe(destroy);
    toggle().click();
    expect(isOpen()).toBe(true);
  });

  it('does nothing on a page without the menu', () => {
    destroy();
    document.body.innerHTML = '<p>No header here</p>';
    destroy = initSiteMenu();
    expect(() => press('Escape')).not.toThrow();
  });
});
