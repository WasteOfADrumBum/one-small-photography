import exifr from 'exifr';
import { describe, expect, it } from 'vitest';
import { sniffImageFormat } from '@/lib/image-type';
import { stripMetadata } from '@/lib/strip-metadata';
import { JPEG_WITH_GPS, PLAIN_JPEG, WEBP_WITH_GPS } from '@/test/fixtures/images';

const gpsOf = async (file: Uint8Array) => exifr.gps(Buffer.from(file)).catch(() => undefined);

/** exifr can't read WebP, so pull the EXIF chunk out and read it as the TIFF block it is. */
function webpExifChunk(file: Uint8Array): Uint8Array | undefined {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  for (let at = 12; at + 8 <= file.length;) {
    const size = view.getUint32(at + 4, true);
    if (String.fromCharCode(...file.subarray(at, at + 4)) === 'EXIF')
      return file.subarray(at + 8, at + 8 + size);
    at += 8 + size + (size % 2);
  }
  return undefined;
}

describe('stripMetadata', () => {
  it('the fixtures really carry a GPS position', async () => {
    expect((await gpsOf(JPEG_WITH_GPS))?.latitude).toBeCloseTo(36.07, 1);
    expect((await gpsOf(webpExifChunk(WEBP_WITH_GPS)!))?.latitude).toBeCloseTo(36.07, 1);
  });

  it('removes EXIF and GPS from a JPEG and leaves a valid JPEG', async () => {
    const out = stripMetadata(JPEG_WITH_GPS, 'jpg');
    expect(await gpsOf(out)).toBeUndefined();
    expect(await exifr.parse(Buffer.from(out)).catch(() => undefined)).toBeUndefined();
    expect(sniffImageFormat(out)).toBe('jpg');
    expect(out.length).toBeLessThan(JPEG_WITH_GPS.length);
    // The image data (from the start-of-scan marker on) is untouched.
    const sos = (f: Uint8Array) =>
      f.subarray(f.findIndex((b, i) => b === 0xff && f[i + 1] === 0xda));
    expect(Buffer.from(sos(out)).equals(Buffer.from(sos(JPEG_WITH_GPS)))).toBe(true);
  });

  it('removes EXIF and GPS from a WebP and fixes its header', async () => {
    const out = stripMetadata(WEBP_WITH_GPS, 'webp');
    expect(webpExifChunk(out)).toBeUndefined();
    expect(sniffImageFormat(out)).toBe('webp');
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    expect(view.getUint32(4, true)).toBe(out.length - 8);
    expect(new TextDecoder().decode(out)).not.toContain('EXIF');
  });

  it('leaves a file without metadata as it was', () => {
    expect(Buffer.from(stripMetadata(PLAIN_JPEG, 'jpg')).equals(Buffer.from(PLAIN_JPEG))).toBe(
      true,
    );
  });

  it('refuses truncated or mislabelled files instead of storing them', () => {
    expect(() => stripMetadata(JPEG_WITH_GPS.subarray(0, 30), 'jpg')).toThrow();
    expect(() => stripMetadata(JPEG_WITH_GPS, 'webp')).toThrow();
  });
});
