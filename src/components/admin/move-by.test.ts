import { describe, expect, it } from 'vitest';
import { moveBy } from './ui';

describe('moveBy (the non-drag way to reorder, WCAG 2.5.7)', () => {
  const list = ['a', 'b', 'c'];

  it('moves an item one place earlier or later without changing the input', () => {
    expect(moveBy(list, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveBy(list, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('refuses to move past either end or from a bad index', () => {
    expect(moveBy(list, 0, -1)).toBeNull();
    expect(moveBy(list, 2, 1)).toBeNull();
    expect(moveBy(list, -1, 1)).toBeNull();
    expect(moveBy([], 0, 1)).toBeNull();
  });
});
