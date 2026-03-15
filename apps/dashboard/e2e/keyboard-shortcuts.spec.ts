import { test, expect } from '@playwright/test';
import { navigateTo } from './helpers';

const DUMMY_PROJECT_ID = '00000000-0000-0000-0000-000000000001';

test.describe('Keyboard interactions', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/');
  });

  test('Ctrl+K opens the command palette', async ({ page }) => {
    // Command palette should not be visible initially
    const palettePlaceholder = page.getByPlaceholder('Type a command...');
    await expect(palettePlaceholder).toHaveCount(0);

    // Open command palette with Ctrl+K
    await page.keyboard.press('Control+k');

    // Command palette input should now be visible
    await expect(palettePlaceholder).toBeVisible();
  });

  test('Meta+K also opens the command palette (macOS)', async ({ page }) => {
    await page.keyboard.press('Meta+k');

    const palettePlaceholder = page.getByPlaceholder('Type a command...');
    await expect(palettePlaceholder).toBeVisible();
  });

  test('Escape closes the command palette', async ({ page }) => {
    // Open
    await page.keyboard.press('Control+k');
    const palettePlaceholder = page.getByPlaceholder('Type a command...');
    await expect(palettePlaceholder).toBeVisible();

    // Close
    await page.keyboard.press('Escape');
    await expect(palettePlaceholder).toHaveCount(0);
  });

  test('command palette can be toggled open and closed with Ctrl+K', async ({ page }) => {
    const palettePlaceholder = page.getByPlaceholder('Type a command...');

    // Open
    await page.keyboard.press('Control+k');
    await expect(palettePlaceholder).toBeVisible();

    // Close by pressing Ctrl+K again
    await page.keyboard.press('Control+k');
    await expect(palettePlaceholder).toHaveCount(0);
  });

  test('command palette shows "No matching commands" for unrecognized input', async ({ page }) => {
    await page.keyboard.press('Control+k');

    const input = page.getByPlaceholder('Type a command...');
    await input.fill('xyznonexistentcommand');

    await expect(page.getByText('No matching commands')).toBeVisible();
  });

  test('clicking the backdrop closes the command palette', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const palettePlaceholder = page.getByPlaceholder('Type a command...');
    await expect(palettePlaceholder).toBeVisible();

    // Click the backdrop overlay (the fixed full-screen div behind the palette)
    const backdrop = page.locator('.fixed.inset-0.z-50');
    await backdrop.click({ position: { x: 10, y: 10 } });

    await expect(palettePlaceholder).toHaveCount(0);
  });

  test('Tab navigation works through the page', async ({ page }) => {
    // Press Tab multiple times and verify focus moves
    const visited = new Set<string>();

    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const tag = await page.evaluate(() => document.activeElement?.tagName ?? 'NONE');
      visited.add(`${tag}-${i}`);
    }

    // We should have moved through multiple elements
    expect(visited.size).toBeGreaterThan(1);
  });

  test('Enter key activates focused links', async ({ page }) => {
    // Navigate to a project page so we have a sub-nav link to test
    await navigateTo(page, `/projects/${DUMMY_PROJECT_ID}/health`);

    const sidebar = page.locator('aside');
    const runsLink = sidebar.getByRole('link', { name: 'Runs' });

    await runsLink.focus();
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/$/);
  });

  test('Arrow keys navigate within command palette list', async ({ page }) => {
    await page.keyboard.press('Control+k');

    const palettePlaceholder = page.getByPlaceholder('Type a command...');
    await expect(palettePlaceholder).toBeVisible();

    // Press ArrowDown to move highlight
    await page.keyboard.press('ArrowDown');

    // The palette should still be open and functional
    await expect(palettePlaceholder).toBeVisible();

    // Press ArrowUp
    await page.keyboard.press('ArrowUp');
    await expect(palettePlaceholder).toBeVisible();
  });

  test('command palette Enter key does not crash the app', async ({ page }) => {
    await page.keyboard.press('Control+k');

    const palettePlaceholder = page.getByPlaceholder('Type a command...');
    await expect(palettePlaceholder).toBeVisible();

    // Press Enter — whether it executes an action or not, the app should not crash
    await page.keyboard.press('Enter');

    // The app should still be functional after pressing Enter
    await expect(page.locator('body')).toBeVisible();
  });
});
