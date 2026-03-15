import { test, expect } from '@playwright/test';
import { navigateTo } from './helpers';

test.describe('Error and empty states', () => {
  test('unknown route shows 404 or redirects gracefully', async ({ page }) => {
    const jsErrors: Error[] = [];
    page.on('pageerror', (err) => jsErrors.push(err));

    await navigateTo(page, '/this-route-definitely-does-not-exist');

    // App should not crash — body must be visible
    await expect(page.locator('body')).toBeVisible();

    // No Vite error overlay
    const errorOverlay = page.locator('vite-error-overlay');
    await expect(errorOverlay).toHaveCount(0);

    // No uncaught JS errors
    expect(jsErrors).toHaveLength(0);
  });

  test('deeply nested unknown route does not crash', async ({ page }) => {
    const jsErrors: Error[] = [];
    page.on('pageerror', (err) => jsErrors.push(err));

    await navigateTo(page, '/projects/fake-id/nonexistent-sub-route');

    await expect(page.locator('body')).toBeVisible();
    const errorOverlay = page.locator('vite-error-overlay');
    await expect(errorOverlay).toHaveCount(0);
    expect(jsErrors).toHaveLength(0);
  });

  test('/runs/non-existent-id handles missing run gracefully', async ({ page }) => {
    const jsErrors: Error[] = [];
    page.on('pageerror', (err) => jsErrors.push(err));

    await navigateTo(page, '/runs/non-existent-id');

    // Should not crash
    await expect(page.locator('body')).toBeVisible();
    const errorOverlay = page.locator('vite-error-overlay');
    await expect(errorOverlay).toHaveCount(0);
    expect(jsErrors).toHaveLength(0);

    // Page should show some content (empty state, error message, or layout)
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(0);
  });

  test('pages with no data show empty states, not broken layouts', async ({ page }) => {
    // Home page with no API data should show an empty state or loading indicator
    await navigateTo(page, '/');

    // The layout should remain intact (sidebar + main)
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('aside')).toHaveCount(1);

    // Page should have text content (even if it is an empty-state message)
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(0);
  });

  test('project pages with dummy project show content, not white screen', async ({ page }) => {
    const dummyProjectId = '00000000-0000-0000-0000-000000000001';
    const projectRoutes = ['health', 'components', 'schedules', 'analytics', 'environments'];

    for (const sub of projectRoutes) {
      const jsErrors: Error[] = [];
      page.on('pageerror', (err) => jsErrors.push(err));

      await navigateTo(page, `/projects/${dummyProjectId}/${sub}`);

      await expect(page.locator('body')).toBeVisible();
      const bodyText = await page.locator('body').textContent();
      expect(bodyText!.length).toBeGreaterThan(0);
      expect(jsErrors).toHaveLength(0);

      page.removeAllListeners('pageerror');
    }
  });

  test('network errors do not crash the app', async ({ page }) => {
    const jsErrors: Error[] = [];
    page.on('pageerror', (err) => jsErrors.push(err));

    // Intercept all API requests and abort them to simulate network failure
    await page.route('**/api/**', (route) => route.abort('connectionrefused'));

    await navigateTo(page, '/');

    // App should still render despite network failures
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();

    const errorOverlay = page.locator('vite-error-overlay');
    await expect(errorOverlay).toHaveCount(0);

    // No uncaught JS errors from network failures
    expect(jsErrors).toHaveLength(0);
  });

  test('aborting API calls mid-navigation does not crash', async ({ page }) => {
    const jsErrors: Error[] = [];
    page.on('pageerror', (err) => jsErrors.push(err));

    // Delay API responses so we can navigate away before they resolve
    await page.route('**/api/**', async (route) => {
      await new Promise((r) => setTimeout(r, 5000));
      route.abort();
    });

    await page.goto('/');
    // Navigate away immediately before API calls can resolve
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
    expect(jsErrors).toHaveLength(0);
  });
});
