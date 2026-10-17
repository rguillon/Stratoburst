import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:4173/';

export default defineConfig({
  testDir: 'tools/e2e',
  timeout: 60_000,
  use: { baseURL },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  ...(process.env.BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run preview',
          url: 'http://localhost:4173/',
          reuseExistingServer: true,
          timeout: 60_000,
        },
      }),
});
