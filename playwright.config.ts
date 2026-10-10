import { defineConfig, devices } from '@playwright/test';
import { baseURL } from './tests/support/env';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  retries: 0,
  use: {
    baseURL,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
