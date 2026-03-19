import { test, expect } from '@playwright/test';

test('guides page loads with articles', async ({ page }) => {
  await page.goto('/guides');
  await expect(page.getByRole('heading', { name: /travel guides/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'All Guides' })).toBeVisible();
});

test('guides page category filter buttons work', async ({ page }) => {
  await page.goto('/guides');
  await page.getByRole('button', { name: 'Destinations' }).click();
  await expect(page.getByRole('button', { name: 'Destinations' })).toHaveClass(/bg-teal-700/);
});

test('article page renders with title and breadcrumb', async ({ page }) => {
  await page.goto('/travel-planning-vs-booking/');
  // Use the page-level h1 (the article template title, first h1 in main)
  await expect(page.locator('main').locator('h1').first()).toBeVisible();
  // Breadcrumb nav (first nav in main)
  await expect(page.locator('main nav').getByRole('link', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('link', { name: /back to all articles/i })).toBeVisible();
});

test('article page has affiliate sidebar on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/travel-planning-vs-booking/');
  await expect(page.locator('a[rel*="sponsored"]').first()).toBeVisible();
});

test('sitemap.xml returns valid XML with article URLs', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('<urlset');
  expect(body).toContain('travel-planning-vs-booking');
});

test('newsletter API accepts valid email', async ({ request }) => {
  const email = `newsletter-${Date.now()}@e2e.test`;
  const res = await request.post('/api/newsletter', {
    data: { email, source: 'e2e-test' },
  });
  expect(res.status()).toBe(201);
});

test('newsletter API rejects duplicate email with 409', async ({ request }) => {
  const email = `dup-${Date.now()}@e2e.test`;
  await request.post('/api/newsletter', { data: { email, source: 'e2e-test' } });
  const res = await request.post('/api/newsletter', { data: { email, source: 'e2e-test' } });
  expect(res.status()).toBe(409);
});
