# Planner Trust + Atlas Trigger Governance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the planner's "trust" gaps (fake progress, silent fallbacks, missing Surprise Me resolution) and replace scattered auto-trigger timers with a single consent-gated Atlas trigger governance state machine.

**Architecture:**
- Add a DTO layer at the trips API boundary so we stop leaking raw `SELECT *` shapes and unblock future schema cleanup.
- Add a dedicated `POST /api/trips/[id]/resolve-surprise` endpoint that atomically transitions Path B → Path A.
- Replace `GenerationProgress`'s fake spinner with truthful "Atlas is searching" state.
- Consolidate all Atlas auto-trigger/idle-nudge behavior into a single `useAtlasTrigger` hook backed by a small state machine, with consent gating before any network work.
- Lift error-state silence in `PlannerDashboard` and `SurpriseMeSection`.
- Split `OnboardingModal` into a guest-eligible bootstrap phase and an auth-only full phase.

**Tech Stack:** Next.js 16.2.6 (App Router) · next-intl 4.12.0 · React · TypeScript · better-sqlite3 · Playwright (e2e) · **vitest (new, for unit tests)**

---

## Plan-review fixes applied (2026-05-27)

`feature-dev:code-reviewer` ran a pre-implementation review and found:
1. **i18n file structure** — The repo has exactly one message file per locale: `messages/{locale}/common.json` (6 locales: en, de, es, fr, it, pt). All namespaces are top-level keys inside that one file. Every step in this plan that referenced creating `messages/en/X.json` has been changed to "merge keys under namespace X into `messages/{locale}/common.json` for ALL 6 locales".
2. **OnboardingModal preservation** — The existing `OnboardingModal.tsx` has a 3-step authenticated flow (airport → budget tier → interests) using `useTranslations("onboarding")`. Task 9 has been restructured to create a NEW `BootstrapModal.tsx` for guests; `OnboardingModal.tsx` is left UNTOUCHED. `OnboardingWrapper.tsx` chooses between them based on auth state.
3. **Locale-aware redirects** — Task 4's `window.location.href = '/planner/${tripId}'` would hit the stub route. Replaced with the repo's typed next-intl router from `@/i18n/navigation`.
4. **`buildAutoSearchPrompt(ctx)` extracted verbatim** — Task 7's prompt helper now includes the full 25-line block from `AssistantChat.tsx:837-861` instead of "extracted from the original".
5. **Returning-user guard preserved** — Task 7's `useAtlasTrigger` was missing the `messagesLenRef.current === 0` guard from the original auto-trigger. Added as a `hasPriorMessages` argument to `enterTripContext`.
6. **`window.__atlasFormContext` typed** — Added a `declare global` block to `src/lib/atlas-trigger-state.ts` so strict TypeScript doesn't reject the access.
7. **`NextResponse.json` for consistency** — All Task 1 / Task 3 / Task 8 endpoint snippets now use `NextResponse.json` (the existing route pattern).

> **Reviewer noted but DEFERRED:** the `createPortal`-into-DOM-slot pattern in Task 7 is acceptable for shipping but architecturally smelly (state lives in `AssistantChat` while visual home lives in the trip page). A follow-up refactor with a locale-layout React Context provider is the cleaner long-term shape. Tracked in Task 7's deferred-work note.

---

**Canonical references (read before starting):**
- `docs/audits/2026-05-27-planner-functionality-consensus-gpt55.md` — final consensus (sprint scope, acceptance criteria)
- `docs/audits/2026-05-27-planner-functionality-audit.md` — v3 audit with file:line evidence
- `memory/feedback_tpi_planner_section_design.md` — locked design rules (don't remove EntryTabs/SurpriseMeQuiz)
- `memory/feedback_planner_ux_northstar.md` — UX north star from 2026-03-24

---

## File Structure

### New files
- `src/lib/dto/trip.ts` — `toTripDto`, `toTripDetailDto`, `toTripsListDto` + `TripDto` / `TripDetailDto` types
- `src/lib/dto/trip.test.ts` — vitest unit tests for DTO converters
- `src/app/api/trips/[id]/resolve-surprise/route.ts` — atomic Surprise Me → real-destination resolution
- `src/lib/atlas-trigger-state.ts` — pure-function state machine for Atlas consent/idle/nudge transitions
- `src/lib/atlas-trigger-state.test.ts` — vitest unit tests for the state machine
- `src/hooks/useAtlasTrigger.ts` — React hook that wraps the state machine, exposes `requestSmartSearch()`, idle subscriptions, and consent state
- `src/components/AtlasSmartSearchChip.tsx` — non-blocking "Start smart search / Not yet" chip
- `src/components/PlannerErrorBanner.tsx` — reusable banner for Surprise Me + PlannerDashboard error states
- `tests/e2e/planner-trust.spec.ts` — e2e: Path B → resolve → Path A, fallback banner, no-auto-send-without-consent
- `vitest.config.ts` — vitest configuration

### Modified files
- `package.json` — add `vitest` + `test:unit` script
- `src/components/GenerationProgress.tsx` — DELETE (replaced by truthful inline messaging)
- `src/app/[locale]/planner/[tripId]/page.tsx:131` — replace `<GenerationProgress>` with inline "Atlas-ready" hint
- `src/app/api/trips/route.ts:5-16, 108-131` — wrap GET list and POST response in DTO
- `src/app/api/trips/[id]/route.ts:9, 29-63` — wrap GET/PUT response in DTO; PUT continues to NOT accept `entry_mode` (resolution goes through the dedicated route)
- `src/components/SurpriseMeSection.tsx` — fallback banner, unknown-origin handling, wire "Plan a trip to X" CTA via `onResolveDestination`
- `src/components/AtlasHeroSection.tsx` — add primary "Plan a trip to X" button per destination card
- `src/components/AssistantChat.tsx:813-870` — remove 800ms auto-trigger; replace with consent-gated `useAtlasTrigger`
- `src/hooks/useAtlasBubble.ts:125-142` — extend idle timer to `pageContext === 'planner'` with section-aware messages
- `src/components/TripForm.tsx` — verify/update `window.__atlasFormContext` + `atlas-interaction` events so trigger state machine can detect "no meaningful progress"
- `src/components/PlannerDashboard.tsx` — update DTO field names in Task 1, then add error state + Retry in Task 8
- `src/components/OnboardingWrapper.tsx` — remove guest auth gate
- `src/components/BootstrapModal.tsx` — NEW guest bootstrap; `OnboardingModal.tsx` stays untouched
- `src/app/[locale]/planner/[tripId]/page.tsx:63` — possibly drop `max-w-[90rem]` after QA gate

### Deleted files (preflight passes)
- `src/components/InterestsModal.tsx` — confirmed orphan (0 file importers)

---

## Sequencing rationale

- **Task 0 → 1** are foundational (vitest + DTO layer). Everything else builds on the DTO at API edges.
- **Task 2** is a one-line guard that ships P0-CODEX-1 immediately. Subsumed harmlessly by Task 7 later.
- **Tasks 3 + 4** ship the Surprise Me resolution flow (endpoint + UI CTA). They're paired but split for review granularity.
- **Task 5** ships Surprise Me fallback banner + unknown-origin handling. UI-only.
- **Task 6** removes the misleading `GenerationProgress` spinner.
- **Task 7** is the largest single task — the trigger governance state machine. Replaces Task 2's guard with the proper version.
- **Tasks 8–10** are independent polish/cleanup.

---

## Task 0: Bootstrap vitest for unit tests

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Test: N/A (this is infra)

- [ ] **Step 1: Install vitest as devDependency**

```bash
npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 3: Add `test:unit` and `test` scripts to `package.json`**

Modify `scripts` to add:

```json
"test:unit": "vitest run",
"test:unit:watch": "vitest",
"test": "npm run test:unit && npm run test:e2e"
```

- [ ] **Step 4: Verify vitest runs (no tests yet)**

```bash
npm run test:unit
```

Expected: `No test files found. exit 0` because `passWithNoTests: true` is set in `vitest.config.ts`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: bootstrap vitest for unit tests"
```

---

## Task 1: Trip DTO layer (foundational)

**Files:**
- Create: `src/lib/dto/trip.ts`
- Create: `src/lib/dto/trip.test.ts`
- Modify: `src/app/api/trips/route.ts` (GET list + POST response)
- Modify: `src/app/api/trips/[id]/route.ts` (GET single + PUT response)

**Why:** Stop leaking `SELECT *` shape to clients. Prerequisite for future quiz-column drop. GPT-5.5 made this a hard requirement.

- [ ] **Step 1: Write the failing test for `toTripDto`**

Create `src/lib/dto/trip.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { toTripDto, toTripDetailDto } from './trip';

describe('toTripDto', () => {
  it('maps DB row to public-facing TripDto', () => {
    const row = {
      id: 1, user_id: 42, name: 'My trip', destination: 'Cancún',
      start_date: '2026-06-01', end_date: '2026-06-08',
      budget: 'midrange', travelers_adults: 2, travelers_children: 0, rooms: 1,
      interests: '["beach","vibe:chill"]', status: 'planning',
      budget_override: null, trip_type: 'round_trip',
      want_hotel: 1, want_car: 0, want_limo: 0, want_activities: 1,
      budget_mode: 'preset', budget_amount: null, budget_categories: null,
      origin: 'MIA', nearby_airports: '["MIA","FLL","PBI"]',
      flexible_window: null, trip_length: null, entry_mode: 'direct',
      // Quiz columns should NOT leak into DTO:
      quiz_budget: 'low', quiz_vibes: '[]', quiz_when: null, quiz_who: null,
      quiz_group_size: 1, group_share: 0, group_costsplit: 0, group_consensus: 0,
      origin_auto: null,
      created_at: '2026-05-27T10:00:00Z', updated_at: '2026-05-27T10:00:00Z',
    };

    const dto = toTripDto(row);

    expect(dto.id).toBe(1);
    expect(dto.destination).toBe('Cancún');
    expect(dto.interests).toEqual(['beach', 'vibe:chill']);
    expect(dto.nearbyAirports).toEqual(['MIA', 'FLL', 'PBI']);
    expect(dto.entryMode).toBe('direct');
    // Quiz columns MUST NOT be present:
    expect('quiz_budget' in dto).toBe(false);
    expect('group_share' in dto).toBe(false);
    expect('origin_auto' in dto).toBe(false);
  });

  it('returns empty array for malformed interests JSON', () => {
    const row = { id: 1, name: 't', destination: 'x', interests: 'not-json' } as any;
    expect(toTripDto(row).interests).toEqual([]);
  });

  it('returns null for missing nearby_airports', () => {
    const row = { id: 1, name: 't', destination: 'x', nearby_airports: null } as any;
    expect(toTripDto(row).nearbyAirports).toBeNull();
  });
});

describe('toTripDetailDto', () => {
  it('combines trip row + items array', () => {
    const row = { id: 1, name: 't', destination: 'Cancún', interests: '[]', nearby_airports: null } as any;
    const items = [
      { id: 10, trip_id: 1, day_number: 1, category: 'flight', title: 'AA123',
        description: null, price_estimate: '$250', booked: 0, sort_order: 0,
        latitude: null, longitude: null, place_id: null, is_placeholder: 0,
        estimated_cost: 250, affiliate_program: null, affiliate_url: null },
    ];
    const detail = toTripDetailDto(row, items);
    expect(detail.id).toBe(1);
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0].priceEstimate).toBe('$250');
    expect(detail.items[0].estimatedCost).toBe(250);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:unit
```

Expected: FAIL — `Cannot find module './trip'` or similar import error.

- [ ] **Step 3: Implement `src/lib/dto/trip.ts`**

```typescript
// Trip DTOs — public-facing shapes returned by trip API endpoints.
// Stops leaking raw `SELECT *` shape (incl. dead quiz_*/group_* columns).

export interface TripDto {
  id: number;
  userId: number;
  name: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  budget: string | null;
  travelersAdults: number;
  travelersChildren: number;
  rooms: number;
  interests: string[];
  status: string;
  budgetOverride: number | null;
  tripType: string;
  wantHotel: boolean;
  wantCar: boolean;
  wantLimo: boolean;
  wantActivities: boolean;
  budgetMode: string;
  budgetAmount: number | null;
  budgetCategories: Record<string, number> | null;
  origin: string | null;
  nearbyAirports: string[] | null;
  flexibleWindow: string | null;
  tripLength: string | null;
  entryMode: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripItemDto {
  id: number;
  tripId: number;
  dayNumber: number;
  category: string;
  title: string;
  description: string | null;
  priceEstimate: string | null;
  booked: boolean;
  sortOrder: number;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  isPlaceholder: boolean;
  estimatedCost: number | null;
  affiliateProgram: string | null;
  affiliateUrl: string | null;
}

export interface TripDetailDto extends TripDto {
  items: TripItemDto[];
}

function safeJsonArray(s: unknown): string[] {
  if (typeof s !== 'string') return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeJsonArrayOrNull(s: unknown): string[] | null {
  if (s === null || s === undefined) return null;
  if (typeof s !== 'string') return null;
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function safeJsonObject(s: unknown): Record<string, number> | null {
  if (s === null || s === undefined) return null;
  if (typeof s !== 'string') return null;
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function toTripDto(row: any): TripDto {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    destination: row.destination,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    budget: row.budget ?? null,
    travelersAdults: row.travelers_adults ?? 1,
    travelersChildren: row.travelers_children ?? 0,
    rooms: row.rooms ?? 1,
    interests: safeJsonArray(row.interests),
    status: row.status ?? 'planning',
    budgetOverride: row.budget_override ?? null,
    tripType: row.trip_type ?? 'round_trip',
    wantHotel: Boolean(row.want_hotel),
    wantCar: Boolean(row.want_car),
    wantLimo: Boolean(row.want_limo),
    wantActivities: Boolean(row.want_activities),
    budgetMode: row.budget_mode ?? 'preset',
    budgetAmount: row.budget_amount ?? null,
    budgetCategories: safeJsonObject(row.budget_categories),
    origin: row.origin ?? null,
    nearbyAirports: safeJsonArrayOrNull(row.nearby_airports),
    flexibleWindow: row.flexible_window ?? null,
    tripLength: row.trip_length ?? null,
    entryMode: row.entry_mode ?? 'direct',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toTripItemDto(row: any): TripItemDto {
  return {
    id: row.id,
    tripId: row.trip_id,
    dayNumber: row.day_number ?? 1,
    category: row.category ?? 'note',
    title: row.title,
    description: row.description ?? null,
    priceEstimate: row.price_estimate ?? null,
    booked: Boolean(row.booked),
    sortOrder: row.sort_order ?? 0,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    placeId: row.place_id ?? null,
    isPlaceholder: Boolean(row.is_placeholder),
    estimatedCost: row.estimated_cost ?? null,
    affiliateProgram: row.affiliate_program ?? null,
    affiliateUrl: row.affiliate_url ?? null,
  };
}

export function toTripDetailDto(row: any, items: any[]): TripDetailDto {
  return { ...toTripDto(row), items: items.map(toTripItemDto) };
}

export function toTripsListDto(rows: any[]): TripDto[] {
  return rows.map(toTripDto);
}
```

- [ ] **Step 4: Run unit test to verify it passes**

```bash
npm run test:unit
```

Expected: 3 tests pass (toTripDto × 3, toTripDetailDto × 1).

- [ ] **Step 5: Wire DTO into `GET /api/trips`**

Modify `src/app/api/trips/route.ts` lines 5-16:

Replace:
```typescript
export async function GET() {
  const ctx = await getUserId();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const rows = getDb().prepare('SELECT * FROM trips WHERE user_id = ? ORDER BY created_at DESC').all(ctx.userId);
  return NextResponse.json(rows);
}
```

With:
```typescript
import { toTripsListDto } from '@/lib/dto/trip';
// (keep existing imports)

export async function GET() {
  const ctx = await getUserId();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const rows = getDb().prepare('SELECT * FROM trips WHERE user_id = ? ORDER BY created_at DESC').all(ctx.userId) as any[];
  return NextResponse.json(toTripsListDto(rows));
}
```

- [ ] **Step 6: Wire DTO into `POST /api/trips`**

In the same file at the POST handler (around line 108-131), change the `return NextResponse.json(trip, { status: 201 });` to:

```typescript
return NextResponse.json(toTripDto(trip), { status: 201 });
```

(Where `trip` is the row returned after `INSERT ... RETURNING *`.)

- [ ] **Step 7: Wire DTO into `GET /api/trips/[id]` and PUT**

Modify `src/app/api/trips/[id]/route.ts`:

```typescript
import { toTripDetailDto, toTripDto } from '@/lib/dto/trip';
// (keep existing imports)

// In GET:
const trip = db.prepare('SELECT * FROM trips WHERE id = ? AND user_id = ?').get(id, ctx.userId) as any;
if (!trip) return NextResponse.json({ error: 'not_found' }, { status: 404 });
const items = db.prepare('SELECT * FROM trip_items WHERE trip_id = ? ORDER BY day_number, sort_order').all(id) as any[];
return NextResponse.json(toTripDetailDto(trip, items));

// In PUT (after the UPDATE statement):
const updated = db.prepare('SELECT * FROM trips WHERE id = ?').get(id) as any;
return NextResponse.json(toTripDto(updated));
```

- [ ] **Step 8: Update the `/api/trips` consumer before tests**

Because `GET /api/trips` now returns camelCase DTO fields, update `src/components/PlannerDashboard.tsx` in the same task. Do not wait for Task 8; otherwise the dashboard can break immediately after Task 1.

Change the local `Trip` interface from snake_case to the DTO shape used by `toTripDto`:

```typescript
interface Trip {
  id: number;
  name: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  budget: string | null;
  status: string;
  createdAt: string;
}
```

Update render references:

```typescript
(trip.startDate || trip.endDate)
trip.startDate && new Date(trip.startDate).toLocaleDateString(...)
trip.endDate && new Date(trip.endDate).toLocaleDateString(...)
```

Keep `trip.id`, `trip.name`, `trip.destination`, `trip.status`, and `trip.budget` unchanged.

- [ ] **Step 8: Add Playwright integration test confirming DTO shape**

Append to `tests/e2e/planner.test.js` (or create a new `tests/e2e/trip-api-dto.spec.ts`):

```typescript
import { test, expect } from '@playwright/test';

test('GET /api/trips returns DTO shape — no quiz_/group_/origin_auto columns leak', async ({ request }) => {
  // Set up: this test assumes ability to authenticate as a guest. Use the
  // existing guest cookie flow — POST a trip first to create the guest, then GET.
  const post = await request.post('/api/trips', {
    data: { name: 'DTO test', destination: 'Miami', budget: 'midrange' },
  });
  expect([200, 201]).toContain(post.status());
  const created = await post.json();

  // Created DTO must use camelCase fields, not snake_case:
  expect(created).toHaveProperty('id');
  expect(created).toHaveProperty('destination', 'Miami');
  expect(created).toHaveProperty('entryMode');
  expect(created).not.toHaveProperty('user_id');
  expect(created).not.toHaveProperty('quiz_budget');
  expect(created).not.toHaveProperty('group_share');
  expect(created).not.toHaveProperty('origin_auto');
});
```

- [ ] **Step 9: Run all tests**

```bash
npm run test:unit && npm run test:e2e -- --grep "DTO"
```

Expected: All pass.

- [ ] **Step 10: Commit**

```bash
git add src/lib/dto/ src/app/api/trips/route.ts src/app/api/trips/\[id\]/route.ts tests/e2e/
git commit -m "feat(api): add Trip DTO layer + stop SELECT * leak"
```

---

## Task 2: Atlas auto-trigger guard for Surprise Me (P0-CODEX-1)

**Files:**
- Modify: `src/components/AssistantChat.tsx` (auto-trigger guard around lines 813-870)
- Test: `tests/e2e/planner-trust.spec.ts` (new file)

**Why:** Atlas currently auto-sends "I just created a trip to Surprise Me. Search flights, hotels, and activities for me." to itself on Path B, producing noisy/low-quality results. Quick one-line guard fix; supersedes itself when Task 7 lands.

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/planner-trust.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Planner trust + trigger governance', () => {
  test('Atlas does not auto-send for Surprise Me trip', async ({ page, context }) => {
    // Create a Surprise Me trip via API
    const post = await context.request.post('/api/trips', {
      data: { name: 'Surprise test', destination: 'Surprise Me', budget: 'midrange' },
    });
    const trip = await post.json();

    // Listen for the Atlas SSE call — it should NOT happen automatically
    const sseCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/assistant/chat')) sseCalls.push(req.url());
    });

    await page.goto(`/planner/${trip.id}`);

    // Wait 2 seconds — longer than the 800ms auto-trigger window
    await page.waitForTimeout(2000);

    expect(sseCalls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:e2e -- --grep "does not auto-send for Surprise Me"
```

Expected: FAIL — the SSE call IS made.

- [ ] **Step 3: Add the guard in `AssistantChat.tsx`**

Find the auto-trigger condition around line 822-823 (search for the block that checks `ctx.destination && ctx.destination !== "your destination"`). Modify the condition to also exclude `"Surprise Me"`:

```typescript
// Before:
if (
  ctx.tripId &&
  ctx.destination &&
  ctx.destination !== "your destination" &&
  /* ...other guards */
) {

// After:
if (
  ctx.tripId &&
  ctx.destination &&
  ctx.destination !== "your destination" &&
  ctx.destination !== "Surprise Me" &&
  /* ...other guards */
) {
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:e2e -- --grep "does not auto-send for Surprise Me"
```

Expected: PASS — no SSE call within 2s.

- [ ] **Step 5: Commit**

```bash
git add src/components/AssistantChat.tsx tests/e2e/planner-trust.spec.ts
git commit -m "fix(atlas): skip auto-trigger for Surprise Me destination (P0-CODEX-1)"
```

---

## Task 3: Surprise Me resolution endpoint

**Files:**
- Create: `src/app/api/trips/[id]/resolve-surprise/route.ts`
- Test: append to `tests/e2e/planner-trust.spec.ts`

**Why:** Path B trip is permanently stuck at `destination="Surprise Me"`. We need atomic transition to Path A. PUT route is intentionally NOT extended (per GPT-5.5 — dedicated endpoint cleaner).

- [ ] **Step 1: Write the failing e2e test**

Append to `tests/e2e/planner-trust.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:e2e -- --grep "resolve-surprise"
```

Expected: FAIL — route does not exist, 404 from Next router.

- [ ] **Step 3: Create the route**

Create `src/app/api/trips/[id]/resolve-surprise/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/guest';
import { getDb } from '@/lib/db';
import { toTripDto } from '@/lib/dto/trip';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'invalid_trip_id' }, { status: 400 });
  }

  const ctx = await getUserId();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  const destination = typeof body?.destination === 'string' ? body.destination.trim() : '';
  if (!destination) {
    return NextResponse.json({ error: 'destination_required' }, { status: 400 });
  }
  if (destination === 'Surprise Me') {
    return NextResponse.json({ error: 'destination_must_be_real' }, { status: 400 });
  }
  if (destination.length > 200) {
    return NextResponse.json({ error: 'destination_too_long' }, { status: 400 });
  }

  const db = getDb();
  const trip = db.prepare('SELECT * FROM trips WHERE id = ? AND user_id = ?').get(id, ctx.userId) as any;
  if (!trip) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (trip.destination !== 'Surprise Me') {
    return NextResponse.json({ error: 'not_surprise_me_trip' }, { status: 400 });
  }

  // Atomic write: destination + entry_mode='surprise' + updated_at
  const now = new Date().toISOString();
  db.prepare(`UPDATE trips
              SET destination = ?, entry_mode = 'surprise', updated_at = ?
              WHERE id = ? AND user_id = ?`)
    .run(destination, now, id, ctx.userId);

  const updated = db.prepare('SELECT * FROM trips WHERE id = ?').get(id) as any;
  return NextResponse.json(toTripDto(updated));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:e2e -- --grep "resolve-surprise"
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/trips/\[id\]/resolve-surprise/ tests/e2e/planner-trust.spec.ts
git commit -m "feat(api): add POST /api/trips/[id]/resolve-surprise"
```

---

## Task 4: Wire "Plan a trip to X" CTA in SurpriseMeSection + AtlasHeroSection

**Files:**
- Modify: `src/components/AtlasHeroSection.tsx` (add primary CTA prop + button per card)
- Modify: `src/components/SurpriseMeSection.tsx` (handler that calls resolve-surprise + navigates)
- Modify: i18n messages — merge `planTripTo` under the existing `atlasHero` namespace in `messages/{locale}/common.json` for all 6 locales
- Test: append to `tests/e2e/planner-trust.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

Append to `tests/e2e/planner-trust.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:e2e -- --grep "Plan a trip to X"
```

Expected: FAIL — selectors don't exist yet.

- [ ] **Step 3: Add `data-testid` to existing components**

Modify `src/components/SurpriseMeSection.tsx` — wrap the outer `<div className="space-y-6">` with `data-testid="surprise-me-section"`:

```typescript
<div className="space-y-6" data-testid="surprise-me-section">
```

Modify `src/components/ItineraryBuilder.tsx` — add `data-testid="itinerary-builder"` to the outermost wrapper element.

Modify `src/components/AtlasHeroSection.tsx` — add `data-testid="atlas-destination-card"` to each destination card root element.

- [ ] **Step 4: Add `onResolveDestination` prop + button to `AtlasHeroSection.tsx`**

Update the props interface to add:

```typescript
interface AtlasHeroSectionProps {
  // ...existing props...
  onResolveDestination: (index: number) => void;
}
```

In the card JSX (the destination card mapper around the existing "Tell me more" button), add a primary CTA BEFORE the secondary "Tell me more":

```typescript
<button
  type="button"
  data-testid="plan-trip-cta"
  onClick={() => onResolveDestination(index)}
  className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-orange-700 transition-colors"
>
  {t('planTripTo', { destination: dest.name })}
</button>
{/* existing "Tell me more" button as secondary */}
```

- [ ] **Step 5: Add the i18n key**

The repo has exactly one message file per locale: `messages/{locale}/common.json`. The `atlasHero` namespace is already a top-level key inside each `common.json` (around line 473 of `messages/en/common.json`).

Add `planTripTo` under the existing `atlasHero` namespace in **all 6 locale files**: `messages/en/common.json`, `messages/de/common.json`, `messages/es/common.json`, `messages/fr/common.json`, `messages/it/common.json`, `messages/pt/common.json`.

Example for `messages/en/common.json`:

```json
"atlasHero": {
  /* ...existing keys... */
  "planTripTo": "Plan a trip to {destination}"
}
```

Translations for the other 5 locales:
- de: `"Plane eine Reise nach {destination}"`
- es: `"Planea un viaje a {destination}"`
- fr: `"Planifier un voyage à {destination}"`
- it: `"Pianifica un viaggio a {destination}"`
- pt: `"Planejar uma viagem para {destination}"`

- [ ] **Step 6: Wire the handler in `SurpriseMeSection.tsx`**

At the top of the component, import the repo's typed next-intl router. This repo exposes it from `src/i18n/navigation.ts` (not `next-intl/client`, which is not used here):

```typescript
import { useRouter } from "@/i18n/navigation";
```

Add new state + handler:

```typescript
const router = useRouter();
const [resolving, setResolving] = useState(false);
const [resolveError, setResolveError] = useState<string | null>(null);

async function handleResolveDestination(index: number) {
  const dest = destinations[index];
  if (!dest) return;
  setResolving(true);
  try {
    const res = await fetch(`/api/trips/${tripId}/resolve-surprise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: dest.name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setResolveError(err.error || 'Could not resolve destination');
      setResolving(false);
      return;
    }
    // Locale-aware navigation: the typed router from @/i18n/navigation honors localePrefix='as-needed'.
    router.push(`/planner/${tripId}`);
    router.refresh(); // server re-renders with new destination → Path A branch takes over
  } catch (e) {
    setResolveError('Network error');
    setResolving(false);
  }
}
```

Add `tripId: number` to `SurpriseMeSectionProps` and update the caller (`[locale]/planner/[tripId]/page.tsx` Path B branch) to pass it.

Pass `onResolveDestination={handleResolveDestination}` to `<AtlasHeroSection>`.

Show error inline (above the cards) if `resolveError`:

```typescript
{resolveError && (
  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
    {resolveError}
    <button onClick={() => setResolveError(null)} className="ml-2 underline">Dismiss</button>
  </div>
)}
```

- [ ] **Step 7: Pass `tripId` from server-rendered page**

In `src/app/[locale]/planner/[tripId]/page.tsx`, where `<SurpriseMeSection ... />` is rendered, add `tripId={trip.id}` to the props.

- [ ] **Step 8: Run e2e test to verify it passes**

```bash
npm run test:e2e -- --grep "Plan a trip to X"
```

Expected: PASS.

- [ ] **Step 9: Run all planner-trust tests + unit tests**

```bash
npm run test:unit && npm run test:e2e -- --grep "planner|trip"
```

Expected: All pass.

- [ ] **Step 10: Commit**

```bash
git add src/components/AtlasHeroSection.tsx src/components/SurpriseMeSection.tsx src/components/ItineraryBuilder.tsx src/app/\[locale\]/planner/\[tripId\]/page.tsx messages/ tests/e2e/planner-trust.spec.ts
git commit -m "feat(planner): Path B 'Plan a trip to X' resolves to Path A"
```

---

## Task 5: SurpriseMeSection fallback banner + unknown-origin handling

**Files:**
- Create: `src/components/PlannerErrorBanner.tsx`
- Modify: `src/components/SurpriseMeSection.tsx` (replace silent setDestinations(V1_FALLBACK))
- Modify: i18n messages — add banner copy keys
- Test: append to `tests/e2e/planner-trust.spec.ts`

**Why:** P0-3 + P1-CODEX-1. Silent MIA-default + silent fallback compound for non-MIA users with API failures.

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/planner-trust.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:e2e -- --grep "fallback banner|unknown-origin"
```

Expected: FAIL — selectors don't exist.

- [ ] **Step 3: Create `PlannerErrorBanner.tsx`**

```typescript
"use client";

import { useTranslations } from "next-intl";

interface PlannerErrorBannerProps {
  testId: string;
  variant?: "warning" | "error";
  title: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
}

export default function PlannerErrorBanner({
  testId, variant = "warning", title, body, onRetry, retryLabel, onDismiss,
}: PlannerErrorBannerProps) {
  const t = useTranslations("plannerErrorBanner");
  const palette = variant === "error"
    ? "bg-red-50 border-red-200 text-red-900"
    : "bg-amber-50 border-amber-200 text-amber-900";

  return (
    <div data-testid={testId} className={`rounded-lg border p-4 ${palette} flex items-start gap-3`}>
      <div className="text-xl" aria-hidden>⚠️</div>
      <div className="flex-1">
        <p className="font-medium text-sm">{title}</p>
        {body && <p className="text-sm mt-1 opacity-90">{body}</p>}
      </div>
      <div className="flex gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-sm font-medium underline hover:no-underline"
          >
            {retryLabel ?? t("retry")}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-sm opacity-70 hover:opacity-100"
            aria-label={t("dismiss")}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add i18n keys**

The repo has only `messages/{locale}/common.json` — no separate namespace files. Add a new top-level `plannerErrorBanner` namespace and extend the existing `atlasHero` namespace in **all 6 locale files** (en, de, es, fr, it, pt).

`messages/en/common.json` — add new namespace and extend existing one:

```json
"plannerErrorBanner": {
  "retry": "Retry",
  "dismiss": "Dismiss"
},
"atlasHero": {
  /* ...existing keys + planTripTo from Task 4... */
  "fallbackTitle": "Atlas couldn't load fresh suggestions.",
  "fallbackBody": "These are example destinations while we try again.",
  "originNeededTitle": "We need your home airport.",
  "originNeededBody": "Tap to set it — Atlas will tailor suggestions to your origin."
}
```

Translate the same key set into the other 5 locale `common.json` files. Use the existing translations in those files as a tone/style reference.

Also update `PlannerErrorBanner.tsx` from Step 3 — the `useTranslations("plannerErrorBanner")` call will now succeed.

- [ ] **Step 5: Refactor `SurpriseMeSection.tsx` to use the banner + unknown-origin gate**

Replace the `useEffect` and render block. Key changes:

1. Detect unknown origin BEFORE fetch:

```typescript
useEffect(() => {
  if (originCode === "???") {
    setOriginUnknown(true);
    setLoading(false);
    return;
  }
  setOriginUnknown(false);
  fetchSuggestions();
}, [originCode, vibesSummary, flexibleWindow, startDate, tripLength]);

function fetchSuggestions() {
  setLoading(true);
  setFallbackUsed(false);
  setFetchError(null);

  const departMonth = deriveDepartMonth(flexibleWindow, startDate);
  const params = new URLSearchParams({ origin: originCode, depart_month: departMonth });
  if (tripLength) params.set("trip_length", tripLength);
  if (vibesSummary) {
    const vibesParam = vibesSummary
      .split(/\s*\+\s*/).map((v) => v.trim().toLowerCase()).filter(Boolean).join(",");
    if (vibesParam) params.set("vibes", vibesParam);
  }

  fetch(`/api/surprise-me?${params.toString()}`)
    .then((r) => r.ok ? r.json() : Promise.reject(r.status))
    .then((data) => {
      if (Array.isArray(data?.destinations) && data.destinations.length > 0) {
        setDestinations(data.destinations);
      } else {
        setDestinations(V1_FALLBACK);
        setFallbackUsed(true);
      }
    })
    .catch((e) => {
      setDestinations(V1_FALLBACK);
      setFallbackUsed(true);
      setFetchError(String(e));
    })
    .finally(() => setLoading(false));
}
```

2. New state:

```typescript
const [originUnknown, setOriginUnknown] = useState(false);
const [fallbackUsed, setFallbackUsed] = useState(false);
const [fetchError, setFetchError] = useState<string | null>(null);
```

3. Render the unknown-origin prompt BEFORE the cards:

```typescript
if (originUnknown) {
  return (
    <div className="space-y-6" data-testid="surprise-me-section">
      <div data-testid="origin-needed-prompt" className="rounded-xl border-2 border-orange-200 bg-orange-50 p-6">
        <p className="font-medium text-orange-900">{t("originNeededTitle")}</p>
        <p className="text-sm text-orange-800 mt-1">{t("originNeededBody")}</p>
        {/* Link or button to set home airport — placeholder for onboarding entry */}
        <a href="/planner" className="inline-block mt-3 text-sm font-medium underline">Set origin →</a>
      </div>
    </div>
  );
}
```

4. Render the fallback banner ABOVE the cards when `fallbackUsed`:

```typescript
return (
  <div className="space-y-6" data-testid="surprise-me-section">
    {fallbackUsed && (
      <PlannerErrorBanner
        testId="surprise-fallback-banner"
        title={t("fallbackTitle")}
        body={t("fallbackBody")}
        onRetry={fetchSuggestions}
      />
    )}
    {/* loading skeleton OR AtlasHeroSection... */}
  </div>
);
```

5. Remove the `originCode === "???" ? "MIA" : originCode` silent map — that code path is now gated by the unknown-origin early return.

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm run test:e2e -- --grep "fallback banner|unknown-origin"
```

Expected: 2 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/PlannerErrorBanner.tsx src/components/SurpriseMeSection.tsx messages/ tests/e2e/planner-trust.spec.ts
git commit -m "fix(planner): non-silent fallback banner + unknown-origin gate for Surprise Me"
```

---

## Task 6: Remove fake GenerationProgress, replace with truthful Atlas-ready hint

**Files:**
- Delete: `src/components/GenerationProgress.tsx`
- Modify: `src/app/[locale]/planner/[tripId]/page.tsx:131`
- Modify: i18n messages — add `tripDetail.atlasReady` key
- Test: append to `tests/e2e/planner-trust.spec.ts`

**Why:** P0-1. The component shows 5 fake progress steps that never advance because no code emits `atlas-progress`. Replace with truthful "Atlas can search for you — tap below" hint.

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/planner-trust.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:e2e -- --grep "Atlas-ready hint"
```

Expected: FAIL — `atlas-ready-hint` selector not found.

- [ ] **Step 3: Delete `GenerationProgress.tsx`**

```bash
rm src/components/GenerationProgress.tsx
```

- [ ] **Step 4: Replace its usage in the tripId page**

Modify `src/app/[locale]/planner/[tripId]/page.tsx` around line 131. Remove the import and the rendered `<GenerationProgress ...>`. Add an inline truthful hint:

Search for `import GenerationProgress` and delete that line.

Replace the JSX block that rendered the spinner with:

```tsx
{items.length === 0 && (
  <div
    data-testid="atlas-ready-hint"
    className="rounded-xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900"
  >
    <p className="font-medium">{t("atlasReadyTitle", { destination: trip.destination })}</p>
    <p className="mt-1 opacity-90">{t("atlasReadyBody")}</p>
  </div>
)}
```

- [ ] **Step 5: Add i18n keys to the existing `tripDetail` namespace**

The `tripDetail` namespace exists in `messages/{locale}/common.json` (around line 455 of `messages/en/common.json`). Extend it in **all 6 locale files**.

`messages/en/common.json`:

```json
"tripDetail": {
  /* ...existing keys... */
  "atlasReadyTitle": "Atlas can plan {destination} for you.",
  "atlasReadyBody": "Tap the chat panel below to search flights, hotels, and activities — or add items manually."
}
```

Translate into de/es/fr/it/pt using the existing keys in each `common.json` as a tone reference.

- [ ] **Step 6: Run test to verify it passes**

```bash
npm run test:e2e -- --grep "Atlas-ready hint"
```

Expected: PASS — `generation-progress` selector returns 0, `atlas-ready-hint` is visible.

- [ ] **Step 7: Run lint to confirm no stale references**

```bash
npm run lint
```

Expected: No errors related to GenerationProgress.

- [ ] **Step 8: Commit**

```bash
git add -A src/components/GenerationProgress.tsx src/app/\[locale\]/planner/\[tripId\]/page.tsx messages/ tests/e2e/planner-trust.spec.ts
git commit -m "fix(planner): replace fake GenerationProgress spinner with truthful Atlas-ready hint (P0-1)"
```

---

## Task 7: Atlas trigger governance state machine + planner idle nudges

**Files:**
- Create: `src/lib/atlas-trigger-state.ts`
- Create: `src/lib/atlas-trigger-state.test.ts` (vitest)
- Create: `src/hooks/useAtlasTrigger.ts`
- Create: `src/components/AtlasSmartSearchChip.tsx`
- Modify: `src/components/AssistantChat.tsx` (remove 800ms auto-trigger, integrate `useAtlasTrigger`)
- Modify: `src/hooks/useAtlasBubble.ts` (extend idle timer to `pageContext === 'planner'` with section-aware messages)
- Modify: `src/components/TripForm.tsx` (verify/update `window.__atlasFormContext` and `atlas-interaction` events on meaningful form progress)
- Modify: i18n — add planner-landing nudge copy
- Test: append to `tests/e2e/planner-trust.spec.ts`

**Why:** P1-2 + P1-3 + (replacement for Task 2's quick guard). The 800ms auto-send is the single biggest UX issue; the missing planner-landing idle nudge directly contradicts the 2026-03-24 north-star feedback. Unify into one state machine.

**State machine specification:**

States: `idle` | `awaiting_consent` | `consented` | `searching` | `done` | `declined`

Inputs (actions):
- `enterTripContext({tripId, destination, hasItems, isSurpriseMe, hasPriorMessages})` — page transition into a trip. `hasPriorMessages` preserves the original `AssistantChat.tsx:831-832` returning-user guard.
- `userConsent()` — user clicked "Start smart search"
- `userDecline()` — user clicked "Not yet"
- `searchStarted()` — first SSE call fired
- `searchFinished()` — SSE stream ended with results
- `interaction()` — any user input (resets idle timer)
- `tick(now)` — clock tick for idle detection

Transition rules:
- `idle` + `enterTripContext({hasItems:false, isSurpriseMe:false, hasPriorMessages:false, destination:nonempty AND not "Surprise Me"})` → `awaiting_consent`
- `idle` + `enterTripContext({hasItems:true OR isSurpriseMe:true OR hasPriorMessages:true OR destination empty OR destination==="Surprise Me"})` → `idle` (no chip)
- `awaiting_consent` + `userConsent()` → `consented`
- `awaiting_consent` + `userDecline()` → `declined`
- `consented` + `searchStarted()` → `searching`
- `searching` + `searchFinished()` → `done`
- Any state + `enterTripContext` → reset to new state per first rule

Idle/nudge state (separate concern but in same module):

Section state: `chooser` | `flight-no-origin` | `flight-no-destination` | `explore-no-vibes` | `explore-no-interests` | `complete`

Inputs:
- `setSection(section)`
- `interaction()`
- `tick(now)`

Emit nudge when `now - lastInteraction > 30000` AND `section !== 'complete'` AND no nudge already emitted this session for this section.

- [ ] **Step 1: Write failing vitest tests for the state machine**

Create `src/lib/atlas-trigger-state.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  initialTriggerState, triggerReducer,
  initialNudgeState, nudgeReducer,
  type TriggerState, type NudgeState, type Section,
} from './atlas-trigger-state';

const defaultCtx = { hasItems: false, isSurpriseMe: false, hasPriorMessages: false };

describe('triggerReducer', () => {
  it('enters awaiting_consent on first real-destination trip with no items + no priors', () => {
    const s: TriggerState = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Cancún', ...defaultCtx,
    });
    expect(s.status).toBe('awaiting_consent');
  });

  it('stays idle for Surprise Me destination string', () => {
    const s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Surprise Me', ...defaultCtx,
    });
    expect(s.status).toBe('idle');
  });

  it('stays idle when isSurpriseMe flag is true even with non-Surprise-Me destination', () => {
    const s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Cancún', ...defaultCtx, isSurpriseMe: true,
    });
    expect(s.status).toBe('idle');
  });

  it('stays idle when items already exist', () => {
    const s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Cancún', ...defaultCtx, hasItems: true,
    });
    expect(s.status).toBe('idle');
  });

  it('stays idle when destination is empty', () => {
    const s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: '', ...defaultCtx,
    });
    expect(s.status).toBe('idle');
  });

  it('stays idle for returning user (hasPriorMessages=true)', () => {
    const s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Cancún', ...defaultCtx, hasPriorMessages: true,
    });
    expect(s.status).toBe('idle');
  });

  it('moves awaiting_consent → consented → searching → done', () => {
    let s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Cancún', ...defaultCtx,
    });
    s = triggerReducer(s, { type: 'userConsent' });
    expect(s.status).toBe('consented');
    s = triggerReducer(s, { type: 'searchStarted' });
    expect(s.status).toBe('searching');
    s = triggerReducer(s, { type: 'searchFinished' });
    expect(s.status).toBe('done');
  });

  it('declines cleanly without firing a search', () => {
    let s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Cancún', ...defaultCtx,
    });
    s = triggerReducer(s, { type: 'userDecline' });
    expect(s.status).toBe('declined');
  });

  it('resets on enterTripContext for a new trip', () => {
    let s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Cancún', ...defaultCtx,
    });
    s = triggerReducer(s, { type: 'userDecline' });
    s = triggerReducer(s, {
      type: 'enterTripContext', tripId: 2, destination: 'Tokyo', ...defaultCtx,
    });
    expect(s.status).toBe('awaiting_consent');
    expect(s.tripId).toBe(2);
  });
});

describe('nudgeReducer', () => {
  it('emits a nudge after 30s of no interaction on a stalled section', () => {
    let s: NudgeState = nudgeReducer(initialNudgeState, {
      type: 'setSection', section: 'explore-no-vibes', now: 0,
    });
    s = nudgeReducer(s, { type: 'tick', now: 31000 });
    expect(s.pendingNudge).toBe('explore-no-vibes');
  });

  it('does not emit twice for the same section in a session', () => {
    let s = nudgeReducer(initialNudgeState, {
      type: 'setSection', section: 'explore-no-vibes', now: 0,
    });
    s = nudgeReducer(s, { type: 'tick', now: 31000 });
    s = nudgeReducer(s, { type: 'consumeNudge' });
    s = nudgeReducer(s, { type: 'tick', now: 62000 });
    expect(s.pendingNudge).toBeNull();
  });

  it('resets idle timer on interaction', () => {
    let s = nudgeReducer(initialNudgeState, {
      type: 'setSection', section: 'flight-no-origin', now: 0,
    });
    s = nudgeReducer(s, { type: 'interaction', now: 20000 });
    s = nudgeReducer(s, { type: 'tick', now: 40000 });
    // Only 20s since last interaction → no nudge yet
    expect(s.pendingNudge).toBeNull();
    s = nudgeReducer(s, { type: 'tick', now: 51000 });
    expect(s.pendingNudge).toBe('flight-no-origin');
  });

  it('never emits for section=complete', () => {
    let s = nudgeReducer(initialNudgeState, {
      type: 'setSection', section: 'complete', now: 0,
    });
    s = nudgeReducer(s, { type: 'tick', now: 60000 });
    expect(s.pendingNudge).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:unit
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/atlas-trigger-state.ts`**

```typescript
// Atlas trigger governance — pure state machine.
// No React, no DOM, no side effects. Easy to unit test.

export type TriggerStatus =
  | 'idle' | 'awaiting_consent' | 'consented' | 'searching' | 'done' | 'declined';

export interface TriggerState {
  status: TriggerStatus;
  tripId: number | null;
  destination: string | null;
}

export type TriggerAction =
  | { type: 'enterTripContext'; tripId: number; destination: string;
      hasItems: boolean; isSurpriseMe: boolean; hasPriorMessages: boolean }
  | { type: 'userConsent' }
  | { type: 'userDecline' }
  | { type: 'searchStarted' }
  | { type: 'searchFinished' };

export const initialTriggerState: TriggerState = {
  status: 'idle',
  tripId: null,
  destination: null,
};

export function triggerReducer(state: TriggerState, action: TriggerAction): TriggerState {
  switch (action.type) {
    case 'enterTripContext': {
      const shouldPrompt =
        !!action.destination &&
        action.destination !== 'Surprise Me' &&
        !action.hasItems &&
        !action.isSurpriseMe &&
        !action.hasPriorMessages; // preserves AssistantChat.tsx:831-832 returning-user guard
      return {
        status: shouldPrompt ? 'awaiting_consent' : 'idle',
        tripId: action.tripId,
        destination: action.destination,
      };
    }
    case 'userConsent':
      return state.status === 'awaiting_consent' ? { ...state, status: 'consented' } : state;
    case 'userDecline':
      return state.status === 'awaiting_consent' ? { ...state, status: 'declined' } : state;
    case 'searchStarted':
      return state.status === 'consented' ? { ...state, status: 'searching' } : state;
    case 'searchFinished':
      return state.status === 'searching' ? { ...state, status: 'done' } : state;
    default:
      return state;
  }
}

// ── Nudge state machine ──────────────────────────────────────────────────

export type Section =
  | 'chooser'
  | 'flight-no-origin'
  | 'flight-no-destination'
  | 'explore-no-vibes'
  | 'explore-no-interests'
  | 'complete';

const NUDGE_DELAY_MS = 30_000;

export interface NudgeState {
  section: Section | null;
  lastInteractionAt: number;
  emittedSections: Section[];
  pendingNudge: Section | null;
}

export type NudgeAction =
  | { type: 'setSection'; section: Section; now: number }
  | { type: 'interaction'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'consumeNudge' };

export const initialNudgeState: NudgeState = {
  section: null,
  lastInteractionAt: 0,
  emittedSections: [],
  pendingNudge: null,
};

export function nudgeReducer(state: NudgeState, action: NudgeAction): NudgeState {
  switch (action.type) {
    case 'setSection':
      return { ...state, section: action.section, lastInteractionAt: action.now, pendingNudge: null };
    case 'interaction':
      return { ...state, lastInteractionAt: action.now, pendingNudge: null };
    case 'tick': {
      if (!state.section || state.section === 'complete') return state;
      if (state.emittedSections.includes(state.section)) return state;
      const idleMs = action.now - state.lastInteractionAt;
      if (idleMs >= NUDGE_DELAY_MS) {
        return {
          ...state,
          pendingNudge: state.section,
          emittedSections: [...state.emittedSections, state.section],
        };
      }
      return state;
    }
    case 'consumeNudge':
      return { ...state, pendingNudge: null };
    default:
      return state;
  }
}

// ── Window typing for __atlasFormContext (set by TripForm) ──────────────
// Allows strict TypeScript to compile detectSection() in useAtlasBubble.ts
// without `(window as any)` casts.

export interface AtlasFormContext {
  mode: 'chooser' | 'flight' | 'explore';
  origin?: string;
  destination?: string;
  vibes?: string[];
  interests?: string[];
  budget?: string;
  travelers?: { adults: number; children: number };
}

declare global {
  interface Window {
    __atlasFormContext?: AtlasFormContext;
  }
}
```

- [ ] **Step 4: Run vitest to verify all state machine tests pass**

```bash
npm run test:unit
```

Expected: All `triggerReducer` and `nudgeReducer` tests pass.

- [ ] **Step 5: Create `src/components/AtlasSmartSearchChip.tsx`**

```typescript
"use client";

import { useTranslations } from "next-intl";

interface AtlasSmartSearchChipProps {
  destination: string;
  onConsent: () => void;
  onDecline: () => void;
}

export default function AtlasSmartSearchChip({ destination, onConsent, onDecline }: AtlasSmartSearchChipProps) {
  const t = useTranslations("atlasSmartSearch");
  return (
    <div
      data-testid="atlas-smart-search-chip"
      className="rounded-xl border border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-4 flex items-center gap-3 shadow-sm"
      role="region"
      aria-label={t("ariaLabel")}
    >
      <div className="text-2xl" aria-hidden>🤖</div>
      <div className="flex-1 text-sm text-orange-900">
        {t("prompt", { destination })}
      </div>
      <button
        onClick={onConsent}
        data-testid="atlas-smart-search-start"
        className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-700"
      >
        {t("start")}
      </button>
      <button
        onClick={onDecline}
        data-testid="atlas-smart-search-decline"
        className="text-orange-700 px-2 py-1.5 text-sm hover:underline"
      >
        {t("notYet")}
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Add i18n keys**

Add two new top-level namespaces (`atlasSmartSearch` and `tripFormNudge`) into `messages/{locale}/common.json` for **all 6 locales**.

`messages/en/common.json`:

```json
"atlasSmartSearch": {
  "ariaLabel": "Atlas smart search",
  "prompt": "I can search flights, hotels, and activities for {destination}.",
  "start": "Start smart search",
  "notYet": "Not yet"
},
"tripFormNudge": {
  "chooser": "Not sure where to start? Pick the option that feels closest — you can change it later.",
  "flight-no-origin": "Tell me where you're flying from, or tap Atlas and say it in plain English.",
  "flight-no-destination": "Where are you going? Type a city or airport code.",
  "explore-no-vibes": "Pick a feeling — chill, adventure, romance. Atlas will narrow the rest.",
  "explore-no-interests": "Add two things you like and Atlas can build better suggestions."
}
```

Translate into de/es/fr/it/pt. Keep the JSON key names exactly as shown (i18n keys are not translated, only values are).

- [ ] **Step 7: Create `src/hooks/useAtlasTrigger.ts`**

```typescript
"use client";

import { useEffect, useReducer, useRef } from "react";
import {
  triggerReducer, initialTriggerState,
  type TriggerState, type TriggerAction,
} from "@/lib/atlas-trigger-state";

interface UseAtlasTriggerArgs {
  tripId: number | null;
  destination: string | null;
  hasItems: boolean;
  isSurpriseMe: boolean;
  hasPriorMessages: boolean;
}

export function useAtlasTrigger({ tripId, destination, hasItems, isSurpriseMe, hasPriorMessages }: UseAtlasTriggerArgs) {
  const [state, dispatch] = useReducer<React.Reducer<TriggerState, TriggerAction>>(
    triggerReducer, initialTriggerState
  );
  const lastTripId = useRef<number | null>(null);

  useEffect(() => {
    if (tripId === null || !destination) return;
    if (lastTripId.current === tripId) return;
    lastTripId.current = tripId;
    dispatch({ type: 'enterTripContext', tripId, destination, hasItems, isSurpriseMe, hasPriorMessages });
  }, [tripId, destination, hasItems, isSurpriseMe, hasPriorMessages]);

  return {
    status: state.status,
    requestConsent: () => dispatch({ type: 'userConsent' }),
    declineConsent: () => dispatch({ type: 'userDecline' }),
    markSearchStarted: () => dispatch({ type: 'searchStarted' }),
    markSearchFinished: () => dispatch({ type: 'searchFinished' }),
  };
}
```

- [ ] **Step 8: Integrate into `AssistantChat.tsx`**

This step does three things:
1. Extract the existing auto-search prompt-building block (`AssistantChat.tsx:837-861`) into a pure helper `buildAutoSearchPrompt(ctx)` — verbatim, no behavior change.
2. Replace the 800ms auto-trigger `useEffect` (`AssistantChat.tsx:813-870`) with `useAtlasTrigger` integration.
3. Render `AtlasSmartSearchChip` via `createPortal` into a DOM slot on the trip detail page when the state machine is in `awaiting_consent`.

**8a. Add the verbatim helper at module scope (above the component definition):**

```typescript
// Extracted from AssistantChat.tsx:837-861 (was inline in the 800ms auto-trigger).
// Pure function — no React, no side effects. Same behavior, easier to test.
function buildAutoSearchPrompt(ctx: {
  destination: string;
  dates?: { start: string; end: string };
  flexibleWindow?: string;
  tripLength?: string;
}): string {
  const windowLabels: Record<string, string> = {
    next_2_weeks: "in the next 2 weeks",
    next_month: "next month",
    "2_3_months": "in 2-3 months",
    "6_months": "in about 6 months",
    this_year: "sometime this year",
    any: "whenever it's cheapest",
  };
  const lengthLabels: Record<string, string> = {
    weekend: "a weekend (2-3 days)",
    week: "about a week",
    "10_14_days": "10-14 days",
    "2_plus_weeks": "2+ weeks",
    any: "however long gives the best deal",
  };

  let prompt = `I just created a trip to ${ctx.destination}`;
  if (ctx.dates) {
    prompt += ` from ${ctx.dates.start} to ${ctx.dates.end}`;
  } else if (ctx.flexibleWindow || ctx.tripLength) {
    const when = ctx.flexibleWindow ? windowLabels[ctx.flexibleWindow] || ctx.flexibleWindow : "flexible dates";
    const howLong = ctx.tripLength ? lengthLabels[ctx.tripLength] || ctx.tripLength : "flexible duration";
    prompt += `. I'm flexible on dates — thinking ${when}, for ${howLong}`;
  }
  prompt += ". Search flights, hotels, and activities for me.";
  return prompt;
}
```

**8b. Replace the 800ms auto-trigger `useEffect` block at `AssistantChat.tsx:813-870`** with a tracked trip-context state. Do not reference a free `ctx` variable — `readTripContext()` currently returns a value only when called, so the hook needs React state.

Add imports:

```typescript
import { createPortal } from 'react-dom';
import { useAtlasTrigger } from '@/hooks/useAtlasTrigger';
import AtlasSmartSearchChip from './AtlasSmartSearchChip';
```

Inside `AssistantChat`, near the existing refs/state, add:

```typescript
const [tripCtx, setTripCtx] = useState<TripContext>(() => ({
  destination: "your destination",
  adults: 1,
  budgetTier: "mid",
}));

useEffect(() => {
  // Read once after mount and whenever the route-side script tag may have changed.
  setTripCtx(readTripContext());
}, []);

const hasRealItems = tripCtx.items?.some(
  (i) => i.price_estimate !== null && i.category !== 'note'
) ?? false;

const atlasTrigger = useAtlasTrigger({
  tripId: tripCtx.tripId ?? null,
  destination: tripCtx.destination ?? null,
  hasItems: hasRealItems,
  isSurpriseMe: tripCtx.destination === 'Surprise Me',
  hasPriorMessages: messagesLenRef.current > 0,
});
```

Then replace the original 800ms auto-send `useEffect` with a consent-only effect:

```typescript
useEffect(() => {
  if (atlasTrigger.status !== 'consented') return;
  if (!tripCtx.destination || tripCtx.destination === 'your destination') return;

  const prompt = buildAutoSearchPrompt({
    destination: tripCtx.destination,
    dates: tripCtx.dates,
    flexibleWindow: tripCtx.flexibleWindow,
    tripLength: tripCtx.tripLength,
  });
  setIsOpen(true);
  atlasTrigger.markSearchStarted();
  sendMessageRef.current(prompt);
}, [
  atlasTrigger.status,
  atlasTrigger.markSearchStarted,
  tripCtx.destination,
  tripCtx.dates,
  tripCtx.flexibleWindow,
  tripCtx.tripLength,
]);
```

Finally, mark the state machine done when the auto-search stream completes. The cleanest minimal implementation is to add an optional second argument to `sendMessage`, e.g. `sendMessage(text, { onDone })`, and call `onDone?.()` in every terminal path (normal stream end, 429, non-OK, catch). The consent effect should call:

```typescript
sendMessageRef.current(prompt, { onDone: atlasTrigger.markSearchFinished });
```

If changing `sendMessage` signature is too invasive, add a small wrapper just for this path, but do not leave the state stuck in `searching` forever.

Delete the original 813-870 block — it has been fully superseded by the above.

**8c. Render the chip via `createPortal` into a DOM slot:**

Add a placeholder div above `<ItineraryBuilder>` in `src/app/[locale]/planner/[tripId]/page.tsx` (Path A branch only):

```tsx
<div id="atlas-smart-search-slot" />
{items.length === 0 && (/* atlas-ready hint from Task 6 */)}
<ItineraryBuilder ... />
```

In `AssistantChat.tsx`, add this render block (place it near other portal/floating UI in the component; imports were added in 8b):

```typescript
const slot = typeof document !== 'undefined'
  ? document.getElementById('atlas-smart-search-slot')
  : null;

const showChip = atlasTrigger.status === 'awaiting_consent' && tripCtx.destination && slot;
// ...

{showChip && createPortal(
  <AtlasSmartSearchChip
    destination={tripCtx.destination!}
    onConsent={atlasTrigger.requestConsent}
    onDecline={atlasTrigger.declineConsent}
  />,
  slot!
)}
```

> **Deferred refactor (acceptable for now):** state lives in `AssistantChat` while the chip's visual home is in the trip page. This portal-to-DOM-slot pattern is opaque and brittle to future engineers. The cleaner long-term shape is a locale-layout React Context provider that owns `TriggerState`, with both `AssistantChat` and the trip page consuming via `useContext`. **Track as P3 follow-up** — does not block the sprint.

- [ ] **Step 9: Extend `useAtlasBubble.ts` idle timer to planner landing**

In `src/hooks/useAtlasBubble.ts` around lines 125-142, the current idle timer is gated by `pageContext === 'itinerary'`. Extend it:

```typescript
// Existing: only itinerary
if (pageContext === 'itinerary') { /* idle timer */ }

// Add: planner landing — read section from window.__atlasFormContext
if (pageContext === 'planner') {
  // Section detection from window.__atlasFormContext (set by TripForm)
  const section = detectSection(window.__atlasFormContext);
  // ...idle timer that emits a one-shot bubble per section...
}
```

Add a `detectSection()` helper at the bottom of the file:

```typescript
function detectSection(ctx: any): Section | null {
  if (!ctx) return null;
  if (ctx.mode === 'chooser') return 'chooser';
  if (ctx.mode === 'flight') {
    if (!ctx.origin) return 'flight-no-origin';
    if (!ctx.destination) return 'flight-no-destination';
    return 'complete';
  }
  if (ctx.mode === 'explore') {
    if (!ctx.vibes || ctx.vibes.length === 0) return 'explore-no-vibes';
    if (!ctx.interests || ctx.interests.length < 2) return 'explore-no-interests';
    return 'complete';
  }
  return null;
}
```

Use `nudgeReducer` internally (or duplicate the simple "emit after 30s if not emitted" logic for this hook — to keep the hook self-contained, reuse `nudgeReducer`).

- [ ] **Step 10: TripForm emits `atlas-interaction` (already does) — verify**

`TripForm.tsx` already fires `window.dispatchEvent(new Event('atlas-interaction'))` per the audit. Verify by grep and confirm the events flow to `useAtlasBubble`. No code change unless missing.

```bash
grep -n "atlas-interaction" src/components/TripForm.tsx
```

Expected: ≥ 1 match.

- [ ] **Step 11: Write the e2e test**

Append to `tests/e2e/planner-trust.spec.ts`:

```typescript
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
```

- [ ] **Step 12: Run all tests**

```bash
npm run test:unit && npm run test:e2e -- --grep "planner"
```

Expected: All pass.

- [ ] **Step 13: Commit**

```bash
git add src/lib/atlas-trigger-state.ts src/lib/atlas-trigger-state.test.ts src/hooks/useAtlasTrigger.ts src/hooks/useAtlasBubble.ts src/components/AtlasSmartSearchChip.tsx src/components/AssistantChat.tsx src/components/TripForm.tsx src/app/\[locale\]/planner/\[tripId\]/page.tsx messages/ tests/e2e/planner-trust.spec.ts
git commit -m "feat(atlas): trigger governance state machine + consent chip + planner idle nudges"
```

---

## Task 8: PlannerDashboard error state + Retry

**Files:**
- Modify: `src/components/PlannerDashboard.tsx` (around lines 28-31 — fetch error handling)
- Test: append to `tests/e2e/planner-trust.spec.ts`

**Why:** P1-7. Currently silently shows empty trip list on any fetch failure.

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/planner-trust.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:e2e -- --grep "PlannerDashboard shows error"
```

Expected: FAIL.

- [ ] **Step 3: Add error state to `PlannerDashboard.tsx`**

Around the fetch effect:

```typescript
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  loadTrips();
}, []);

async function loadTrips() {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch('/api/trips');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setTrips(Array.isArray(data) ? data : []);
  } catch (e: any) {
    setError(e.message || 'fetch_failed');
  } finally {
    setLoading(false);
  }
}
```

Add the banner to the render:

```typescript
{error && (
  <PlannerErrorBanner
    testId="planner-dashboard-error"
    variant="error"
    title={t("dashboardError.title")}
    body={t("dashboardError.body")}
    onRetry={loadTrips}
  />
)}
```

Extend the existing `plannerDashboard` namespace in **all 6 locale `common.json` files**. The namespace exists at around line 197 of `messages/en/common.json`.

`messages/en/common.json`:

```json
"plannerDashboard": {
  /* ...existing keys... */
  "dashboardError": {
    "title": "Couldn't load your trips.",
    "body": "Network or server hiccup. Try again."
  }
}
```

Translate into de/es/fr/it/pt.

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:e2e -- --grep "PlannerDashboard shows error"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PlannerDashboard.tsx messages/ tests/e2e/planner-trust.spec.ts
git commit -m "fix(planner): PlannerDashboard error state + Retry (P1-7)"
```

---

## Task 9: Guest-eligible bootstrap onboarding (preserve existing OnboardingModal)

**Files:**
- Create: `src/components/BootstrapModal.tsx` — NEW component for guests only
- Modify: `src/components/OnboardingWrapper.tsx` — choose between BootstrapModal (guest) and OnboardingModal (auth)
- DO NOT MODIFY: `src/components/OnboardingModal.tsx` — its 3-step authenticated flow (airport → budget tier → interests) stays intact
- Test: append to `tests/e2e/planner-trust.spec.ts`

**Why:** P1-5. Guests currently never see onboarding because `OnboardingWrapper.tsx` is gated behind `useSession()`. Guests are the primary funnel. **Per plan-review feedback:** the existing `OnboardingModal.tsx` is a working 3-step authenticated flow (airport + budget tier + interests with custom interests, AI-assisted toggle, etc.). We do NOT replace it. We add a new lightweight `BootstrapModal` for guests and gate selection in the wrapper.

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/planner-trust.spec.ts`:

```typescript
test('Guest user sees bootstrap onboarding once', async ({ page, context }) => {
  // Fresh browser context — no cookies, no localStorage
  await page.goto('/');
  await page.waitForTimeout(2000);

  // Onboarding bootstrap modal must be visible for guest
  await expect(page.locator('[data-testid="onboarding-bootstrap"]')).toBeVisible({ timeout: 5000 });

  // After completing bootstrap (simulate)
  await page.fill('[data-testid="bootstrap-home-airport"]', 'MIA');
  await page.click('[data-testid="bootstrap-save"]');

  // Reload — bootstrap should NOT appear again
  await page.reload();
  await page.waitForTimeout(2000);
  await expect(page.locator('[data-testid="onboarding-bootstrap"]')).not.toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:e2e -- --grep "Guest user sees bootstrap"
```

Expected: FAIL.

- [ ] **Step 3: Create `BootstrapModal.tsx` (new file, guests only)**

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export const GUEST_BOOTSTRAP_LS_KEY = "tpi_onboarding_bootstrap_complete";
export const GUEST_PREFS_LS_KEY = "tpi_guest_prefs";

interface BootstrapModalProps {
  onClose: () => void;
}

const GUEST_INTERESTS = ['beach', 'mountains', 'food', 'culture'] as const;

export default function BootstrapModal({ onClose }: BootstrapModalProps) {
  const t = useTranslations("bootstrapModal");
  const [homeAirport, setHomeAirport] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleInterest(i: string) {
    setInterests((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  }

  function save() {
    setSaving(true);
    localStorage.setItem(GUEST_BOOTSTRAP_LS_KEY, '1');
    localStorage.setItem(GUEST_PREFS_LS_KEY, JSON.stringify({
      home_airport: homeAirport,
      interests,
    }));
    window.dispatchEvent(new CustomEvent('atlas-onboarding-complete'));
    onClose();
  }

  return (
    <div
      data-testid="onboarding-bootstrap"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bootstrap-title"
    >
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 space-y-4 shadow-2xl">
        <h2 id="bootstrap-title" className="text-lg font-bold text-gray-900">{t("title")}</h2>
        <p className="text-sm text-gray-600">{t("subtitle")}</p>

        <label className="block text-sm font-medium text-gray-700">
          {t("homeAirportLabel")}
          <input
            data-testid="bootstrap-home-airport"
            value={homeAirport}
            onChange={(e) => setHomeAirport(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="e.g. MIA"
            className="mt-1 w-full border rounded-lg p-2 font-mono"
            maxLength={3}
            aria-required="true"
          />
        </label>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">{t("interestsLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {GUEST_INTERESTS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleInterest(i)}
                aria-pressed={interests.includes(i)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  interests.includes(i)
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t(`interest.${i}`)}
              </button>
            ))}
          </div>
        </div>

        <button
          data-testid="bootstrap-save"
          onClick={save}
          disabled={!homeAirport || interests.length < 2 || saving}
          className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("save")}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add `bootstrapModal` namespace to `messages/{locale}/common.json` for all 6 locales**

`messages/en/common.json`:

```json
"bootstrapModal": {
  "title": "Welcome — let's get oriented.",
  "subtitle": "Tell Atlas the basics so suggestions match where you live and what you like.",
  "homeAirportLabel": "Home airport (IATA code)",
  "interestsLabel": "What do you enjoy on a trip? Pick at least 2.",
  "interest": {
    "beach": "Beach",
    "mountains": "Mountains",
    "food": "Food",
    "culture": "Culture"
  },
  "save": "Save & continue"
}
```

Translate into de/es/fr/it/pt.

- [ ] **Step 5: Modify `OnboardingWrapper.tsx` to choose between Bootstrap (guest) and Onboarding (auth)**

`OnboardingWrapper.tsx` (full replacement — currently auth-only):

```typescript
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import OnboardingModal from "./OnboardingModal";
import BootstrapModal, { GUEST_BOOTSTRAP_LS_KEY } from "./BootstrapModal";

export default function OnboardingWrapper() {
  const { data: session, status } = useSession();
  const [variant, setVariant] = useState<"none" | "bootstrap" | "full">("none");

  useEffect(() => {
    if (status === "loading") return;

    const timer = setTimeout(() => {
      if (session?.user) {
        // Authenticated: existing OnboardingModal handles its own visibility check
        // (it reads `tpi_onboarding_complete` localStorage + preferences). Just mount it.
        setVariant("full");
      } else {
        // Guest: gate purely on localStorage bootstrap flag.
        if (typeof window !== 'undefined' && !localStorage.getItem(GUEST_BOOTSTRAP_LS_KEY)) {
          setVariant("bootstrap");
        }
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [session, status]);

  if (variant === "bootstrap") return <BootstrapModal onClose={() => setVariant("none")} />;
  if (variant === "full") return <OnboardingModal />; // existing component, unchanged
  return null;
}
```

> **Important:** `OnboardingModal.tsx` is NOT modified. Its existing 3-step flow (airport → budget tier → interests with custom interests + AI-assisted toggle) stays intact. The wrapper simply chooses which component to mount based on auth state.

- [ ] **Step 6: Run test to verify it passes**

```bash
npm run test:e2e -- --grep "Guest user sees bootstrap"
```

Expected: PASS.

- [ ] **Step 7: Sanity-check that existing OnboardingModal still works for auth'd users**

Manual check (no test code change — existing OnboardingModal isn't modified):

```bash
grep -nE "useTranslations\(.onboarding.\)|PREF_ENUMS.budget_tier|tpi_onboarding_complete" src/components/OnboardingModal.tsx | head -5
```

Expected: original 3-step flow still wired (uses `useTranslations("onboarding")`, references `PREF_ENUMS.budget_tier`, writes `tpi_onboarding_complete` LS key).

- [ ] **Step 8: Commit**

```bash
git add src/components/BootstrapModal.tsx src/components/OnboardingWrapper.tsx messages/ tests/e2e/planner-trust.spec.ts
git commit -m "feat(onboarding): add BootstrapModal for guests; OnboardingModal preserved (P1-5)"
```

---

## Task 10: Full-width planner QA + adjust (gated on visual confirmation)

**Files:**
- Modify (if confirmed): `src/app/[locale]/planner/[tripId]/page.tsx:63` (max-w-[90rem] cap)
- Test: visual QA via Playwright screenshot diff

**Why:** P1-4. Audit claims the 90rem cap squeezes itinerary. Confirm with screenshots at 3 viewport widths before changing.

- [ ] **Step 1: Take baseline screenshots at 1280, 1440, 1920 widths**

Create `tests/e2e/visual-baseline.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

[1280, 1440, 1920].forEach((width) => {
  test(`planner/[tripId] at ${width}w baseline screenshot`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    const post = await context.request.post('/api/trips', {
      data: { name: 'Visual test', destination: 'Cancún', budget: 'midrange' },
    });
    const trip = await post.json();
    await page.goto(`/planner/${trip.id}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(`planner-tripId-${width}.png`, { fullPage: true });
  });
});
```

```bash
npm run test:e2e -- --grep "baseline screenshot" --update-snapshots
```

Expected: 3 snapshots saved.

- [ ] **Step 2: Visually inspect the snapshots**

Open `test-results/` snapshots. Confirm whether 90rem cap is materially harming layout at 1440/1920.

- [ ] **Step 3: If confirmed, change `max-w-[90rem]` → `max-w-screen-2xl`**

```typescript
// src/app/[locale]/planner/[tripId]/page.tsx around line 63
// Before:
<div className="max-w-[90rem] mx-auto px-4">

// After:
<div className="max-w-screen-2xl mx-auto px-4">
```

- [ ] **Step 4: Re-run snapshots and visually confirm improvement**

```bash
npm run test:e2e -- --grep "baseline screenshot" --update-snapshots
git diff -- tests/e2e/__snapshots__/  # review diff
```

- [ ] **Step 5: Commit (or skip if QA shows no change needed)**

```bash
git add src/app/\[locale\]/planner/\[tripId\]/page.tsx tests/e2e/visual-baseline.spec.ts tests/e2e/__snapshots__/
git commit -m "ui(planner): widen tripId layout to screen-2xl (P1-4)"
```

If QA shows the 90rem cap is fine: commit only the snapshot test:

```bash
git add tests/e2e/visual-baseline.spec.ts tests/e2e/__snapshots__/
git commit -m "test(planner): visual baseline at 1280/1440/1920 — 90rem cap confirmed OK"
```

---

## Task 11: Delete InterestsModal.tsx

**Files:**
- Delete: `src/components/InterestsModal.tsx`

**Why:** P2-2 (revised). True orphan, 0 importers. Preflight passed (file-level grep returns empty; the `showInterestsModal` references in `ItineraryBuilder` are state names for an inline modal, not the orphan).

- [ ] **Step 1: Final preflight**

```bash
grep -rE "^import.*InterestsModal|from.*InterestsModal" src/ --include="*.tsx" --include="*.ts"
```

Expected: empty.

- [ ] **Step 2: Delete the file**

```bash
rm src/components/InterestsModal.tsx
```

- [ ] **Step 3: Run lint + build to confirm nothing breaks**

```bash
npm run lint && npx next build
```

Expected: lint clean, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A src/components/InterestsModal.tsx
git commit -m "chore: delete orphaned InterestsModal.tsx (P2-2 revised)"
```

---

## Final verification (end of sprint)

After all 11 tasks complete, run the full verification gate:

- [ ] **Run all unit tests**

```bash
npm run test:unit
```

Expected: all pass.

- [ ] **Run all e2e tests**

```bash
npm run test:e2e
```

Expected: all pass.

- [ ] **Run lint + build**

```bash
npm run lint && npx next build
```

Expected: lint clean, build succeeds.

- [ ] **GPT-5.5 acceptance criteria checklist** (verify each via the relevant e2e test):

| # | Acceptance | Test |
|---|---|---|
| 1 | Path B → Path A resolution works for a guest trip | `planner-trust.spec.ts > Plan a trip to X` |
| 2 | `entry_mode` correct after resolution | `planner-trust.spec.ts > resolve-surprise persists entry_mode` |
| 3 | "Tell me more" does NOT mutate trip state | manual verification + DB check (no `entry_mode`/`destination` change after click) |
| 4 | Atlas does not auto-send on Surprise Me | `planner-trust.spec.ts > does not auto-send for Surprise Me` |
| 5 | Atlas does not auto-send on Path A before consent | `planner-trust.spec.ts > does NOT auto-send on new Path A trip` |
| 6 | Planner-landing idle nudge once per session | manual: idle on `/planner` 30s — verify bubble appears, reload — does not re-appear |
| 7 | Surprise Me API failure shows banner + Retry | `planner-trust.spec.ts > non-silent fallback banner` |
| 8 | PlannerDashboard fetch error shows banner + Retry | `planner-trust.spec.ts > PlannerDashboard shows error` |
| 9 | Trip endpoints return DTOs, not raw rows | `planner.test.js > GET /api/trips returns DTO shape` |

- [ ] **Push branch + open PR**

```bash
git push -u origin chore/planner-trust-trigger-governance
gh pr create --title "Planner trust + Atlas trigger governance sprint" --body "Implements the 10-item sprint plan from docs/audits/2026-05-27-planner-functionality-consensus-gpt55.md. All P0s + selected P1s + DTO foundation."
```

---

## Reviewer sign-off

**Reviewed by:** GPT-5.5 via Hermes Agent on 2026-05-27

**Plan-review blockers fixed inline:** Vitest no-test behavior, stale `NextNextResponse` typo, missing `NextResponse` import in `resolve-surprise`, DTO consumer update for `PlannerDashboard`, stale i18n file path, incorrect `next-intl/client` router guidance, Task 7 free `ctx` variable / stuck `searching` state, and stale OnboardingModal/TripForm file-list claims.

---

## Self-review checklist

Before handoff to execution:

- [ ] **Spec coverage:** Every item from GPT-5.5's 10-item table is covered by a task above (item 1 → Task 6, item 2 → Tasks 3+4, item 3 → Task 5, item 4 → Task 2, item 5 → Task 7, item 6 → Task 8, item 7 → Task 9, item 8 → Task 1, item 9 → Task 10, item 10 → Task 11). ✅
- [ ] **No placeholders:** every "implement X" includes the code. No "TBD" / "TODO" / "similar to Task N" without re-included code.
- [ ] **Type consistency:** `TripDto.entryMode` is used the same way in resolve-surprise endpoint (Task 3) as in DTO tests (Task 1). State machine types match across Task 7's hook + test.
- [ ] **Test coverage at call sites:** each task ends with an e2e or unit test that proves the behavior, not just helper assertions.
- [ ] **TDD discipline:** every task has the failing-test step BEFORE the implementation step.
- [ ] **Sequencing:** Task 2 (quick guard) lands before Task 7 (full governance) so the P0 ships early. Task 1 (DTO) lands before Task 3 (resolve-surprise uses DTO).

If any of the above are unchecked, fix inline.
