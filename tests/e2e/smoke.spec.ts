import { test, expect } from '@playwright/test'

test.describe('Smoke Tests', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login')

    // Check page heading (use first() since logo appears in both desktop and mobile)
    await expect(page.locator('text=Truth Checker').first()).toBeVisible()

    // Check email input exists
    await expect(page.locator('input[type="email"]')).toBeVisible()

    // Check password input exists
    await expect(page.locator('input[type="password"]')).toBeVisible()

    // Check login button exists
    await expect(page.locator('button:has-text("Sign in")')).toBeVisible()
  })

  test('signup page loads correctly', async ({ page }) => {
    await page.goto('/signup')

    // Check page heading (use first() since logo appears in both desktop and mobile)
    await expect(page.locator('text=Truth Checker').first()).toBeVisible()

    // Check email input exists
    await expect(page.locator('input[type="email"]')).toBeVisible()

    // Check signup button exists
    await expect(page.locator('button:has-text("Create account")')).toBeVisible()
  })

  test('pricing page loads correctly', async ({ page }) => {
    await page.goto('/pricing')

    // Check pricing content is visible
    await expect(page.locator('text=Pro')).toBeVisible()
  })

  test('forgot password page loads correctly', async ({ page }) => {
    await page.goto('/forgot-password')

    // Check page loads with email input
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })
})

test.describe('Navigation', () => {
  test('can navigate from login to signup', async ({ page }) => {
    await page.goto('/login')

    // Find and click signup link ("Create one")
    await page.click('a:has-text("Create one")')

    // Verify we're on signup page
    await expect(page).toHaveURL(/.*signup/)
  })

  test('can navigate from signup to login', async ({ page }) => {
    await page.goto('/signup')

    // Find and click login link ("Sign in")
    await page.click('a:has-text("Sign in")')

    // Verify we're on login page
    await expect(page).toHaveURL(/.*login/)
  })
})
