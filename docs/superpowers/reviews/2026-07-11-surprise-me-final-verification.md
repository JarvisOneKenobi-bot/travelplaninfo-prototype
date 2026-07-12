# Final Verification — Surprise Me Workstation Independence

- **Branch:** `feat/surprise-me-workstation-independence` @ `1f881a9` (10 code commits vs `main`)
- **Verifier:** Independent verification-before-completion pass (did not write or previously review this code)
- **Date:** 2026-07-12
- **Verdict:** **DO-NOT-SHIP — one BLOCKER (F1).** Everything else passes. The blocker is a single residual
  fabrication path with a small, well-scoped fix; after fixing F1 and re-running the gates this branch is
  otherwise ship-ready.

---

## Verdict summary

| # | Item | Result |
|---|------|--------|
| 1 | Gates (lint / unit / build / e2e / FastAPI grep) | **PASS** (all five) |
| 2 | Fabrication genuinely dead | **FAIL — BLOCKER F1** (enrichment path can claim `nonstop: true` from an absent `transfers` value; proven by adversarial probe) |
| 3 | Live behavioral smokes | **PASS** (all six assertions) |
| 4 | Tests are real (mutation check) | **PASS** (5 fix-tests fail against pre-fix code; http-budget cannot pass at 0 fetches) — with one caveat: the shipped enrichment-nonstop test mocks at the wrong layer, which is exactly why F1 escaped (see F1) |
| 5 | F6 rate budget | **PASS** (worst case 7 wire calls ≤ 8, caps pre-dispatch) |
| 6 | Untouched surface regression | **PASS** (tool-loop / getPopularRoutes / system-prompt / AssistantChat: zero diff) |
| 7 | Deploy safety | **PASS** (needs only `TRAVELPAYOUTS_TOKEN`; missing token degrades honestly, zero wire calls, degrade never cached) — one MINOR caching wrinkle (F2) |

---

## 1. Gates — PASS

All run fresh in this worktree, 2026-07-12.

**`npm run lint`** — exit 0:
```
✖ 30 problems (0 errors, 30 warnings)
```
0 errors, 30 warnings = stated baseline. PASS.

**`npm run test:unit`** — exit 0:
```
Test Files  18 passed (18)
     Tests  132 passed (132)
```
132/132 as expected. PASS.

**`npm run build`** — exit 0, full route table emitted, no errors/warnings in output. PASS.

**`npx playwright test`** — exit 0 (run against the live :3001 dev server, before the build):
```
41 passed (39.8s)
```
Includes `SurpriseMeSection shows non-silent fallback banner on API failure` and
`SurpriseMeSection signals unknown-origin instead of silently defaulting to MIA`. PASS.

**`grep -rn "getFastApiBaseUrl\|FASTAPI_URL" src/`** — zero hits (grep exit 1). The last workstation
dependency is gone: `getFastApiBaseUrl` + `DEFAULT_FASTAPI_BASE_URL` deleted from `src/lib/server-config.ts`,
and `docs/deployment/local-to-vps.md` no longer lists `FASTAPI_URL`. PASS.

---

## 2. Fabrication audit — FAIL (one BLOCKER)

### What is verifiably dead (checked in code AND live payloads)

- **Server V1 fallback** (`$89/$95/$75` hotel prices, "Spirit NK"/"JetBlue", blanket `nonstop: true`,
  `hotelPrice` key): exists only in the Python original
  (`command-post/routers/assistant.py:1090-1099`); no equivalent anywhere in `src/`. Confirmed by grep and
  by the `no-fabrication.test.ts` tripwire (bans `$89`, `$95`, `$75`, `$127`, `$159`, `$189`, `/night`,
  `hotelPrice`, `Spirit NK`, `JetBlue`, `V1_FALLBACK`, `FALLBACK` across the 7 Surprise Me path files, plus
  bans `MIA` in `surprise.ts`).
- **Client V1_FALLBACK** (`$127/$159/$189`): `SurpriseMeSection.tsx` read in full — no fallback array; empty
  destinations → honest degraded banner with retry. Deleted.
- **`hotelPrice`**: removed from `AtlasHeroSection.tsx` interface + prop pass-through, from
  `DestinationCard.tsx`, and `hotelsFrom`/`flightsFrom` i18n strings removed in all 6 locales. No live
  payload contained the key (all smokes + no-token probes checked).
- **Origin collapse to MIA**: Python default `origin: str = "MIA"` not ported; invalid origin returns the
  input uppercased with `INVALID_IATA_REASON` (live-verified below). `route.test.ts` "NO ORIGIN MANGLING"
  pins it.
- **"—" dash paths**: dash cards carry `flightPrice: "—"`, `airline: ""`, `nonstop: false`, `link: ""` —
  no invented values. `DestinationCard` renders the nonstop badge only when `nonstop === true`, so `false`
  makes no visual claim.
- **i18n**: degraded copy in all 6 locales is honest ("This does not mean no flights exist — try again");
  the old "These are example destinations" copy is deleted.
- **Dead components**: `EntryTabs.tsx` (fabricated `hotelPrice: 85/65/45`) and `DestinationSuggestions.tsx`
  have **zero importers** (EntryTabs imports DestinationSuggestions; nothing imports EntryTabs) —
  unreachable at runtime, pre-existing on `main`, outside this branch's diff. Flagged as a cleanup
  candidate, not a blocker for this branch.
- **Error paths**: route `catch` returns `INTERNAL_ERROR_REASON` degrade (never a 500, never cached) —
  pinned by `route.test.ts` "ENGINE THROW DEGRADES IN-BODY".
- Pre-existing static marketing pages (`destinations/page.tsx`, `hot-deals/page.tsx`,
  `config/affiliates.ts`, `TrendingDestinations`, `TripResultsModal`) contain hardcoded prices but are not
  part of the Surprise Me surface and are unchanged by this branch.

### F1 — BLOCKER: enrichment path still claims `nonstop: true` from an absent `transfers` value

**The claim under test** (commit `1f881a9`): "nonstop is claimed only from an explicit transfers: 0 …
on both the popular-routes and enrichment paths."

**The claim is false for the enrichment path.** The fix changed
`src/lib/atlas/surprise.ts:207` to `transfers: cheapest.transfers ?? null` — but `cheapest` comes from
`rawSearchFlights()`, whose `normalizeFlights()` has **already** coerced absence away upstream:

```ts
// src/lib/atlas/travelpayouts-client.ts:385 (inside normalizeFlights)
transfers: item.transfers ?? 0,
```

So by the time surprise.ts sees the flight, an absent (or explicit `null`) `transfers` is an
indistinguishable `0`, the `?? null` guard is dead code, and `nonstop: route.transfers === 0` renders
**true** for a flight nobody measured.

**Adversarial proof** (scratch worktree at `1f881a9`, probe test mocking `fetch` — i.e. controlling actual
TP wire responses, not internal functions): popular returns empty (forcing enrichment); enrichment
responses contain one flight each **without a `transfers` key**. Result:

```
CARDS: [
 { "name": "Cancún, Mexico",  "flightPrice": "$300", "airline": "XX", "nonstop": true, ... },
 { "name": "San Juan, Puerto Rico", ... "nonstop": true, ... },
 { "name": "Punta Cana, Dominican Republic", "flightPrice": "$300", "airline": "XX", "nonstop": true, ... }
]
AssertionError: FABRICATION: nonstop claimed with NO transfers evidence:
expected [ 'Cancún, Mexico', …(2) ] to deeply equal []
```

The same probe against the **popular** path (items without `transfers`) correctly produced
`nonstop: false` — the popular-path fix is real; only the enrichment path is broken.

**Why the shipped test suite passes anyway:** `surprise.test.ts:251` ("NONSTOP: enrichment does not claim
nonstop when transfers are absent") mocks `rawSearchFlights` itself and hand-builds a `FlightOption` with
the `transfers` key deleted — a state the real `rawSearchFlights` can never produce (it needs an `as` cast
to compile, because `FlightOption.transfers` is a required `number`). The test verifies the fix at a mock
boundary above the bug.

**Reachability:** requires vibes with <3 popular matches (common for niche vibe combos / small origins)
AND TP omitting `transfers` or sending `transfers: null` on the cheapest enrichment item. TP v3 usually
includes `transfers`, so real-world frequency is low — but `TpFlightItem.transfers` is typed
`number | null | undefined` precisely because it is not guaranteed, and the branch's own standard
(commit message: "asserting a nonstop flight from missing data is precisely the fabrication class this
branch exists to eliminate") plus the verification standard ("if you can make it fabricate, that is a
BLOCKER") both classify this as a blocker.

**Fix sketch (for the implementer, not applied here):** carry `transfers: number | null` faithfully out of
`normalizeFlights` (`item.transfers ?? null`) and let the one downstream consumer `formatStops`
(travelpayouts-client.ts:292, chat-tool "stops" label) handle `null` honestly — note the chat surface
currently has the same coercion-born "Nonstop" claim, pre-existing on main. Alternatively, keep the fix
surprise-local by having the enrichment path read raw TP items instead of normalized `FlightOption`s.
Then rewrite `surprise.test.ts:251` to mock `fetch` (wire level), not `rawSearchFlights`, so the test can
actually see the composed system.

---

## 3. Live behavioral smokes — PASS

Against the running `:3001` dev server with the real TravelPayouts token. Note: the app 308-redirects to
trailing-slash URLs (`curl -L` required).

**`?origin=JFK&vibes=beach,romantic&trip_length=week`** — real cards, real data, PASS:
```json
{"origin": "JFK", "destinations": [
  {"name": "Cancún, Mexico", "flightPrice": "$282 rt", "airline": "B6", "nonstop": false,
   "link": "https://www.aviasales.com/search/JFK0108CUN08081?marker=164743"},
  {"name": "Punta Cana, Dominican Republic", "flightPrice": "$476 rt", "airline": "AV", "nonstop": false, ...},
  {"name": "Montego Bay, Jamaica", "flightPrice": "$666 rt", "airline": "B6", "nonstop": false, ...}]}
```
Real market prices (not the $89/$127 families), real carrier codes, `marker=164743` on every link.

**`?origin=JFK&vibes=flexible&trip_length=week`** — REAL cards, NOT a degraded banner (the fixed bug), PASS:
```json
{"origin": "JFK", "destinations": [
  {"name": "Boston, Massachusetts", "flightPrice": "$128 rt", "airline": "B6", "nonstop": true, ...},
  {"name": "Atlanta, Georgia", "flightPrice": "$141 rt", "airline": "F9", "nonstop": true, ...},
  {"name": "FMY", "flightPrice": "$145 rt", "airline": "B6", "nonstop": true, ...}]}
```
Identical to vibe-less JFK (sentinel stripped at both layers: `surprise-query.ts:9` client-side,
`surprise.ts:105` via `normalizeVibes` engine-side). Re-verified after the post-build server restart
(3 cards, `degraded=None`).

**`?origin=LAX&vibes=beach,romantic&trip_length=week`** — different payload from JFK (origin not
collapsed), PASS: HNL `$292 rt` UA nonstop:true, CUN `$324 rt` Y4 nonstop:false, PUJ `$755 rt` F9
nonstop:false.

**`?origin=Cancun`** — degrades honestly, PASS:
```json
{"origin": "CANCUN", "destinations": [], "degraded": {"reason":
  "origin and destination must be 3-letter IATA airport codes (e.g. CUN for Cancún, MIA for Miami) — pass the airport code, not a city name."}}
```
Origin echoes `"CANCUN"` — never `"MIA"`.

**No `hotelPrice` key** in any captured payload (all of the above + no-token probes). PASS.

**Nonstop discriminates**, PASS: `true` for JFK→BOS/ATL/FMY and LAX→HNL; `false` for JFK→CUN/PUJ/MBJ and
LAX→CUN/PUJ. Not blanket-asserted. (Cosmetic note: FMY and HNL render as raw IATA codes — honest
`IATA_TO_CITY` fallback, faithful to the Python `IATA_TO_CITY.get(code, code)`.)

---

## 4. Tests are real — PASS (with the F1 caveat)

**Mutation test:** HEAD's `surprise.test.ts` + `surprise-query.test.ts` were overlaid onto a scratch
worktree at `9479560` (the branch state BEFORE the two review fixes) and run:

```
❯ src/lib/atlas/surprise-query.test.ts (0 test)   ← fails to load against pre-fix module
❯ src/lib/atlas/surprise.test.ts (21 tests | 5 failed)
    × NONSTOP: popular routes only claim nonstop when transfers is explicitly zero
    × FLEXIBLE SENTINEL: behaves like absent vibes when popular routes exist
    × FLEXIBLE SENTINEL: mixed with a real vibe preserves the real vibe filter
    × FLEXIBLE SENTINEL: empty popular routes use the no-routes reason
    × NONSTOP: enrichment does not claim nonstop when transfers are absent
Test Files  2 failed (2) | Tests  5 failed | 16 passed (21)
```

Exactly the five fix-assertions fail against the broken implementation — the tests bite. (The enrichment
NONSTOP test does detect the surprise.ts-layer regression; it just cannot see the deeper
`normalizeFlights` coercion — see F1.)

**`surprise.http-budget.test.ts` cannot pass vacuously at 0 fetches:** it asserts
`expect(fetchMock.mock.calls.length).toBe(7)` — an exact equality, not a `<=` — plus
`result.destinations).toHaveLength(3)` with dash-card shape. At 0 fetches both assertions fail. It runs the
REAL `tpGet`/`rawSearchFlights` with only `fetch` mocked, so it genuinely counts wire dispatches.

**`route.test.ts`** is well-built: distinct `vibes` values per test act as cache-key discriminators, so the
module-level route cache cannot leak state between tests (a trap I independently confirmed exists — my own
first probe run was polluted by the module-level TP cache until I isolated files).

**F3 (informational, test-hygiene):** `surprise.test.ts:354` "TP FAILURE + 2 VIBES STILL FILLS HONESTLY"
documents that a total TP failure with 2+ vibes yields 3 dash cards with `degraded: undefined`. That is a
faithful port of the Python behavior, but see F2 for its interaction with the route cache.

---

## 5. F6 rate budget — PASS

- **Worst case = 7 wire calls ≤ 8:** 1 popular `prices_for_dates` + at most 3 enrichment codes × at most
  2 attempts each in `rawSearchFlights` (exact-date, then month retry only when `departDate.length === 10`).
  Pinned by the http-budget test (exact 7 through real code paths with mocked `fetch`).
- **Cap enforced PRE-dispatch:** `enrichmentCodes` is bounded to `slotsRemaining` (≤3) BEFORE
  `Promise.all` fires (`surprise.ts:183-192`); pinned by `surprise.test.ts` "ENRICHMENT CAP = 3, ENFORCED
  PRE-DISPATCH" (`rawSearchFlights` called exactly 3 times on empty popular).
- **Window limiter counts pre-fetch:** `travelpayouts-client.ts:341-345` — `checkRateLimit()` rejects
  before dispatch and `requestTimestamps.push` happens BEFORE `fetch`, so bursts and failures both consume
  the window.
- **Filler never engages without vibes:** pinned by test ("FILLER DOES NOT ENGAGE WITHOUT VIBES",
  `rawSearchFlights` not called) — vibe-less worst case is 1 wire call.

## 6. Untouched surface — PASS

`git diff main..HEAD --stat -- src/lib/atlas/tool-loop.ts src/lib/atlas/system-prompt.ts
src/components/AssistantChat.tsx src/lib/preferences.ts` → **empty**. The Atlas chat `surprise_me` tool
still routes to `getPopularRoutes` (`tool-loop.ts:110-111`), unchanged. The entire
`travelpayouts-client.ts` diff is `export` keyword additions plus the `server-config` deletion — zero
logic changes to shared code (verified by reading the full diff hunk-by-hunk). `no-fabrication.test.ts`
re-pins the D3 tool allowlist (`search_flights`, `get_deals`, `get_article`, `surprise_me` — no hotel /
activity / restaurant tools).

## 7. Deploy safety — PASS (one MINOR)

- **Build is clean** (exit 0) and the branch removes a production dependency rather than adding one.
  Merging this to `main` does not make main un-deployable.
- **Env vars needed in production for this surface:** exactly one — **`TRAVELPAYOUTS_TOKEN`**. (The doc
  `docs/deployment/local-to-vps.md:101-103` correctly lists it as required and flags it "NOT YET
  PROVISIONED on the VPS" — it must ride along with the pending Phase 2 secrets provisioning.) `FASTAPI_URL`
  is gone from code and docs. No other new env vars are introduced (`ANTHROPIC_API_KEY` etc. belong to the
  pre-existing assistant chat surface, untouched here).
- **Missing token behavior — proven through the real route handler + real engine** (scratch worktree with
  no token, `fetch` booby-trapped to fail on any wire call):
  ```
  NO-TOKEN BODY: {"origin":"JFK","destinations":[],"degraded":{"reason":"Live flight search is not
  configured (missing Travelpayouts token). The search could not run — this does NOT mean no flights exist."}}
  ```
  Honest degrade, zero fabricated fields, zero wire calls (`fetchTrap` never invoked), and degraded
  responses are never cached (`route.ts:83` caches only `destinations.length > 0 && !result.degraded`;
  pinned by "DEGRADED IS NOT CACHED", "EMPTY-BUT-UNDEGRADED IS NOT CACHED", and "thrown runs are not
  cached" route tests).

### F2 — MINOR: no-token + 2 vibes response is cached for 1h

With no token AND 2+ vibes, the engine returns 3 curated **dash cards** (`"—"`, no airline, no link, no
nonstop claim — honest, verified via the same probe) with **no `degraded` flag** (faithful to the Python
original), so `route.ts:83` caches it for 1h per query-combo. This is technically a cached degraded-quality
response. Impact is negligible in practice: provisioning `TRAVELPAYOUTS_TOKEN` requires a process restart,
which wipes the in-memory cache. Recommend (non-blocking) tagging TP-failure-backed dash-fills as degraded
or cache-exempt in a follow-up.

---

## Findings index

| ID | Severity | Summary |
|----|----------|---------|
| F1 | **BLOCKER** | Enrichment path claims `nonstop: true` from absent/null `transfers` — `normalizeFlights` (`travelpayouts-client.ts:385`, `?? 0`) launders absence into 0 before the `surprise.ts:207` `?? null` guard runs (guard is dead code). Proven by wire-level probe. Shipped test mocks above the bug. |
| F2 | MINOR | No-token + 2-vibes dash-card response carries no `degraded` flag → cached 1h. Honest content, negligible impact (token provisioning restarts the process anyway). |
| F3 | INFO | `surprise.test.ts:251` should mock `fetch`, not `rawSearchFlights` (would have caught F1). Fix alongside F1. |
| F4 | INFO (pre-existing) | Dead components `EntryTabs.tsx`/`DestinationSuggestions.tsx` still carry fabricated hotel prices; zero importers, unreachable, on `main` before this branch. Cleanup candidate. |
| F5 | INFO (pre-existing) | Chat-tool surface (`formatStops`) has the same `?? 0` coercion → "Nonstop" label from unmeasured data; untouched by this branch (no regression), fixable together with F1. |

## Environment notes

- Working tree at verification start: modified `next-env.d.ts` + `playwright-report/index.html`
  (build/test artifacts) and one untracked prior review doc — no code drift vs `1f881a9`.
- All probes ran in throwaway scratch worktrees (`probe-head` @ 1f881a9, `probe-broken` @ 9479560),
  removed after use; the branch worktree code was never modified.
- Dev server on :3001 verified healthy after the build; post-restart smoke re-confirmed
  (`flexible` → 3 real cards, no degrade).

## Final verdict

**DO-NOT-SHIP** until F1 is fixed. F1 is a genuine, reproducible member of the exact fabrication class
this branch exists to eliminate, and the commit that claims to have fixed it (`1f881a9`) is demonstrably
incomplete on the enrichment path. The fix is one line plus one test rewritten at the wire level
(F3), with an eyes-open decision about whether to also fix the pre-existing chat-surface coercion (F5).
Everything else — all five gates, all six live smokes, the flexible-sentinel fix, origin fidelity,
hotelPrice eradication, V1/client fallback deletion, rate budget, untouched chat surface, and honest
no-token degradation — passed with fresh evidence.
