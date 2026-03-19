import { test, expect } from '@playwright/test';

test('planner page renders for unauthenticated user', async ({ page }) => {
  await page.goto('/planner');
  const url = page.url();
  if (url.includes('signin')) {
    // Redirected to sign in
    await expect(page.locator('input[type="email"]')).toBeVisible();
  } else {
    // Shows TripForm preview + sign-in banner
    await expect(page.getByRole('heading', { name: /where are you going/i })).toBeVisible();
  }
});

test('/api/trips GET returns 401 without session', async ({ request }) => {
  const res = await request.get('/api/trips');
  expect(res.status()).toBe(401);
});

test('/api/trips POST returns 401 without session', async ({ request }) => {
  const res = await request.post('/api/trips', {
    data: { name: 'Test', destination: 'Miami' },
  });
  expect(res.status()).toBe(401);
});

test('/api/trips/1 PUT returns 401 without session', async ({ request }) => {
  const res = await request.put('/api/trips/1', {
    data: { name: 'Updated' },
  });
  expect(res.status()).toBe(401);
});
