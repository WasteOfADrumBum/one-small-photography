import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { cameras, lenses, type Gear } from '@/db/schema';
import { APERTURES, ISOS, SHUTTER_SPEEDS } from '@/lib/camera-settings';

export const GEAR_KINDS = ['cameras', 'lenses'] as const;
export type GearKind = (typeof GEAR_KINDS)[number];
export const isGearKind = (value: unknown): value is GearKind =>
  GEAR_KINDS.includes(value as GearKind);

const tables = { cameras, lenses } as const;

export async function listGear(kind: GearKind): Promise<Gear[]> {
  const table = tables[kind];
  return db().select().from(table).orderBy(asc(table.name));
}

export async function addGear(kind: GearKind, name: string): Promise<Gear | undefined> {
  const [row] = await db().insert(tables[kind]).values({ name }).onConflictDoNothing().returning();
  return row;
}

export async function renameGear(kind: GearKind, id: string, name: string) {
  const table = tables[kind];
  const [row] = await db().update(table).set({ name }).where(eq(table.id, id)).returning();
  return row;
}

/** Photos that used this camera or lens keep their other settings; the reference is cleared. */
export async function deleteGear(kind: GearKind, id: string) {
  const table = tables[kind];
  const [row] = await db().delete(table).where(eq(table.id, id)).returning();
  return row;
}

/** Validation for the optional settings on a photo. Empty means "not set". */
export const PhotoSettings = z.object({
  cameraId: z.uuid().nullable().optional(),
  lensId: z.uuid().nullable().optional(),
  aperture: z.enum(APERTURES).nullable().optional(),
  shutterSpeed: z.enum(SHUTTER_SPEEDS).nullable().optional(),
  iso: z
    .number()
    .int()
    .refine((n) => (ISOS as readonly number[]).includes(n), 'Pick an ISO from the list.')
    .nullable()
    .optional(),
});

/** Confirms a chosen camera and lens still exist, so a stale admin tab gets a clear message. */
export async function missingGear(settings: {
  cameraId?: string | null;
  lensId?: string | null;
}): Promise<string | null> {
  if (settings.cameraId) {
    const [row] = await db()
      .select({ id: cameras.id })
      .from(cameras)
      .where(eq(cameras.id, settings.cameraId));
    if (!row) return 'That camera was deleted. Reload the page and pick another.';
  }
  if (settings.lensId) {
    const [row] = await db()
      .select({ id: lenses.id })
      .from(lenses)
      .where(eq(lenses.id, settings.lensId));
    if (!row) return 'That lens was deleted. Reload the page and pick another.';
  }
  return null;
}
