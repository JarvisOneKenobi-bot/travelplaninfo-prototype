/**
 * Guest Flow E2E Tests — TravelPlanInfo
 *
 * Tests the complete guest user lifecycle:
 *   1. Guest trip creation (no auth required)
 *   2. Adding items to a guest trip
 *   3. Save nudge item count verification via API
 *   4. Full lifecycle: guest trip → register → verify merge
 *
 * Implementation notes:
 *   - The app uses next-intl with localePrefix: "as-needed" — /planner serves the en locale
 *     directly from src/app/[locale]/planner/page.tsx
 *   - With no session, /planner shows a bare TripForm (no PlannerDashboard)
 *   - POSTing to /api/trips calls getOrCreateGuest(), which sets tpi_guest + tpi_guest_hint
 *     cookies and returns 201 with trip JSON including `id`
 *   - After trip creation, TripForm calls router.push(`/planner/${trip.id}`)
 *   - ItineraryBuilder auto-populates 3 placeholder items (flight, hotel, car) for a new trip
 *   - PlannerDashboard calls /api/auth/merge-guest after login when tpi_guest_hint cookie exists
 *
 * NOTE: The app's dev server must be running on the port configured in playwright.config.ts
 *   (defaults to http://localhost:3001). Run: npm run dev -- --port 3001
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Fill and submit the TripForm shown on /planner for unauthenticated visitors. */
async function createGuestTrip(
  page: Page,
  context: BrowserContext,
  opts: { destination?: string; tripName?: string } = {}
) {
  const destination = opts.destination ?? 'Miami, Florida';
  const tripName    = opts.tripName    ?? `E2E Test Trip ${Date.now()}`;

  await context.clearCookies();

  // Navigate to planner — next-intl middleware handles locale prefix internally
  await page.goto('/planner', { waitUntil: 'domcontentloaded' });

  // Wait for client-side hydration — the TripForm renders via React client component
  // The TripForm's "Where are you going?" section is an h2 inside a form
  // Use a broader locator to avoid SSR/hydration timing issues
  await page.waitForLoadState('networkidle');

  // The unauthenticated /planner page renders TripForm directly (no PlannerDashboard)
  // Step 1 — Departing from (required field — airport code input with placeholder)
  const originInput = page.getByPlaceholder('Airport code (e.g., MIA, JFK, LAX)');
  await expect(originInput).toBeVisible({ timeout: 15_000 });
  await originInput.fill('MIA');

  // Step 2 — Destination (required field)
  await page.getByPlaceholder('e.g., Miami, Florida').fill(destination);

  // Trip name (optional field)
  await page.getByPlaceholder('Trip name (optional)').fill(tripName);

  // Step 3 — Dates: leave as-is (both date fields are optional)

  // Submit — "Start Planning" button (the submit button in TripForm)
  const submitBtn = page.getByRole('button', { name: /start planning/i });
  await expect(submitBtn).toBeEnabled({ timeout: 8_000 });
  await submitBtn.click();

  // Wait for redirect to /planner/{id}
  await page.waitForURL(/\/planner\/\d+/, { timeout: 20_000 });

  return page.url();
}

/** Extract the numeric tripId from a /planner/{id} URL. */
function extractTripId(url: string): string {
  const m = url.match(/\/planner\/(\d+)/);
  if (!m) throw new Error(`Could not extract tripId from URL: ${url}`);
  return m[1];
}

// ─── Test 1: Guest trip creation ─────────────────────────────────────────────

test('Test 1: guest trip creation sets cookies and redirects to /planner/{id}', async ({
  page,
  context,
}) => {
  const tripUrl = await createGuestTrip(page, context, {
    destination: 'Miami, Florida',
    tripName: `Guest Create Test ${Date.now()}`,
  });

  // 1a. URL should be /planner/{numeric id}
  expect(tripUrl).toMatch(/\/planner\/\d+$/);

  // 1b. tpi_guest and tpi_guest_hint cookies must be present
  const cookies = await context.cookies();
  const cookieNames = cookies.map(c => c.name);

  expect(cookieNames).toContain('tpi_guest');
  expect(cookieNames).toContain('tpi_guest_hint');

  // 1c. Trip detail page renders — wait for h1 heading (trip name)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });
});

// ─── Test 2: Guest adds an item to their trip ────────────────────────────────

test('Test 2: guest sees auto-populated placeholders and can add a manual item', async ({
  page,
  context,
}) => {
  await createGuestTrip(page, context, {
    destination: 'Barcelona, Spain',
    tripName: `Guest Items Test ${Date.now()}`,
  });

  // Auto-population: ItineraryBuilder POSTs flight/hotel/car items on first load.
  // Wait for them to appear — each shows a category badge chip.
  // ItineraryBuilder uses category metadata: flight="Flight", hotel="Hotel / Accommodation", car="Car Rental"
  await expect(
    page.getByText('Flight', { exact: false })
  ).toBeVisible({ timeout: 15_000 });

  await expect(
    page.getByText('Hotel / Accommodation', { exact: false })
  ).toBeVisible();

  await expect(
    page.getByText('Car Rental', { exact: false })
  ).toBeVisible();

  // Add a manual item via the "+ Add item" button in Day 1 header
  // The button text is exactly "+ Add item" per ItineraryBuilder.tsx line 423
  const addItemBtn = page.getByText('+ Add item').first();
  await addItemBtn.click();

  // The multi-layer category dropdown appears — click "Note / Reminder"
  // per CATEGORIES array in ItineraryBuilder.tsx
  await page.getByText('Note / Reminder').click();

  // The inline add-item form is now shown — fill in the Title field (placeholder "Title *")
  await page.getByPlaceholder('Title *').fill('My Custom Note');

  // Submit the inline form with "Add Item" button
  await page.getByRole('button', { name: /add item/i }).click();

  // Verify the new item appears in the itinerary
  await expect(page.getByText('My Custom Note')).toBeVisible({ timeout: 8_000 });
});

// ─── Test 3: Save nudge API check — items.length >= 3 ────────────────────────

test('Test 3: after guest trip creation, GET /api/trips/{tripId} returns >= 3 items', async ({
  page,
  context,
  request,
}) => {
  await createGuestTrip(page, context, {
    destination: 'Tokyo, Japan',
    tripName: `Save Nudge Test ${Date.now()}`,
  });

  const tripId = extractTripId(page.url());

  // Wait for auto-population to finish (items render in the UI) before hitting the API
  await expect(
    page.getByText('Flight', { exact: false })
  ).toBeVisible({ timeout: 15_000 });

  // Retrieve cookies from the browser context to attach to the API request
  const browserCookies = await context.cookies();
  const cookieHeader = browserCookies
    .map(c => `${c.name}=${c.value}`)
    .join('; ');

  // Call the API with the guest session cookies
  const res = await request.get(`/api/trips/${tripId}`, {
    headers: { Cookie: cookieHeader },
  });

  expect(res.status()).toBe(200);

  const data = await res.json();
  expect(Array.isArray(data.items)).toBe(true);
  expect(data.items.length).toBeGreaterThanOrEqual(3);
});

// ─── Test 4: Full lifecycle — guest trip → register → merge ──────────────────

test('Test 4: guest trip is merged after registration and appears in /planner', async ({
  page,
  context,
}) => {
  const tripName  = `Merge Test Trip ${Date.now()}`;
  const testEmail = `e2e-test-${Date.now()}@test.local`;
  const testPass  = 'TestPassword123!';

  // 4a. Create a guest trip
  await createGuestTrip(page, context, {
    destination: 'Paris, France',
    tripName,
  });

  // Confirm tpi_guest_hint cookie is set (required for merge to trigger)
  const cookiesBefore = await context.cookies();
  expect(cookiesBefore.map(c => c.name)).toContain('tpi_guest_hint');

  // 4b. Navigate to /register
  await page.goto('/register', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  // Registration form fields (from register/page.tsx):
  //   - Name: label "Name", placeholder "Your name"
  //   - Email: label "Email", placeholder "you@example.com"
  //   - Password: label "Password", placeholder "••••••••"
  //   - Terms checkbox: required before submit
  await page.getByPlaceholder('Your name').fill('E2E Test User');
  await page.getByPlaceholder('you@example.com').fill(testEmail);
  await page.getByPlaceholder('••••••••').fill(testPass);

  // Terms checkbox — label text wraps a checkbox input
  await page.getByRole('checkbox').check();

  // 4c. Intercept the merge-guest call before submitting
  // PlannerDashboard fires POST /api/auth/merge-guest after login if tpi_guest_hint is present
  const mergeGuestPromise = page.waitForResponse(
    r => r.url().includes('/api/auth/merge-guest'),
    { timeout: 25_000 }
  );

  // 4d. Submit registration — triggers auto sign-in then router.push('/planner')
  await page.getByRole('button', { name: /create account/i }).click();

  // 4e. Wait for navigation to /planner
  await page.waitForURL(/\/planner/, { timeout: 25_000 });

  // 4f. Wait for merge-guest API call to complete
  await mergeGuestPromise;

  // 4g. PlannerDashboard calls window.location.reload() when merged > 0.
  // After reload the trip list shows the guest trip.
  // Wait for the trip name to appear
  await expect(page.getByText(tripName, { exact: false })).toBeVisible({
    timeout: 20_000,
  });
});
