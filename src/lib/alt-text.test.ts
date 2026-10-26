import { describe, expect, it } from 'vitest';
import { albumCoverAlt, albumPhotoAlt, isFileNameTitle, photoAlt } from './alt-text';

const inAlbum = (album: string, n: number) => albumPhotoAlt(album, n);

describe('photoAlt', () => {
  it('uses the alt text that was written', () => {
    expect(photoAlt({ alt: ' A chestnut horse ', title: 'Dusty' }, inAlbum('Animals', 1))).toBe(
      'A chestnut horse',
    );
  });

  it('falls back to the title', () => {
    expect(photoAlt({ alt: '', title: 'Dusty in autumn' }, inAlbum('Animals', 1))).toBe(
      'Dusty in autumn',
    );
    expect(photoAlt({ alt: '   ', title: 'Dusty' }, inAlbum('Animals', 1))).toBe('Dusty');
  });

  it('treats alt text that is only a file name as missing', () => {
    expect(photoAlt({ alt: 'DSC 0042', title: 'DSC 0042' }, inAlbum('Portraits', 3))).toBe(
      'Photo 3 from the Portraits album',
    );
  });

  it('skips titles that are only a camera file name', () => {
    expect(photoAlt({ alt: '', title: 'DSC 0042' }, inAlbum('Portraits', 3))).toBe(
      'Photo 3 from the Portraits album',
    );
  });

  it('names the album and position when there is nothing else', () => {
    expect(photoAlt({ alt: '', title: '' }, inAlbum('Weddings', 12))).toBe(
      'Photo 12 from the Weddings album',
    );
  });
});

describe('albumCoverAlt', () => {
  it('describes an album cover', () => {
    expect(photoAlt({ alt: '', title: 'IMG_0042' }, albumCoverAlt('Fashion'))).toBe(
      'Cover photo of the Fashion album',
    );
  });
});

describe('isFileNameTitle', () => {
  it('recognizes camera and phone file names', () => {
    for (const name of [
      'DSC 0042',
      'DSC_0042',
      '_DSC1234',
      'IMG 4321',
      'PXL 20240101 123456',
      'DSCF0001',
      'Z72 0042',
      'DSC 0042 final',
    ]) {
      expect(isFileNameTitle(name), name).toBe(true);
    }
  });

  it('leaves real titles alone', () => {
    for (const name of ['Dusty', 'Image of a barn', 'DSC concert', 'Portrait 3', '2014 Virginia']) {
      expect(isFileNameTitle(name), name).toBe(false);
    }
  });
});
