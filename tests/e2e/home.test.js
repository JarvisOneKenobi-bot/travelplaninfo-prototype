import { test, expect } from '@playwright/test';

const BASE = 'https://travelplaninfo-proto.vercel.app';

test('homepage loads with correct title', async ({ page }) => {
  await page.goto(BASE);
  await expect(page).toHaveTitle(/Plan your next trip/i);
});

test('homepage has stats row', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('text=Active Trips')).toBeVisible();
  await expect(page.locator('text=Saved Destinations')).toBeVisible();
  await expect(page.locator('text=Draft Itineraries')).toBeVisible();
});

test('homepage has featured destinations', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByRole('heading', { name: 'Miami Beach' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cancún' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New York City' })).toBeVisible();
});

test('homepage has hot deals section', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('text=Miami Beach Hotels')).toBeVisible();
  await expect(page.locator('text=Miami Vacation Rentals')).toBeVisible();
});

test('homepage has curated itineraries', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('text=3 Days in Miami')).toBeVisible();
  await expect(page.locator('text=5-Day Caribbean Cruise')).toBeVisible();
  await expect(page.locator('text=Florida Keys Road Trip')).toBeVisible();
});

test('homepage has latest guides', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByRole('heading', { name: /tourist traps/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Budgeting a weekend/ })).toBeVisible();
});

test('hot-deals route loads', async ({ page }) => {
  await page.goto(BASE + '/hot-deals/');
  await expect(page).toHaveURL(/hot-deals/);
});
