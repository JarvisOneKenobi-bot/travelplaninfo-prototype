import { test, expect } from '@playwright/test';

const TEST_PASSWORD = 'TestPass123!';

test('register new user and redirect to planner', async ({ page }) => {
  const email = `test-${Date.now()}@e2e.travelplaninfo.com`;
  await page.goto('/register');
  await page.getByPlaceholder('Your name').fill('E2E Test User');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  // Must accept terms checkbox
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL(/planner/, { timeout: 15000 });
});

test('sign in with valid credentials redirects to planner', async ({ page, request }) => {
  const email = `signin-${Date.now()}@e2e.travelplaninfo.com`;
  await request.post('/api/register', {
    data: { email, password: TEST_PASSWORD, name: 'Sign In Test' },
  });

  await page.goto('/signin');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/planner/, { timeout: 15000 });
});

test('sign in with wrong password shows error', async ({ page }) => {
  await page.goto('/signin');
  await page.getByPlaceholder('you@example.com').fill('nobody@example.com');
  await page.locator('input[type="password"]').fill('wrongpassword');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(
    page.locator('text=Invalid').or(page.locator('text=credentials')).or(page.locator('text=incorrect'))
  ).toBeVisible({ timeout: 8000 });
});

test('protected planner redirects or shows sign-in CTA when unauthenticated', async ({ page }) => {
  await page.goto('/planner');
  const url = page.url();
  if (url.includes('signin')) {
    await expect(page.locator('input[type="email"]')).toBeVisible();
  } else {
    await expect(page.getByRole('link', { name: 'Sign in to start planning' })).toBeVisible();
  }
});
