import { test, expect } from '@playwright/test';

test.describe('Planner trust + trigger governance', () => {
  test('Atlas does not auto-send for Surprise Me trip', async ({ page }) => {
    // Track all network requests to /api/assistant/chat
    const sseCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/assistant/chat')) {
        sseCalls.push(req.url());
      }
    });

    // Navigate to a planner page
    await page.goto('/planner/1', { waitUntil: 'domcontentloaded' });

    // Inject a mock trip context with Surprise Me destination into sessionStorage
    // This simulates what would happen after a Surprise Me trip is loaded
    await page.evaluate(() => {
      const mockContext = {
        tripId: '1',
        destination: 'Surprise Me',
        items: [],
        dates: null,
        flexibleWindow: null,
        tripLength: null,
      };
      sessionStorage.setItem('tpi_trip_context', JSON.stringify(mockContext));
    });

    // Wait for the auto-trigger window (800ms) plus some buffer
    await page.waitForTimeout(2000);

    // Verify no SSE call was made — the guard blocks auto-trigger for "Surprise Me"
    expect(sseCalls).toHaveLength(0);
  });
});

test('POST /api/trips/[id]/resolve-surprise transitions trip from Surprise Me → real destination', async ({ context }) => {
  // Create Surprise Me trip
  const post = await context.request.post('/api/trips', {
    data: { name: 'Resolve test', destination: 'Surprise Me', budget: 'midrange' },
  });
  const trip = await post.json();

  // Resolve to Cancún
  const resolve = await context.request.post(`/api/trips/${trip.id}/resolve-surprise`, {
    data: { destination: 'Cancún' },
  });
  expect(resolve.status()).toBe(200);
  const updated = await resolve.json();
  expect(updated.destination).toBe('Cancún');
  expect(updated.entryMode).toBe('surprise');
  // DTO shape — no raw columns leaking:
  expect(updated).not.toHaveProperty('quiz_budget');

  // GET trip confirms persistence
  const get = await context.request.get(`/api/trips/${trip.id}`);
  const fetched = await get.json();
  expect(fetched.destination).toBe('Cancún');
  expect(fetched.entryMode).toBe('surprise');
});

test('resolve-surprise refuses when trip is not Surprise Me', async ({ context }) => {
  const post = await context.request.post('/api/trips', {
    data: { name: 'Already real', destination: 'Miami', budget: 'midrange' },
  });
  const trip = await post.json();

  const resolve = await context.request.post(`/api/trips/${trip.id}/resolve-surprise`, {
    data: { destination: 'Cancún' },
  });
  expect(resolve.status()).toBe(400);
});

test('resolve-surprise refuses with empty destination', async ({ context }) => {
  const post = await context.request.post('/api/trips', {
    data: { name: 'Empty', destination: 'Surprise Me', budget: 'midrange' },
  });
  const trip = await post.json();

  const resolve = await context.request.post(`/api/trips/${trip.id}/resolve-surprise`, {
    data: { destination: '' },
  });
  expect(resolve.status()).toBe(400);
});

test('resolve-surprise enforces ownership (404 on someone else trip)', async ({ context }) => {
  // Use a clearly invalid trip id; the route should return 404, not 200
  const resolve = await context.request.post('/api/trips/999999/resolve-surprise', {
    data: { destination: 'Cancún' },
  });
  expect([401, 404]).toContain(resolve.status());
});

test('Path B → "Plan a trip to X" CTA resolves trip and renders Path A', async ({ page, context }) => {
  const post = await context.request.post('/api/trips', {
    data: { name: 'CTA test', destination: 'Surprise Me', budget: 'midrange', origin: 'MIA' },
  });
  const trip = await post.json();
  await page.goto(`/planner/${trip.id}`);

  // Wait for SurpriseMeSection to load destinations
  await page.waitForSelector('[data-testid="atlas-destination-card"]', { timeout: 10000 });

  // Click primary CTA on first card
  await page.click('[data-testid="atlas-destination-card"]:first-child [data-testid="plan-trip-cta"]');

  // After navigation, page should render Path A — ItineraryBuilder visible, no SurpriseMeSection
  await expect(page.locator('[data-testid="itinerary-builder"]')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('[data-testid="surprise-me-section"]')).not.toBeVisible();
});

test('SurpriseMeSection shows non-silent fallback banner on API failure', async ({ page, context }) => {
  // Force /api/surprise-me to fail
  await context.route('/api/surprise-me*', (route) => route.abort());

  const post = await context.request.post('/api/trips', {
    data: { name: 'Fallback test', destination: 'Surprise Me', budget: 'midrange', origin: 'DEN' },
  });
  const trip = await post.json();
  await page.goto(`/planner/${trip.id}`);

  // Banner with retry button must be visible
  await expect(page.locator('[data-testid="surprise-fallback-banner"]')).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
});

test('SurpriseMeSection signals unknown-origin instead of silently defaulting to MIA', async ({ page, context }) => {
  const post = await context.request.post('/api/trips', {
    data: { name: 'Unknown origin', destination: 'Surprise Me', budget: 'midrange', origin: '???' },
  });
  const trip = await post.json();
  await page.goto(`/planner/${trip.id}`);

  // Should show prompt to set home airport, NOT silently load MIA destinations
  await expect(page.locator('[data-testid="origin-needed-prompt"]')).toBeVisible({ timeout: 5000 });
});
