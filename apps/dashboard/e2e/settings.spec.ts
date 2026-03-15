import { test, expect } from '@playwright/test';
import { navigateTo } from './helpers';

// Settings page is only available in cloud mode.
// In local mode, verify that navigating to /settings doesn't crash.
test.describe('Settings page (local mode)', () => {
  test('navigating to /settings does not crash the app', async ({ page }) => {
    const jsErrors: Error[] = [];
    page.on('pageerror', (err) => jsErrors.push(err));

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // App should not throw JS errors
    expect(jsErrors).toHaveLength(0);
  });

  test('app remains functional after visiting unknown route', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Navigate to a valid route — app should still work
    await navigateTo(page, '/');
    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(0);
  });
});
