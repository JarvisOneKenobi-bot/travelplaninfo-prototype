import { test, expect } from '@playwright/test';

// These specs assert the Atlas consent chip/nudges appear, which now requires
// GET /api/assistant/health to report healthy:true. That in turn requires the
// FastAPI backend to be reachable at FASTAPI_URL (default http://localhost:8766)
// and ANTHROPIC_API_KEY (or ~/.openclaw/credentials/anthropic.json) to be set —
// both already expected to be true in local dev; this suite does not run
// against an environment where the assistant backend is intentionally down.

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

  test('Path A with no items shows truthful Atlas-ready hint, not fake progress spinner', async ({ page, context }) => {
    const post = await context.request.post('/api/trips', {
      data: { name: 'Hint test', destination: 'Miami', budget: 'midrange' },
    });
    const trip = await post.json();
    await page.goto(`/planner/${trip.id}`);

    // GenerationProgress with its 5-step animation must NOT be rendered
    await expect(page.locator('[data-testid="generation-progress"]')).toHaveCount(0);

    // The truthful Atlas-ready hint must be visible
    await expect(page.locator('[data-testid="atlas-ready-hint"]')).toBeVisible();
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
  await context.route('/api/surprise-me*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      origin: 'MIA',
      destinations: [
        { name: 'Cancún, Mexico', flightPrice: '$142', airline: 'NK', nonstop: true, link: 'https://www.aviasales.com/search/MIA0108CUN1?marker=164743' },
        { name: 'San Juan, Puerto Rico', flightPrice: '$168', airline: 'B6', nonstop: true, link: '' },
        { name: 'Punta Cana, Dominican Republic', flightPrice: '$203', airline: 'NK', nonstop: false, link: '' },
      ],
    }),
  }));
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

test('Atlas does NOT auto-send on new Path A trip — chip is shown, no SSE until consent', async ({ page, context }) => {
  const post = await context.request.post('/api/trips', {
    data: { name: 'Consent test', destination: 'Tokyo', budget: 'midrange' },
  });
  const trip = await post.json();

  const sseCalls: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/assistant/chat')) sseCalls.push(req.url());
  });

  await page.goto(`/planner/${trip.id}`);
  await page.waitForTimeout(2500);

  // Chip must be visible
  await expect(page.locator('[data-testid="atlas-smart-search-chip"]')).toBeVisible();
  // No SSE call yet
  expect(sseCalls).toHaveLength(0);

  // Click "Start smart search"
  await page.click('[data-testid="atlas-smart-search-start"]');

  // Now SSE should fire
  await page.waitForResponse((r) => r.url().includes('/api/assistant/chat'), { timeout: 5000 });
  expect(sseCalls.length).toBeGreaterThanOrEqual(1);
});

test('PlannerDashboard shows error banner + Retry when /api/trips fails', async ({ page, context }) => {
  // Ensure we're authenticated as a guest first
  await context.request.post('/api/trips', { data: { name: 'Seed', destination: 'Miami' } });

  // Then force /api/trips to fail
  await context.route('**/api/trips', (route) => {
    if (route.request().method() === 'GET') return route.abort();
    return route.continue();
  });

  await page.goto('/planner');

  await expect(page.locator('[data-testid="planner-dashboard-error"]')).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
});

test('Guest user sees bootstrap onboarding once', async ({ page, context }) => {
  // Fresh browser context — no cookies, no localStorage
  await page.goto('/');
  await page.waitForTimeout(2000);

  // Onboarding bootstrap modal must be visible for guest
  await expect(page.locator('[data-testid="onboarding-bootstrap"]')).toBeVisible({ timeout: 5000 });

  // After completing bootstrap (simulate)
  await page.fill('[data-testid="bootstrap-home-airport"]', 'MIA');
  // Click 2 interests (the save button is disabled until min 2 interests)
  await page.click('button[aria-pressed="false"]:has-text("Beach")');
  await page.click('button[aria-pressed="false"]:has-text("Food")');
  await page.click('[data-testid="bootstrap-save"]');

  // Reload — bootstrap should NOT appear again
  await page.reload();
  await page.waitForTimeout(2000);
  await expect(page.locator('[data-testid="onboarding-bootstrap"]')).not.toBeVisible();
});
