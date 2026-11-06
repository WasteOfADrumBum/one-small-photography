/**
 * Removes camera metadata (EXIF, including GPS location, plus XMP, IPTC and
 * comments) from an uploaded photo before it is stored.
 *
 * The admin page resizes photos in the browser, and a canvas re-encode already
 * drops every tag. This is the server-side guarantee for anything that reaches
 * the upload API another way: a photo can never be published with the place it
 * was taken in it. Colour information (JFIF, ICC profile, Adobe colour
 * transform) is kept so the picture looks the same.
 */

/** JPEG APPn markers that carry descriptive metadata rather than colour data. */
const JPEG_METADATA_MARKERS = new Set([
  0xe1, // APP1: Exif (GPS lives here) and XMP
  0xe3, // APP3..APP12: maker and vendor blocks
  0xe4,
  0xe5,
  0xe6,
  0xe7,
  0xe8,
  0xe9,
  0xea,
  0xeb,
  0xec,
  0xed, // APP13: Photoshop / IPTC
  0xef, // APP15
  0xfe, // COM: free-text comment
]);

export function stripMetadata(file: Uint8Array, format: string): Uint8Array {
  if (format === 'jpg') return stripJpeg(file);
  if (format === 'webp') return stripWebp(file);
  return file;
}

function stripJpeg(file: Uint8Array): Uint8Array {
  if (file[0] !== 0xff || file[1] !== 0xd8) throw new Error('Not a JPEG.');
  const kept: Uint8Array[] = [file.subarray(0, 2)];
  let at = 2;
  let inScan = false;
  for (;;) {
    if (at >= file.length) throw new Error('Malformed JPEG.'); // no end-of-image marker
    if (inScan) {
      // Compressed image data runs until the next real marker. Inside it, 0xFF is
      // followed by 0x00 (an escaped byte) or a restart marker (D0..D7).
      const from = at;
      while (at + 1 < file.length) {
        if (file[at] === 0xff) {
          const next = file[at + 1]!;
          if (next !== 0x00 && !(next >= 0xd0 && next <= 0xd7) && next !== 0xff) break;
        }
        at += 1;
      }
      kept.push(file.subarray(from, at));
      if (at + 1 >= file.length) throw new Error('Malformed JPEG.');
    }
    if (file[at] !== 0xff) throw new Error('Malformed JPEG.');
    while (file[at + 1] === 0xff) at += 1; // fill bytes before a marker
    const marker = file[at + 1];
    if (marker === undefined) throw new Error('Malformed JPEG.');
    if (marker === 0xd9) {
      // End of image. Anything after it (MPF second images, motion-photo trailers,
      // appended data) is dropped: it can carry its own Exif and GPS.
      kept.push(file.subarray(at, at + 2));
      return concat(kept);
    }
    if (at + 4 > file.length) throw new Error('Malformed JPEG.');
    const length = (file[at + 2]! << 8) | file[at + 3]!;
    if (length < 2 || at + 2 + length > file.length) throw new Error('Malformed JPEG.');
    const segment = file.subarray(at, at + 2 + length);
    if (!isMetadataSegment(marker, segment)) kept.push(segment);
    at += 2 + length;
    // Start of scan: compressed data follows (progressive photos have several scans).
    inScan = marker === 0xda;
  }
}

/** APP2 holds either the ICC colour profile (kept) or MPF, the index of extra images (dropped). */
function isMetadataSegment(marker: number, segment: Uint8Array): boolean {
  if (JPEG_METADATA_MARKERS.has(marker)) return true;
  return marker === 0xe2 && ascii(segment, 4) === 'MPF\0';
}

const ascii = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
const EXIF_FLAG = 0x08;
const XMP_FLAG = 0x04;

function stripWebp(file: Uint8Array): Uint8Array {
  if (ascii(file, 0) !== 'RIFF' || ascii(file, 8) !== 'WEBP') throw new Error('Not a WebP.');
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const end = Math.min(file.length, 8 + view.getUint32(4, true));
  const chunks: Uint8Array[] = [];
  let removed = false;
  for (let at = 12; at + 8 <= end;) {
    const fourcc = ascii(file, at);
    const size = view.getUint32(at + 4, true);
    if (at + 8 + size > end) throw new Error('Malformed WebP.');
    const next = at + 8 + size + (size % 2);
    if (fourcc === 'EXIF' || fourcc === 'XMP ') removed = true;
    else chunks.push(file.slice(at, Math.min(next, end)));
    at = next;
  }
  if (!removed) return file;
  const vp8x = chunks.find((c) => ascii(c, 0) === 'VP8X');
  if (vp8x) vp8x[8] = vp8x[8]! & ~(EXIF_FLAG | XMP_FLAG);
  const body = concat(chunks);
  const header = new Uint8Array(12);
  header.set(file.subarray(0, 12));
  new DataView(header.buffer).setUint32(4, 4 + body.length, true);
  return concat([header, body]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
