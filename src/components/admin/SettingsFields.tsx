import { APERTURES, ISOS, SHUTTER_SPEEDS, formatIso, formatShutter } from '@/lib/camera-settings';
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
    Add your cameras and lenses under "Your gear" on the <a href="/admin#gear">albums page</a> to
    pick them here.
  </p>
);

/** Five optional dropdowns for a photo's camera settings. Each change is passed up on its own. */
export default function SettingsFields({
  value,
  gear,
  onChange,
}: {
  value: Settings;
  gear: GearOptions;
  onChange: (changes: Partial<Settings>) => void;
}) {
  const noGear = gear.cameras.length === 0 && gear.lenses.length === 0;
  return (
    <fieldset className="rounded-lg border border-sand/15 p-3">
      <legend className="px-1 text-sm text-sand">Camera settings (optional)</legend>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
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
            {APERTURES.map((a) => (
              <option key={a} value={a}>
                ƒ/{a}
              </option>
            ))}
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
            {SHUTTER_SPEEDS.map((s) => (
              <option key={s} value={s}>
                {formatShutter(s)}
              </option>
            ))}
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
            {ISOS.map((i) => (
              <option key={i} value={i}>
                {formatIso(i)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {noGear && <NoGearHint />}
    </fieldset>
  );
}
