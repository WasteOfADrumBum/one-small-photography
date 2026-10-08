import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Session ids are SHA-256 hashes of the cookie token, so a leaked table can't sign anyone in. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);

export const albums = pgTable('albums', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  coverPhotoId: uuid('cover_photo_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  published: boolean('published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Cameras and lenses Joshua manages in the admin and picks per photo. */
export const cameras = pgTable('cameras', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lenses = pgTable('lenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PhotoExif = {
  make?: string;
  model?: string;
  lens?: string;
  focalLength?: number;
  fNumber?: number;
  exposureTime?: number;
  iso?: number;
  takenAt?: string;
};

export const photos = pgTable(
  'photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    albumId: uuid('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default(''),
    description: text('description').notNull().default(''),
    alt: text('alt').notNull().default(''),
    /** File extension of the stored sizes: `webp` or `jpg`. */
    format: text('format').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    exif: jsonb('exif').$type<PhotoExif>().notNull().default({}),
    // Optional settings shown under the photo. Values come from src/lib/camera-settings.ts.
    cameraId: uuid('camera_id').references(() => cameras.id, { onDelete: 'set null' }),
    lensId: uuid('lens_id').references(() => lenses.id, { onDelete: 'set null' }),
    aperture: text('aperture'),
    shutterSpeed: text('shutter_speed'),
    iso: integer('iso'),
    sortOrder: integer('sort_order').notNull().default(0),
    published: boolean('published').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('photos_album_id_idx').on(t.albumId, t.sortOrder)],
);

/** Notes sent from the contact page. They stay here; no email service is involved. */
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    body: text('body').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('messages_created_at_idx').on(t.createdAt)],
);

export const albumsRelations = relations(albums, ({ many }) => ({
  photos: many(photos),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  album: one(albums, { fields: [photos.albumId], references: [albums.id] }),
  camera: one(cameras, { fields: [photos.cameraId], references: [cameras.id] }),
  lens: one(lenses, { fields: [photos.lensId], references: [lenses.id] }),
}));

export type Album = typeof albums.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type User = typeof users.$inferSelect;
export type Gear = typeof cameras.$inferSelect;
export type Message = typeof messages.$inferSelect;
