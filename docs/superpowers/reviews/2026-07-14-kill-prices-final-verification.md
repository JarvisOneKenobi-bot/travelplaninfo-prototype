# Final Independent Verification — fix/kill-hardcoded-prices

- **Date:** 2026-07-13 (report filed under 2026-07-14 per orchestrator naming)
- **Verifier:** Independent (did not write this code); all evidence from fresh commands
- **Worktree:** `.worktrees/kill-prices` @ `3d3efee`, merge-base with `main` = `4d5a1e7` (verified: `git merge-base HEAD main` == `git rev-parse main`)
- **Dev server:** PID 2153434 on :3001, `/proc/2153434/cwd` → this worktree (verified before AND after the e2e run, and again after build)

## VERDICT: **SHIP** — with 2 non-blocking guard-gap findings and observations below

No blockers found. Every gate passes, the fabrications are gone from every rendered surface in all six locales, no new invented claim was introduced, monetization is link-for-link identical to production, the guard is red on pre-fix main and green now, the deliberately-deferred items are untouched, and both merge orders with PR #7 are conflict-free (identical merge trees; combined suite 307/307).

---

## A. Gates — PASS (all five)

| Gate | Expected | Actual (fresh run) |
|---|---|---|
| `npm run lint` | 0 errors / 30 warnings | `✖ 30 problems (0 errors, 30 warnings)` |
| `npx tsc --noEmit` | 0 errors | zero output (clean) |
| `npm run test:unit` | 89 | `Test Files 14 passed (14) · Tests 89 passed (89)` |
| `npx playwright test` | 46/46 | `46 passed (47.2s)` — server cwd verified in same command |
| `npm run build` | clean | route table emitted, `BUILD_PIPELINE_STATUS=0` |

Build was run last; dev server survived and post-build smoke re-confirmed `/en/hot-deals` → 200, still clean, still 25 CJ links.

## B. Fabrications actually gone — PASS

**Method note (self-caught):** my first curl-based scan was vacuous — `/en/hot-deals` 308-redirects to a trailing-slash URL and I had scanned 14-byte redirect stubs. Redone with `-L` on full pages (69-74 KB each).

**Positive control:** the same pattern set run against **live production** (pre-fix) found the exact claimed fabrications: `Live Deal Feed ×2, $349, 75% off ×2, 45% off, Tonight ×3, Last-minute/Last minute, Late-night, Limited inventory, From $19/$25/$79/$89/$99/$119/$129/$199/$229/$249, $899, $79, $159, $500, /night ×19, /day, /person` across `/en/hot-deals` and `/en/destinations`.

**Branch (:3001):** scanned `/{en,es,fr,de,it,pt}/hot-deals`, `/en/destinations`, `/en/travel-planning-guide` — zero fabricated-claim matches in any locale. Residual regex hits were inspected with context and are all benign: React Flight serialization tokens (`"$20"`, `"$L82"`), and the RSC-shipped i18n catalog containing `{price}/night` **templates** for live data (`atlasHero.hotelsFrom`, `atlas.perNight` — used by Atlas HotelCard with live TravelPayouts data; `atlasHero.flightsFrom/hotelsFrom` currently have **no consumer** in src and are removed by PR #7). Browser-level `innerText` checks are additionally enforced by the new e2e suite (passed above).

**i18n, all six locales:** only surviving price/urgency-adjacent strings are `preferences.perDay`/`percentOff` (render the **user's own** budget/alert-threshold settings) and the `{price}` templates above. `hotDeals.tagline` "Live/Feed/Flux" prefix removed in all 6 files; `cruisesDesc` replaced in all 6; disclosure's "Prices shown are estimates" dropped in all 6 (now accurate — no prices are shown).

**Source:** zero remaining `deal.price`/`deal.savings` consumers outside Atlas live-data components; the `AffiliateDeal` interface no longer has `price`/`savings` fields. `$`-hits remaining in `affiliates.ts` are EPC **code comments** (real CJ data, explicitly allowed, invisible to users, and proven invisible to the AST guard since Arm A passes on this file).

## C. No new invented claims — PASS

Every new/changed user-facing string audited against "what backs this?":

| New string | Backing |
|---|---|
| `cruisesDesc` ×6: "Search and compare CruiseDirect sailings across major cruise lines." (+ 5 translations) | Describes CruiseDirect's actual service (OTA selling major-line sailings). Byte-exact enforced by the guard's per-locale approved-copy manifest; non-EN must differ from EN (anti-copy-paste check). |
| Quick stats: "Hotels.com / Vrbo / EconomyBookings / CruiseDirect" | Partner names from config; links verified to those advertisers. |
| "Caribbean Cruises from Miami" + "Compare Caribbean sailings on CruiseDirect." | Search handoff; href = CruiseDirect Carnival-Caribbean CJ deep link `13096782`. |
| "Miami Beach hotels" + "Compare Miami Beach stays on Hotels.com." | Hotels.com's real inventory; evergreen link `15734399`. |
| "Cruise deals" + "Compare cruise fares on CruiseDirect." | href = CruiseDirect last-minute CJ deep link `8331182` (partner's own page). |
| DEALS subtitles ("Hotels.com · Miami Beach stays", "EconomyBookings · Compare car-rental suppliers", "CruiseDirect · Caribbean/Bahamas sailings", "Hotels.com · Cancún resorts", …) | Partner-descriptive, number-free; the old "Compare 500+ suppliers" numeric claim was removed from DEALS. |
| help-content "hot-deals" rewrite (partner directory + "Why we don't show prices") | Verifiable against the code (page IS a 4-partner directory of search handoffs). "The Planner and Atlas search live flight prices…" is backed by `src/lib/atlas/travelpayouts-client.ts` (live TP flight API) and `/api/trending-prices`. |
| `🏨 Find Hotels` (AffiliateInlineCTA) | No claim; replaces the invented "$79". |

Phantom-benefit regression check: `git grep -in "weekly stays\|lowest fares" HEAD -- src/ messages/` → **empty**.

## D. Monetization did not regress — PASS (exact, not just floor)

- **Diff audit:** zero removed lines in `git diff main -- src/` contain `href=`, `CJ_LINKS`, `CJ_BANNERS`, `click-101692716`, `getAffiliateUrl` or `searchUrl`. All `+` matches are the new test manifest.
- **Source counts:** CJ tracking URLs in src 22 (main) → 34 (HEAD); the +12 are exactly the 8 deal + 4 banner URLs pinned in the new test manifest. `rel="noopener noreferrer sponsored"` count 25 = 25, identical per-file.
- **Runtime, local branch vs live production (pre-fix):**
  - `/en/hot-deals`: **25 CJ tracking links locally, 25 on production — identical per-deep-link-id distribution** (anrdoezrs-13096743 ×2, dpbolvw-15734399 ×6, jdoqocy-10784831 ×6, jdoqocy-15586457 ×6, kqzyfj-13096782 ×2, tkqlhce-15534697 ×2, tkqlhce-8331182 ×1).
  - `/en/destinations`: 13× Hotels.com CJ + 12× cars CJ + 13× Aviasales `marker=164743` — **identical local vs production**.
  - Article page: 34 CJ links; sidebar (3 deals + 4 banners) and inline CTA (3 links) individually asserted by e2e.
- **Advertiser correctness:** every deep-link id maps to the intended advertiser in `affiliates.ts` (15734399/15612526 Hotels.com, 10784831 Vrbo, 15586457/15736982 EconomyBookings, 15534697/8331182/13096782/13096743/15734200 CruiseDirect variants), and the unit guard hardcodes id→URL so a silently re-pointed link fails the build.

## E. Guard has teeth — PASS with 2 gap findings

- **Red on pre-fix state:** guard test run in a detached scratch worktree at `main` (shared node_modules): **6 failed / 3 passed** — Arm A **42** price violations, Arm B **14** urgency, Arm C **6** live-feed i18n, Arm E **6** discount i18n (= 68 detections ≥ claimed "61+"), plus both cruisesDesc manifest tests. First violations reported are precisely the production fabrications (`From $99`, `From $79/night`, …).
- **Green now:** included in the 89/89 pass.
- **Sneak attempts** (each injected alone in a scratch worktree at HEAD, guard re-run, file restored):
  1. `"$99"` in hot-deals JSX → **CAUGHT** (Arm A, 1 violation).
  2. `"50 % off"` (spaced) → **CAUGHT** (Arm B, 1 violation).
  3. Spanish `"75% de descuento"` appended in `hotDeals` namespace (es) → **SLIPPED** (9/9 passed). → **Finding 1**.
  4. `"Lowest fares guaranteed."` as a DEALS subtitle → **SLIPPED** (9/9 passed). → **Finding 2**.
- **Scoped & satisfiable:** confirmed. Unit guard scans only 5 source files (AST string/JSX-text nodes — the `// $138.91 EPC` comments in a scanned file do NOT trip it), the DEALS statement, and 2 i18n namespaces; e2e scans rendered body text of 2 EN routes + article widgets. Articles, tests, EPC comments and CJ_BANNERS advertiser creative are deliberately outside scope, so the guard is satisfiable long-term.

### Findings (non-blocking; neither string exists in the shipped code — these are gaps in the tripwire, not defects on the surfaces)
1. **Translated discount claims can slip the `hotDeals` i18n arm.** Arm C uses only price shapes + live/feed/flux words; `\d+\s*%` and locale discount vocabulary (`descuento|desconto|Rabatt|réduction|sconto`) are enforced for `affiliateRecommendations` but not `hotDeals`, and e2e only scans `/en/` routes. Fix: apply `AFFILIATE_RECOMMENDATIONS_PATTERNS` (minus the deal-words that legitimately appear, e.g. "Ofertas" is in approved hotDeals copy — so at minimum add `\d+\s*%` + last-minute/tonight vocabulary) to the `hotDeals` namespace.
2. **"guarantee(d)" claims are unpatterned.** "Best price guarantee. …" was one of the fabrications this branch removed, yet re-adding a guarantee claim to DEALS/hot-deals/article CTAs passes both guards. Fix: add `/guarant/i` to `URGENCY_PATTERNS` — note this requires deciding on the two pre-existing occurrences listed in G-observations first, or scoping the pattern away from them.

## F. Visual — PASS (nothing gutted or broken)

Full-page screenshots taken from :3001 (in scratchpad, `shot-*.png`):
- **/en/hot-deals** — complete page: hero + 4 partner chips, featured CruiseDirect card, 8 compact deal rows, 4 program cards, All Deals grid (8 cards, title/subtitle/CTA — no empty price slots), Deal Alerts box, disclosures. Layout reads intentional; the quick-stats row (now 2×2 partner names) looks deliberate.
- **/en/destinations** — 12 cards with description + 3 CTAs each; no gap where price badges were. (Several Unsplash images rendered as alt-text in the headless capture — remote-image slowness, URLs untouched by the diff; not a branch defect.)
- **Article page** — sidebar: 3 clean deal cards + 4 CJ banners; inline "Ready to book your trip?" CTA with 3 buttons; "Plan this trip" widget renders 4 cards. All monetized, no broken/empty blocks.

## G. Deliberately NOT fixed — confirmed untouched (not defects)

- `dealAlertsDesc`: byte-identical to main in **all 6 locales** (per-locale diff).
- `destinations.subheading` ("…We compare prices across major booking sites…"): present, unchanged.
- `SurpriseMeSection.tsx`: `git diff main --` → **0 lines**; the `$127`/`$89/night` fallback is still at line 29 as expected (fixed on PR #7, not here). Neither the unit guard (file not in SOURCE_FILES) nor e2e (home page not scanned) trips on it — consistent.

**Related observations (pre-existing on main, same deferred category — for a future sweep, NOT this branch):**
- hot-deals EconomyBookings program card: "500+ suppliers. Best price guarantee. Free cancellation." (unchanged from main:125).
- `ArticleAffiliateCTA.tsx:20`: "Top-rated hotels with free cancellation. Best price guaranteed." and `:39`: "Compare 500+ suppliers — Hertz, Enterprise, Sixt & more." (both pre-existing; arguably traceable to the partners' own advertised services, but they are the same claim-shape as Finding 2).
- `CJ_BANNERS` headlines ("Cruises Up to 75% Off", "Save 10%+ with Member Prices") render in the article sidebar — untouched by this branch, advertiser-supplied CJ creative with dedicated tracking ids (explicitly allowed category).
- The article's "Plan this trip" widget shows "Hotels in Planning & Tips" twice — driven by the article's own opportunities list, pre-existing.
- `playwright-report/index.html` is a tracked build artifact (tracked since `d395264` on main; branch updates 1 line). Repo-hygiene note only.
- A pre-existing detached worktree `/tmp/kill-prices-audit.x2DJ6o` @ 2119a5e exists (not created by this verification; left alone).

## H. Merge order

**Either order is safe; recommended: merge PR #7 (`feat/surprise-me-workstation-independence`) first, then this branch, then run the full gate suite once on merged main before the single deploy.**

Evidence, not opinion:
- The branches overlap on 7 files (all six `messages/*/common.json` + `src/lib/help-content.ts`), **but** `git merge-tree --write-tree` in **both orders** produces the **identical conflict-free tree `fabea05c…`** (surprise-me edits `atlasHero`/interests namespaces; this branch edits `hotDeals`/`affiliateRecommendations`; hunks never collide).
- I extracted that merged tree into a scratch dir and ran the **combined** unit suite against it: **28 files / 307 tests passed** — both branches' guards hold post-merge (surprise-me also deletes the dead `atlasHero.flightsFrom/hotelsFrom` `{price}` templates, which this branch's guard doesn't cover — complementary, no interference).
- Rationale for #7-first: it is older and already review-approved (877efd6), and merging the guard branch last means the fabrication tripwire is validated against the final pre-deploy tree by its own CI run.

## Environment left as found

Scratch worktrees (`guard-main`, `guard-sneak`, `merged`) removed; verification-dirtied `next-env.d.ts` + `playwright-report/index.html` restored; `git status --short` → clean; dev server PID 2153434 still serving this worktree on :3001 (post-build smoke 200).
