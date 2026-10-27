// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initIconTips } from './icon-tip';

let destroy: () => void;

const tip = () => document.querySelector<HTMLElement>('[data-icon-tip]')!;
const link = () => tip().querySelector('a')!;
const press = (key: string) =>
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

beforeEach(() => {
  document.body.innerHTML = `
    <span data-icon-tip>
      <a href="/login" aria-label="Log in" aria-describedby="tip">icon</a>
      <span id="tip" role="tooltip">Log in</span>
    </span>
  `;
  destroy = initIconTips();
});

afterEach(() => destroy());

describe('icon tooltips', () => {
  it('hides on Escape without moving focus', () => {
    link().focus();
    press('Escape');
    expect(tip().hasAttribute('data-dismissed')).toBe(true);
    expect(document.activeElement).toBe(link());
  });

  it('ignores other keys', () => {
    press('Enter');
    expect(tip().hasAttribute('data-dismissed')).toBe(false);
  });

  it('shows again on the next hover or focus', () => {
    press('Escape');
    tip().dispatchEvent(new Event('pointerenter'));
    expect(tip().hasAttribute('data-dismissed')).toBe(false);
    press('Escape');
    link().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tip().hasAttribute('data-dismissed')).toBe(false);
  });

  it('wires up only once per document', () => {
    expect(initIconTips()).toBe(destroy);
  });
});
