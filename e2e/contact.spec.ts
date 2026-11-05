/**
 * The "say hello" form, end to end: browser, API, database and the email
 * heads-up, which goes to a local stand-in for Resend (never a real inbox).
 */
import { expect, test, type Page } from '@playwright/test';
import { failNextEmails, query, sentEmails } from './support/env';

async function openForm(page: Page) {
  await page.goto('/contact');
  const form = page.locator('form').filter({ has: page.getByLabel('Message') });
  await form.scrollIntoViewIfNeeded();
  // The form is a React island that hydrates when it scrolls into view.
  await expect(form.getByRole('button', { name: 'Send' })).toBeEnabled();
  return form;
}

async function fill(page: Page, name: string, email: string, body: string) {
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email, so I can write back').fill(email);
  await page.getByLabel('Message').fill(body);
}

const messagesFrom = (email: string) =>
  query<{ name: string; body: string }>('select name, body from messages where email = $1', [
    email,
  ]);

test('the browser asks for every field before sending', async ({ page }) => {
  let posted = false;
  page.on('request', (r) => r.url().endsWith('/api/contact') && (posted = true));
  await openForm(page);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByLabel('Your name')).toHaveJSProperty('validity.valueMissing', true);
  expect(posted).toBe(false);
});

test('the server explains a bad email address, and the note can then be sent', async ({ page }) => {
  const email = `visitor-${Date.now()}@example.test`;
  await openForm(page);
  await fill(page, 'Ada', 'ada@nowhere', 'Hello there');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('alert')).toHaveText('That email address does not look right.');
  // What the visitor typed is still there; fix it and send.
  await expect(page.getByLabel('Message')).toHaveValue('Hello there');
  await page.getByLabel('Email, so I can write back').fill(email);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('status')).toContainText("Thanks, it's on its way.");
  expect(await messagesFrom(email)).toEqual([{ name: 'Ada', body: 'Hello there' }]);
});

test('a sent note is saved once and the heads-up email is escaped', async ({ page }) => {
  const email = `escape-${Date.now()}@example.test`;
  await openForm(page);
  await fill(page, '<b>Mallory</b>', email, 'Hi <script>alert(1)</script>');
  // A slow network: a second click while sending must not send twice.
  await page.route('**/api/contact', async (route) => {
    await new Promise((r) => setTimeout(r, 400));
    await route.continue();
  });
  const send = page.getByRole('button', { name: 'Send' });
  await send.click();
  await expect(page.getByRole('button', { name: 'Sending…' })).toBeDisabled();
  await page
    .getByRole('button', { name: 'Sending…' })
    .click({ force: true })
    .catch(() => {});
  await expect(page.getByRole('status')).toContainText("Thanks, it's on its way.");

  expect(await messagesFrom(email)).toHaveLength(1);
  await expect
    .poll(async () => (await sentEmails()).filter((e) => e.body.reply_to === email).length)
    .toBe(1);
  const mail = (await sentEmails()).find((e) => e.body.reply_to === email)!.body;
  expect(mail.to).toEqual(['owner@e2e.test']);
  expect(mail.html).toContain('&lt;b&gt;Mallory&lt;/b&gt;');
  expect(mail.html).not.toContain('<script>');
});

test('a dropped connection says so, keeps the note, and sending again works', async ({ page }) => {
  const email = `offline-${Date.now()}@example.test`;
  await openForm(page);
  await fill(page, 'Grace', email, 'Testing a dropped connection');
  await page.route('**/api/contact', (route) => route.abort('internetdisconnected'));
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('alert')).toContainText('Check your connection and try again');
  await expect(page.getByLabel('Message')).toHaveValue('Testing a dropped connection');
  expect(await messagesFrom(email)).toHaveLength(0);

  await page.unroute('**/api/contact');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('status')).toContainText("Thanks, it's on its way.");
  expect(await messagesFrom(email)).toHaveLength(1);
});

test('a failed email still keeps the note for the admin inbox', async ({ page }) => {
  const email = `mailfail-${Date.now()}@example.test`;
  await failNextEmails(1);
  await openForm(page);
  await fill(page, 'Linus', email, 'Email provider is down');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('status')).toContainText("Thanks, it's on its way.");
  expect(await messagesFrom(email)).toHaveLength(1);
});
