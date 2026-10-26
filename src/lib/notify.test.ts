import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contactEmail, escapeHtml, notifyNewMessage, oneLine } from './notify';

const note = { name: 'Ada', email: 'ada@example.com', body: 'Loved the Dusty photo.' };
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('CONTACT_TO_EMAIL', 'owner@example.com');
  vi.stubEnv('CONTACT_FROM_EMAIL', 'Site <hello@example.com>');
  fetchMock.mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

const sentBody = () => JSON.parse(fetchMock.mock.calls[0]![1].body as string);

describe('the contact email', () => {
  it('goes to the configured inbox with Reply-To set to the sender', async () => {
    expect(await notifyNewMessage(note, 'https://photo.example')).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    expect(sentBody()).toMatchObject({
      from: 'Site <hello@example.com>',
      to: ['owner@example.com'],
      reply_to: 'ada@example.com',
      subject: 'New note on OneSmallPhoto from Ada',
    });
    expect(sentBody().text).toContain('Loved the Dusty photo.');
    expect(sentBody().text).toContain('https://photo.example/admin#messages');
  });

  it('takes more than one recipient', async () => {
    vi.stubEnv('CONTACT_TO_EMAIL', 'a@example.com, b@example.com');
    await notifyNewMessage(note);
    expect(sentBody().to).toEqual(['a@example.com', 'b@example.com']);
  });

  it('does nothing until all three settings exist', async () => {
    for (const name of ['RESEND_API_KEY', 'CONTACT_TO_EMAIL', 'CONTACT_FROM_EMAIL']) {
      vi.stubEnv(name, '');
      expect(await notifyNewMessage(note)).toBe(false);
      vi.stubEnv(name, 'x');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs instead of throwing when Resend says no', async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"bad key"}', { status: 403 }));
    expect(await notifyNewMessage(note)).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it('logs instead of throwing when the network fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await notifyNewMessage(note)).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });
});

describe('what a sender can put in the email', () => {
  it('cannot break the subject onto new header lines', () => {
    const email = contactEmail({ ...note, name: 'Ada\r\nBcc: victim@example.com' });
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.subject).toBe('New note on OneSmallPhoto from Ada Bcc: victim@example.com');
  });

  it('cannot add markup to the HTML version', () => {
    const email = contactEmail({ ...note, name: '<b>Ada</b>', body: '<script>x()</script>' });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;x()&lt;/script&gt;');
    expect(email.html).toContain('&lt;b&gt;Ada&lt;/b&gt;');
  });

  it('helpers do what they say', () => {
    expect(oneLine(' a\nb\tc\u2028d ')).toBe('a b c d');
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});
