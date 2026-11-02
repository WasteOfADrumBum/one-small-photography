import { describe, expect, it } from 'vitest';
import { sniffImageFormat } from './image-type';

const bytes = (...values: (number | string)[]) =>
  Uint8Array.from(
    values.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v])),
  );

describe('sniffImageFormat', () => {
  it('recognises WebP and JPEG by their signatures', () => {
    expect(sniffImageFormat(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '))).toBe('webp');
    expect(sniffImageFormat(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe('jpg');
  });

  it('rejects anything else, including look-alikes and empty files', () => {
    expect(sniffImageFormat(bytes('<!doctype html><script>'))).toBeNull();
    expect(sniffImageFormat(bytes('RIFF', 0, 0, 0, 0, 'WAVEfmt '))).toBeNull();
    expect(sniffImageFormat(bytes(0x89, 'PNG\r\n', 0x1a, '\n'))).toBeNull();
    expect(sniffImageFormat(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffImageFormat(new Uint8Array())).toBeNull();
  });
});
