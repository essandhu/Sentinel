import { test, expect } from '@playwright/test';

test.describe('Dashboard navigation', () => {
  test('navigating between pages updates the URL', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('browser back button works after navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test('direct URL access works for all main routes', async ({ page }) => {
    const routes = ['/', '/settings'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).toBeVisible();
      const errorOverlay = page.locator('vite-error-overlay');
      await expect(errorOverlay).toHaveCount(0);
    }
  });
});
