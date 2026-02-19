import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('home page loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Resume Matcher|Power Resume/i);
  });

  test('dashboard page loads correctly', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('builder page loads correctly', async ({ page }) => {
    await page.goto('/builder');
    await expect(page).toHaveURL(/.*builder/);
  });

  test('settings page loads correctly', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/.*settings/);
  });
});
