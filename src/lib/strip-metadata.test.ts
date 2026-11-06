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

  const join = (...parts: Uint8Array[]) => new Uint8Array(Buffer.concat(parts));
  const segment = (marker: number, body: string) => {
    const bytes = new TextEncoder().encode(body);
    return new Uint8Array([
      0xff,
      marker,
      (bytes.length + 2) >> 8,
      (bytes.length + 2) & 0xff,
      ...bytes,
    ]);
  };

  it('drops anything after the end of the image, such as a second photo with GPS', async () => {
    const withTrailer = join(PLAIN_JPEG, JPEG_WITH_GPS);
    const out = stripMetadata(withTrailer, 'jpg');
    expect(Buffer.from(out).equals(Buffer.from(PLAIN_JPEG))).toBe(true);
    expect(Buffer.from(out).includes(Buffer.from('Exif'))).toBe(false);
  });

  it('drops the MPF index of extra images but keeps the colour profile', () => {
    const icc = segment(0xe2, 'ICC_PROFILE\0\x01\x01colour');
    const mpf = segment(0xe2, 'MPF\0MM\0*');
    const file = join(PLAIN_JPEG.subarray(0, 2), icc, mpf, PLAIN_JPEG.subarray(2));
    expect(
      Buffer.from(stripMetadata(file, 'jpg')).equals(
        Buffer.from(join(PLAIN_JPEG.subarray(0, 2), icc, PLAIN_JPEG.subarray(2))),
      ),
    ).toBe(true);
  });

  it('copes with fill bytes before a marker', async () => {
    const stripped = stripMetadata(JPEG_WITH_GPS, 'jpg');
    const filled = join(
      JPEG_WITH_GPS.subarray(0, 2),
      new Uint8Array([0xff, 0xff]),
      JPEG_WITH_GPS.subarray(2),
    );
    const out = stripMetadata(filled, 'jpg');
    expect(await gpsOf(out)).toBeUndefined();
    expect(Buffer.from(out).equals(Buffer.from(stripped))).toBe(true);
  });

  it('keeps tables between the scans of a progressive photo', () => {
    const sos = PLAIN_JPEG.findIndex((b, i) => b === 0xff && PLAIN_JPEG[i + 1] === 0xda);
    const eoi = PLAIN_JPEG.length - 2;
    // A second "scan" after the first: a comment (dropped) and a table segment (kept).
    const dht = segment(0xc4, 'table');
    const file = join(
      PLAIN_JPEG.subarray(0, eoi),
      segment(0xfe, 'note'),
      dht,
      PLAIN_JPEG.subarray(sos, eoi),
      PLAIN_JPEG.subarray(eoi),
    );
    const expected = join(
      PLAIN_JPEG.subarray(0, eoi),
      dht,
      PLAIN_JPEG.subarray(sos, eoi),
      PLAIN_JPEG.subarray(eoi),
    );
    expect(Buffer.from(stripMetadata(file, 'jpg')).equals(Buffer.from(expected))).toBe(true);
  });

  it('refuses truncated or mislabelled files instead of storing them', () => {
    expect(() => stripMetadata(JPEG_WITH_GPS.subarray(0, 30), 'jpg')).toThrow();
    expect(() => stripMetadata(JPEG_WITH_GPS, 'webp')).toThrow();
    // Cut off before the end-of-image marker.
    expect(() => stripMetadata(PLAIN_JPEG.subarray(0, PLAIN_JPEG.length - 2), 'jpg')).toThrow();
  });
});
