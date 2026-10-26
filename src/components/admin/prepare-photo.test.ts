import { describe, expect, it } from 'vitest';
import { titleFromFilename } from './prepare-photo';

describe('titleFromFilename', () => {
  it('turns a camera file name into a starting title', () => {
    expect(titleFromFilename('DSC_0042-final.jpg')).toBe('DSC 0042 final');
    expect(titleFromFilename('dusty.horse.webp')).toBe('dusty.horse');
    expect(titleFromFilename('__portrait__.JPG')).toBe('portrait');
  });
});
