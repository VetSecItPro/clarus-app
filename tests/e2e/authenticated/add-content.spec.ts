import { test, expect } from '@playwright/test'

test.beforeEach(async () => {
  if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
    test.skip(true, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required')
  }
})

test.describe('Add Content', () => {
  test('loads add content page with form', async ({ page }) => {
    await page.goto('/add-content')

    await expect(page.locator('h1:has-text("Add New Content")')).toBeVisible()
  })

  test('displays all required form fields', async ({ page }) => {
    await page.goto('/add-content')

    // Title input
    const titleInput = page.locator('#title')
    await expect(titleInput).toBeVisible()

    // URL input
    const urlInput = page.locator('#url')
    await expect(urlInput).toBeVisible()

    // Content type selector
    const typeSelect = page.locator('#type')
    await expect(typeSelect).toBeVisible()

    // Submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('submit button text says "Analyze Content"', async ({ page }) => {
    await page.goto('/add-content')

    await expect(page.locator('button[type="submit"]')).toContainText('Analyze Content')
  })

  test('shows optional full text textarea', async ({ page }) => {
    await page.goto('/add-content')

    const fullTextArea = page.locator('#fullText')
    await expect(fullTextArea).toBeVisible()
  })

  test('can fill in form fields', async ({ page }) => {
    await page.goto('/add-content')

    await page.locator('#title').fill('Test Article Title')
    await page.locator('#url').fill('https://example.com/test-article')

    await expect(page.locator('#title')).toHaveValue('Test Article Title')
    await expect(page.locator('#url')).toHaveValue('https://example.com/test-article')
  })

  test('URL validation prevents invalid URLs', async ({ page }) => {
    await page.goto('/add-content')

    const urlInput = page.locator('#url')
    await urlInput.fill('not-a-valid-url')

    // HTML5 validation should mark it invalid
    const isInvalid = await urlInput.evaluate(
      (el) => !(el as HTMLInputElement).validity.valid
    )
    expect(isInvalid).toBe(true)
  })
})
