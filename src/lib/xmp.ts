import { copyright } from '@/lib/copyright';
import { site } from '@/lib/site';

/**
 * Copyright tags inside the photo files themselves, so the owner and notice
 * travel with a saved copy (Photoshop, Lightroom, Google Images and most
 * photo apps read them).
 *
 * Uploads are resized in the browser, which drops every tag the camera wrote,
 * so the tags are added as each file is served instead. That way they always
 * match the current settings in `copyright.ts` and nothing stored is rewritten.
 * Files that already carry XMP tags are left as they are.
 */

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function copyrightXmp(): string {
  const notice = escapeXml(copyright.notice);
  const holder = escapeXml(copyright.holder);
  const website = escapeXml(copyright.website);
  const creator = escapeXml(site.owner);
  return [
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    '<rdf:Description rdf:about=""',
    ' xmlns:dc="http://purl.org/dc/elements/1.1/"',
    ' xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"',
    ' xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"',
    ' xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"',
    ' xmlns:plus="http://ns.useplus.org/ldf/xmp/1.0/"',
    ` xmpRights:Marked="True" xmpRights:WebStatement="${website}"`,
    ` photoshop:Credit="${holder}"`,
    '>',
    `<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${notice}</rdf:li></rdf:Alt></dc:rights>`,
    `<dc:creator><rdf:Seq><rdf:li>${creator}</rdf:li></rdf:Seq></dc:creator>`,
    `<plus:CopyrightOwner><rdf:Seq><rdf:li rdf:parseType="Resource"><plus:CopyrightOwnerName>${holder}</plus:CopyrightOwnerName></rdf:li></rdf:Seq></plus:CopyrightOwner>`,
    `<Iptc4xmpCore:CreatorContactInfo rdf:parseType="Resource"><Iptc4xmpCore:CiUrlWork>${website}</Iptc4xmpCore:CiUrlWork></Iptc4xmpCore:CreatorContactInfo>`,
    '</rdf:Description>',
    '</rdf:RDF>',
    '</x:xmpmeta>',
    '<?xpacket end="r"?>',
  ].join('\n');
}

/** Returns the file with the XMP packet added, or unchanged if it can't or needn't be. */
export function embedXmp(file: Uint8Array, format: string, xmp: string): Uint8Array {
  const packet = new TextEncoder().encode(xmp);
  try {
    if (format === 'jpg') return embedInJpeg(file, packet);
    if (format === 'webp') return embedInWebp(file, packet);
  } catch {
    // A file we can't parse is served exactly as stored.
  }
  return file;
}

const JPEG_XMP_ID = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0');

function startsWith(bytes: Uint8Array, prefix: Uint8Array, at = 0) {
  return prefix.every((b, i) => bytes[at + i] === b);
}

function embedInJpeg(file: Uint8Array, packet: Uint8Array): Uint8Array {
  if (file[0] !== 0xff || file[1] !== 0xd8) return file;

  // Walk the leading APPn segments: skip if XMP is already there, and insert
  // after JFIF/Exif so readers that expect those first still find them.
  let insertAt = 2;
  for (let at = 2; at + 4 <= file.length && file[at] === 0xff;) {
    const marker = file[at + 1]!;
    if (marker < 0xe0 || marker > 0xef) break;
    const length = (file[at + 2]! << 8) | file[at + 3]!;
    if (marker === 0xe1 && startsWith(file, JPEG_XMP_ID, at + 4)) return file;
    at += 2 + length;
    if (marker === 0xe0 || marker === 0xe1) insertAt = at;
  }

  const length = 2 + JPEG_XMP_ID.length + packet.length;
  if (length > 0xffff) return file;
  const segment = new Uint8Array(2 + length);
  segment.set([0xff, 0xe1, length >> 8, length & 0xff]);
  segment.set(JPEG_XMP_ID, 4);
  segment.set(packet, 4 + JPEG_XMP_ID.length);
  return concat(file.subarray(0, insertAt), segment, file.subarray(insertAt));
}

const ascii = (s: string) => new TextEncoder().encode(s);
const XMP_FLAG = 0x04;

function embedInWebp(file: Uint8Array, packet: Uint8Array): Uint8Array {
  if (!startsWith(file, ascii('RIFF')) || !startsWith(file, ascii('WEBP'), 8)) return file;
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const fourcc = String.fromCharCode(...file.subarray(12, 16));

  let body: Uint8Array; // every chunk after "WEBP", with VP8X first
  if (fourcc === 'VP8X') {
    if (file[20]! & XMP_FLAG) return file;
    body = file.slice(12);
    body[8] = body[8]! | XMP_FLAG;
  } else {
    const size = webpCanvasSize(file, fourcc);
    if (!size) return file;
    const vp8x = new Uint8Array(18);
    vp8x.set(ascii('VP8X'));
    const v = new DataView(vp8x.buffer);
    v.setUint32(4, 10, true);
    vp8x[8] = XMP_FLAG | (fourcc === 'VP8L' && hasVp8lAlpha(file) ? 0x10 : 0);
    setUint24(v, 12, size.width - 1);
    setUint24(v, 15, size.height - 1);
    body = concat(vp8x, file.subarray(12, 8 + view.getUint32(4, true)));
  }

  const chunk = new Uint8Array(8 + packet.length + (packet.length % 2));
  chunk.set(ascii('XMP '));
  new DataView(chunk.buffer).setUint32(4, packet.length, true);
  chunk.set(packet, 8);

  const header = new Uint8Array(12);
  header.set(ascii('RIFF'));
  new DataView(header.buffer).setUint32(4, 4 + body.length + chunk.length, true);
  header.set(ascii('WEBP'), 8);
  return concat(header, body, chunk);
}

function webpCanvasSize(file: Uint8Array, fourcc: string) {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (fourcc === 'VP8 ') {
    // Frame tag (3 bytes), start code 9d 01 2a, then 14-bit width and height.
    if (file[23] !== 0x9d || file[24] !== 0x01 || file[25] !== 0x2a) return null;
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  if (fourcc === 'VP8L') {
    if (file[20] !== 0x2f) return null;
    const bits = view.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function hasVp8lAlpha(file: Uint8Array) {
  return ((file[24]! >> 4) & 1) === 1;
}

function setUint24(view: DataView, at: number, value: number) {
  view.setUint8(at, value & 0xff);
  view.setUint8(at + 1, (value >> 8) & 0xff);
  view.setUint8(at + 2, (value >> 16) & 0xff);
}

function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
