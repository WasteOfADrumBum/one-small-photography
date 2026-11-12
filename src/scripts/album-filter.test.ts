// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { albumMatches, initAlbumFilter, parseTags } from './album-filter';

let destroy: () => void;

const root = () => document.querySelector<HTMLElement>('[data-album-filter]')!;
const select = () => document.querySelector<HTMLSelectElement>('[data-album-filter-select]')!;
const chips = () => [...document.querySelectorAll<HTMLElement>('[data-album-filter-remove]')];
const clear = () => document.querySelector<HTMLButtonElement>('[data-album-filter-clear]')!;
const status = () => document.querySelector<HTMLElement>('[data-album-filter-status]')!;
const visible = () =>
  [...document.querySelectorAll<HTMLElement>('[data-album-tags]')]
    .filter((el) => !el.hidden)
    .map((el) => el.id);

function pick(tag: string) {
  select().value = tag;
  select().dispatchEvent(new Event('change', { bubbles: true }));
}

function mount(search = '') {
  window.history.replaceState(null, '', `/portfolio${search}`);
  document.body.innerHTML = `
    <div data-album-filter hidden>
      <select data-album-filter-select>
        <option value="">Add a filter…</option>
        <option value="portrait" data-label="Portrait">Portrait (2)</option>
        <option value="live-music" data-label="Live Music">Live Music (1)</option>
        <option value="landscape" data-label="Landscape">Landscape (1)</option>
      </select>
      <ul data-album-filter-chips hidden></ul>
      <button type="button" data-album-filter-clear hidden>Clear filters</button>
      <p data-album-filter-status></p>
    </div>
    <a id="seniors" data-album-tags="portrait senior"></a>
    <a id="gig" data-album-tags="live-music portrait"></a>
    <a id="hills" data-album-tags="landscape"></a>
    <a id="untagged" data-album-tags=""></a>
  `;
  destroy = initAlbumFilter();
}

afterEach(() => destroy?.());

describe('parseTags', () => {
  const offered = new Set(['portrait', 'landscape']);
  it('keeps offered tags once each and drops the rest', () => {
    expect(parseTags('?tags=portrait,nope,portrait,%20landscape', offered)).toEqual([
      'portrait',
      'landscape',
    ]);
    expect(parseTags('', offered)).toEqual([]);
    expect(parseTags('?tags=<script>', offered)).toEqual([]);
  });
});

describe('albumMatches', () => {
  it('shows everything with no filter, and any album with one of the active tags', () => {
    expect(albumMatches([], [])).toBe(true);
    expect(albumMatches(['portrait'], ['landscape', 'portrait'])).toBe(true);
    expect(albumMatches(['portrait'], ['landscape'])).toBe(false);
    expect(albumMatches([], ['landscape'])).toBe(false);
  });
});

describe('the portfolio filter', () => {
  beforeEach(() => mount());

  it('reveals the control and starts with every album showing', () => {
    expect(root().hidden).toBe(false);
    expect(visible()).toEqual(['seniors', 'gig', 'hills', 'untagged']);
    expect(chips()).toHaveLength(0);
    expect(status().textContent).toBe('');
  });

  it('picking a tag adds a chip, filters the albums and updates the address', () => {
    pick('portrait');
    expect(visible()).toEqual(['seniors', 'gig']);
    expect(chips().map((c) => c.getAttribute('aria-label'))).toEqual([
      'Remove the Portrait filter',
    ]);
    expect(status().textContent).toBe('Showing 2 of 4 albums.');
    expect(window.location.search).toBe('?tags=portrait');
    // The picked tag leaves the dropdown, which goes back to its prompt.
    expect(select().value).toBe('');
    expect(select().querySelector<HTMLOptionElement>('[value=portrait]')!.disabled).toBe(true);
  });

  it('several tags show albums with any of them', () => {
    pick('landscape');
    pick('live-music');
    expect(visible()).toEqual(['gig', 'hills']);
    expect(window.location.search).toBe('?tags=landscape,live-music');
    expect(clear().hidden).toBe(false);
  });

  it('a chip removes its tag, and Clear removes them all', () => {
    pick('landscape');
    pick('portrait');
    chips()[0]!.click();
    expect(visible()).toEqual(['seniors', 'gig']);
    expect(select().querySelector<HTMLOptionElement>('[value=landscape]')!.disabled).toBe(false);
    pick('landscape');
    clear().click();
    expect(visible()).toEqual(['seniors', 'gig', 'hills', 'untagged']);
    expect(chips()).toHaveLength(0);
    expect(window.location.search).toBe('');
  });
});

describe('a shared link', () => {
  it('opens already filtered, ignoring tags the page does not offer', () => {
    mount('?tags=landscape,bogus');
    expect(visible()).toEqual(['hills']);
    expect(chips()).toHaveLength(1);
  });
});
