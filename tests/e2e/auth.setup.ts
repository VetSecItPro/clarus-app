import { test as setup, expect } from '@playwright/test'

const AUTH_FILE = 'tests/e2e/.auth/user.json'

setup('authenticate', async ({ page }) => {
  // Skip auth setup if test credentials are not configured
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD

  if (!email || !password) {
    setup.skip(true, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set')
    return
  }

  // Navigate to login
  await page.goto('/login')

  // Fill in credentials
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)

  // Submit login form
  await page.locator('button[type="submit"]:has-text("Sign in")').click()

  // Wait for redirect to dashboard/home (successful login)
  await expect(page).not.toHaveURL(/.*login/, { timeout: 15000 })

  // Save auth state (cookies + localStorage with Supabase tokens)
  await page.context().storageState({ path: AUTH_FILE })
})
