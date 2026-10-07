import { Camera, Timer } from 'lucide-react';
import { formatIso, formatShutter } from '@/lib/camera-settings';

const WIDEST = Math.log2(0.95);
const NARROWEST = Math.log2(32);

/**
 * An iris drawn for a given f-number: wide open at f/0.95, nearly closed at f/32.
 * Six blades leave a hexagonal opening that shrinks as the number grows.
 */
export function ApertureIcon({ fNumber, size = 16 }: { fNumber: number; size?: number }) {
  const t = Math.min(1, Math.max(0, (Math.log2(fNumber) - WIDEST) / (NARROWEST - WIDEST)));
  const opening = 7.5 - t * 5.5; // radius of the hole, in a 24-unit box with a radius-10 ring
  const ring = 10;
  const corners = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return [12 + opening * Math.cos(a), 12 + opening * Math.sin(a)] as const;
  });
  // Each blade edge runs from one corner of the hole, past the next corner, out to the ring.
  const blades = corners.map(([x, y], i) => {
    const [nx, ny] = corners[(i + 1) % 6]!;
    const len = Math.hypot(nx - x, ny - y);
    const [dx, dy] = [(nx - x) / len, (ny - y) / len];
    const [px, py] = [x - 12, y - 12];
    const b = px * dx + py * dy;
    const s = -b + Math.sqrt(b * b - (px * px + py * py - ring * ring));
    return `M${x.toFixed(2)} ${y.toFixed(2)}L${(x + s * dx).toFixed(2)} ${(y + s * dy).toFixed(2)}`;
  });
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r={ring} />
      <path d={blades.join('')} />
    </svg>
  );
}

/** A lens seen from the front: barrel, glass and the reflection in it. */
export function LensIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <path d="M9.5 9.5a3.5 3.5 0 0 1 3-1.4" />
    </svg>
  );
}

/** The boxed "ISO" mark cameras use on their dials and screens. */
export function IsoIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="1.5" y="5" width="21" height="14" rx="2.5" stroke="currentColor" strokeWidth={1.5} />
      <text
        x="12"
        y="15.2"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="currentColor"
      >
        ISO
      </text>
    </svg>
  );
}

export type PhotoSettingsValues = {
  camera?: string | null;
  lens?: string | null;
  aperture?: string | null;
  shutterSpeed?: string | null;
  iso?: number | null;
};

/** One line of settings with icons and dividers. Renders nothing when none are set. */
export default function PhotoSettingsLine({
  settings,
  className = '',
}: {
  settings: PhotoSettingsValues;
  className?: string;
}) {
  const items = [
    settings.camera && {
      key: 'camera',
      label: 'Camera',
      icon: <Camera aria-hidden size={16} strokeWidth={1.5} />,
      text: settings.camera,
    },
    settings.lens && { key: 'lens', label: 'Lens', icon: <LensIcon />, text: settings.lens },
    settings.aperture && {
      key: 'aperture',
      label: 'Aperture',
      icon: <ApertureIcon fNumber={Number(settings.aperture)} />,
      text: `ƒ/${settings.aperture}`,
    },
    settings.shutterSpeed && {
      key: 'shutter',
      label: 'Shutter speed',
      icon: <Timer aria-hidden size={16} strokeWidth={1.5} />,
      text: formatShutter(settings.shutterSpeed),
    },
    settings.iso && { key: 'iso', label: 'ISO', icon: <IsoIcon />, text: formatIso(settings.iso) },
  ].filter((item) => !!item);
  if (items.length === 0) return null;
  return (
    <ul
      className={`flex flex-wrap items-center justify-center gap-y-2 text-xs tracking-wide text-sage ${className}`}
    >
      {items.map((item, i) => (
        <li
          key={item.key}
          title={item.label}
          className={`flex items-center gap-1.5 px-3 ${i > 0 ? 'border-l border-sand/25' : ''}`}
        >
          {item.icon}
          <span className="sr-only">{item.label}: </span>
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}
