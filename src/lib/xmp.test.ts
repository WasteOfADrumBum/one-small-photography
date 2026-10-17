import { describe, expect, it } from 'vitest';
import { copyright } from '@/lib/copyright';
import { copyrightXmp, embedXmp } from './xmp';

const xmp = copyrightXmp();
const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);
const ascii = (s: string) => new TextEncoder().encode(s);

function riff(...chunks: Uint8Array[]) {
  const body = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(12 + body);
  out.set(ascii('RIFF'));
  new DataView(out.buffer).setUint32(4, 4 + body, true);
  out.set(ascii('WEBP'), 8);
  let at = 12;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function chunk(fourcc: string, data: Uint8Array) {
  const out = new Uint8Array(8 + data.length + (data.length % 2));
  out.set(ascii(fourcc));
  new DataView(out.buffer).setUint32(4, data.length, true);
  out.set(data, 8);
  return out;
}

/** Walks the chunks of a WebP file. */
function chunks(file: Uint8Array) {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  expect(view.getUint32(4, true)).toBe(file.length - 8);
  const found: { fourcc: string; data: Uint8Array }[] = [];
  for (let at = 12; at < file.length;) {
    const size = view.getUint32(at + 4, true);
    found.push({
      fourcc: text(file.subarray(at, at + 4)),
      data: file.subarray(at + 8, at + 8 + size),
    });
    at += 8 + size + (size % 2);
  }
  return found;
}

// A lossy VP8 frame header for a 1280 x 853 image (the pixel data doesn't matter here).
const vp8 = new Uint8Array([0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x00, 0x05, 0x55, 0x03, 1, 2, 3]);

describe('copyrightXmp', () => {
  it('carries the notice, holder and website from the copyright settings', () => {
    expect(xmp).toContain(copyright.notice);
    expect(xmp).toContain(`photoshop:Credit="${copyright.holder}"`);
    expect(xmp).toContain(copyright.website);
    expect(xmp).toContain('xmpRights:Marked="True"');
  });
});

describe('embedXmp for WebP', () => {
  it('turns a simple file into an extended one with the copyright tags', () => {
    const out = embedXmp(riff(chunk('VP8 ', vp8)), 'webp', xmp);
    const found = chunks(out);
    expect(found.map((c) => c.fourcc)).toEqual(['VP8X', 'VP8 ', 'XMP ']);
    const vp8x = new DataView(found[0]!.data.buffer, found[0]!.data.byteOffset);
    expect(vp8x.getUint8(0) & 0x04).toBe(0x04);
    expect(vp8x.getUint16(4, true) + 1).toBe(1280);
    expect(vp8x.getUint16(7, true) + 1).toBe(853);
    expect(found[1]!.data).toEqual(vp8);
    expect(text(found[2]!.data)).toContain(copyright.notice);
  });

  it('adds the tags to an extended file and sets its XMP flag', () => {
    const header = new Uint8Array(10);
    const out = embedXmp(riff(chunk('VP8X', header), chunk('VP8 ', vp8)), 'webp', xmp);
    const found = chunks(out);
    expect(found.map((c) => c.fourcc)).toEqual(['VP8X', 'VP8 ', 'XMP ']);
    expect(found[0]!.data[0]! & 0x04).toBe(0x04);
  });

  it('leaves a file that already has XMP tags alone', () => {
    const once = embedXmp(riff(chunk('VP8 ', vp8)), 'webp', xmp);
    expect(embedXmp(once, 'webp', xmp)).toBe(once);
  });

  it('serves a file it cannot read exactly as stored', () => {
    const junk = ascii('not a webp file');
    expect(embedXmp(junk, 'webp', xmp)).toBe(junk);
  });
});

describe('embedXmp for JPEG', () => {
  const jfif = new Uint8Array([0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]);
  const jpeg = new Uint8Array([0xff, 0xd8, ...jfif, 0xff, 0xdb, 0x00, 0x02, 0xff, 0xd9]);

  it('adds an XMP segment after the JFIF header', () => {
    const out = embedXmp(jpeg, 'jpg', xmp);
    expect([...out.subarray(0, 8)]).toEqual([0xff, 0xd8, ...jfif]);
    expect([...out.subarray(8, 10)]).toEqual([0xff, 0xe1]);
    const length = (out[10]! << 8) | out[11]!;
    expect(text(out.subarray(12, 41))).toBe('http://ns.adobe.com/xap/1.0/\0');
    expect(text(out.subarray(12, 10 + length))).toContain(copyright.notice);
    expect([...out.subarray(10 + length)]).toEqual([0xff, 0xdb, 0x00, 0x02, 0xff, 0xd9]);
  });

  it('leaves a file that already has XMP tags alone', () => {
    const once = embedXmp(jpeg, 'jpg', xmp);
    expect(embedXmp(once, 'jpg', xmp)).toBe(once);
  });
});
