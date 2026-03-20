import { test, expect } from '@playwright/test';
import { navigateTo } from './helpers';

const DUMMY_PROJECT_ID = '00000000-0000-0000-0000-000000000001';

test.describe('Sidebar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/');
  });

  test('sidebar contains Runs navigation link', async ({ page }) => {
    const sidebar = page.locator('aside');
    const nav = sidebar.locator('nav[role="navigation"]');
    await expect(nav).toHaveCount(1);

    // Runs link is always visible in local mode
    await expect(sidebar.getByRole('link', { name: 'Runs' })).toBeVisible();
  });

  test('clicking Runs link navigates to runs page', async ({ page }) => {
    // Start on a project page so we can navigate away
    await navigateTo(page, `/projects/${DUMMY_PROJECT_ID}/health`);

    const sidebar = page.locator('aside');
    await sidebar.getByRole('link', { name: 'Runs' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/runs$/);
  });

  test('active route link has distinct styling', async ({ page }) => {
    await navigateTo(page, '/runs');
    const sidebar = page.locator('aside');
    const runsLink = sidebar.getByRole('link', { name: 'Runs' });

    // On runs page, Runs link should have the active accent color
    const runsClass = await runsLink.getAttribute('class');
    expect(runsClass).toContain('s-accent');
  });

  test('sidebar is present on all main pages', async ({ page }) => {
    // Local mode routes only
    const routes = ['/', `/projects/${DUMMY_PROJECT_ID}/health`];

    for (const route of routes) {
      await navigateTo(page, route);
      const aside = page.locator('aside');
      await expect(aside).toHaveCount(1);
    }
  });

  // Note: project-scoped sub-nav links (Health, Components, Analytics) only
  // appear when the API returns projects matching the active route's projectId.
  // Without a running backend + seeded data, these links won't render.
  // These are covered by the Sidebar unit tests instead.

  test('project page renders layout even with unknown project', async ({ page }) => {
    await navigateTo(page, `/projects/${DUMMY_PROJECT_ID}/health`);

    // Layout should still render even without matching project data
    const aside = page.locator('aside');
    await expect(aside).toHaveCount(1);
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('sidebar shows branding text', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar.getByText('Sentinel', { exact: true })).toBeVisible();
  });
});
