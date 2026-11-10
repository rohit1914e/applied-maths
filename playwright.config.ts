import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs against the production build served by `vite preview` (`npm run test:e2e`).
 * Set BASE_URL to test a deployed site instead, e.g.
 *   BASE_URL=https://network-latency-predictor-gilt.vercel.app npx playwright test
 */
const deployed = process.env.BASE_URL

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  // each page runs live animations; more parallel browsers than this starve a laptop CPU
  workers: 3,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: deployed ?? 'http://localhost:4174',
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } }],
  webServer: deployed
    ? undefined
    : {
        command: 'npx vite preview --port 4174 --strictPort',
        url: 'http://localhost:4174',
        reuseExistingServer: false,
        timeout: 60_000,
      },
})
