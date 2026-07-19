# Surprise Me — Workstation Independence + De-Fabrication

**Date:** 2026-07-11
**Repo:** `travelplaninfo-prototype`
**Branch:** `feat/surprise-me-workstation-independence` (worktree off `main` @ `4d5a1e7`)
**Status:** Spec — plan written; revised 2026-07-11 to fold adversarial-review findings (`docs/superpowers/reviews/2026-07-11-surprise-me-plan-review.md`)

---

## 1. Problem

Two defects, one root cause.

### 1.1 Production is serving fabricated inventory (live, right now)

`GET /api/surprise-me` proxies to the FastAPI backend running on the **workstation**. The VPS cannot reach it — prod `/api/assistant/health` reports `backendReachable:false`. So the route's `catch`/`!res.ok` path fires on **every single request**, returning a hardcoded constant.

Live evidence, captured 2026-07-11 against `https://travelplaninfo.com`:

```
$ curl "…/api/surprise-me?origin=JFK&vibes=beach"      # and again with origin=LAX
{"origin":"MIA","destinations":[
  {"name":"Cancún, Mexico","flightPrice":"—","airline":"Spirit NK","nonstop":true,"hotelPrice":"$89/night","link":""},
  {"name":"San Juan, Puerto Rico","flightPrice":"—","airline":"JetBlue","nonstop":true,"hotelPrice":"$95/night","link":""},
  {"name":"Punta Cana, DR","flightPrice":"—","airline":"Spirit NK","nonstop":true,"hotelPrice":"$75/night","link":""}]}
```

Identical payload for both origins. Every claim in it is invented:

- **Hotel prices** (`$89`/`$95`/`$75` a night) — TPI has no hotel inventory API at all.
- **Airlines** and **nonstop** flags — not sourced from anything.
- **Origin** — the user's requested origin is silently discarded and replaced with `MIA`. A user in Los Angeles is told they're flying out of Miami.

This is exactly the fabricated-inventory pattern decision **D3** outlawed and that the entire Atlas rebuild exists to eliminate. It is currently visible to real visitors.

There is a **second fabrication layer** in the client: `SurpriseMeSection.tsx`'s `V1_FALLBACK` invents flight prices (`$127`/`$159`/`$189`) plus the same hotel prices, and fires whenever the API returns empty or errors. Fixing only the server would leave this one lying.

**Note:** the FastAPI implementation itself is *honest* — its own test asserts `hotelPrice == ""`, it maps real `airline`/`transfers` from TravelPayouts, and when price enrichment fails it emits `"—"` rather than a number. **The fabrication is entirely in the two Next.js fallback constants.** This is a Next.js-layer bug, not a backend one.

### 1.2 It is the last workstation dependency

`src/app/api/surprise-me/route.ts` holds the **only remaining `getFastApiBaseUrl()` import in the application**. Phase 2 relocated the Atlas brain into Next.js precisely so TPI could run without this workstation — which sleeps and is explicitly not a 24/7 host (`project_workstation_not_24_7`). This one route is what stands between TPI and that goal.

Both defects die with the same change: port the endpoint natively and delete the liars.

---

## 2. Goals / Non-Goals

**Goals**

- G1. Remove the FastAPI dependency from `/api/surprise-me` — zero `getFastApiBaseUrl` importers remain.
- G2. Delete both fabrication sites (server `FALLBACK`, client `V1_FALLBACK`). No invented price, airline, nonstop flag, or origin, on any code path.
- G3. Faithfully preserve today's Surprise Me behaviour (vibe ranking + curated filler), evidence-backed — see §3.
- G4. Honest degrade when there is genuinely no data, reusing the shipped F2 failure-reason vocabulary.
- G5. Never silently rewrite the caller's origin.

**Non-Goals (explicitly out of scope)**

- Hotel pricing or a hotel partner-search CTA. TPI has no hotel API; the honest move is to omit hotel data, which is what the backend already does (`hotelPrice: ""`). A Hotels.com partner-search handoff is **Phase 3 monetization** work and belongs in that banked plan, not here.
- Restructuring curated-vs-live into a blended source (see §7 Follow-ups).
- Any change to Atlas chat's `surprise_me` tool. It already uses native `getPopularRoutes` and is unaffected.
- Deploying. `main` stays deployable; this merges on Jose's word.

---

## 3. Evidence Behind the Design

The central design question was whether the Python "curated filler" — which tops up card slots from an 82-entry destination-vibe map when live TP results don't yield 3 vibe matches — is load-bearing or dead weight. Settled empirically, not by taste.

**Probe:** live TravelPayouts `prices_for_dates` (token marker 164743), 6 origins (MIA/JFK/LAX/ORD/DFW/SEA) × 6 vibe combos = 36 scenarios, departure 2026-08, applying the exact production filter (drop self-origin → dedupe by destination → `min_overlap = 2 if len(vibes) >= 2 else 1`).

| Live vibe matches | Scenarios | Cards without the filler |
|---|---|---|
| 3 or more | 8 (22%) | full section |
| 1–2 | 19 (53%) | thin 1–2 card section |
| **0** | **9 (25%)** | **nothing** |

**Without the filler, Surprise Me shows fewer than 3 cards 78% of the time and zero cards 25% of the time.**

Mechanism: TP returns ~30 routes per origin → 12–24 unique destinations after dedupe → **only 5–9 of those appear in the vibe map at all.** TP's cheap-popular routes skew to domestic hubs (ATL, BOS, TPA, FLL); the vibe map is built around leisure/international destinations. The two sets barely intersect, and `min_overlap >= 2` prunes what survives. Worst case: **`adventure + cultural` matched zero live routes at all six origins** — that combo would be permanently dead without the filler.

**Conclusion:** the curated filler is the primary path, not a fallback. Port it faithfully (Option B).

---

## 4. Design

### 4.1 New module: `src/lib/atlas/surprise.ts`

Single exported entry point; all Surprise Me logic lives here, testable without HTTP.

```ts
export interface SurpriseDestination {
  name: string;        // IATA_TO_CITY[code] ?? code
  flightPrice: string; // "$142" | "$142 rt" | "—"   (never invented)
  airline: string;     // TP airline code | ""
  nonstop: boolean;    // transfers === 0 (absent transfers defaults to 0 — deliberate Python parity)
  link: string;        // TP deep link | ""
}

export interface SurpriseResult {
  origin: string;
  destinations: SurpriseDestination[];
  degraded?: { reason: string };  // present iff destinations is empty
}

export async function getSurpriseDestinations(params: {
  origin: string;
  vibes?: string;        // comma-separated
  departMonth?: string;  // YYYY-MM
  tripLength?: string;   // weekend|week|10_14_days|2_weeks|3_weeks
}): Promise<SurpriseResult>;
```

The `flightPrice` doc-comment example is deliberately `$142` — a value NOT in §5's banned fabricated tuple. Using `$127` (one of the fabricated `V1_FALLBACK` prices) as the example would make §5's tripwire fail against this module's own contract comment.

**Algorithm** — a faithful port of `routers/assistant.py:surprise_destinations`:

1. **Validate origin** via the existing strict `parseIata` (F7 — no truncation, no `Cancun→CAN`). Invalid → `degraded` with `INVALID_IATA_REASON`. **Never** substitute `MIA`.
2. **Default `departMonth`** to next month (UTC) when absent. Reuse the existing `nextMonthUtc` helper.
3. **Round-trip pricing:** if `tripLength` maps through `TRIP_LENGTH_DAYS` (`weekend:2, week:7, 10_14_days:12, 2_weeks:14, 3_weeks:21` — port verbatim from `assistant.py:848`), compute `return_at` and set `isRoundTrip`, which suffixes prices with `" rt"`. Round-trip is computed only when `departMonth` matches `/^\d{4}-\d{2}$/` — a malformed month (a full date like `2026-08-15`, garbage like `2026-13`) skips round-trip pricing, mirroring Python's `try/except ValueError` skip.
4. **Fetch** popular routes (`prices_for_dates`, `sorting=price`, `currency=usd`, `limit=100`). On failure, map the `tpGet` failure cause through the existing `FAILURE_REASONS` table (F2 — distinguishes `no_token` / `rate_limited` / `http_error` / `timeout`; a missing token must never read as "no flights exist").
5. **Candidates:** drop routes back to the origin, dedupe by destination keeping the first (API is price-ascending → keeps cheapest).
6. **Vibe ranking:** if vibes requested, `min_overlap = 2 if vibes.size >= 2 else 1`; keep candidates whose `DESTINATION_VIBES` tags meet the threshold; sort by overlap descending (stable — preserves price-ascending within equal overlap).
7. **Map** top 3 to `SurpriseDestination`. `hotelPrice` does not exist in the type — it cannot be fabricated.
8. **Curated filler** (only when `destinations.length < 3` **and** vibes were requested): walk `DESTINATION_VIBES` sorted by overlap desc, skipping the origin, entries with overlap `< 2`, and cities already shown. For codes absent from the live result set, enrich with **bounded-parallel** `rawSearchFlights` calls (**cap 3**, matching the Python `slots_remaining` bound) to get a real price. `rawSearchFlights` — the module-private single-pair helper in `travelpayouts-client.ts`, exported by the plan's Task 1 — is the faithful equivalent of Python `client.search_flights` (one origin→destination pair, numeric price, one month-granularity retry). The *public* `searchFlights` must **NOT** be used here: it fans out over nearby airports (`airportsWithNearby` — LAX becomes 4 origins ⇒ up to 8 HTTP calls per enrichment ⇒ worst case 25 total, blowing the ≤8 F6 budget) and returns display strings, not numbers. Enrichment failure → `flightPrice: "—"`, `airline: ""`, `nonstop: false`, `link: ""`. **Never a number.**
9. **Empty** → `degraded: { reason }`, selected by one rule: the step-4 failure reason if the TP fetch failed; otherwise `NO_VIBE_MATCH_REASON` if vibes were requested (this covers both "fetch succeeded with zero routes while vibes were requested" and "routes existed but none survived vibes + filler"); otherwise `NO_ROUTES_REASON`. The discriminator is whether vibes were requested, not whether routes existed. Edge case: routes existed but all were the origin itself and no vibes were requested → `NO_ROUTES_REASON` — honest enough, intended. Both new reasons follow the F2 style ("this does NOT mean no flights exist"). Never degraded when `destinations.length > 0`.

**Rate-limit interaction (must not regress F6):** each `rawSearchFlights` enrichment can issue up to **2** HTTP requests (specific-date attempt, then one month-granularity fallback — Python `client.search_flights` has the identical property), so the true worst case is 1 popular-routes call + 3×2 enrichment requests = **7 HTTP requests**, within the ≤8 budget F6 established. The limiter counts attempts *pre-fetch*; the enrichment cap must be enforced before dispatch, not after.

### 4.2 New data: `src/lib/atlas/destination-vibes.ts`

`DESTINATION_VIBES: Record<string, ReadonlySet<string>>` — all **82** entries ported verbatim from `assistant.py:755`. Static taxonomy only; contains no prices and fabricates nothing. Vocabulary: `tropical, beach, romantic, nightlife, big_city, cultural, adventure, foodie, mountain`.

A unit test asserts the entry count and spot-checks known tags, so a truncated port fails loudly rather than silently narrowing the filler.

### 4.3 Route: `src/app/api/surprise-me/route.ts`

- Drop the `getFastApiBaseUrl` import and the `fetch` proxy.
- Call `getSurpriseDestinations`, **wrapped in try/catch**: the engine shouldn't throw (TP failures come back as values), but an unexpected throw must return an in-body degraded response (`destinations: []`, honest F2-style reason, HTTP 200, never cached) rather than a 500 — degradation is uniformly in-body.
- **Delete `FALLBACK`.**
- Keep the existing 1-hour in-memory cache and its key shape (`origin|vibes|month|tripLength`) — but `encodeURIComponent` each component before joining, so a `|` inside `vibes` cannot make the key ambiguous and collide with another parameter combination. Keep the input clamps and `MAX_CACHE_ENTRIES` pruning. **Only cache successful, non-empty results** — a degraded response must never be cached for an hour (this also closes the "empty-success caching" item flagged in the xhigh review).
- Return `{ origin, destinations, degraded? }`. Always HTTP 200; degradation is in the body, so the client can render a reason rather than guess from a status code.

### 4.4 Client: `src/components/SurpriseMeSection.tsx`

- **Delete `V1_FALLBACK`** and both `setFallbackUsed(true)` paths.
- Drop `hotelPrice` from the `Destination` interface and any render of it.
- Render three states: **destinations** (1–3 real cards), **degraded** (honest message + `Retry` + existing Ask-Atlas escape hatch), **originUnknown** (existing behaviour, preserved).
- The degraded copy surfaces `degraded.reason` verbatim — the F2 strings already say things like "not configured … this does NOT mean no flights exist."
- Fewer than 3 real cards renders 1–2 cards. It never pads.
- **i18n:** delete the dead `atlasHero` keys from all 6 locales — `fallbackTitle`/`fallbackBody` (the "example destinations" copy is now a lie) **and** the never-consumed `hotelsFrom`/`flightsFrom` price-template keys (zero consumers in `src/`; they are the exact hotel-price-fabrication shape this change outlaws, one `t("hotelsFrom")` call away from resurrection). Add honest degraded-state copy in their place.

### 4.5 Cleanup

`getFastApiBaseUrl` and `DEFAULT_FASTAPI_BASE_URL` become unused. Delete them from `src/lib/server-config.ts` (and the assertion in `server-config.test.ts`), plus the `FASTAPI_URL` env references. This also resolves the `FASTAPI_URL` contradictions in `docs/deployment/local-to-vps.md` flagged in the xhigh review backlog — including the stale sidecar health-check instructions: the deploy-verification step `curl -I http://127.0.0.1:8766/ || true` at `docs/deployment/local-to-vps.md:288` and the matching prose at `docs/product/ARCHITECTURE.md:163` both instruct operators to probe a FastAPI sidecar that no longer exists in any code path, and must be removed/rewritten in the same cleanup.

**Gate:** `grep -rn "getFastApiBaseUrl\|FASTAPI_URL" src/` must return **zero** hits. If any other consumer surfaces, stop and reassess rather than deleting the helper out from under it.

---

## 5. Testing

**Unit** (`surprise.test.ts`, mocking `tpGet`/`searchFlights` — no live calls):
- Maps live routes → cards; `transfers: 0 → nonstop: true`, `1 → false`.
- Round-trip suffix `" rt"` appears only when `tripLength` resolves.
- Self-origin dropped; duplicate destinations deduped keeping cheapest.
- `min_overlap` is 2 for 2+ vibes, 1 for a single vibe.
- Filler engages when live matches < 3 **and** vibes present; does **not** engage with no vibes.
- Enrichment capped at 3 calls (assert call count — guards F6 at the function layer).
- Worst-case HTTP budget pinned at the wire: with the TP token stubbed and `global.fetch` mocked to success-empty, a full filler run issues **≤ 7** fetch calls (1 popular + 3 enrichments × 2 month-fallback attempts) — the F6 budget asserted at the HTTP layer, not just the function-call layer.
- Enrichment failure → `"—"`, never a number.
- TP failure → `degraded.reason` distinguishes `no_token` from "no routes".
- Degraded-reason selection follows §4.1 step 9: failure reason if the TP call failed, else `NO_VIBE_MATCH_REASON` when vibes were requested, else `NO_ROUTES_REASON`.
- Invalid origin → degraded; origin is **never** rewritten to `MIA`.
- **Anti-fabrication guard** (extends the existing `no-fabrication.test.ts`), scoped to the Surprise Me file set — the route, `SurpriseMeSection.tsx`, `AtlasHeroSection.tsx`, `DestinationCard.tsx`, `surprise.ts`, `destination-vibes.ts`: none of those six files contains the fabricated literals `$89`/`$95`/`$75`/`$127`/`$159`/`$189`, `/night` formatting, a `hotelPrice` key, or the invented airlines. **Deliberately NOT repo-wide:** unrelated pre-existing literals live in `src/config/affiliates.ts` (`$899`, `$159`) and the static `src/app/[locale]/destinations/page.tsx` marketing page (`$89`, `$75/night`, …), so a repo-wide ban can never pass.

**Vibe map** (`destination-vibes.test.ts`): 82 entries; spot-check `CUN`, `SJU`, `PUJ`.

**Route** (`route.test.ts`): no FastAPI fetch; degraded responses are not cached; successful ones are; an unexpected engine throw degrades in-body (HTTP 200), never a 500.

**E2E:** existing Playwright suite must stay 41/41.

**Live smoke** (real token, dev server): a vibe combo that the probe showed returns <3 live matches (e.g. `beach+romantic` from JFK, measured 0) must still render 3 cards via the filler with **real** prices — proving the filler works and nothing is invented.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Filler ported subtly wrong → silently fewer cards | Unit tests assert engagement + call cap; live smoke on a known 0-match combo |
| Extra TP calls regress the F6 rate budget | Hard cap of 3 enrichment calls; worst case 7 HTTP requests (1 popular + 3×2 month-fallback) vs ≤8 budget; asserted in tests at both the function layer and the fetch layer |
| Deleting `getFastApiBaseUrl` breaks an unseen consumer | `grep` gate must show zero hits before deletion |
| Diff sits under a pending deploy | Isolated worktree; `main` stays at verified `4d5a1e7` until Jose green-lights the merge |
| Vibe map truncated during port | Test asserts exactly 82 entries |

---

## 7. Follow-ups (not this change)

- **Blended source restructure.** The probe shows the curated map carries ~78% of cases, so "curated + live enrichment" is really the primary path and "popular routes" the garnish. A single blended source is likely the right long-term shape. Deliberately deferred — it is a redesign, not a bug fix.
- **`adventure + cultural` is structurally weak** (0 live matches at all 6 origins; only 16 destinations carry `adventure`). Worth widening the tag coverage or reconsidering `min_overlap` for sparse vibes. Product call, not a porting concern.
- **Hotel partner-search handoff** — Phase 3 monetization plan.
