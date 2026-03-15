import { test, expect } from '@playwright/test';
import { navigateTo } from './helpers';

test.describe('Theme', () => {
  test('app uses dark mode by default', async ({ page }) => {
    await navigateTo(page, '/');

    const hasDarkClass = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(hasDarkClass).toBe(true);
  });

  test('dark mode persists across navigation', async ({ page }) => {
    await navigateTo(page, '/');

    const hasDarkBefore = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(hasDarkBefore).toBe(true);

    await navigateTo(page, '/settings');

    const hasDarkAfter = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(hasDarkAfter).toBe(true);
  });

  test('body has visible content in dark mode', async ({ page }) => {
    await navigateTo(page, '/');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(0);
  });
});
