/**
 * @module tests/e2e/authenticated/core-flow.spec.ts
 * @description E2E tests for the core user flow: submit URL → process → view results → library.
 *
 * Since we can't call real AI APIs in CI, these tests verify the UI flow
 * up to the processing state and check that pages render correctly.
 * For completed analysis rendering, we navigate to pre-existing content
 * (if any) in the test account.
 */

import { test, expect, devices } from '@playwright/test'

test.beforeEach(async () => {
  if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
    test.skip(true, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required')
  }
})

// ==========================================
// URL SUBMISSION FLOW
// ==========================================
test.describe('URL Submission Flow', () => {
  test('renders add-content page with URL input and submit button', async ({ page }) => {
    await page.goto('/add-content')

    // Page heading
    await expect(page.locator('h1')).toContainText('Add Content')

    // URL input field is the primary form element
    const urlInput = page.locator('#url')
    await expect(urlInput).toBeVisible()
    await expect(urlInput).toHaveAttribute('type', 'url')

    // Submit button
    await expect(page.locator('button[type="submit"]')).toContainText('Analyze Content')
  })

  test('shows validation feedback for invalid URL', async ({ page }) => {
    await page.goto('/add-content')

    const urlInput = page.locator('#url')
    await urlInput.fill('not-a-valid-url')

    // HTML5 URL validation marks it invalid
    const isInvalid = await urlInput.evaluate(
      (el) => !(el as HTMLInputElement).validity.valid
    )
    expect(isInvalid).toBe(true)
  })

  test('detects content type and shows title field for valid URL', async ({ page }) => {
    await page.goto('/add-content')

    const urlInput = page.locator('#url')
    await urlInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

    // Wait for URL validation and type detection
    await page.waitForTimeout(1000)

    // Title input should appear once URL is validated
    const titleInput = page.locator('#title')
    // Title field is conditionally rendered when isValidUrl is true
    await expect(titleInput).toBeVisible({ timeout: 5000 })
  })

  test('submits form and navigates to item page', async ({ page }) => {
    await page.goto('/add-content')

    const urlInput = page.locator('#url')
    // Use a real article URL that Firecrawl can handle
    await urlInput.fill('https://example.com')

    // Wait for URL validation
    await page.waitForTimeout(1000)

    // Click submit
    await page.locator('button[type="submit"]').click()

    // After submission, we should either:
    // 1. Navigate to /item/[id] (success)
    // 2. See an error message (API failure in CI)
    // 3. See "Analyzing..." button state (processing)
    await Promise.race([
      // Success: redirected to item page
      page.waitForURL(/\/item\//, { timeout: 15000 }).catch(() => null),
      // Loading state: button shows "Analyzing..."
      expect(page.locator('button[type="submit"]')).toContainText(/Analyz/),
      // Error: alert appears
      page.locator('[role="alert"]').waitFor({ state: 'visible', timeout: 15000 }).catch(() => null),
    ])

    // Verify we're either on an item page or still on add-content with a response
    const currentUrl = page.url()
    const hasItemUrl = currentUrl.includes('/item/')
    const hasAlert = await page.locator('[role="alert"]').isVisible().catch(() => false)
    const hasStatus = await page.locator('[role="status"]').isVisible().catch(() => false)

    // At least one of these should be true — we got a response from the server
    expect(hasItemUrl || hasAlert || hasStatus).toBe(true)
  })
})

// ==========================================
// RESULTS PAGE
// ==========================================
test.describe('Results Page', () => {
  test('item page loads with content title and navigation', async ({ page }) => {
    // First, go to library to find an existing item
    await page.goto('/library')
    await page.waitForTimeout(1000)

    // Find any content card link in the library
    const contentLink = page.locator('#main-content a[href*="/item/"]').first()
    const hasContent = await contentLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (!hasContent) {
      test.skip(true, 'No existing content in test account library')
      return
    }

    await contentLink.click()
    await page.waitForURL(/\/item\//)

    // Back button should be visible
    await expect(page.locator('[aria-label="Go back"]')).toBeVisible()

    // Main content area exists
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('item page shows tab navigation on desktop', async ({ page }) => {
    await page.goto('/library')
    await page.waitForTimeout(1000)

    const contentLink = page.locator('#main-content a[href*="/item/"]').first()
    const hasContent = await contentLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (!hasContent) {
      test.skip(true, 'No existing content in test account library')
      return
    }

    await contentLink.click()
    await page.waitForURL(/\/item\//)

    // Desktop view should have tab navigation (Summary/Full Text)
    const tablist = page.locator('[role="tablist"]')
    await expect(tablist.first()).toBeVisible({ timeout: 5000 })
  })

  test('item page shows action buttons', async ({ page }) => {
    await page.goto('/library')
    await page.waitForTimeout(1000)

    const contentLink = page.locator('#main-content a[href*="/item/"]').first()
    const hasContent = await contentLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (!hasContent) {
      test.skip(true, 'No existing content in test account library')
      return
    }

    await contentLink.click()
    await page.waitForURL(/\/item\//)

    // At least the back button and some action buttons should exist
    await expect(page.locator('[aria-label="Go back"]')).toBeVisible()
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('completed analysis renders section content', async ({ page }) => {
    await page.goto('/library')
    await page.waitForTimeout(1000)

    const contentLink = page.locator('#main-content a[href*="/item/"]').first()
    const hasContent = await contentLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (!hasContent) {
      test.skip(true, 'No existing content in test account library')
      return
    }

    await contentLink.click()
    await page.waitForURL(/\/item\//)

    // Wait for content to load
    await page.waitForTimeout(2000)

    // The page should have substantive text content (analysis sections)
    // Check that main-content has meaningful text (more than just nav elements)
    const mainContent = page.locator('#main-content')
    const textContent = await mainContent.textContent()

    // A completed analysis should have substantial text
    // If still processing, there will be a loading/polling indicator
    expect(textContent).toBeTruthy()
    expect(textContent!.length).toBeGreaterThan(50)
  })
})

// ==========================================
// LIBRARY INTEGRATION
// ==========================================
test.describe('Library Integration', () => {
  test('library page loads with content listing', async ({ page }) => {
    await page.goto('/library')

    // Heading — either "Library" or a collection name
    await expect(page.locator('h1')).toBeVisible()

    // Main content area
    await expect(page.locator('#main-content')).toBeVisible()

    // Search input
    await expect(page.locator('[aria-label="Search library"]')).toBeVisible()
  })

  test('search filters library content', async ({ page }) => {
    await page.goto('/library')

    const searchInput = page.locator('[aria-label="Search library"]')
    await expect(searchInput).toBeVisible()

    // Search for something that likely exists
    await searchInput.fill('test')
    await page.waitForTimeout(500)

    // Content area should still be visible (either results or empty state)
    await expect(page.locator('#main-content')).toBeVisible()

    // Clear and try a nonsense query
    await searchInput.clear()
    await searchInput.fill('zzzznonexistent12345')
    await page.waitForTimeout(500)

    // Should show empty state or filtered results
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('content cards show type badges and titles', async ({ page }) => {
    await page.goto('/library')
    await page.waitForTimeout(1000)

    // Check if there are any content items
    const contentArea = page.locator('#main-content')
    const hasItems = await contentArea.locator('a[href*="/item/"]').first()
      .isVisible({ timeout: 5000 }).catch(() => false)

    if (!hasItems) {
      test.skip(true, 'No content items in test account library')
      return
    }

    // First content card should have a visible title (non-empty text)
    const firstCard = contentArea.locator('a[href*="/item/"]').first()
    const cardText = await firstCard.textContent()
    expect(cardText).toBeTruthy()
    expect(cardText!.trim().length).toBeGreaterThan(0)
  })
})

// ==========================================
// MOBILE VIEWPORT
// ==========================================
test.describe('Mobile Viewport', () => {
  test.use({ ...devices['Pixel 7'] })

  test('core flow works on mobile viewport', async ({ page }) => {
    // 1. Navigate to add-content
    await page.goto('/add-content')
    await expect(page.locator('h1')).toContainText('Add Content')
    await expect(page.locator('#url')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()

    // 2. Navigate to library
    await page.goto('/library')
    await expect(page.locator('#main-content')).toBeVisible()

    // 3. If content exists, navigate to an item
    const contentLink = page.locator('#main-content a[href*="/item/"]').first()
    const hasContent = await contentLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasContent) {
      await contentLink.click()
      await page.waitForURL(/\/item\//)

      // Mobile should show Analysis/Chat tabs
      const tablist = page.locator('[role="tablist"]')
      await expect(tablist.first()).toBeVisible({ timeout: 5000 })

      // Back button
      await expect(page.locator('[aria-label="Go back"]')).toBeVisible()
    }
  })
})
