import exifr from 'exifr';
import type { PhotoExif } from '@/db/schema';

export const SIZES = { sm: 480, md: 1280, lg: 2400 } as const;
type Size = keyof typeof SIZES;

export type PreparedPhoto = {
  files: Record<Size, Blob>;
  format: 'webp' | 'jpg';
  width: number;
  height: number;
  exif: PhotoExif;
  previewUrl: string;
};

/** Vercel's request limit is 4.5 MB for all three sizes together; leave headroom. */
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

async function readExif(file: File): Promise<PhotoExif> {
  try {
    const tags = await exifr.parse(file, [
      'Make',
      'Model',
      'LensModel',
      'FocalLength',
      'FNumber',
      'ExposureTime',
      'ISO',
      'DateTimeOriginal',
    ]);
    if (!tags) return {};
    return {
      make: tags.Make,
      model: tags.Model,
      lens: tags.LensModel,
      focalLength: tags.FocalLength,
      fNumber: tags.FNumber,
      exposureTime: tags.ExposureTime,
      iso: tags.ISO,
      takenAt:
        tags.DateTimeOriginal instanceof Date ? tags.DateTimeOriginal.toISOString() : undefined,
    };
  } catch {
    return {};
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode image.'))),
      type,
      quality,
    ),
  );
}

async function encode(bitmap: ImageBitmap, longEdge: number, quality: number) {
  const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  // Browsers without WebP encoding (older Safari) silently return PNG; fall back to JPEG.
  let blob = await toBlob(canvas, 'image/webp', quality);
  if (blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
  return { blob, width: canvas.width, height: canvas.height };
}

/** Reads EXIF and makes the three web sizes in the browser, so originals never leave your computer. */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const [exif, bitmap] = await Promise.all([
    readExif(file),
    createImageBitmap(file, { imageOrientation: 'from-image' }),
  ]);
  try {
    for (const quality of [0.86, 0.78, 0.7, 0.6]) {
      const sm = await encode(bitmap, SIZES.sm, quality);
      const md = await encode(bitmap, SIZES.md, quality);
      const lg = await encode(bitmap, SIZES.lg, quality);
      if (sm.blob.size + md.blob.size + lg.blob.size <= MAX_TOTAL_BYTES) {
        return {
          files: { sm: sm.blob, md: md.blob, lg: lg.blob },
          format: lg.blob.type === 'image/webp' ? 'webp' : 'jpg',
          width: lg.width,
          height: lg.height,
          exif,
          previewUrl: URL.createObjectURL(sm.blob),
        };
      }
    }
    throw new Error('This photo is too detailed to fit the upload limit.');
  } finally {
    bitmap.close();
  }
}

/** "DSC_0042-final.jpg" becomes "DSC 0042 final". */
export const titleFromFilename = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
