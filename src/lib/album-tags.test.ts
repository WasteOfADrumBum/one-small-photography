import { describe, expect, it } from 'vitest';
import { AlbumTags } from './album-tag-schema';
import { ALBUM_TAGS, MAX_ALBUM_TAGS, albumTagLabel, cleanAlbumTags, tagsInUse } from './album-tags';

describe('the tag list', () => {
  it('has unique ids that are safe in a URL and a space-separated attribute', () => {
    const ids = ALBUM_TAGS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it('has unique labels', () => {
    const labels = ALBUM_TAGS.map((t) => t.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('cleanAlbumTags', () => {
  it('keeps known tags once each, in list order', () => {
    expect(cleanAlbumTags(['landscape', 'portrait', 'landscape', 'made-up', 7])).toEqual([
      'portrait',
      'landscape',
    ]);
  });
  it('reads anything that is not a list as no tags', () => {
    expect(cleanAlbumTags(undefined)).toEqual([]);
    expect(cleanAlbumTags('portrait')).toEqual([]);
  });
});

describe('albumTagLabel', () => {
  it('gives the label, or the id for a tag no longer on the list', () => {
    expect(albumTagLabel('live-music')).toBe('Live Music');
    expect(albumTagLabel('retired')).toBe('retired');
  });
});

describe('tagsInUse', () => {
  it('lists only tags some album carries, with counts, in list order', () => {
    const used = tagsInUse([
      { tags: ['landscape', 'portrait'] },
      { tags: ['portrait'] },
      { tags: [] },
      { tags: null },
    ]);
    expect(used.map((t) => [t.id, t.count])).toEqual([
      ['portrait', 2],
      ['landscape', 1],
    ]);
  });
});

describe('AlbumTags (what the admin API accepts)', () => {
  it('accepts tags from the list and tidies them', () => {
    expect(AlbumTags.parse(['boudoir', 'portrait', 'boudoir'])).toEqual(['portrait', 'boudoir']);
    expect(AlbumTags.parse([])).toEqual([]);
  });
  it('rejects anything not on the list', () => {
    const result = AlbumTags.safeParse(['portrait', '<script>']);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Pick tags from the list.');
  });
  it('caps how many an album can have', () => {
    const tooMany = ALBUM_TAGS.slice(0, MAX_ALBUM_TAGS + 1).map((t) => t.id);
    expect(AlbumTags.safeParse(tooMany).success).toBe(false);
  });
});
