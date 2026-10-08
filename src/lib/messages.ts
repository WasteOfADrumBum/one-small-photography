import { count, desc, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { messages, type Message } from '@/db/schema';

export const NewMessage = z.object({
  name: z.string().trim().min(1, 'Add your name.').max(120),
  email: z.email('That email address does not look right.').max(200),
  body: z.string().trim().min(1, 'Write a message.').max(5000),
  /** Hidden from people; bots that fill every field give themselves away here. */
  website: z.string().max(500).optional(),
});

/** Most messages accepted in an hour, to keep a flood of spam from filling the database. */
const HOURLY_LIMIT = 20;

export async function tooManyRecent(): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [row] = await db()
    .select({ n: count() })
    .from(messages)
    .where(gt(messages.createdAt, since));
  return (row?.n ?? 0) >= HOURLY_LIMIT;
}

export async function addMessage(input: { name: string; email: string; body: string }) {
  await db().insert(messages).values(input);
}

export function listMessages(): Promise<Message[]> {
  return db().select().from(messages).orderBy(desc(messages.createdAt));
}

export async function setRead(id: string, read: boolean) {
  const [row] = await db()
    .update(messages)
    .set({ readAt: read ? new Date() : null })
    .where(eq(messages.id, id))
    .returning();
  return row;
}

export async function deleteMessage(id: string) {
  await db().delete(messages).where(eq(messages.id, id));
}
