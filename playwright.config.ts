import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config with three project tiers:
 *
 * 1. "setup" — Logs in with E2E_TEST_EMAIL/PASSWORD, saves storageState
 * 2. "smoke" — Unauthenticated smoke tests (always run)
 * 3. "authenticated" — Tests that require a logged-in session (depends on setup)
 *
 * Usage:
 *   pnpm exec playwright test                     # Run all
 *   pnpm exec playwright test --project=smoke     # Smoke only (no creds needed)
 *   pnpm exec playwright test --project=authenticated  # Auth tests only
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['html'], ['github']]
    : [['html']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Auth setup — runs first, saves storageState for authenticated tests
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Smoke tests — no auth required, run on every CI push
    {
      name: 'smoke',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'smoke-mobile',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
    // Authenticated tests — require E2E_TEST_EMAIL and E2E_TEST_PASSWORD
    {
      name: 'authenticated',
      testDir: './tests/e2e/authenticated',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
      },
    },
    {
      name: 'authenticated-mobile',
      testDir: './tests/e2e/authenticated',
      dependencies: ['setup'],
      use: {
        ...devices['Pixel 7'],
        storageState: 'tests/e2e/.auth/user.json',
      },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
      SUPABASE_URL: process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key',
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || 'placeholder-openrouter-key',
      SUPADATA_API_KEY: process.env.SUPADATA_API_KEY || 'placeholder-supadata-key',
      FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY || 'placeholder-firecrawl-key',
      POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN || 'placeholder-polar-token',
      POLAR_WEBHOOK_SECRET: process.env.POLAR_WEBHOOK_SECRET || 'placeholder-webhook-secret',
      POLAR_ORGANIZATION_ID: process.env.POLAR_ORGANIZATION_ID || 'placeholder-org-id',
    },
  },
})
