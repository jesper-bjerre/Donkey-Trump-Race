import { defineConfig, devices } from '@playwright/test';

const PORT = 8090;

/** E2E tests run against the production build: run `pnpm build` first. */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  // One retry on CI absorbs rare timing flakes in multi-browser-context tests; the retry is
  // reported as "flaky" and keeps its trace, so it stays visible.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Software WebGL so the 3D scene renders on GPU-less CI runners.
        launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader'] },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true } },
      },
    },
  ],
  webServer: {
    command: 'node packages/server/dist/main.js',
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      HOST: '127.0.0.1',
      ALLOW_SOLO: '1',
      // The suite creates many rooms from one browser; production limits stay at 1x.
      RATE_LIMIT_SCALE: '20',
    },
  },
});
