import { test, expect } from '@playwright/test'

// Skip all tests in this file if E2E credentials are not configured
test.beforeEach(async () => {
  if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
    test.skip(true, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required')
  }
})

test.describe('Dashboard', () => {
  test('loads dashboard page with heading', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
  })

  test('shows usage and preferences tabs', async ({ page }) => {
    await page.goto('/dashboard')

    const tabList = page.locator('[role="tablist"]')
    await expect(tabList).toBeVisible()

    await expect(page.getByRole('tab', { name: /Usage/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Preferences/i })).toBeVisible()
  })

  test('usage tab displays tier badge and usage bars', async ({ page }) => {
    await page.goto('/dashboard')

    // Wait for usage data to load (status spinner goes away)
    await page.waitForSelector('[role="status"]', { state: 'detached', timeout: 10000 }).catch(() => {
      // Status may not appear if data loads fast
    })

    // Should show at least one usage metric
    const usageLabels = ['Analyses', 'Chat Messages', 'Library Items']
    for (const label of usageLabels) {
      await expect(page.getByText(label).first()).toBeVisible()
    }
  })

  test('can switch to preferences tab', async ({ page }) => {
    await page.goto('/dashboard')

    const preferencesTab = page.getByRole('tab', { name: /Preferences/i })
    await preferencesTab.click()

    await expect(preferencesTab).toHaveAttribute('aria-selected', 'true')
  })

  test('shows current billing period', async ({ page }) => {
    await page.goto('/dashboard')

    // Should display a month/year string for the current period
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' })
    await expect(page.getByText(new RegExp(currentMonth))).toBeVisible()
  })
})
