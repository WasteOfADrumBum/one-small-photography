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
  while (at + 4 <= file.length) {
    if (file[at] !== 0xff) throw new Error('Malformed JPEG.');
    const marker = file[at + 1]!;
    // Start of scan: everything after is image data, kept as is.
    if (marker === 0xda) break;
    const length = (file[at + 2]! << 8) | file[at + 3]!;
    if (length < 2 || at + 2 + length > file.length) throw new Error('Malformed JPEG.');
    if (!JPEG_METADATA_MARKERS.has(marker)) kept.push(file.subarray(at, at + 2 + length));
    at += 2 + length;
  }
  kept.push(file.subarray(at));
  return concat(kept);
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
