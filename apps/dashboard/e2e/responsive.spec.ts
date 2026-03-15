import { test, expect, devices } from '@playwright/test';

test.describe('Responsive design', () => {
  test('dashboard renders correctly on mobile viewport', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 13'],
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
    await context.close();
  });

  test('dashboard renders correctly on tablet viewport', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPad Mini'],
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await context.close();
  });

  test('dashboard renders correctly on wide desktop', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 2560, height: 1440 },
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await context.close();
  });
});
