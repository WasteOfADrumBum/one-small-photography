/** The contact route with the database and email mocked: the note is saved before any email. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const order: string[] = [];
const addMessage = vi.fn(async () => void order.push('saved'));
const notifyNewMessage = vi.fn(async () => {
  order.push('emailed');
  return false;
});

vi.mock('@/lib/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/messages')>()),
  addMessage,
  tooManyRecent: async () => false,
}));
vi.mock('@/lib/notify', () => ({ notifyNewMessage }));

const { POST } = await import('@/pages/api/contact');

const note = { name: 'Ada', email: 'ada@example.com', body: 'Loved the Dusty photo.' };
const send = (body: object) =>
  POST({
    request: new Request('https://photo.example/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as never);

beforeEach(() => {
  order.length = 0;
  vi.clearAllMocks();
});

describe('contact form email', () => {
  it('saves the note, then emails, and still says sent when the email fails', async () => {
    const res = await send(note);
    expect(res.status).toBe(201);
    expect(order).toEqual(['saved', 'emailed']);
    expect(notifyNewMessage).toHaveBeenCalledWith(note, 'https://photo.example');
  });

  it('sends no email for honeypot posts', async () => {
    expect((await send({ ...note, website: 'http://spam.example' })).status).toBe(201);
    expect(addMessage).not.toHaveBeenCalled();
    expect(notifyNewMessage).not.toHaveBeenCalled();
  });

  it('needs a valid email from the sender before it saves or emails', async () => {
    const noEmail = { name: note.name, body: note.body };
    for (const body of [noEmail, { ...note, email: '' }, { ...note, email: 'nope' }]) {
      expect((await send(body)).status).toBe(400);
    }
    expect(addMessage).not.toHaveBeenCalled();
    expect(notifyNewMessage).not.toHaveBeenCalled();
  });

  it('never emails if saving fails', async () => {
    addMessage.mockRejectedValueOnce(new Error('db down'));
    await expect(send(note)).rejects.toThrow('db down');
    expect(notifyNewMessage).not.toHaveBeenCalled();
  });
});
