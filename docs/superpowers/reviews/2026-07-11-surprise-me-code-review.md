# Post-Implementation Code Review — Surprise Me Workstation Independence + De-Fabrication

**Date:** 2026-07-12
**Reviewed:** full diff `main...HEAD` on `feat/surprise-me-workstation-independence` (8 code commits, ~1900 insertions)
**Reference:** spec/plan/plan-review in `docs/superpowers/{specs,plans,reviews}/2026-07-11-*`; Python source of truth `command-post/routers/assistant.py:900-1101` + `command-post/tp_client.py:111-165,264-307`
**Method:** adversarial line-level read of every changed file; independent programmatic diff of the 82-entry vibe taxonomy, `TRIP_LENGTH_DAYS`, and `IATA_TO_CITY` against the Python originals; fresh `vitest run` (115/115); mutation reasoning against every new test; end-to-end trace of the client → route → engine → TP wire path including the UI entry point (`planner/[tripId]/page.tsx` → `SurpriseMeSection` → `/api/surprise-me`).

**Verdict: APPROVE-WITH-EDITS** — 0 BLOCKER, 2 IMPORTANT, 7 NIT. The fabrication kill is complete and verified; the two IMPORTANT items are (1) a UI-sentinel bug that guarantees a degraded banner for a creatable class of trips even when live data exists, and (2) the one surviving inference-from-absent-data (`transfers ?? 0` → nonstop badge), which the spec accepted but deserves a final conscious sign-off.

---

## Fabrication audit (hunt item 1) — NO BLOCKER FOUND

Every fabrication path named in the mandate is dead, verified in code (not just tests):

- **Server `FALLBACK` deleted** — `src/app/api/surprise-me/route.ts` diff removes the `$89/$95/$75 /night`, Spirit NK/JetBlue, `origin:"MIA"` constant entirely. The route now calls `getSurpriseDestinations` and has no literal destination data.
- **Client `V1_FALLBACK` deleted** — `SurpriseMeSection.tsx` diff removes the `$127/$159/$189` constant; both `setFallbackUsed(true)` paths replaced with `setDestinations([])` + `setDegradedReason(...)` (`SurpriseMeSection.tsx:98-108`). Empty/error → banner + Ask-Atlas button, never cards.
- **Origin never substituted** — old route's `.slice(0,3) || "MIA"` truncation (which turned `CANCUN` into a fake `CAN`) is gone; `parseIata` rejects non-3-letter input and returns `degraded: INVALID_IATA_REASON` with the caller's own string echoed (`surprise.ts:94-102`). Pinned by unit test (`surprise.test.ts:231-248`) and the live smoke (`origin=Cancun` → `"CANCUN"`, never MIA).
- **`hotelPrice` cannot exist** — stripped from `SurpriseDestination` (`surprise.ts:30-36`), the route, `SurpriseMeSection`, `AtlasHeroSection`, and `DestinationCard` prop/render. The type has no slot to fabricate into.
- **i18n price templates deleted** — `flightsFrom` / `hotelsFrom` ("Hotels from {price}/night") removed from all 6 `messages/*/common.json`; grep confirms zero `t("hotelsFrom")`-style consumers remain. Replacement keys `degradedTitle`/`degradedNetworkBody` are translated in all 6 locales.
- **Price labels** — the only price formatter in the engine is `priceLabel` (`surprise.ts:58-61`): `null → "—"`, else `$<TP price>` (+ `" rt"` iff round-trip was actually priced with `return_at` sent to TP). Enrichment failure → `"—"`, `airline:""`, `link:""` (`surprise.ts:238-244`), pinned by `ENRICHMENT FAILURE -> DASH` which asserts no digit can appear (`surprise.test.ts:206-207`).
- **Degraded never cached; cache key unambiguous** — `route.ts:83-86` caches only `destinations.length > 0 && !result.degraded` (and the engine never sets `degraded` on a non-empty result, so the condition is exact); key components are `encodeURIComponent`-ed before `|`-join (`route.ts:58-60`), closing plan-review N4. Engine throw → in-body 200 degraded, not cached, never a 500 (`route.ts:75-81`, pinned `route.test.ts:149-172`).
- **Tripwire is real** — `no-fabrication.test.ts:34-73` scans the six live files from disk for the exact fabricated literals + `/night` + `hotelPrice` + `V1_FALLBACK`/`FALLBACK` + the invented airlines, and separately bans `MIA` from `surprise.ts`. It reads the shipped source, so it cannot pass against a resurrected constant.

I could not construct any input — valid, invalid, empty, garbage month, TP failure, TP success-empty, partial enrichment, thrown engine — that emits a number, airline, or origin nobody measured. The one remaining *flag* inference is IMPORTANT-2 below.

## HTTP budget / F6 (hunt item 2) — HOLDS, pinned at the wire

- True worst case, counted at the fetch layer: 1 popular call (`surprise.ts:129`) + ≤3 enrichment codes × ≤2 requests each (`rawSearchFlights` specific-date attempt + month-granularity retry, `travelpayouts-client.ts:406-420`) = **7 ≤ 8**.
- Cap enforced **before dispatch**: `enrichmentCodes` is bounded by `slotsRemaining` (≤3) in the pre-pass loop (`surprise.ts:189-196`) *before* `Promise.all` fires (`surprise.ts:199`). No post-hoc trimming.
- `surprise.http-budget.test.ts` is genuinely wire-level and cannot pass vacuously: it stubs `global.fetch` (real `tpGet`/`rawSearchFlights` run), stubs the token, and asserts **exactly** `7` fetch calls plus 3 honest dash-cards (`:24-28`). A cap enforced after dispatch, a 4th enrichment, or a skipped month-retry all change the count and fail. Zero calls also fails.
- F6 limiter untouched and intact: `checkRateLimit` + pre-fetch `requestTimestamps.push` (`travelpayouts-client.ts:317-345`, push at :345 precedes fetch at :351). The `travelpayouts-client.ts` diff is export-keyword-only — verified no behavioral hunk.
- Function-layer backstop: `ENRICHMENT CAP = 3, ENFORCED PRE-DISPATCH` (`surprise.test.ts:188-195`) fails if the filler ever dispatches per-curated-entry instead of per-slot.

## Test vacuity (hunt item 3) — none found

For each new test I tried to construct a broken implementation that still passes; none exists for the load-bearing ones (budget: exact count; dedupe: `$150` vs `$300` distinguishes keep-first from keep-last; stable sort: 4-way fixture where price order inverts overlap order; degraded reasons: asserts the *specific* constant and asserts it is NOT the sibling constant). `route.test.ts` avoids the module-level cache trap by using unique query strings per test — deliberate and correct. The tripwire reads real files. One residual note: `no-fabrication.test.ts` bans `FALLBACK` (uppercase) so the retained `surprise-fallback-banner` testId (lowercase, required by e2e) passes — intentional, not vacuous.

## Faithfulness to the Python original (hunt item 4) — verified, 3 honest-direction divergences

Programmatic comparison (script, not eyeball): **82/82 vibe entries, identical insertion order, identical tag sets**; `TRIP_LENGTH_DAYS` identical; `IATA_TO_CITY` 127/127 identical; `HNL` missing from both city maps (same code-fallback behavior). Line-level trace confirms: `min_overlap = 2 if ≥2 vibes else 1` (`surprise.ts:165` ≡ `assistant.py:971`); dedupe keeps first = cheapest (`:157-162` ≡ `:959-966`); stable overlap-desc sort preserving price order (JS sort is spec-stable; ≡ `:980`); self-origin drop; `" rt"` suffix logic (`:58-61` ≡ `:989,1068`); the hard-coded `overlap < 2` filler skip in both pre-pass and fill loop, making single-vibe filler dead (`:192,222` ≡ `:1019,1058`, pinned by `SINGLE-VIBE FILLER IS DEAD`); `popularPriceByDest` built pre-filter (`:148-153` ≡ `:952-956`); pre-pass does not mutate `seen` (matches Python's subtlety); popular params (`sorting=price, currency=usd, limit=100`, month-sliced `departure_at`/`return_at`) match `tp_client.get_popular:277-286`.

Divergences, all deliberate or safer, none fabricating:
1. Origin validation replaces Python's `origin: str = "MIA"` default + blind upper — spec-mandated (G5).
2. Round-trip month gate `canUseMonthForRoundTrip` (`surprise.ts:72-76`) vs Python `strptime` — fixes plan-review N1's `2026-13` JS-rollover; `2026-2` (unpadded) goes one-way in TS where Python goes round-trip — harmless, client only sends `YYYY-MM`.
3. Enrichment depart date is sliced (`${departMonth.slice(0,7)}-01`, `surprise.ts:202`) where Python would build garbage `"2026-08-15-01"` from a full-date month — TS is saner.
4. Cheapest-pick `?? 999999` vs Python `or 999999` differs only for a literal TP price of 0 — recorded in plan review, no action.

## Untouched surfaces (hunt item 5) — intact

- `tool-loop.ts` untouched; chat `surprise_me` still routes to `getPopularRoutes` (`tool-loop.ts:59,110`), which is unchanged. `getDeals`, `searchFlights`, `getPopularRoutes` bodies byte-identical (diff shows `export` keywords only in `travelpayouts-client.ts`).
- `no-fabrication.test.ts` original 3 D3 assertions retained (`:7-32`).
- `planner-trust.spec.ts` still has exactly 12 `test(` blocks; the new `/api/surprise-me*` stub is registered before `page.goto` inside the Path B CTA test only; the degraded-banner test (`route.abort()` at :147) exercises the new client degraded state for real. Playwright 41/41 (orchestrator-verified).
- `getFastApiBaseUrl`/`FASTAPI_URL`/port-8766 grep over `src/`: zero hits (fresh). `server-config.ts` deletion took the test assertion with it.

## Phase 2 VPS deploy (hunt item 7) — safe

Route needs only `TRAVELPAYOUTS_TOKEN` (already in `.env.example` and ARCHITECTURE.md's env table); missing token degrades in-body with the F2 `no_token` reason, never 500s, never caches the degraded body. In-memory cache + rate limiter are per-PM2-process — fine for the single `tpi` process. Next 16 route handlers are dynamic by default; no stale static snapshot risk. Docs cleanup landed including the plan-review I3 stragglers (`local-to-vps.md:280` now curls `/api/assistant/health`; `VERIFICATION_CHECKLIST.md` marks the 8766 probe forbidden). One doc gap is NIT-6.

---

## BLOCKER

None. Explicitly: no surviving path — default, i18n, component, type, cache, or inference — can emit an invented price, airline, or origin.

## IMPORTANT

### IMPORTANT-1 — The `"flexible"` sentinel is sent as a literal vibe, guaranteeing a degraded banner for zero-vibe Surprise Me trips even when TP has real routes

- **Evidence:** `src/app/[locale]/planner/[tripId]/page.tsx:58` — `vibesSummary = vibes.length > 0 ? vibes.join(" + ") : "flexible"`. `SurpriseMeSection.tsx:86-90` treats any truthy `vibesSummary` as vibes and sends `vibes=flexible`. Engine: `requestedVibes = {"flexible"}` → size 1 → `minOverlap 1` → no taxonomy entry carries `flexible` → **every live candidate is filtered out** (`surprise.ts:164-174`); the filler is dead for single vibes (`overlap < 2` skip, `surprise.ts:192`) → `degraded: NO_VIBE_MATCH_REASON` (`surprise.ts:254`). The user is told "No live routes matched the requested vibes" when they requested none and TP returned real routes.
- **Reachability:** a zero-vibe Surprise Me trip is creatable — `TripForm.tsx:304-309` validates only ≥2 *interests*; `vibesComplete` (`TripForm.tsx:380`) merely styles a section border. Custom-vibes-only trips (`vibe:custom:*`) hit the same dead-end via unknown tokens.
- **Why the happy path hid it:** the live smoke queried the API directly with no/valid vibes; the Path B e2e stubs `/api/surprise-me` (`planner-trust.spec.ts:120`), so no test drives the real client param-building into the real engine.
- **Not a fabrication** (output is honest) and the param-building lines are pre-existing — but pre-change the outcome was masked by V1_FALLBACK; post-change it is a *guaranteed* degraded banner on a creatable trip class where the fully honest popular-routes path (`vibes=""` → top-3 live cards) exists one branch away. That works against this change's own goal.
- **Fix (one line, client-side):** don't emit the sentinel — in `planner/[tripId]/page.tsx` pass `vibes.join(" + ")` (empty string when none) to `SurpriseMeSection` and keep `"flexible"` only for the display subtitle, or in `SurpriseMeSection.tsx:86` skip when `vibesSummary === "flexible"`. Optionally also filter vibe tokens against the closed vocabulary before sending. Add one route/engine-free client test for the no-vibes param shape.

### IMPORTANT-2 — `transfers ?? 0` still converts *absent* data into a "nonstop" claim (the one surviving inference)

- **Evidence:** `surprise.ts:141` (`transfers: route.transfers ?? 0`), `:211` (enrichment), `:234` (`nonstop: (route.transfers ?? 0) === 0`), and pre-existing `travelpayouts-client.ts:385`. If TP ever omits `transfers`, the card renders the green "nonstop" badge (`DestinationCard.tsx:50-54`) with nothing measured behind it.
- **Status:** deliberate — spec §4.1 documents it as Python parity (`route.get("transfers", 0)`, `assistant.py:988`), plan-review N6 recorded "no action", and TP v3 payloads carry `transfers` in practice. This is the *only* field left anywhere in the Surprise Me path where a claim can outrun the data, which is why it belongs above the NIT line for a final conscious sign-off rather than silent inheritance.
- **Fix if tightening:** `nonstop: route.transfers === 0` (absent → `false` → no badge, matching how the filler's no-data cards already behave) at the three surprise.ts sites — a divergence from Python in the honest direction, consistent with the already-shipped origin-validation divergence. If parity wins, record the sign-off and close.

## NIT

1. **Degraded reasons are English-only and sometimes tool-voiced.** `SurpriseMeSection.tsx:100` renders `degraded.reason` verbatim (per spec §4.4) in all 6 locales; `INVALID_IATA_REASON` ("pass the airport code, not a city name", `travelpayouts-client.ts:256-257`) addresses a tool caller, not a traveler, and `FAILURE_REASONS.no_token` names an internal config detail. Follow-up: return a machine `reason.code` alongside the text and map codes → localized copy client-side.
2. **Total TP failure + 2 matched vibes renders 3 all-dash cards with no banner** (`surprise.test.ts:261-270` pins it). Honest, Python-parity, but a user sees three destinations with no price, airline, or link and no explanation. Consider a notice when every card is data-less. Related: when TP times out, enrichment still fires 6 doomed sequential-retry attempts inside the parallel batch — worst-case ~20s response. Python has the identical property; noting for the latency budget.
3. **Dead fabrication scaffolding survives outside the tripwire's file set.** `src/components/EntryTabs.tsx:35-51` (`hotelPrice: 85/65/45`) and `src/components/DestinationSuggestions.tsx:138-139` ("Hotels from $X/night") have zero importers (verified) but are one import away from resurrecting the exact outlawed shape — delete them (EntryTabs was design-rejected 2026-04-10). The live static `src/app/[locale]/destinations/page.tsx:14-117` ("From $99", "$79/night", …) remains a real user-facing invented-price surface — correctly out of this change's scope, but it needs the follow-up ticket the plan review already suggested.
4. **`formatPrice` renders `"$0"` for a null TP price on the Atlas chat surface** (`travelpayouts-client.ts:289`, reachable via `searchFlights` → `price: formatPrice(flight.price, …)`). Pre-existing, untouched by this diff, out of scope — but it is a number nobody measured on a sibling surface; ticket it.
5. **Catch-path origin casing inconsistency:** `route.ts:76-80` echoes the raw clamped origin (e.g. `"cancun"`) where the engine echoes uppercase — cosmetic; align with `origin.toUpperCase()` if touched again. Also `INTERNAL_ERROR_REASON` need not be exported.
6. **`local-to-vps.md` env table undersells `TRAVELPAYOUTS_TOKEN`** — still "Used by `src/app/api/trending-prices/route.ts`" only; post-port it also powers `/api/surprise-me` and the Atlas flight/deal tools. ARCHITECTURE.md:83 has it right; one-line runbook fix so the pending Phase 2 secrets pass doesn't deprioritize it.
7. **Route-cache key uses raw (un-normalized) `vibes`** — `"Beach"` vs `beach` or reordered lists occupy separate 1h slots for identical results. Pure efficiency; harmless.

---

## Verdict

**APPROVE-WITH-EDITS.** The mandate is met: both fabrication constants are gone with tripwire coverage, the last `getFastApiBaseUrl`/`FASTAPI_URL` dependency is deleted with a satisfied grep gate, the port is faithful (82/82 taxonomy verified programmatically, every named semantic rule traced to its Python line), degradation is honest and uncached, F6 holds at 7 ≤ 8 with the cap enforced pre-dispatch and pinned at the wire, and the untouched surfaces are provably untouched. Fix IMPORTANT-1 (one-line client change + test) before merge; make an explicit accept/tighten call on IMPORTANT-2; NITs can ride follow-up tickets.
