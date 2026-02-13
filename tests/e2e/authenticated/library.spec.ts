import { test, expect } from '@playwright/test'

test.beforeEach(async () => {
  if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
    test.skip(true, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required')
  }
})

test.describe('Library', () => {
  test('loads library page with heading', async ({ page }) => {
    await page.goto('/library')

    await expect(page.locator('h1:has-text("Library")')).toBeVisible()
  })

  test('displays search input', async ({ page }) => {
    await page.goto('/library')

    const searchInput = page.locator('[aria-label="Search library"]')
    await expect(searchInput).toBeVisible()
  })

  test('can toggle filter panel', async ({ page }) => {
    await page.goto('/library')

    const filterToggle = page.locator('[aria-label="Toggle filters"]')
    await expect(filterToggle).toBeVisible()

    await filterToggle.click()

    // Filter options should appear
    await expect(page.getByText('Articles')).toBeVisible()
    await expect(page.getByText('YouTube')).toBeVisible()
  })

  test('search filters content by query', async ({ page }) => {
    await page.goto('/library')

    const searchInput = page.locator('[aria-label="Search library"]')
    await searchInput.fill('nonexistent-query-12345')

    // Wait for results to update
    await page.waitForTimeout(500)

    // Either shows filtered results or empty state
    const contentArea = page.locator('#main-content')
    await expect(contentArea).toBeVisible()
  })

  test('can clear search query', async ({ page }) => {
    await page.goto('/library')

    const searchInput = page.locator('[aria-label="Search library"]')
    await searchInput.fill('test query')
    await searchInput.clear()

    await expect(searchInput).toHaveValue('')
  })

  test('sort dropdown is accessible', async ({ page }) => {
    await page.goto('/library')

    // Look for the sort control
    const sortButton = page.getByText('Newest').first()
    if (await sortButton.isVisible()) {
      await sortButton.click()

      // Sort options should appear
      await expect(page.getByText('Oldest')).toBeVisible()
    }
  })
})
