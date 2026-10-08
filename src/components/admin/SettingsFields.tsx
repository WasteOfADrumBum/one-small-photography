import {
  APERTURES,
  FAVORITE_ISOS,
  FAVORITE_SHUTTER_SPEEDS,
  ISOS,
  SHUTTER_SPEEDS,
  formatIso,
  formatShutter,
} from '@/lib/camera-settings';
import { ApertureIcon } from '@/components/PhotoSettingsLine';

export type Settings = {
  cameraId: string | null;
  lensId: string | null;
  aperture: string | null;
  shutterSpeed: string | null;
  iso: number | null;
};

export type GearOptions = {
  cameras: { id: string; name: string }[];
  lenses: { id: string; name: string }[];
};

const select =
  'mt-1 w-full rounded-md border border-sand/30 bg-espresso px-2 py-2 text-sm text-paper focus:border-gold';

export type Gear = Pick<Settings, 'cameraId' | 'lensId'>;

/** Camera and lens dropdowns, each spanning a full row of a two-column grid. */
export function GearSelects({
  value,
  gear,
  onChange,
}: {
  value: Gear;
  gear: GearOptions;
  onChange: (changes: Partial<Gear>) => void;
}) {
  return (
    <>
      <label className="col-span-2 block text-xs text-sand">
        Camera
        <select
          className={select}
          value={value.cameraId ?? ''}
          onChange={(e) => onChange({ cameraId: e.target.value || null })}
        >
          <option value="">—</option>
          {gear.cameras.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="col-span-2 block text-xs text-sand">
        Lens
        <select
          className={select}
          value={value.lensId ?? ''}
          onChange={(e) => onChange({ lensId: e.target.value || null })}
        >
          <option value="">—</option>
          {gear.lenses.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export const NoGearHint = () => (
  <p className="mt-2 text-xs text-sand">
    Add your cameras and lenses on the <a href="/admin#gear">Gear tab</a> to pick them here.
  </p>
);

/** Options with favorites listed first, then the full list (favorites included again). */
function Options<T extends string | number>({
  all,
  favorites = [],
  label,
}: {
  all: readonly T[];
  favorites?: readonly T[];
  label: (value: T) => string;
}) {
  const options = (list: readonly T[]) =>
    list.map((v) => (
      <option key={v} value={v}>
        {label(v)}
      </option>
    ));
  if (favorites.length === 0) return options(all);
  return (
    <>
      <optgroup label="Favorites">{options(favorites)}</optgroup>
      <optgroup label="All">{options(all)}</optgroup>
    </>
  );
}

/** Five optional dropdowns for a photo's camera settings. Each change is passed up on its own. */
export default function SettingsFields({
  value,
  gear,
  onChange,
  legend = 'Camera settings (optional)',
  wide = false,
  hint,
}: {
  value: Settings;
  gear: GearOptions;
  onChange: (changes: Partial<Settings>) => void;
  legend?: string;
  /** Lay the dropdowns out in more columns on wide screens. */
  wide?: boolean;
  hint?: string;
}) {
  const noGear = gear.cameras.length === 0 && gear.lenses.length === 0;
  return (
    <fieldset className="rounded-lg border border-sand/15 p-3">
      <legend className="px-1 text-sm text-sand">{legend}</legend>
      <div className={`grid grid-cols-2 gap-x-3 gap-y-2 ${wide ? 'md:grid-cols-4' : ''}`}>
        <GearSelects value={value} gear={gear} onChange={onChange} />
        <label className="block text-xs text-sand">
          <span className="flex items-center gap-1">
            Aperture
            {value.aperture && <ApertureIcon fNumber={Number(value.aperture)} size={14} />}
          </span>
          <select
            className={select}
            value={value.aperture ?? ''}
            onChange={(e) => onChange({ aperture: e.target.value || null })}
          >
            <option value="">—</option>
            <Options all={APERTURES} label={(a) => `ƒ/${a}`} />
          </select>
        </label>
        <label className="block text-xs text-sand">
          Shutter speed
          <select
            className={select}
            value={value.shutterSpeed ?? ''}
            onChange={(e) => onChange({ shutterSpeed: e.target.value || null })}
          >
            <option value="">—</option>
            <Options
              all={SHUTTER_SPEEDS}
              favorites={FAVORITE_SHUTTER_SPEEDS}
              label={formatShutter}
            />
          </select>
        </label>
        <label className="col-span-2 block text-xs text-sand sm:col-span-1">
          ISO
          <select
            className={select}
            value={value.iso ?? ''}
            onChange={(e) => onChange({ iso: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">—</option>
            <Options all={ISOS} favorites={FAVORITE_ISOS} label={formatIso} />
          </select>
        </label>
      </div>
      {noGear ? <NoGearHint /> : hint && <p className="mt-2 text-xs text-sand">{hint}</p>}
    </fieldset>
  );
}

/** One line describing the settings, like "Nikon D300s · 35mm f/1.8 · ƒ/8 · 1/200s · ISO 200". */
function summarize(value: Settings, gear: GearOptions) {
  const parts = [
    gear.cameras.find((c) => c.id === value.cameraId)?.name,
    gear.lenses.find((l) => l.id === value.lensId)?.name,
    value.aperture && `ƒ/${value.aperture}`,
    value.shutterSpeed && formatShutter(value.shutterSpeed),
    value.iso && `ISO ${formatIso(value.iso)}`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'None set';
}

/**
 * The same dropdowns folded behind a one-line summary, so a photo card stays short.
 * Click the summary to open them.
 */
export function CollapsedSettingsFields(props: Parameters<typeof SettingsFields>[0]) {
  return (
    <details className="group rounded-lg border border-sand/15">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 text-sand">Camera</span>
        <span className="min-w-0 flex-1 truncate text-paper">
          {summarize(props.value, props.gear)}
        </span>
        <span className="shrink-0 text-xs text-sand group-open:hidden">Edit</span>
        <span className="hidden shrink-0 text-xs text-sand group-open:inline">Done</span>
      </summary>
      <div className="px-2 pb-2">
        <SettingsFields legend="Camera settings (optional)" {...props} />
      </div>
    </details>
  );
}
