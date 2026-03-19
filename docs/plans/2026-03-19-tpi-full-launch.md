# TPI Full Launch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform TravelPlanInfo from a Vercel prototype into a self-hosted, fully functional travel planning tool with real auth, a persistent trip planner, and contextual affiliate integration — "the tool that earns while it helps."

**Architecture:** Hybrid-C static Next.js site on SSDNodes VPS. SQLite for trip/user data. NextAuth for authentication. Nginx reverse proxy with SSL. Content pipeline drops article JSON files; a rebuild trigger regenerates static pages. The trip planner is the core product — every interaction surfaces contextual CJ affiliate links.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 3.4, NextAuth.js 5, better-sqlite3, Nginx, PM2, Let's Encrypt SSL, Playwright E2E tests.

---

## Phase 1: Clean House (remove dead code, fix P0 bugs)

### Task 1: Remove DesignB/C dead code

**Files:**
- Delete: `src/components/DesignB.tsx`
- Delete: `src/components/DesignC.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Delete DesignB and DesignC components**

Remove both files from `src/components/`.

**Step 2: Update page.tsx — remove B/C imports and ternary**

Remove imports for DesignB and DesignC.

Remove the `PageProps` interface (no longer needed).

Replace the design ternary:
```tsx
{design === "B" ? <DesignB /> : design === "C" ? <DesignC /> : <DesignA />}
```
with:
```tsx
<DesignA />
```

Remove `searchParams` from the `Home` function signature:
```tsx
export default async function Home() {
```

Delete the two lines:
```tsx
const params = await searchParams;
const design = (params.design || "A").toUpperCase();
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 4: Commit**
```
git add -A && git commit -m "chore: remove DesignB/C dead code — Design A is final"
```

---

### Task 2: Fix domain references (P0)

**Files:**
- Modify: `src/app/robots.ts`
- Modify: `src/app/sitemap.ts`

**Step 1: Update robots.ts**

Change sitemap URL from `https://travelplaninfo-proto.vercel.app/sitemap.xml` to `https://travelplaninfo.com/sitemap.xml`.

**Step 2: Update sitemap.ts**

Change `SITE_URL` from `https://travelplaninfo-proto.vercel.app` to `https://travelplaninfo.com`.

**Step 3: Verify [slug]/page.tsx canonical**

Confirm canonical already uses `https://travelplaninfo.com/${slug}/` — no change needed.

**Step 4: Build and commit**
```
npm run build && git add -A && git commit -m "fix: update domain from proto.vercel.app to travelplaninfo.com"
```

---

### Task 3: Localize images (P0)

**Files:**
- Modify: `src/content/posts.json`
- Modify: `src/components/Hero.tsx`
- Modify: `next.config.ts` (add Unsplash remote pattern)

**Step 1: Audit which images exist locally vs referenced remotely**

List all `featuredImage` URLs in posts.json and check which have local copies in `public/images/posts/`.

**Step 2: Update posts.json to use local paths**

For each post with a `featuredImage` pointing to `travelplaninfo.com/wp-content/uploads/...`:
- Verify the file exists in `public/images/posts/`
- Update the path to `/images/posts/<filename>`

For inline content images in the `content` field: find-and-replace WP URLs with local paths.

**Step 3: Handle Hero background image**

Download the Unsplash hero image to `public/images/hero-bg.jpg` and update Hero.tsx.

**Step 4: Handle Destinations page images**

Add Unsplash to `next.config.ts` remotePatterns for stock destination photos (these are external stock images, not content-dependent):
```ts
images: {
  unoptimized: true,
  remotePatterns: [
    { protocol: "https", hostname: "images.unsplash.com" },
  ],
},
```

**Step 5: Build, verify, commit**
```
npm run build && git add -A && git commit -m "fix: localize article images from WP to local paths"
```

---

### Task 4: Optimize logo (P1)

**Files:**
- Replace: `public/logo.png` (1.4 MB to optimized WebP)
- Modify: `src/components/Header.tsx`

**Step 1: Compress logo to WebP (~50-100KB)**

**Step 2: Update Header.tsx to reference logo.webp with explicit width/height via next/image**

**Step 3: Build and commit**
```
npm run build && git add -A && git commit -m "perf: optimize logo from 1.4MB to WebP"
```

---

### Task 5: Clean imported content

**Files:**
- Modify: `src/content/posts.json`

**Step 1: Remove the limo-service post**

Delete the object with slug `limo-service-black-car-service-airport-transfer`.

**Step 2: Fix YAML frontmatter leak on travel-planning-vs-booking**

Strip the YAML metadata block from the beginning of the `content` field. Fix `seo.title` from "Travelplaninfo Planning Vs Booking" to the actual article title.

**Step 3: Strip AirportsPickup cross-contamination**

In `florida-travel-guide-2019` and `best-things-to-do-in-denver-colorado`:
- Remove all links to airportspickup.com and 123corporatetransportation.com
- Remove the marquee tag in the Florida post

**Step 4: Strip Elementor data attributes across all posts**

Remove `data-elementor*`, `data-id`, `data-element_type`, `data-widget_type`, `data-particle*` attributes. Remove empty Elementor wrapper divs.

**Step 5: Build and commit**
```
npm run build && git add -A && git commit -m "fix: remove limo spam, fix YAML leak, strip Elementor bloat"
```

---

### Task 6: Fix TP flight tracking (P1)

**Files:**
- Modify: `src/app/destinations/page.tsx`

**Step 1: Add TP marker to Aviasales URLs**

Import `TP_CONFIG` from `@/config/affiliates` and use `TP_CONFIG.searchUrl(origin, dest)` for all flight search links.

**Step 2: Build and commit**
```
npm run build && git add -A && git commit -m "fix: add Travelpayouts marker to flight search URLs"
```

---

## Phase 2: Auth & Database

### Task 7: Install NextAuth + SQLite dependencies

**Files:**
- Modify: `package.json`
- Create: `src/lib/db.ts`
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/api/register/route.ts`
- Create: `.env.local`

**Step 1: Install dependencies**
```
npm install next-auth@beta better-sqlite3 bcryptjs
npm install -D @types/better-sqlite3 @types/bcryptjs
```

**Step 2: Create SQLite database module (`src/lib/db.ts`)**

Schema tables:
- `users` — id, email, name, password_hash, provider, created_at, updated_at
- `trips` — id, user_id (FK), name, destination, start_date, end_date, budget, travelers_adults, travelers_children, rooms, interests (JSON), status, created_at, updated_at
- `trip_items` — id, trip_id (FK), day_number, category (hotel/flight/car/activity/cruise/restaurant/note), title, description, affiliate_program, affiliate_url, price_estimate, booked, sort_order, created_at

Use WAL journal mode and foreign keys enabled. Auto-create schema on first connection.

Add `data/` to `.gitignore` for the SQLite file.

**Step 3: Create NextAuth config (`src/lib/auth.ts`)**

Providers:
- Credentials (email + password with bcrypt verification)
- Google OAuth (optional — reads from env vars, disabled if not configured)

Callbacks:
- `signIn`: auto-create user record for Google OAuth users
- `session` + `jwt`: attach user ID to session

Pages: `signIn: "/signin"`, `newUser: "/register"`
Strategy: JWT

**Step 4: Create auth API route (`src/app/api/auth/[...nextauth]/route.ts`)**

Export GET and POST handlers from auth config.

**Step 5: Create registration API route (`src/app/api/register/route.ts`)**

POST accepts `{ email, password, name }`. Validates, hashes password with bcrypt (rounds=12), inserts user, returns user object. Returns 409 if email exists.

**Step 6: Create `.env.local`**
```
NEXTAUTH_SECRET=<generate random 32-char string>
NEXTAUTH_URL=https://travelplaninfo.com
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
```

**Step 7: Build and commit**
```
npm run build && git add -A && git commit -m "feat: add NextAuth + SQLite for user auth and trip persistence"
```

---

### Task 8: Wire auth into existing UI

**Files:**
- Modify: `src/app/layout.tsx` (add SessionProvider)
- Modify: `src/app/signin/page.tsx`
- Modify: `src/app/register/page.tsx`
- Modify: `src/app/forgot-password/page.tsx`
- Modify: `src/components/Header.tsx`

**Step 1: Wrap app in SessionProvider (layout.tsx)**

Create a client wrapper component for SessionProvider. Wrap `{children}` in layout.

**Step 2: Rewrite signin page**

Replace `alert()` button with real NextAuth `signIn("credentials", ...)` call. On success redirect to `/planner`. On failure show error. Google button calls `signIn("google")` if configured.

**Step 3: Rewrite register page**

POST to `/api/register`, on success auto-sign-in and redirect to `/planner`.

**Step 4: Update forgot-password**

Show honest message: "Password reset is not yet available. Please register a new account or sign in with Google."

**Step 5: Update Header with session state**

If signed in: show user name + "My Trips" link + Sign Out button.
If not signed in: show current Sign In + Register buttons.

**Step 6: Build and commit**
```
npm run build && git add -A && git commit -m "feat: wire real auth into signin/register/header"
```

---

## Phase 3: Trip Planner (the product)

### Task 9: Trip CRUD API

**Files:**
- Create: `src/app/api/trips/route.ts` (list + create)
- Create: `src/app/api/trips/[id]/route.ts` (get + update + delete)
- Create: `src/app/api/trips/[id]/items/route.ts` (list + create items)
- Create: `src/app/api/trips/[id]/items/[itemId]/route.ts` (update + delete items)

**Step 1: Trips list + create**

`GET /api/trips` — all trips for authenticated user (auth check, 401 if not signed in).
`POST /api/trips` — create trip from body fields, return created trip.

**Step 2: Trip get + update + delete**

`GET /api/trips/[id]` — trip with all items, verify ownership.
`PUT /api/trips/[id]` — update trip fields.
`DELETE /api/trips/[id]` — cascade delete trip + items.

**Step 3: Trip items CRUD**

`POST /api/trips/[id]/items` — create item (day_number, category, title, description, affiliate_program, affiliate_url, price_estimate).
`PUT /api/trips/[id]/items/[itemId]` — update item.
`DELETE /api/trips/[id]/items/[itemId]` — delete item.

All routes verify trip ownership.

**Step 4: Build and commit**
```
npm run build && git add -A && git commit -m "feat: trip CRUD API with items"
```

---

### Task 10: Planner UI — trip creation flow

**Files:**
- Rewrite: `src/app/planner/page.tsx`
- Delete: `src/components/PlannerSubmit.tsx`
- Create: `src/components/TripForm.tsx`

**Step 1: Rewrite planner page**

Not signed in: show the form UI with CTA "Sign in to start planning" linking to `/signin?callbackUrl=/planner`.
Signed in: show saved trips list + "Create New Trip" button.

**Step 2: Create TripForm component**

Reuse the existing 5-step form (destination, dates, travelers, budget, interests). On submit, POST to `/api/trips`, redirect to `/planner/[tripId]`.

**Step 3: Delete PlannerSubmit.tsx**

**Step 4: Build and commit**
```
npm run build && git add -A && git commit -m "feat: real trip creation flow in planner"
```

---

### Task 11: Trip detail page — itinerary builder + affiliate engine

**Files:**
- Create: `src/app/planner/[tripId]/page.tsx`
- Create: `src/components/ItineraryBuilder.tsx`
- Create: `src/components/AffiliateRecommendations.tsx`

**Step 1: Trip detail page layout**

Route `/planner/[tripId]`:
- Left: trip summary (destination, dates, budget) — editable inline
- Center: day-by-day itinerary with items
- Right sidebar: contextual affiliate recommendations

**Step 2: ItineraryBuilder component**

- Items grouped by day_number
- "Add item" button per day with category selector (Hotel, Flight, Car Rental, Activity, Cruise, Restaurant, Note)
- Each item: title, description, price estimate, booked checkbox
- Items with `affiliate_url` show a "Book Now" link
- Edit/delete per item

**Step 3: AffiliateRecommendations component — THE MONEY PIECE**

Reads trip destination, budget, and interests. Suggests relevant CJ deals:
- Always: Hotels.com city search (`CJ_LINKS.hotelsCity(destination)`), Vrbo, EconomyBookings car comparison
- Conditional: CruiseDirect links if interests include cruise or destination is a cruise port
- Budget-aware: luxury → Hotels.com priority; budget → EconomyBookings priority

Each recommendation has "Add to Itinerary" button that creates a `trip_item` with pre-filled `affiliate_url`. User sees the item in their itinerary with a "Book Now" CJ link.

**Core monetization loop:** Plan trip → system suggests bookings → add to itinerary → click affiliate link → TPI earns commission.

**Step 4: Build and commit**
```
npm run build && git add -A && git commit -m "feat: itinerary builder with contextual affiliate recommendations"
```

---

## Phase 4: Content Infrastructure

### Task 12: Article content system (replace WP export)

**Files:**
- Create: `src/lib/articles.ts`
- Create: `content/articles/` directory
- Modify: `src/app/[slug]/page.tsx`
- Modify: `src/app/guides/page.tsx`
- Modify: `src/app/page.tsx`
- Delete: `src/content/posts.json` (after migration)

**Step 1: Define article JSON format**

Individual files at `content/articles/<slug>.json`:
```json
{
  "slug": "hilton-head-vacation-guide",
  "title": "...",
  "excerpt": "...",
  "content": "<article HTML>",
  "featuredImage": "/images/posts/hilton-head-hero.jpg",
  "categories": [{"name": "Destination Guides", "slug": "destination-guides"}],
  "date": "2026-03-12",
  "modified": "2026-03-12",
  "seo": { "title": "...", "description": "...", "canonical": "..." },
  "affiliateOpportunities": ["hotels", "vrbo", "cars"]
}
```

**Step 2: Create `src/lib/articles.ts`**

`getAllArticles()` — reads all JSON files from `content/articles/`, sorted by date desc.
`getArticle(slug)` — reads single article by slug.

**Step 3: Split posts.json into individual files**

Write a one-time migration script to split the monolithic JSON into per-slug files.

**Step 4: Update all pages to use articles.ts**

- `page.tsx`: `getAllArticles().slice(0, 6)` for latest articles
- `guides/page.tsx`: `getAllArticles()` for full list
- `[slug]/page.tsx`: `getArticle(slug)` + `generateStaticParams()` from `getAllArticles()`

**Step 5: Delete old posts.json**

**Step 6: Build and commit**
```
npm run build && git add -A && git commit -m "refactor: split monolithic posts.json into individual article files"
```

---

### Task 13: Content pipeline integration

**Files:**
- Create: `scripts/publish-article.sh`
- Create: `scripts/rebuild-if-changed.sh`

**Step 1: Create publish script**

Takes an assembled article JSON from the content pipeline, transforms it into TPI article format, copies to `content/articles/<slug>.json` and images to `public/images/articles/`.

**Step 2: Create rebuild trigger script**

Checks md5 hash of `content/articles/` directory. If changed since last check, runs `npm run build` and `pm2 restart tpi`.

**Step 3: Commit**
```
git add -A && git commit -m "feat: content pipeline integration scripts"
```

---

### Task 14: In-content contextual affiliate CTAs

**Files:**
- Create: `src/components/ArticleAffiliateCTA.tsx`
- Modify: `src/app/[slug]/page.tsx`

**Step 1: Create contextual CTA component**

Reads the article's `affiliateOpportunities` array and renders relevant CTAs:
- "hotels" → Hotels.com CTA with city search
- "vrbo" → Vrbo vacation rental CTA
- "cars" → EconomyBookings comparison CTA
- "cruises" → CruiseDirect CTA

Styled as helpful recommendation cards, not banner ads.

**Step 2: Inject CTAs between article sections**

Split content by `<h2>` tags. Insert a CTA after every 2nd H2 section for natural placement.

**Step 3: Build and commit**
```
npm run build && git add -A && git commit -m "feat: contextual in-article affiliate CTAs based on article opportunities"
```

---

## Phase 5: SEO & Polish

### Task 15: Schema markup (structured data)

**Files:**
- Modify: `src/app/[slug]/page.tsx` (Article + BreadcrumbList schema)
- Modify: `src/app/layout.tsx` (WebSite schema)

**Step 1: Add Article JSON-LD to blog posts** — headline, datePublished, dateModified, author, publisher, image, description.

**Step 2: Add BreadcrumbList JSON-LD** — matches existing visual breadcrumbs.

**Step 3: Add WebSite JSON-LD to homepage** — name, url, description.

**Step 4: Build and commit**
```
npm run build && git add -A && git commit -m "feat: add Article, BreadcrumbList, and WebSite schema markup"
```

---

### Task 16: Guides page category filter (make functional)

**Files:**
- Modify: `src/app/guides/page.tsx`

**Step 1: Convert to client component with filter state**

Add `"use client"`, manage `activeCategory` state. Filter articles by category on selection.

**Step 2: Wire filter buttons with onClick handlers and active styling**

**Step 3: Build and commit**
```
npm run build && git add -A && git commit -m "feat: functional category filter on guides page"
```

---

### Task 17: Newsletter email capture (real)

**Files:**
- Create: `src/app/api/newsletter/route.ts`
- Modify: `src/lib/db.ts` (add newsletter_subscribers table)
- Modify: all components with email forms

**Step 1: Add `newsletter_subscribers` table to SQLite schema**

Columns: id, email (unique), subscribed_at, source (which form).

**Step 2: Create newsletter API**

`POST /api/newsletter` — accepts `{ email, source }`, stores in SQLite, returns success. Deduplicates by email.

**Step 3: Wire all email forms across the site to POST to `/api/newsletter`**

Show success toast on subscribe. Show error if already subscribed.

**Step 4: Build and commit**
```
npm run build && git add -A && git commit -m "feat: real newsletter signup stored in SQLite"
```

---

## Phase 6: E2E Tests

### Task 18: Rewrite E2E tests

**Files:**
- Rewrite: `tests/e2e/home.test.js`
- Create: `tests/e2e/auth.test.js`
- Create: `tests/e2e/planner.test.js`
- Create: `tests/e2e/articles.test.js`
- Modify: `playwright.config.ts`

**Step 1: Update playwright config**

Change BASE URL to `http://localhost:3000` (or `process.env.BASE_URL`).

**Step 2: Rewrite home tests**

Remove: stats row, KPI cards, hero chips tests.
Add: homepage title, hero CTAs, TripModes, Latest Articles, Featured Destinations, Hot Deals affiliate links, footer.

**Step 3: Auth tests**

Register new user → redirect to planner. Sign in → redirect to planner. Sign out → redirect to home. Protected routes → redirect to signin.

**Step 4: Planner tests**

Unauthenticated → "Sign in to start planning". Authenticated → create trip, add items, affiliate recommendations appear, "Add to Itinerary" works.

**Step 5: Article tests**

Article page renders, breadcrumbs work, affiliate sidebar renders, in-content CTAs match article opportunities.

**Step 6: Run all tests and commit**
```
npx playwright test && git add -A && git commit -m "test: rewrite E2E tests for auth, planner, articles, homepage"
```

---

## Phase 7: VPS Deployment

### Task 19: Server setup (SSDNodes VPS)

**Step 1: Install Node.js 20 LTS + PM2**

**Step 2: Create site directory at `/var/www/travelplaninfo.com`**

**Step 3: Clone repo, install deps, create .env.local with production values, build**

**Step 4: Create PM2 ecosystem config**

Run Next.js on port 3001 (behind Nginx). Auto-restart, 512M memory limit.

**Step 5: Start with PM2, save, enable startup**

---

### Task 20: Nginx + SSL

**Step 1: Create Nginx reverse proxy config for travelplaninfo.com**

Proxy to 127.0.0.1:3001. Cache static assets. Serve images directly.

**Step 2: Get SSL via Certbot/Let's Encrypt**

**Step 3: Verify HTTPS works**

---

### Task 21: Rebuild trigger

**Step 1: Install cron job that checks `content/articles/` every 15 minutes**

Compares md5 hash of article directory. If changed, runs build + PM2 restart.

---

### Task 22: DNS cutover + WordPress retirement

**Step 1: Update A record to VPS IP**

**Step 2: Wait for propagation, verify site loads**

**Step 3: Add 301 redirects for any changed WP URLs**

**Step 4: Disable WordPress (keep backup 30 days)**

**Step 5: Resubmit to Booking.com Travelpayouts** — run `generate_tp_links.py --site travelplaninfo`

**Step 6: Submit sitemap to Google Search Console**

---

## Task Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1. Clean House | 1-6 | Remove dead code, fix domain, localize images, clean content |
| 2. Auth & DB | 7-8 | NextAuth + SQLite + wire into UI |
| 3. Planner | 9-11 | Trip CRUD API, creation flow, itinerary builder + affiliate engine |
| 4. Content | 12-14 | Article system, pipeline integration, contextual CTAs |
| 5. SEO & Polish | 15-17 | Schema markup, category filter, newsletter |
| 6. E2E Tests | 18 | Rewrite all tests for new functionality |
| 7. VPS Deploy | 19-22 | Server setup, Nginx, SSL, rebuild trigger, DNS cutover |

**Total: 22 tasks across 7 phases.**
