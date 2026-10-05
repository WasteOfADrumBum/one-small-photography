import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Photo sizes stored per photo, by longest edge in pixels. */
export const PHOTO_SIZES = { sm: 480, md: 1280, lg: 2400 } as const;
export type PhotoSize = keyof typeof PHOTO_SIZES;
export const isPhotoSize = (value: string): value is PhotoSize => value in PHOTO_SIZES;

export const photoKey = (photoId: string, size: PhotoSize, format: string) =>
  `photos/${photoId}/${size}.${format}`;

let client: S3Client | undefined;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Backblaze B2 through its S3-compatible API. The bucket stays private. */
function b2(): S3Client {
  if (client) return client;
  const endpoint = env('B2_ENDPOINT').replace(/^https?:\/\//, '');
  // B2 endpoints look like s3.us-east-005.backblazeb2.com; the region is the middle part.
  const region = endpoint.split('.')[1] ?? 'us-east-005';
  client = new S3Client({
    endpoint: `https://${endpoint}`,
    region,
    credentials: {
      accessKeyId: env('B2_KEY_ID'),
      secretAccessKey: env('B2_APPLICATION_KEY'),
    },
  });
  return client;
}

/** Local folder used instead of B2 when STORAGE_DIR is set (development and tests only). */
const localDir = () => process.env.STORAGE_DIR;

const localTypes: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg' };

export async function putPhoto(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const dir = localDir();
  if (dir) {
    const path = join(dir, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return;
  }
  await b2().send(
    new PutObjectCommand({
      Bucket: env('B2_BUCKET'),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getPhoto(
  key: string,
): Promise<{ body: Uint8Array; contentType: string } | null> {
  const dir = localDir();
  if (dir) {
    try {
      const body = new Uint8Array(await readFile(join(dir, key)));
      return {
        body,
        contentType: localTypes[key.split('.').pop() ?? ''] ?? 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }
  try {
    const res = await b2().send(new GetObjectCommand({ Bucket: env('B2_BUCKET'), Key: key }));
    if (!res.Body) return null;
    return {
      body: await res.Body.transformToByteArray(),
      contentType: res.ContentType ?? 'application/octet-stream',
    };
  } catch (err) {
    if ((err as { name?: string }).name === 'NoSuchKey') return null;
    throw err;
  }
}

export async function deletePhotoFiles(photoId: string, format: string): Promise<void> {
  const dir = localDir();
  if (dir) {
    await rm(join(dir, 'photos', photoId), { recursive: true, force: true });
    return;
  }
  const keys = (Object.keys(PHOTO_SIZES) as PhotoSize[]).map((size) => ({
    Key: photoKey(photoId, size, format),
  }));
  await b2().send(
    new DeleteObjectsCommand({ Bucket: env('B2_BUCKET'), Delete: { Objects: keys } }),
  );
}
