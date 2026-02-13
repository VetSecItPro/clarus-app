import { test, expect } from '@playwright/test'

test.beforeEach(async () => {
  if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
    test.skip(true, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required')
  }
})

test.describe('Account', () => {
  test('loads account page with heading', async ({ page }) => {
    await page.goto('/account')

    await expect(page.locator('h1:has-text("Account")')).toBeVisible()
  })

  test('shows all account sections', async ({ page }) => {
    await page.goto('/account')

    // Export section
    await expect(page.getByText('Export Your Data')).toBeVisible()

    // Subscription section
    await expect(page.getByText('Subscription & Billing')).toBeVisible()

    // Delete section
    await expect(page.getByText('Delete Account')).toBeVisible()

    // Privacy section
    await expect(page.getByText('Your Privacy Rights')).toBeVisible()
  })

  test('export data button is visible', async ({ page }) => {
    await page.goto('/account')

    await expect(page.getByText('Download My Data')).toBeVisible()
  })

  test('shows subscription tier info', async ({ page }) => {
    await page.goto('/account')

    // Should show one of the tier names
    const tiers = ['Free', 'Starter', 'Pro', 'Day Pass']
    const hasTier = await Promise.any(
      tiers.map(async (tier) => {
        const count = await page.getByText(tier, { exact: false }).count()
        return count > 0
      })
    ).catch(() => false)

    expect(hasTier).toBeTruthy()
  })

  test('delete account requires confirmation', async ({ page }) => {
    await page.goto('/account')

    // Click delete account button
    await page.getByText('Delete My Account').click()

    // Confirmation UI should appear
    await expect(page.locator('[placeholder="Type DELETE"]')).toBeVisible()
    await expect(page.getByText('Confirm Delete')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  test('can cancel delete account', async ({ page }) => {
    await page.goto('/account')

    // Open delete confirmation
    await page.getByText('Delete My Account').click()
    await expect(page.locator('[placeholder="Type DELETE"]')).toBeVisible()

    // Click cancel
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Confirmation should disappear
    await expect(page.locator('[placeholder="Type DELETE"]')).not.toBeVisible()
  })

  test('has back navigation link', async ({ page }) => {
    await page.goto('/account')

    const backLink = page.locator('[aria-label="Back to home"]')
    await expect(backLink).toBeVisible()
  })
})
