import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['github'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
      SUPABASE_URL: 'https://placeholder.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-key',
      OPENROUTER_API_KEY: 'placeholder-openrouter-key',
      SUPADATA_API_KEY: 'placeholder-supadata-key',
      FIRECRAWL_API_KEY: 'placeholder-firecrawl-key',
      STRIPE_SECRET_KEY: 'placeholder-stripe-key',
      STRIPE_WEBHOOK_SECRET: 'placeholder-webhook-secret',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'placeholder-stripe-pub-key',
    },
  },
})
