import { test, expect } from '@playwright/test';
import { navigateTo } from './helpers';

const DUMMY_PROJECT_ID = '00000000-0000-0000-0000-000000000001';

// Local mode routes only (no /settings, /schedules, /environments)
const ALL_ROUTES = [
  { name: 'Runs (home)', path: '/' },
  { name: 'Health', path: `/projects/${DUMMY_PROJECT_ID}/health` },
  { name: 'Components', path: `/projects/${DUMMY_PROJECT_ID}/components` },
  { name: 'Analytics', path: `/projects/${DUMMY_PROJECT_ID}/analytics` },
];

test.describe('All dashboard pages load without crashing', () => {
  for (const route of ALL_ROUTES) {
    test(`${route.name} page (${route.path}) loads successfully`, async ({ page }) => {
      const jsErrors: Error[] = [];
      page.on('pageerror', (err) => jsErrors.push(err));

      await navigateTo(page, route.path);

      // No Vite error overlay
      const errorOverlay = page.locator('vite-error-overlay');
      await expect(errorOverlay).toHaveCount(0);

      // Body is visible and has content
      await expect(page.locator('body')).toBeVisible();
      const bodyText = await page.locator('body').textContent();
      expect(bodyText!.length).toBeGreaterThan(0);

      // No uncaught JS errors
      expect(jsErrors).toHaveLength(0);
    });
  }

  test('all pages render the shared layout (sidebar and main area)', async ({ page }) => {
    for (const route of ALL_ROUTES) {
      await navigateTo(page, route.path);

      // The DashboardLayout always renders a <main> element
      const main = page.locator('main');
      await expect(main).toBeVisible();

      // The sidebar <aside> element exists in the DOM
      const aside = page.locator('aside');
      await expect(aside).toHaveCount(1);
    }
  });

  test('Diff page with dummy runId does not crash', async ({ page }) => {
    const jsErrors: Error[] = [];
    page.on('pageerror', (err) => jsErrors.push(err));

    await navigateTo(page, '/runs/00000000-0000-0000-0000-000000000099');

    const errorOverlay = page.locator('vite-error-overlay');
    await expect(errorOverlay).toHaveCount(0);
    await expect(page.locator('body')).toBeVisible();
    expect(jsErrors).toHaveLength(0);
  });
});
