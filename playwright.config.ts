import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests. Run them through `npm run test:e2e`, which starts the built
 * site with a throwaway database and photo folder and sets E2E_BASE_URL; see
 * docs/TESTING.md. Chromium runs on every pull request; Firefox and WebKit run
 * on a schedule (.github/workflows/browsers.yml).
 */
const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) throw new Error('E2E_BASE_URL is not set: run the tests with `npm run test:e2e`.');

const CI = Boolean(process.env.CI);
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results/e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  forbidOnly: CI,
  // One retry in CI so a flaky test shows up as "flaky" instead of failing the
  // run or passing silently: the summary step lists it and annotates the run.
  retries: CI ? 1 : 0,
  // One worker: the admin tests briefly break this run's photo folder on purpose.
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
  ],
  use: {
    baseURL,
    // Traces and screenshots only for failures. The account and database are
    // made for this run and dropped after it, so nothing in them is reusable.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // E2E_HTTPS=1 serves the site with a throwaway self-signed certificate.
    ignoreHTTPSErrors: baseURL.startsWith('https:'),
    timezoneId: 'America/New_York',
    locale: 'en-US',
  },
  projects: [
    // No retry: /setup works once, so a second try would fail for the wrong reason.
    { name: 'setup', testMatch: /seed\.setup\.ts/, retries: 0 },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },
  ],
});
