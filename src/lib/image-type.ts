/**
 * Works out a photo's format from its first bytes, so an upload can't claim to be
 * an image (through its Content-Type) while carrying something else.
 */
export function sniffImageFormat(bytes: Uint8Array): 'webp' | 'jpg' | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'jpg';
  return null;
}
