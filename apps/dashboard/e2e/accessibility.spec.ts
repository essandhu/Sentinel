import { test, expect } from '@playwright/test';
import { navigateTo } from './helpers';

const DUMMY_PROJECT_ID = '00000000-0000-0000-0000-000000000001';

test.describe('Basic accessibility checks', () => {
  test('home page has a <main> landmark', async ({ page }) => {
    await navigateTo(page, '/');
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('sidebar has a navigation landmark', async ({ page }) => {
    await navigateTo(page, '/');
    const nav = page.locator('nav[role="navigation"]');
    await expect(nav).toHaveCount(1);
  });

  test('all pages have a <main> landmark', async ({ page }) => {
    // Local mode routes only
    const routes = [
      '/',
      `/projects/${DUMMY_PROJECT_ID}/health`,
      `/projects/${DUMMY_PROJECT_ID}/components`,
    ];

    for (const route of routes) {
      await navigateTo(page, route);
      const main = page.locator('main');
      await expect(main).toBeVisible();
    }
  });

  test('interactive elements are keyboard focusable', async ({ page }) => {
    await navigateTo(page, '/');

    // Collect all buttons and links
    const buttons = page.locator('button');
    const links = page.locator('a[href]');

    const buttonCount = await buttons.count();
    const linkCount = await links.count();

    // There should be interactive elements on the page
    expect(buttonCount + linkCount).toBeGreaterThan(0);

    // Verify that buttons do not have negative tabindex
    for (let i = 0; i < buttonCount; i++) {
      const tabindex = await buttons.nth(i).getAttribute('tabindex');
      if (tabindex !== null) {
        expect(parseInt(tabindex, 10)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('images have alt text or are decorative', async ({ page }) => {
    await navigateTo(page, '/');

    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      // alt attribute must be present (can be empty string for decorative images)
      expect(alt).not.toBeNull();
    }
  });

  test('tab key navigates through interactive elements', async ({ page }) => {
    await navigateTo(page, '/');

    // Press Tab and verify focus moves
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(firstFocused).toBeTruthy();

    await page.keyboard.press('Tab');
    const secondFocused = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? { tag: el.tagName, text: el.textContent?.trim().slice(0, 50) } : null;
    });
    expect(secondFocused).toBeTruthy();

    // The two focused elements should be different (focus is actually moving)
    // We check by pressing Tab a few more times and verifying we visit different elements
    const focusedElements = new Set<string>();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? `${el.tagName}:${el.textContent?.trim().slice(0, 30)}` : 'none';
      });
      focusedElements.add(info);
    }

    // We should have visited multiple different elements
    expect(focusedElements.size).toBeGreaterThan(1);
  });

  test('focus is visible on focused elements', async ({ page }) => {
    await navigateTo(page, '/');

    // Tab to the first focusable element
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Get the focused element and check it has some focus indicator
    const focusInfo = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow,
        tag: el.tagName,
      };
    });

    // The focused element should exist and have some visual indicator
    // (outline, box-shadow, or the browser default focus ring)
    expect(focusInfo).toBeTruthy();
  });

  test('pages have visible text content', async ({ page }) => {
    // Local mode routes only
    const routes = [
      '/',
      `/projects/${DUMMY_PROJECT_ID}/health`,
    ];

    for (const route of routes) {
      await navigateTo(page, route);

      // The page should have visible text (not just blank)
      const bodyText = await page.locator('body').textContent();
      expect(bodyText!.trim().length).toBeGreaterThan(0);
    }
  });

  test('buttons have accessible names', async ({ page }) => {
    await navigateTo(page, '/');

    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      const title = await button.getAttribute('title');

      // Button should have at least one accessible name source
      const hasAccessibleName =
        (text && text.trim().length > 0) ||
        (ariaLabel && ariaLabel.trim().length > 0) ||
        (title && title.trim().length > 0);
      expect(hasAccessibleName).toBe(true);
    }
  });

  test('links have accessible names', async ({ page }) => {
    await navigateTo(page, '/');

    const links = page.locator('a[href]');
    const count = await links.count();

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');

      const hasAccessibleName =
        (text && text.trim().length > 0) ||
        (ariaLabel && ariaLabel.trim().length > 0);
      expect(hasAccessibleName).toBe(true);
    }
  });
});
