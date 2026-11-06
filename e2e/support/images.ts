/**
 * Synthetic photos drawn on a canvas in the browser: gradients and shapes made
 * for the tests, never real photographs. Deterministic for a given seed.
 */
import type { Page } from '@playwright/test';

type Spec = { width: number; height: number; seed?: number; type?: 'image/jpeg' | 'image/webp' };

/** A synthetic image file, as bytes, for `setInputFiles`. */
export async function syntheticImage(page: Page, spec: Spec): Promise<Buffer> {
  const base64 = await page.evaluate(async ({ width, height, seed = 1, type = 'image/jpeg' }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, `hsl(${(seed * 47) % 360} 45% 35%)`);
    g.addColorStop(1, `hsl(${(seed * 47 + 120) % 360} 50% 65%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = `hsl(${(seed * 31 + i * 29) % 360} 60% ${30 + ((i * 7) % 40)}%)`;
      const r = ((i * 53 + seed * 17) % 97) / 97;
      ctx.beginPath();
      ctx.arc(
        width * r,
        (height * ((i * 37) % 11)) / 11,
        (Math.min(width, height) / 10) * (1 + (i % 3)),
        0,
        7,
      );
      ctx.fill();
    }
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), type, 0.8));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }, spec);
  return Buffer.from(base64, 'base64');
}

export type SeededPhoto = { id: string; format: string; width: number; height: number };

/**
 * Adds a photo through the real upload API from an admin page, the way the
 * editor does: three sizes (480, 1280 and 2400 px on the long edge).
 */
export async function uploadThroughApi(
  page: Page,
  albumId: string,
  photo: { title: string; alt: string; width: number; height: number; seed: number },
): Promise<SeededPhoto> {
  return page.evaluate(
    async ({ albumId, photo }) => {
      const sizes = { sm: 480, md: 1280, lg: 2400 } as const;
      const form = new FormData();
      let final = { width: 0, height: 0 };
      for (const [size, edge] of Object.entries(sizes)) {
        const scale = Math.min(1, edge / Math.max(photo.width, photo.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(photo.width * scale);
        canvas.height = Math.round(photo.height * scale);
        const ctx = canvas.getContext('2d')!;
        const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        g.addColorStop(0, `hsl(${(photo.seed * 47) % 360} 45% 35%)`);
        g.addColorStop(1, `hsl(${(photo.seed * 47 + 120) % 360} 50% 65%)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.8));
        form.set(size, blob, `${size}.jpg`);
        final = { width: canvas.width, height: canvas.height };
      }
      form.set('title', photo.title);
      form.set('alt', photo.alt);
      form.set('width', String(final.width));
      form.set('height', String(final.height));
      const res = await fetch(`/api/admin/albums/${albumId}/photos`, {
        method: 'POST',
        body: form,
      });
      if (res.status !== 201) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
      return res.json();
    },
    { albumId, photo },
  );
}

/** Calls the admin JSON API from an admin page (same origin, real session cookie). */
export async function adminApi<T>(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  return page.evaluate(
    async ({ path, method, body }) => {
      const res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
      return res.json();
    },
    { path, method, body },
  );
}
