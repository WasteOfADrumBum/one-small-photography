/**
 * Standard camera settings in third-stop increments, as most cameras (Nikon Z included)
 * offer them. Photos store the label exactly as listed here.
 */

/** f-numbers, widest to narrowest. */
export const APERTURES = [
  '0.95',
  '1',
  '1.1',
  '1.2',
  '1.4',
  '1.6',
  '1.8',
  '2',
  '2.2',
  '2.5',
  '2.8',
  '3.2',
  '3.5',
  '4',
  '4.5',
  '5',
  '5.6',
  '6.3',
  '7.1',
  '8',
  '9',
  '10',
  '11',
  '13',
  '14',
  '16',
  '18',
  '20',
  '22',
  '25',
  '29',
  '32',
] as const;

/** Shutter speeds, longest to shortest. Whole seconds end in "s"; fractions are of a second. */
export const SHUTTER_SPEEDS = [
  '30s',
  '25s',
  '20s',
  '15s',
  '13s',
  '10s',
  '8s',
  '6s',
  '5s',
  '4s',
  '3s',
  '2.5s',
  '2s',
  '1.6s',
  '1.3s',
  '1s',
  '1/1.3',
  '1/1.6',
  '1/2',
  '1/2.5',
  '1/3',
  '1/4',
  '1/5',
  '1/6',
  '1/8',
  '1/10',
  '1/13',
  '1/15',
  '1/20',
  '1/25',
  '1/30',
  '1/40',
  '1/50',
  '1/60',
  '1/80',
  '1/100',
  '1/125',
  '1/160',
  '1/200',
  '1/250',
  '1/320',
  '1/400',
  '1/500',
  '1/640',
  '1/800',
  '1/1000',
  '1/1250',
  '1/1600',
  '1/2000',
  '1/2500',
  '1/3200',
  '1/4000',
  '1/5000',
  '1/6400',
  '1/8000',
] as const;

export const ISOS = [
  32, 50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500,
  3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600, 32000, 51200, 102400,
] as const;

export type Aperture = (typeof APERTURES)[number];
export type ShutterSpeed = (typeof SHUTTER_SPEEDS)[number];
export type Iso = (typeof ISOS)[number];

/** Seconds for a shutter label: "1/250" → 0.004, "2.5s" → 2.5. */
export function shutterSeconds(label: string): number {
  if (label.startsWith('1/')) return 1 / Number(label.slice(2));
  return Number(label.replace(/s$/, ''));
}

/** "1/250" → "1/250s"; "2.5s" stays as it is. */
export const formatShutter = (label: string) => (label.endsWith('s') ? label : `${label}s`);

export const formatIso = (iso: number) => iso.toLocaleString('en-US');

/** Closest list entry on a log scale, for snapping a camera's EXIF value to the list. */
function nearest<T extends string | number>(
  list: readonly T[],
  value: number,
  toNumber: (item: T) => number,
): T {
  let best = list[0]!;
  let bestDistance = Infinity;
  for (const item of list) {
    const distance = Math.abs(Math.log(toNumber(item)) - Math.log(value));
    if (distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best;
}

/** Settings guessed from a photo's EXIF, so uploads start pre-filled. */
export function settingsFromExif(exif: { fNumber?: number; exposureTime?: number; iso?: number }) {
  const ok = (n?: number): n is number => typeof n === 'number' && n > 0 && Number.isFinite(n);
  return {
    aperture: ok(exif.fNumber) ? nearest(APERTURES, exif.fNumber, Number) : null,
    shutterSpeed: ok(exif.exposureTime)
      ? nearest(SHUTTER_SPEEDS, exif.exposureTime, shutterSeconds)
      : null,
    iso: ok(exif.iso) ? nearest(ISOS, exif.iso, (n) => n) : null,
  };
}
