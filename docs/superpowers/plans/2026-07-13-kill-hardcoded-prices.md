# Plan — Kill the Hardcoded Prices & Fabricated Offers

**Spec:** `docs/superpowers/specs/2026-07-13-kill-hardcoded-prices-design.md`
**Branch:** `fix/kill-hardcoded-prices` (worktree `.worktrees/kill-prices`, off `main` @ `4d5a1e7`)
**Status:** Plan v2 — SOL XHIGH review folded (verdict on v1: **NO**)
**Review:** `docs/superpowers/reviews/2026-07-13-kill-hardcoded-prices-plan-review.md` (22 findings)

## v2 changelog — what SOL broke and how v1 was wrong

| # | SOL finding | Fold |
|---|---|---|
| 1 | **CRITICAL — a 4th surface.** `AffiliateInlineCTA.tsx:20` ships `🏨 Hotels from $79` as **JsxText inside a live CTA**, on article pages *and* the planner. Spec AND plan v1 both missed it. | **Added as F4** (Task 4b). Verified: rendered by `[locale]/[slug]/page.tsx` + `[locale]/planner/[tripId]/page.tsx`. |
| 12-16 | **CRITICAL — my replacement copy was itself invented.** v1 justified new `savings` badges as "partner claims already in the repo" — but "No booking fees" occurs *only* in the string being scrubbed (circular), "Weekly stays available" exists **nowhere** (I made it up), and `Member prices available` advertises a benefit `getAffiliateUrl()` does not route to (`CJ_LINKS.hotelsMemberPrices` has **zero consumers**). | **Structural fix: stop inventing. `savings` is DELETED from the type** alongside `price`. No substitute copy. An honest card with no badge beats a badge with a fabricated claim — the spec's own rule. |
| 2 | CRITICAL — `Late-night hotel deals` (hot-deals:106) is time-bound urgency that `/tonight/i` does not match. | Reworded + `/late[-\s]?night/i` added to Arm B. |
| 4 | MAJOR — urgency arm ran on F2 only, so `Tonight's Deals` / `Save up to 40%` / `Up to 75% off` in **affiliates.ts** could return unguarded. | Arm B extended to F3 — **scoped to the `DEALS` subtree** (see carve-out below). |
| 5 | MAJOR — fabricated durations (`5-night all-inclusive`, `3 Nights`) evade every pattern. | `/\b\d+[-\s]nights?\b/i` added to Arm B. |
| 7 | MAJOR — AST walk is not recurrence-safe: `<span>{349}</span>` / `"$" + 349` evade a token-only guard. | NumericLiteral-in-JSX + concat hardening **and** Arm E (rendered-DOM), which is evasion-proof by construction. |
| 8,9,10,11 | MAJOR — **Arm D was theater.** `AffiliateSidebar` renders 4 `CJ_BANNERS` anchors, so "≥3 anchors" passes even if **all 3 deal links vanish**. It also never exercised DesignA / PackageDealsCarousel / the two hot-deals loops. | Arm D rewritten: **exact `href` asserted per CTA**, no aggregate counts. New **Arm E** (Playwright) covers every consumer on the real rendered pages. |
| 20 | MINOR — `0 errors` lets warnings regress above the 30 baseline. | Gate is now **0 errors AND ≤30 warnings**. |
| 21 | MINOR — stale pid. | Already handled: `885336` was `.worktrees/surprise-me` (**PR #7's code — the exact trap**); killed, replaced with pid `911990` cwd-verified to this worktree. |

**Carve-out, documented deliberately (SOL #6):** `CJ_BANNERS` headlines (`Save 10%+ with Member Prices`, `Cruises Up to 75% Off`) are **advertiser-supplied creative displayed inside advertiser-branded banners with the advertiser named on them**. They are the partner's claim, not ours — the coordinator's KEEP list. They stay, and Arm B is scoped to the `DEALS` subtree so the gate stays satisfiable. **Flagged for Jose** (§3).

---

## 0. What the audit found that the spec did not

The spec says **36 literals across 3 files**. The tree says otherwise. Corrections (verified by grep, cited below):

| Surface | Spec said | Actually |
|---|---|---|
| `destinations/page.tsx` | 24 | **24** ✅ |
| `hot-deals/page.tsx` | 4 | **5** — the spec missed the `$349` featured-offer card (`:74`) |
| `affiliates.ts` | 8 `price:` | **12 user-facing** — 8 `price:` + 3 `subtitle:` (`$79/night`, `$899`, `$500`) + 1 `savings:` (`$500`) |
| **i18n `messages/*/common.json`** | *not mentioned* | **6 locales** carry the false `"Live Deal Feed"` tagline — **it is not in any of the three files** |

**Total user-facing price literals: 41, not 36.** Plus a whole category the spec missed: **fabricated urgency**.

Governing authority is spec **G1** ("remove *every* price literal; zero invented numbers reach a user") plus the
coordinator's scope expansion. The `36` is descriptive, not prescriptive — the extras are the same disease and are removed.

### 0.1 The four traps (each one has killed a prior plan in this repo)

1. **`$349` is JsxText, not a StringLiteral** (`<p …>$349</p>`, hot-deals:74). A guard that walks only string
   literals passes it straight through and *looks* complete. The guard MUST walk `JsxText`. The pre-fix failure
   output must name `$349` explicitly — that is the proof the JsxText branch actually fires.
2. **`affiliates.ts` has 4 legit `$` in COMMENTS** — `// evergreen $138.91 EPC`, `// $154.50 EPC`, `// top EPC
   $280.26`, `// $5.68 EPC`. These are internal affiliate earnings-per-click notes. They are **not user-facing**
   and must **survive**. A raw-source regex guard fails on them forever → unsatisfiable gate → plan #6.
   **A TS-AST token walk excludes comments by construction.** This is why the guard is AST-based, not regex-on-source.
3. **`"Live Deal Feed"` is `t("tagline")`** — it lives in `messages/{de,en,es,fr,it,pt}/common.json`, *outside*
   the three files. A guard scoped to only the three files would report green while the lie stays on the page.
   The guard therefore gets a 4th, **namespace-scoped** i18n arm.
4. **A repo-wide ban is unsatisfiable.** `/night`, `/day`, `$` and "last minute" legitimately exist in the
   TravelPayouts client, Atlas cards (live data), article content, and `messages` keys `perNight`/`perDay`/
   `hotelsFrom`. Scope: **exactly 3 files + exactly the `hotDeals` i18n namespace.** Nothing else.

### 0.2 Confirmed non-risks (checked, do not "fix")

- **`PackageDealsCarousel.scoreDeal()` does NOT read `deal.price`** (scores on `program`/`id`/`interests`,
  `PackageDealsCarousel.tsx:17-29`). Removing `price` is display-only — **no scoring regression**.
- **Atlas `.price` / `.price_night` / `.price_estimate`** (FlightCard, HotelCard, DealCard, TripResultsModal,
  ActivityCard, AssistantChat, ItineraryBuilder, `travelpayouts-client.ts`) are a **different type carrying live
  TravelPayouts data**. **DO NOT TOUCH.** Reaching for these is exactly the repo-wide trap.

---

## 1. Baselines — captured on the UNTOUCHED tree (evidence, pre-any-edit)

| Gate | Baseline | Captured |
|---|---|---|
| `npx eslint .` | **0 errors**, 30 warnings | ✅ |
| `npm run test:unit` | **13 files / 80 tests passed** | ✅ |
| `npx playwright test` | **41** (this branch's baseline is `main` — NOT PR #7's 43) | Task 1 |
| Guard pre-fix | **MUST FAIL** | Task 3 |

⚠ **Playwright needs a dev server on :3001** (`playwright.config.ts` has no `webServer` block). A `next-server`
is **already listening on :3001 (pid 885336)** — it is from the OTHER worktree and would test the WRONG CODE.
Kill it and start `npx next dev -p 3001` **from this worktree**. `npm run build` kills the dev server — restart
before e2e. If every e2e fails in ~300ms, the server is dead.

---

## 2. Tasks

### Task 1 — Playwright baseline on THIS worktree
Kill the foreign :3001 server, start this worktree's, run `npx playwright test`.
**Expected:** `41 passed`. Record verbatim. If ≠41, STOP and report.

---

### Task 2 — The regression guard (written FIRST, must FAIL) → `src/test/no-fabricated-claims.test.ts`

Lives under `src/` (vitest `include: ['src/**/*.test.{ts,tsx}']` — a test in `tests/` would silently never run).

**Mechanism: TypeScript compiler API token walk.** `typescript@5.7.3` is a direct dep and imports cleanly in
vitest/jsdom (it is pure JS — Hermes must confirm before building on it; fallback in §4).

```
SCOPE (exhaustive — nothing else):
  F1 src/app/[locale]/destinations/page.tsx
  F2 src/app/[locale]/hot-deals/page.tsx
  F3 src/config/affiliates.ts          → Arm A: whole file. Arm B: DEALS subtree ONLY.
  F4 src/components/AffiliateInlineCTA.tsx      ← SOL #1. Live on article + planner pages.
  I1 messages/{de,en,es,fr,it,pt}/common.json  → ONLY the `hotDeals` namespace
```

**Arm A — price shape (F1, F2, F3, F4).** Parse with `ts.createSourceFile(…, /*setParentNodes*/ true, ts.ScriptKind.TSX)`.
Walk and collect the `.text` of:
  - `ts.isStringLiteral`
  - `ts.isNoSubstitutionTemplateLiteral`
  - `ts.isTemplateHead | isTemplateMiddle | isTemplateTail`
  - **`ts.isJsxText`**  ← the `$349` (hot-deals:74) and `Hotels from $79` (AffiliateInlineCTA:20) catcher. Non-negotiable.
Assert no collected text matches:
```
PRICE = /\$\s?\d/        // $349, $ 79
UNIT  = /\/night|\/day|\/person/i   // slash-anchored: "5-night" must NOT match
```
Comments are not tokens → the 4 EPC notes survive. Verified safe: URLs/classNames in these files contain no
`$`+digit; `${expr}` in template literals is `$` + `{`, not a digit.

**Recurrence hardening (SOL #7)** — a token-only walk is evadable: `<span>{349}</span>`, `<span>${349}</span>`,
`"$" + 349`, `` `$${349}` `` all slip through because neither `"$"` nor the numeric token matches `/\$\s?\d/`
alone. Additionally flag, within F1-F4:
  - any `ts.isJsxExpression` whose expression is a `ts.isNumericLiteral`;
  - any `ts.isBinaryExpression` (`+`) or template expression that concatenates a `$`-ending string with a numeric
    literal.
This closes the named evasions at the source level. **Arm E closes them at the render level**, which is
evasion-proof by construction — a computed price still appears in the DOM text.

**Arm B — fabricated urgency / invented offers.** Same token set. Applies to **F2 (whole), F4 (whole), and F3's
`DEALS` array subtree ONLY** (locate the `DEALS` VariableStatement and walk that node). Assert no match:
```
/live\s*deal\s*feed/i · /tonight/i · /late[-\s]?night/i · /last[-\s]?minute/i
/limited inventory/i  · /\d+\s*%\s*off/i · /save\s+(up\s+to\s+)?\d+\s*%/i
/weekly discounts/i   · /\b\d+[-\s]nights?\b/i   ← fabricated durations: "5-night", "3 Nights"
```
**`CJ_BANNERS` is deliberately EXCLUDED from Arm B** — advertiser-supplied creative in advertiser-branded banners
(see carve-out above). Scoping Arm B to the `DEALS` subtree is what keeps this gate **satisfiable**; running it
over the whole of F3 would fail forever on `Cruises Up to 75% Off` → plan #6.

**Arm C — i18n (I1, `hotDeals` namespace only).** Every string value in `hotDeals` for all 6 locales must
match none of Arm A's patterns nor:
```
/\blive\b/i  (en "Live Deal Feed", de "Live-Angebote")
/\bfeed\b/i  (es/pt "Feed de Ofertas", it "Feed Offerte")
/\bflux\b/i  (fr "Flux d'Offres")
```
Namespace-scoped so `perNight: "/day"`, `hotelsFrom: "Hotels from {price}/night"` (Atlas, real data) are untouched.

**Arm D — G2 MONETIZATION GUARD (must pass BEFORE and AFTER — never allowed to go red).**
*v1's Arm D was theater (SOL #8-#11): `AffiliateSidebar` renders 4 `CJ_BANNERS` anchors, so an "≥3 anchors"
assertion stays green even if **all three deal links are deleted**. Rewritten:*
1. **All 8 deals:** `getAffiliateUrl(deal)` returns an `https://` URL on a known CJ tracking domain
   (`dpbolvw.net|jdoqocy.com|tkqlhce.com|anrdoezrs.net|kqzyfj.com`). Assert all 8 `id`s and all 8 `cta`s still exist.
2. **Every `CJ_LINKS` function** — not the v1 subset. Iterate the whole object (`hotels`, `hotelsMemberPrices`,
   `hotelsCity("Miami")`, `vrbo`, `cruises`, `cruisesHoneymoon`, `cruisesFamily`, `cruisesLastMinute`,
   `cruisesBahamas`, `cruisesCarnival`, `cruisesDisney`, `cruisesCelebrity`, `cars`, `carsCompare`); each returns a
   non-empty CJ `https://` URL. **`airAdvisor` is the one documented exemption** (non-CJ URL, program status "New").
3. All 4 `CJ_BANNERS` entries keep a CJ `url`.
4. **Render `AffiliateSidebar`** (`@testing-library/react` v16.3.2; no `next-intl` dep → renders standalone).
   For each of the 3 rendered deals (`DEALS.slice(0,3)`), query the link **by its CTA text** and assert its
   **exact `href`** equals `getAffiliateUrl(deal)`. **No aggregate anchor counts** — that is what made v1 theater.
   Assert the 4 banner anchors carry their exact `url`s too.

**Arm E — RENDERED-DOM guard (Playwright, `tests/e2e/no-fabricated-claims.spec.ts`).** *This is the arm that
cannot be evaded — it inspects what the user actually sees, so computed/concatenated prices (SOL #7) and lost
CTAs on consumers the unit test never renders (SOL #10) both surface here.*
On `/en/hot-deals`, `/en/destinations`, and one article page (renders `AffiliateSidebar` + `AffiliateInlineCTA`):
1. `document.body.innerText` matches **none** of the Arm A price patterns nor the Arm B urgency patterns.
2. **Monetization:** every affiliate CTA anchor is still present and its `href` still points at a CJ/TP tracking
   domain. On `/hot-deals`: the 4 hero CTAs + all 8 `DEALS` CTAs (both loops) + the 4 program cards + the featured
   CruiseDirect card. On `/destinations`: all 3 CTAs per card (`flightUrl`, `hotelsCity`, `carsUrl`).
   On the article page: the `AffiliateInlineCTA` anchors + sidebar deal anchors.
   *This covers `DesignA`, `PackageDealsCarousel` and both hot-deals loops, which Arm D cannot reach.*
   ⚠ Playwright baseline is **41**; this adds tests. Record the new total and confirm the delta is exactly the
   new file's tests — **no pre-existing test may break**.

**FAILURE OUTPUT FORMAT (a deliverable, not a nicety):** `file:line: "matched text"` per violation, plus a
total count. Illegible failure output = no evidence.

**Gate:** run `npx vitest run src/test/no-fabricated-claims.test.ts` against the **untouched** source.
**Expected: Arms A/B/C FAIL, Arm D PASSES.** Capture verbatim. The failure list MUST include, by name:
  - `hot-deals/page.tsx:74: "$349"`            ← proves the **JsxText** branch fires
  - `AffiliateInlineCTA.tsx:20: "Hotels from $79"` ← proves **F4** is in scope
**If either is absent, the guard is broken — fix the guard before touching any source.**

---

### Task 3 — `src/config/affiliates.ts`

**3a. Type:** delete **BOTH** `price: string;` **and** `savings: string;` from `interface AffiliateDeal`.
*(This makes every missed consumer a COMPILE error, not a runtime `undefined` — the type IS the consumer census.)*

**Why `savings` dies too (SOL #12-#16 — the finding that broke plan v1).** v1 kept the green badge and refilled it
with "partner claims already asserted in the repo". SOL checked each one against the tree and they were **not
backed**:
- `No booking fees` — occurs **only** in the very string v1 was scrubbing (`hot-deals:119`). v1 cited the claim as
  provenance **for itself**. Circular.
- `Weekly stays available` — exists **nowhere in the source tree**. v1 invented it outright.
- `Member prices available` — advertises a benefit the landing link does not deliver: `getAffiliateUrl()` routes
  hotels deals through `CJ_LINKS.hotels()`, and **`CJ_LINKS.hotelsMemberPrices` has zero consumers**.
- `Free cancellation` / `Compare 500+ suppliers` — repetition of our own unverified marketing copy is not partner
  evidence, and a generic affiliate landing URL does not guarantee those terms for every result.

Replacing an invented discount with an invented benefit is **not** a fix. So we invent nothing: the `savings`
field and its green badge are **deleted**. A card with no badge is honest; a badge with a fabricated claim is not
— the spec's own rule, applied to itself.

**3b. Scrub the 8 `DEALS` entries.** Delete every `price:` and `savings:`. Rewrite invented product offers
("5-night all-inclusive", "Tonight's Deals", "3 Nights") into **factual category descriptors** — which is what the
links actually do. **Rewords, not deletions**: stripping `$79/night` from `"Beachfront from $79/night"` would leave
the live string `"Beachfront from"`. **No claims, no numbers, no adjectives we cannot source:**

| id | title → | subtitle → |
|---|---|---|
| `hotels-miami-beach` | `Miami Beach Hotels` *(drop "— Tonight's Deals")* | `Hotels.com · Miami Beach stays` |
| `vrbo-miami-condo` | `Miami Vacation Rentals` *(unchanged)* | `Vrbo · Entire homes & condos` *(unchanged — describes Vrbo's inventory type, a fact)* |
| `cars-miami` | `Miami Car Rentals` *(drop "— All Brands Compared")* | `EconomyBookings · Compare car-rental suppliers` *(drop unverified "500+")* |
| `cruisedirect-caribbean` | `Caribbean Cruises from Miami` *(category, not an offer)* | `CruiseDirect · Caribbean sailings` |
| `hotels-cancun` | `Cancún All-Inclusive Resorts` *(unchanged)* | `Hotels.com · Cancún resorts` *(drop "7 nights from $899")* |
| `cars-cancun` | `Cancún Car Rentals` *(unchanged)* | `EconomyBookings · Cancún car rentals` *(drop "Free cancellation options")* |
| `vrbo-nyc-apartment` | `NYC Vacation Apartments` *(unchanged)* | `Vrbo · Manhattan & Brooklyn stays` *(unchanged — factual)* |
| `cruisedirect-bahamas` | `Bahamas Cruises` *(drop "— 3 Nights")* | `CruiseDirect · Bahamas sailings` *(drop "Up to $500 onboard credit")* |

**3c. DO NOT TOUCH:** `CJ_LINKS`, `TP_CONFIG`, `TP_KLOOK`, `getAffiliateUrl`, **`CJ_BANNERS`** (advertiser
creative — see carve-out), the `url:` deep-link overrides, all 8 `id`/`program`/`cta` values, and **the 4 EPC
comments** (`$138.91`, `$154.50`, `$280.26`, `$5.68`). Deleting an `id` or a `cta` is a monetization regression.

**Gate:** `npx tsc --noEmit` → the compile errors ARE the exhaustive render-site census. **Expect exactly 9.**

---

### Task 4 — The 9 render sites (fix the compile errors from Task 3) + the 4th surface

**4a. Delete only the price/savings `<span>`s. Touch nothing else in these components.**

| File | Line | Delete | Field |
|---|---|---|---|
| `src/components/AffiliateSidebar.tsx` | 21 | `<span …>{deal.price}</span>` | price |
| `src/components/AffiliateSidebar.tsx` | 19 | the `{deal.savings}` badge `<span>` | savings |
| `src/components/DesignA.tsx` | 70 | `<span …>{deal.price}</span>` | price |
| `src/components/DesignA.tsx` | 69 | `<span …>{deal.savings}</span>` | savings |
| `src/components/PackageDealsCarousel.tsx` | 124 | `<span …>{deal.price}</span>` | price |
| `src/components/PackageDealsCarousel.tsx` | 119 | `<span …>{deal.savings}</span>` | savings |
| `src/app/[locale]/hot-deals/page.tsx` | 96 | `<span className="text-gray-400 ml-2">— {d.price}</span>` | price |
| `src/app/[locale]/hot-deals/page.tsx` | 148 | `<span …>{deal.price}</span>` | price |
| `src/app/[locale]/hot-deals/page.tsx` | 147 | `<span …>{deal.savings}</span>` | savings |

The surrounding `<a href={getAffiliateUrl(deal)}>`, `title`, `subtitle` and `cta` **all stay**. Where price+savings
shared a `justify-between` flex row, that row is now empty — **remove the empty wrapper div**, don't leave phantom
spacing. Confirm visually (G4).

⚠ **`src/components/atlas/DealCard.tsx:21-23` uses `deal.savings_pct`** — a **different type carrying live Atlas
data**. DO NOT TOUCH.

**4b. `src/components/AffiliateInlineCTA.tsx:20` — the 4th surface (SOL #1, CRITICAL).**
`🏨 Hotels from $79` is **JsxText inside a live `<a href={CJ_LINKS.hotels()}>` CTA**, rendered on **article pages**
(`[locale]/[slug]/page.tsx`) **and the planner** (`[locale]/planner/[tripId]/page.tsx`). Neither the spec nor plan
v1 saw it.
- Change the label to `🏨 Find Hotels` — matching the honest-CTA pattern of its two siblings
  (`🏡 Vacation Rentals`, `🚢 Cruise Deals`).
- **KEEP the `<a>`, the `href`, and `rel="noopener noreferrer sponsored"`.** Only the number goes.

**Gate:** `npx tsc --noEmit` → **0 errors**.

---

### Task 5 — `src/app/[locale]/hot-deals/page.tsx` (the fabricated-urgency surface)

The page is `"use client"` with **no fetch, no await, no revalidate** — 100% static constants — yet it presents
itself as a live feed of urgent, time-limited offers. Every claim below is invented. Remove the untrue statements;
**keep structure and function** (no redesign, no replacement offers).

**5a. Stat tiles (`:50-54`)** — replace the invented `value` with the partner that actually serves the category.
Honest, keeps the tile intentional (G4):
```
{ label: "HOTELS",      value: "Hotels.com",      icon: "🏨" }
{ label: "RENTALS",     value: "Vrbo",            icon: "🏡" }
{ label: "CAR RENTALS", value: "EconomyBookings", icon: "🚗" }
{ label: "CRUISES",     value: "CruiseDirect",    icon: "🚢" }
```

**5b. Featured "deal" card (`:66-81`)** — an entirely invented product offer with a fictional itinerary.
- DELETE `$349` (`:74`) — the JsxText literal.
- DELETE the fictional itinerary line `:73` `"CruiseDirect · 5-night all-inclusive from Port Everglades"`
  and `:75` `"Includes meals, entertainment & port stops at Nassau + Cozumel"`.
- Retitle `:71` `"Caribbean Cruise from Miami"` → `"Caribbean Cruises from Miami"` (a category, not an offer).
- Replace the `t("featuredDeal")` eyebrow with the existing `t("cruises")` ("CruiseDirect") — **or**, if that
  reads wrong, keep the eyebrow and let Jose call it. Add an honest partner descriptor
  (`"Compare Caribbean sailings on CruiseDirect."`).
- **KEEP** the `<a href={CJ_LINKS.cruises()}>` wrapper and the `"View on CruiseDirect →"` CTA. **This card must
  remain a working, clickable affiliate link.**

**5c. Program cards (`:104-127`)** — strip fabricated urgency/discount; keep partner value props.
- `:106` heading `"Late-night hotel deals"` → `"Miami Beach hotels"` — **SOL #2 (CRITICAL):** "Late-night" is
  time-bound urgency of exactly the prohibited class, and `/tonight/i` does **not** match it. Guarded by
  `/late[-\s]?night/i`.
- `:107` `"Up to 45% off Miami Beach stays tonight."` → `"Compare Miami Beach stays on Hotels.com."`
  *(invented discount + invented time-bound scarcity)*
- `:118` heading `"Last minute cruise deals"` → `"Cruise deals"` *(invented urgency)*
- `:119` `"Best price guarantee. No booking fees. Limited inventory."` → `"Compare cruise fares on CruiseDirect."`
  **Revised per SOL #13:** v1 kept "Best price guarantee. No booking fees." as "partner claims" — but SOL showed
  `No booking fees` appears **nowhere else in the tree**, so citing it as its own provenance was circular. We
  cannot substantiate either claim, so **all three sentences go**, not just "Limited inventory."
- `:116` **the `CJ_LINKS.cruisesLastMinute()` href STAYS.** It is a CJ tracking URL, not a user-visible claim.
  Renaming it is a monetization risk for zero honesty gain.
- Vrbo (`:110-115`) and EconomyBookings (`:122-127`) cards: **unchanged** — they describe the partner's service
  ("Entire home rentals", "Perfect for families & groups", "500+ suppliers"), per the coordinator's KEEP list.

**5d. KEEP untouched:** all 4 hero CTAs (`:33-44`), all `CJ_LINKS.*` hrefs, `rel="…sponsored"`, the `DEALS` map
loops, `NewsletterForm`, `HelpButton`, the disclosure.

---

### Task 6 — i18n (`messages/{de,en,es,fr,it,pt}/common.json`, `hotDeals` namespace)

**6a. `hotDeals.tagline`** — every locale claims a live/streaming offer feed. There is no feed. Drop the false
prefix, keep the category list (minimal honest edit, no redesign):

| locale | from | to |
|---|---|---|
| en | `Live Deal Feed · Hotels · Vacation Rentals · Car Rentals · Cruises` | `Hotels · Vacation Rentals · Car Rentals · Cruises` |
| de | `Live-Angebote · Hotels · Ferienhäuser · Mietwagen · Kreuzfahrten` | `Hotels · Ferienhäuser · Mietwagen · Kreuzfahrten` |
| es | `Feed de Ofertas · Hoteles · Alquileres · Autos · Cruceros` | `Hoteles · Alquileres · Autos · Cruceros` |
| fr | `Flux d'Offres · Hôtels · Locations · Voitures · Croisières` | `Hôtels · Locations · Voitures · Croisières` |
| it | `Feed Offerte · Hotel · Affitti · Auto · Crociere` | `Hotel · Affitti · Auto · Crociere` |
| pt | `Feed de Ofertas · Hotéis · Aluguéis · Carros · Cruzeiros` | `Hotéis · Aluguéis · Carros · Cruzeiros` |

**6b. `hotDeals.affiliateDisclosure`** — drop the trailing sentence `"Prices shown are estimates and may vary."`
(and its 5 translations). After this change **no prices are shown on the page**; the sentence refers to nothing
and is itself a residual fabrication (it currently launders the invented numbers as "estimates"). **Keep the
commission disclosure sentence** — it is the legally required part. This is a direct consequence of the change,
not scope creep.

**6c. DO NOT TOUCH** any other namespace. `perNight: "/night"`, `perDay: "/day"`, `hotelsFrom: "Hotels from
{price}/night"` are **Atlas real-data** strings.

---

### Task 7 — `src/app/[locale]/destinations/page.tsx` (24 literals)

- Delete `flightsFrom:` and `hotelsFrom:` from all **12** destination objects (`:17-18, 28-29, 39-40, 50-51,
  61-62, 72-73, 83-84, 94-95, 105-106, 116-117, 127-128, 138-139`).
- Delete the render block `:273-279` — the two-tile `<div className="flex gap-3 mb-4">` containing
  `✈️ {dest.flightsFrom}` and `🏨 {dest.hotelsFrom}`. Remove the **whole wrapper div**, not just the `<p>`s
  (an empty flex row leaves phantom `mb-4` spacing).
- **KEEP:** `image`, `name`, `country`, `region`, `description`, `slug`, `iata`, and **all three CTAs** —
  `flightUrl(dest)` (TravelPayouts), `CJ_LINKS.hotelsCity(dest.name)` (Hotels.com), `carsUrl` (EconomyBookings).
  The `iata` field feeds `flightUrl` — **do not remove it** even though it looks like inert metadata.
- Card keeps image → name → description → CTAs. Confirm it doesn't collapse visually (G4).

---

### Task 8 — Verification (all gates, fresh output)

| Gate | Expected |
|---|---|
| `npx vitest run src/test/no-fabricated-claims.test.ts` | **PASS** (was FAIL in Task 2) |
| `npm run test:unit` | **≥81 tests, all pass** (80 baseline + new guard) |
| `npx eslint .` | **0 errors AND ≤30 warnings** (SOL #20 — v1 let warnings regress silently) |
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | clean |
| `npx playwright test` | **41 pre-existing pass + Arm E's new tests.** Restart the dev server on :3001 **from THIS worktree** first (`build` kills it). **No pre-existing test may break.** |
| `grep -nE '\$[0-9]' F1 F2 F3 F4` | **only the 4 EPC comments** in `affiliates.ts` |

Then screenshot `/destinations`, `/hot-deals`, and an article page (AffiliateSidebar) in EN for Jose's visual review.

---

## 3. Report-only (do NOT fix — false claims about **what the product does**; Jose's product call)

The dividing line: we delete claims **we** fabricated about *inventory* (prices, offers, urgency). Claims about
**product capability** get flagged, not silently rewritten — the coordinator applied exactly this rule to
`destinations.subheading`, and it is applied consistently here.

1. **`destinations.subheading`** (`messages/*/common.json:306`): *"We compare prices across major booking sites to
   get you the best deal."* **We compare nothing on that page** — the prices were constants, and after this change
   there are none. A false claim about what the product *does*. Survives the guard by design. **Jose's call.**
2. **`common.smartSearchDesc`** (`:35`): *"We compare prices across 100+ booking sites"* — same disease, other surface.
3. **`hotDeals.dealAlertsDesc`** (`:343`, all 6 locales): *"Weekly flight + hotel bundles with price-drop alerts."*
   **SOL #3 rates this CRITICAL and wants it removed now** — it verified `NewsletterForm` only POSTs
   `{email, source}` to `/api/newsletter` and found **no price-drop worker or delivery path** in the repo.
   **I am flagging rather than fixing, and recording the dissent.** Rationale: this is a promise about what a
   newsletter *will send* — an operational commitment Jose controls and may well intend to build — not a fabricated
   price rendered on the page. Rewriting it is a product decision, and the brief says report rather than improvise.
   **It is a live false claim either way — Jose should rule on it this week.**
4. **`ArticleAffiliateCTA.tsx:39,46`**: *"Compare 500+ suppliers"* and *"Up to 75% off cruise fares. Last-minute
   deals available."* — fabricated discount + urgency on **article pages**. **No price literal**, and this file is
   outside the brief's named surfaces, so it is not in scope. **It is the same disease and should be the next PR.**
5. **`CJ_BANNERS`** (`affiliates.ts:168,192`): *"Save 10%+ with Member Prices"*, *"Cruises Up to 75% Off"* — kept
   as advertiser creative (carve-out above). If Jose cannot confirm these are current CJ-supplied creatives, they
   should go too.
6. **`SurpriseMeSection.tsx:29-31`** still carries hardcoded prices on `main` — **PR #7 fixes this on the
   `surprise-me` branch. NOT touched here: editing it would conflict with #7.**
7. If a section looks broken/empty after the honest removals, that is **reported, not filled with invented copy**.

---

## 4. Risks

| Risk | Mitigation |
|---|---|
| Guard misses `$349` (JsxText) | Arm A walks `ts.isJsxText`. Pre-fix failure output **must name `$349`** or the guard is broken. |
| Guard flags the 4 EPC comments → unsatisfiable | AST token walk; comments are not tokens. Verified. |
| Guard scoped too wide → unsatisfiable (5 prior plans) | Exactly 3 files + the `hotDeals` namespace. Atlas/TP/articles/tests untouched. |
| `"Live Deal Feed"` survives (it's in i18n, not the 3 files) | Arm C, all 6 locales. |
| **Monetization regression** — CTAs deleted with the prices | **Arm D**: every `getAffiliateUrl(deal)` is a CJ URL; `AffiliateSidebar` rendered, anchors + CTA text asserted. Arm D must be **green before AND after**. |
| `typescript` won't import in vitest | Confirm first (it is pure JS). Fallback: import-and-walk `DEALS`/`CJ_BANNERS` values for F3 (comment-immune by construction) + raw-source regex for F1/F2 (verified to have no `$`-comments). Do **not** blend if AST works. |
| Cards look gutted (G4) | Visual review in EN before merge. Report, don't invent filler. |
| Playwright tests the OTHER worktree's dev server on :3001 | Kill pid 885336; start `npx next dev -p 3001` from THIS dir; re-verify with `ss -tlnp`. |
| Touching Atlas `.price` (live TP data) | Explicit DO-NOT-TOUCH list, §0.2. |

## 5. Out of scope
No merge. No push to `main`. No deploy. No redesign of either page. No replacement numbers.
