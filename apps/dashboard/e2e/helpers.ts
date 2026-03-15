import { type Page } from '@playwright/test';

export async function waitForAppReady(page: Page) {
  await page.waitForLoadState('networkidle');
}

export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await waitForAppReady(page);
}
