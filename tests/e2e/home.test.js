import { test, expect } from '@playwright/test';

test('homepage loads with correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/TravelPlanInfo/i);
});

test('hero CTAs navigate to planner and destinations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Explore Destinations' }).click();
  await expect(page).toHaveURL(/destinations/);

  await page.goto('/');
  await page.getByRole('link', { name: 'Start Planning' }).click();
  await expect(page).toHaveURL(/planner|signin/);
});

test('TripModes section renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Trip Modes')).toBeVisible();
  await expect(page.getByRole('heading', { name: /travel energy/i })).toBeVisible();
});

test('Latest Articles section shows articles', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Latest Articles' })).toBeVisible();
  // At least one article link should be present
  const articleLinks = page.locator('a[href^="/"][href$="/"]').filter({ hasText: /\w/ });
  await expect(articleLinks.first()).toBeVisible();
});

test('hot-deals page loads with affiliate links', async ({ page }) => {
  await page.goto('/hot-deals');
  await expect(page).toHaveURL(/hot-deals/);
  const affiliateLinks = page.locator('a[rel*="sponsored"]');
  await expect(affiliateLinks.first()).toBeVisible();
});

test('footer renders on homepage', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer')).toBeVisible();
});
