/**
 * Emails Joshua when someone sends a note from /contact, through Resend's API.
 *
 * The note is always saved to the database first; this is only a heads-up, so
 * it never throws. Without RESEND_API_KEY and CONTACT_TO_EMAIL it does nothing,
 * which keeps local dev and tests quiet.
 *
 * The visitor's own address can't be the From (mail providers reject mail
 * "from" a domain the sender doesn't own), so it goes in Reply-To and the body.
 * From defaults to Resend's shared sender until a domain is verified there.
 */
import { site } from '@/lib/site';

const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 5000;
export const DEFAULT_FROM = `${site.name} <onboarding@resend.dev>`;

export type ContactNote = { name: string; email: string; body: string };

/** Drops line breaks and other control characters, so text can't add email headers. */
export const oneLine = (text: string) =>
  // eslint-disable-next-line no-control-regex
  text.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').trim();

export const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export function contactEmail(note: ContactNote, siteUrl?: string) {
  const name = oneLine(note.name).slice(0, 120);
  const email = oneLine(note.email);
  const inbox = siteUrl ? new URL('/admin#messages', siteUrl).href : undefined;
  const footer = inbox ? `Read and reply from ${inbox}, or just reply to this email.` : '';
  return {
    subject: `New note on ${site.name} from ${name}`,
    replyTo: email,
    text: [`From: ${name} <${email}>`, '', note.body, '', footer].join('\n').trim(),
    html: [
      `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>`,
      `<p style="white-space:pre-wrap">${escapeHtml(note.body)}</p>`,
      inbox ? `<p style="color:#666">${escapeHtml(footer)}</p>` : '',
    ].join(''),
  };
}

/** Sends the heads-up email. Returns whether it went; failures are logged, not thrown. */
export async function notifyNewMessage(note: ContactNote, siteUrl?: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL || DEFAULT_FROM;
  if (!apiKey || !to) return false;

  const email = contactEmail(note, siteUrl);
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: to.split(',').map((address) => address.trim()),
        reply_to: email.replyTo,
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`Contact email failed: Resend answered ${res.status}`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Contact email failed:', err);
    return false;
  }
}
