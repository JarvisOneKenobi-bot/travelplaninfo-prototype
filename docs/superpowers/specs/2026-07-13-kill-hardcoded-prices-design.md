# Kill the Remaining Hardcoded Prices

**Date:** 2026-07-13
**Repo:** `travelplaninfo-prototype`
**Branch:** `fix/kill-hardcoded-prices` (worktree off `main` @ `4d5a1e7`)
**Status:** Spec — pending plan
**Related:** PR #7 (Surprise Me de-fabrication). Same disease, different surfaces.

---

## 1. Problem

PR #7 removed fabricated inventory from Surprise Me. **Three other surfaces are still serving invented prices to real visitors,** verified live against `https://travelplaninfo.com`:

| Surface | Invented literals | Example |
|---|---|---|
| `/[locale]/destinations` | **24** | `flightsFrom: "From $99"` · `hotelsFrom: "From $79/night"` (rendered at `page.tsx:275,278`) |
| `/hot-deals` | **4** | `"From $79/night"` · `"From $19/day"` · `"From $199/person"` |
| `src/config/affiliates.ts` | **8** | `price: "$79"` · `"$899"` — rendered by **five** components incl. `AffiliateSidebar` (article pages) |

**36 literals. 15 of them are hotel-per-night claims.** Nothing sources, refreshes, or validates any of them. They are decoration shaped like data.

## 2. Why "wire them to live data" is not the fix

The obvious remedy — replace the fake numbers with real TravelPayouts prices — **does not work, and understanding why is what makes this change principled rather than a matter of taste.**

> **A flight price with no origin is not a price.**

The `/destinations` card for Miami says **"✈️ From $99"**. From *where*? Anchorage? London? The number is unanswerable without a departure airport, and a marketing page has none — the user's origin only exists inside the planner flow. The same holds for `"Hotels.com · $79"` with no city and no dates, and for `"CRUISES From $199/person"` with no ship, route, or date.

So these values are not merely *unsourced*; they are **unanswerable in context**. There is no data source, present or future, that could make them true. TravelPayouts cannot help. A hotel API — which TPI does not have and will not have under D3 — could not help either.

**Therefore they are deleted, not replaced.** This is the same conclusion D3 reached for fabricated hotel inventory, applied to the surfaces D3 missed.

## 3. Goals / Non-Goals

**Goals**

- G1. Remove **every** hardcoded price literal from the three surfaces. Zero invented numbers reach a user.
- G2. **Preserve the commercial function.** The affiliate CTAs ("Find Hotels", "Search Flights", "Browse Rentals") stay and keep working — this is a monetization surface and must not be gutted. Only the *fake numbers* go.
- G3. A regression guard that fails the build if a price-shaped literal reappears on these surfaces — the PR #7 lesson: the fix is worth less than the guard that keeps it fixed.
- G4. The pages must still look intentional, not visibly gutted. Cards keep image, name, description, and CTA.

**Non-Goals**

- Wiring live prices into marketing pages (see §2 — impossible without an origin, not merely out of scope).
- Redesigning `/destinations` or `/hot-deals`.
- The Atlas/Surprise Me surfaces (done in PR #7).
- Deploying. `main` stays deployable; this merges on Jose's word after visual review.

## 4. Design

### 4.1 `/[locale]/destinations`
Drop `flightsFrom` / `hotelsFrom` from the destination objects (24 literals) and remove the two `<p>` elements at `page.tsx:275,278`. The card keeps its image, name, region, and description, and gains nothing fake. Verify the card doesn't collapse visually with two lines removed.

### 4.2 `/hot-deals` — ⚠ FAR WORSE THAN FOUR BAD NUMBERS (amended 2026-07-13 after viewing production)

The page is `"use client"` with **no `fetch`, no `await`, no revalidation — it is 100% static constants** — and it presents itself as a **"LIVE DEAL FEED"** of specific, urgent, time-limited offers. All of it is invented:

- **"LIVE DEAL FEED"** — nothing on the page is live. Flatly false.
- **A fabricated featured offer:** *"Caribbean Cruise from Miami — CruiseDirect · 5-night all-inclusive from Port Everglades · **$349** · Includes meals, entertainment & port stops at Nassau + Cozumel."* An invented product with a fictional itinerary.
- **A fabricated deal feed:** "Miami Beach Hotels — **Tonight's Deals** — $79" · "Cancún All-Inclusive Resorts — $899" · "NYC Vacation Apartments — $159" · "Bahamas Cruise — 3 Nights — $199" …
- **Invented urgency and scarcity:** *"Up to **45% off** Miami Beach stays **tonight**"* · *"**Last minute** cruise deals … **Limited inventory**"*
- The 4 category stat tiles (`From $79/night`, `From $129/night`, `From $19/day`, `From $199/person`).

> **A fabricated price is dishonest. A fabricated time-limited offer with manufactured scarcity is a different category of claim** — "tonight", "last minute", "limited inventory", "45% off" are assertions about availability and discount that no data backs, because there is no feed. Every urgency/scarcity/discount claim is treated as fabrication here.

**Remove** all of the above. **Keep** — these are the *partners'* descriptions of their own service, not offers we invent, and they are the part that earns:
- partner names/branding (Hotels.com, Vrbo, CruiseDirect, EconomyBookings);
- generic partner value props ("Free cancellation", "500+ suppliers", "Entire home rentals");
- **every affiliate CTA and its tracking link** ("View rates", "Browse homes", "Grab a deal", "Compare cars").

Result: an honest partner directory. **Do NOT redesign the layout and do NOT invent replacement offers.** If a section is left visibly empty, report it rather than filling it with something made up.

### 4.3 `src/config/affiliates.ts`
Remove the `price` field from the deal objects (8 literals) and from every consumer: `AffiliateSidebar.tsx`, `PackageDealsCarousel.tsx`, `DesignA.tsx` (+ check `ItineraryBuilder.tsx`, `AssistantChat.tsx`). The card keeps partner, title, description, and its booking CTA — which is the part that actually earns.

This is the highest-blast-radius file: it renders on **article pages**, so fake prices are currently sitting next to editorial content.

### 4.4 The guard (G3)
A unit test asserting that the three surfaces contain **no price-shaped literal** (`/\$\d/`, `/night`, `/day`, `/person`).

⚠ **Must be scoped, not repo-wide** — a repo-wide ban is unsatisfiable (prices legitimately exist in the TP client, in tests, and in Surprise Me's honest live data). Scope it to exactly: `destinations/page.tsx`, `hot-deals/page.tsx`, `affiliates.ts`. This is the self-defeating-gate class that has now been caught in **five** prior plans in this repo — do not make it six.

## 5. Testing

- **Guard (§4.4)** — must **fail against `main`** (36 literals), pass after. Demonstrate the pre-fix failure.
- **Consumers compile** — removing `price` from the affiliate type must not leave a dangling reference; the type change should make any missed consumer a compile error (prefer that over a runtime `undefined`).
- **Commercial function intact** — the affiliate CTAs still render and still carry their tracking links (assert the link `href`s survive; a monetization regression is a real regression).
- **Visual** — screenshot `/destinations`, `/hot-deals`, and an article page (sidebar) in EN, before/after. The PR #7 lesson: this class of bug is found by eye, not by tests. Jose reviews before any deploy.
- Gates: lint 0 errors · unit (all pass) · build clean · Playwright 41/41 (this branch's baseline is `main`, i.e. 41 — **not** PR #7's 43).

## 6. Risks

| Risk | Mitigation |
|---|---|
| Cards look empty/broken with the price line gone | Visual review in EN before merge; adjust spacing if the card collapses |
| Removing `price` breaks a consumer at runtime | Remove it from the *type* so a missed consumer fails the build, not the page |
| Monetization regression (CTAs lost with the prices) | Explicit test that affiliate CTA links survive — G2 |
| Guard written repo-wide → unsatisfiable | Scope to the three files; reason about what it matches before writing it |
| Conflicts with PR #7 | Different files; PR #7 does not touch these three. Branch off `main`, merge after #7. |

## 7. Follow-up (not this change)

The honest way to show a price on a marketing page is to **ask for the origin first** — which is what the planner already does. If the destination cards should carry live pricing, the card becomes a planner entry point ("see flights from *your* airport"), not a static number. That is a product change, and it is Jose's call.
