// Compares the photo rows in the database with the files in storage, so after a
// restore you can see which photos lost their files and which files lost their
// rows. Read-only. See docs/RECOVERY.md.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const SIZES = ['sm', 'md', 'lg'];

/** rows: [{ id, format }]; keys: ['photos/<id>/<size>.<format>', …] */
export function comparePhotoStorage(rows, keys) {
  const stored = new Set(keys);
  const known = new Set(rows.map((r) => r.id));
  const missing = [];
  for (const row of rows) {
    const absent = SIZES.filter((size) => !stored.has(`photos/${row.id}/${size}.${row.format}`));
    if (absent.length) missing.push({ id: row.id, sizes: absent });
  }
  const orphans = new Set();
  for (const key of keys) {
    const id = /^photos\/([^/]+)\//.exec(key)?.[1];
    if (id && !known.has(id)) orphans.add(id);
  }
  return { photos: rows.length, files: keys.length, missing, orphans: [...orphans] };
}

/** Every key under photos/ in the local folder (STORAGE_DIR) or the B2 bucket. */
export async function listPhotoKeys(env = process.env) {
  if (env.STORAGE_DIR) {
    const files = await readdir(join(env.STORAGE_DIR, 'photos'), { recursive: true }).catch(
      () => [],
    );
    return files
      .filter((f) => /\.(webp|jpg)$/.test(f))
      .map((f) => `photos/${f.split('\\').join('/')}`);
  }
  const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
  const endpoint = env.B2_ENDPOINT.replace(/^https?:\/\//, '');
  const client = new S3Client({
    endpoint: `https://${endpoint}`,
    region: endpoint.split('.')[1] ?? 'us-east-005',
    credentials: { accessKeyId: env.B2_KEY_ID, secretAccessKey: env.B2_APPLICATION_KEY },
  });
  const keys = [];
  let token;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: env.B2_BUCKET,
        Prefix: 'photos/',
        ContinuationToken: token,
      }),
    );
    for (const o of page.Contents ?? []) keys.push(o.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}
