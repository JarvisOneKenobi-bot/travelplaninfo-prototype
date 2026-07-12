# Final Re-Verification (Pass 2) — Surprise Me Workstation Independence

- **Branch:** `feat/surprise-me-workstation-independence` @ `87226b2` (14 commits vs `main`)
- **Verifier:** Independent final re-verification pass (did not write or previously review this code; prior
  pass's DO-NOT-SHIP report read but nothing taken on trust — every command below run fresh 2026-07-12)
- **Scope:** Confirm blocker F1 (and minor F2) from
  `2026-07-11-surprise-me-final-verification.md` are genuinely dead, all gates hold, and the two fix
  commits (`60209dc`, `87226b2`) introduce no new regression.
- **Verdict:** **SHIP.** Nothing wrong was found. Every item below passed with fresh evidence, including
  adversarial wire-level probes that reproduce the original F1 attack and two mutation checks proving the
  new test genuinely bites.

---

## Verdict summary

| # | Item | Result |
|---|------|--------|
| 1 | F1 blocker really dead (adversarial wire probes, both surfaces) | **PASS** |
| 2 | New wire test genuinely bites (2 mutations, assertion-level failures, cheat-proof) | **PASS** |
| 3 | No over-correction (measured `transfers: 0` still → `nonstop: true`, live mixed response) | **PASS** |
| 4 | Gates: lint / unit 137 / build / playwright 41 / FastAPI grep | **PASS** (all five) |
| 5 | Live smokes (real TP token, :3001) | **PASS** (all five) |
| 6 | All other fabrication still dead | **PASS** |
| 7 | F6 rate budget (≤8 wire calls, cap pre-dispatch) | **PASS** |
| 8 | Untouched surface (tool-loop / getPopularRoutes / searchFlights) | **PASS** |
| 9 | Deploy safety (env vars, missing-token honesty, F2 never-cache) | **PASS** |
| 10 | New regressions from fix commits 60209dc / 87226b2 | **PASS — none found** |

---

## 1. The blocker is really dead — PASS

**The fix as shipped** (verified by reading current source, not the commit message):
- `travelpayouts-client.ts:386` — `transfers: item.transfers ?? null` (was `?? 0`)
- `travelpayouts-client.ts:17` — `FlightOption.transfers: number | null`
- `travelpayouts-client.ts:292-296` — `formatStops(null)` returns `""` (never "Nonstop", never "0 stops")
- `surprise.ts:139` (popular) and `surprise.ts:208` (enrichment) — `?? null`, with
  `nonstop: route.transfers === 0` at lines 85/231 → strict-equality means null can never claim nonstop.

**Independent adversarial probe** (my own, written from scratch — NOT the shipped test — run in a
throwaway scratch worktree at `87226b2` with `node_modules` linked; controls the actual TP wire by
stubbing `global.fetch`; probe file preserved at
`/tmp/claude-1000/-home-jarvis/661731b7-02cd-4330-b3ce-88b51f589913/scratchpad/probe.adversarial.test.ts`):

| Probe | Attack | Result on HEAD |
|-------|--------|----------------|
| A | Enrichment path (popular forced empty), items **without** `transfers` key | `nonstop:true` cards = `[]`; prices still real (`$300…`) |
| B | Enrichment path, explicit `transfers: null` | no nonstop claims |
| C | Popular path, items without `transfers` | no nonstop claims |
| D | Popular path, measured `0` / `1` / absent mixed in ONE response | exactly `[true, false, false]` |
| E | Atlas chat `searchFlights`, item without `transfers` | `stops === ""` (not "Nonstop", not "0 stops"); `duration === ""` |
| F | Atlas chat, explicit `transfers: null` | `stops === ""` |
| G | Positive control: chat, measured `transfers: 0` | `stops === "Nonstop"` |

```
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

**Probe validity check** — re-running the same 7 probes against the `?? 0` mutation (the pre-fix state):

```
 ❯ probe.adversarial.test.ts (7 tests | 4 failed)
     × PROBE A: enrichment path — items WITHOUT transfers key must never claim nonstop
     × PROBE B: enrichment path — explicit transfers: null must never claim nonstop
     × PROBE E: Atlas chat stops label — item WITHOUT transfers must render stops as '' (no claim)
     × PROBE F: Atlas chat stops label — transfers: null renders '' too
```

The probes detect the old bug on **both** the surprise enrichment path AND the Atlas chat stops path,
and pass on HEAD — the fabrication class is dead on both surfaces. (Probes C/D pass even under the
mutation because the popular path reads raw TP items and was already fixed at `1f881a9`, consistent with
the prior report.)

## 2. The new test genuinely bites — PASS

All mutations were applied in the throwaway scratch worktree only; the branch worktree code was never
modified (`git status` at end: only `next-env.d.ts` + `playwright-report/index.html` build artifacts and
untracked review docs).

**Mutation A — revert the fix** (`transfers: item.transfers ?? null` → `?? 0` at
`travelpayouts-client.ts:386`), run `surprise.wire.test.ts`:

```
 FAIL  … > ENRICHMENT: absent transfers must NOT be claimed as nonstop
 AssertionError: expected true to be false        (surprise.wire.test.ts:57)
 FAIL  … > ENRICHMENT: transfers: null is absence, not zero
 AssertionError: expected true to be false        (surprise.wire.test.ts:77)
 Tests  2 failed | 2 passed (4)
```

Fails on **assertions** (not an import crash), on exactly the two absence cases, while the two measured
cases still pass. The test mocks `global.fetch` and imports the real module chain, so the real
`normalizeFlights` runs — it tests below the layer where the old test was blind.

**Mutation B — the cheat** (hardcode `nonstop: false` at both `surprise.ts` claim sites):

```
 FAIL  … > ENRICHMENT: explicit transfers: 0 IS a measured nonstop (positive control)
 AssertionError: expected false to be true        (surprise.wire.test.ts:67)
 Tests  1 failed | 3 passed (4)
```

The positive control catches the cheat: measured zeros MUST yield `true`. The test also asserts
`flightPrice` matches `/^\$\d/` on every card, so it cannot be satisfied by degrading to dash cards
either. Cheat-proof.

## 3. No over-correction — PASS

Measured `transfers: 0` still yields `nonstop: true`, proven three ways:
- **Live, single response** — `?origin=LAX&vibes=beach,romantic&trip_length=week` contains BOTH values:
  HNL `$292 rt` UA `nonstop: true` alongside CUN `$324 rt` Y4 `nonstop: false` and PUJ `$755 rt` F9
  `nonstop: false`.
- **Live** — JFK flexible: BOS/ATL/FMY all `nonstop: true` (real measured nonstops, $128/$141/$145 rt).
- **Probe D** — measured `0`/`1`/absent in one wire response → exactly `[true, false, false]`.
- **Probe G** — chat surface: measured `0` still renders `"Nonstop"`.

## 4. Gates — PASS (all five, fresh)

- **`npm run lint`** → `✖ 30 problems (0 errors, 30 warnings)` — matches the stated baseline.
- **`npm run test:unit`** → `Test Files 19 passed (19)` / `Tests 137 passed (137)` — 137 as expected
  (prior 132, −1 worthless mock-level test removed, +4 wire tests, +1 client stops-discrimination test,
  +1 all-dash-not-cached route test).
- **`npm run build`** → exit 0, full route table, no errors.
- **`npx playwright test`** → `41 passed (39.6s)` against the live :3001 dev server, including
  `SurpriseMeSection shows non-silent fallback banner on API failure` and
  `SurpriseMeSection signals unknown-origin instead of silently defaulting to MIA`
  (`tests/e2e/planner-trust.spec.ts:145,160`).
- **`grep -rn "getFastApiBaseUrl\|FASTAPI_URL" src/`** → zero hits (exit 1).

## 5. Live smokes — PASS (real TP token, :3001; server confirmed 200 before and after the build)

- **JFK + beach,romantic + week** → 3 real cards: CUN `$282 rt` B6, PUJ `$476 rt` AV, MBJ `$666 rt` B6 —
  all `nonstop: false`, all links `aviasales.com/search/…?marker=164743`. Real market prices, not the
  `$89/$127` fabrication families.
- **JFK + flexible + week** → 3 REAL cards (BOS `$128 rt`, ATL `$141 rt`, FMY `$145 rt`), NOT a degraded
  banner. Re-confirmed post-build: `3 cards, degraded = None`.
- **LAX + beach,romantic** → differs from JFK (HNL/CUN/PUJ vs CUN/PUJ/MBJ) and mixes nonstop true/false
  in one payload (see item 3).
- **origin=Cancun** → honest degrade: `"origin": "CANCUN"`, `destinations: []`,
  reason = `INVALID_IATA_REASON` ("pass the airport code, not a city name"). Never "MIA".
- **hotelPrice** → all five captured payloads re-fetched and grepped: `0` occurrences.

## 6. All other fabrication still dead — PASS

- **Server FALLBACK / client V1_FALLBACK:** `grep -rn "V1_FALLBACK\|FALLBACK" src/` (non-test) → zero
  hits.
- **Fabricated price/airline literals** (`$89/$95/$127/$159/$189`, `Spirit NK`, `JetBlue`, `/night`,
  `hotelPrice`, `hotelsFrom`/`flightsFrom`): remaining hits live ONLY in pre-existing static marketing
  pages (`destinations/page.tsx`, `hot-deals/page.tsx`, `config/affiliates.ts`,
  `TrendingDestinations.tsx`, `TripResultsModal` hotel copy, `trip-types.ts`) and the two dead
  components — and `git diff main..HEAD --stat` over every one of those files is **empty** (unchanged by
  this branch, outside the Surprise Me surface).
- **Dead components:** `EntryTabs.tsx` (fabricated `hotelPrice: 85/65/45`) has zero importers
  (only `DestinationSuggestions.tsx`, which only EntryTabs imports) — unreachable, pre-existing on main
  (F4 carryover, cleanup candidate, not a blocker).
- **Tripwire:** `no-fabrication.test.ts` pins the 7 Surprise Me path files against all banned literals,
  bans `MIA` in `surprise.ts`, pins the D3 tool allowlist (`search_flights`, `get_deals`, `get_article`,
  `surprise_me`), and forces client query construction through `buildSurpriseQuery` so the flexible
  sentinel can never reach the API as a vibe. Part of the passing 137.
- **i18n:** degraded copy honest in locales ("This does not mean no flights exist — try again" / Spanish
  equivalent verified; all 6 locale files in the branch diff).
- **Caches:** TP client caches only raw TP responses (5 min); route caches only responses with ≥1
  measured price AND no degrade flag (see item 9/F2); error path returns `INTERNAL_ERROR_REASON` degrade,
  never cached (pinned by route tests in the 137).

## 7. F6 rate budget — PASS

- Worst case = **7 ≤ 8** wire calls: 1 popular fetch + ≤3 enrichment codes × ≤2 attempts each
  (exact-date then month retry). Pinned by `surprise.http-budget.test.ts` which runs the REAL
  `tpGet`/`rawSearchFlights` with only `fetch` mocked and asserts **exact equality**
  `expect(fetchMock.mock.calls.length).toBe(7)` plus 3 dash-shape cards — cannot pass vacuously at 0.
- Cap enforced **pre-dispatch**: `surprise.ts:186-193` bounds `enrichmentCodes` to `slotsRemaining` (≤3)
  before `Promise.all` fires.
- Window limiter counts **pre-fetch**: `travelpayouts-client.ts:342-346` (`checkRateLimit()` rejects
  before dispatch; timestamp pushed before `fetch`).

## 8. Untouched surface — PASS

- `git diff main..HEAD --stat -- src/lib/atlas/tool-loop.ts src/lib/atlas/system-prompt.ts
  src/components/AssistantChat.tsx src/lib/preferences.ts` → **empty**.
- The full `travelpayouts-client.ts` diff vs main was extracted line-by-line: `export` keyword additions
  + `FlightOption.transfers: number | null` + `formatStops` null guard + `?? null` — nothing else.
  `getPopularRoutes`/`getDeals`/`formatPrice` logic untouched.
- The one intentional chat-surface behavior change (F5 fix: `stops: ""` for unmeasured flights) is
  handled by every consumer: `AssistantChat.tsx:180-189` (`/nonstop/i.test("")` → false),
  `FlightCard.tsx:18` and `TripResultsModal.tsx:302/315/574` (non-empty join — no dangling separators).
  Probe G proves measured chat nonstops still label "Nonstop".
- `DealOption`/`PopularRoute` interfaces still declare `transfers: number` but are never constructed
  anywhere (dead type fields, pre-existing, zero runtime risk).

## 9. Deploy safety — PASS

- **Env vars required in production for this surface:** exactly one — **`TRAVELPAYOUTS_TOKEN`**.
  It rides with the pending Phase 2 VPS provisioning together with `ANTHROPIC_API_KEY` (Atlas brain);
  `docs/deployment/local-to-vps.md:96-103` documents both as "NOT YET PROVISIONED on the VPS" manual
  pre-deploy gates. The rest of the app's env contract (NEXTAUTH_SECRET/URL, APP_BASE_URL, Google keys,
  OPENAI_API_KEY) is pre-existing and unchanged; `FASTAPI_URL` is gone from code and docs. The branch
  **removes** a production dependency (FastAPI :8766) and adds none.
- **Missing token proven honest through the REAL route handler + REAL engine + REAL TP client** (probe in
  scratch worktree, token empty, `fetch` booby-trapped to throw on any wire attempt):
  - No vibes: `{"origin":"JFK","destinations":[],"degraded":{"reason":"…missing Travelpayouts token…does
    NOT mean no flights exist…"}}` — fetch trap never invoked, no `hotelPrice`, no `MIA`; second
    identical request returns the same honest degrade with still-zero wire calls (degrade not served
    from cache).
  - 2+ vibes: 3 dash cards (`flightPrice: "—"`, `airline: ""`, `nonstop: false`, `link: ""`) — claims
    nothing — and **F2 is fixed end-to-end**: a spy on the real engine shows the second identical request
    re-invokes it (all-dash response NOT cached). Also pinned by the new route test
    "ALL-DASH UNDEGRADED IS NOT CACHED" (in the 137).
- Both probe tests passed: `Tests 2 passed (2)`.

## 10. Fix-commit regression review (`60209dc`, `87226b2`) — PASS, none found

Read hunk-by-hunk (`git diff 1f881a9..87226b2`):
- Type widening (`number | null`) compiles clean across the codebase (build exit 0, lint 0 errors).
- `FlightCard`/`TripResultsModal` separator joins are strict improvements (the old template produced
  dangling `· ·` separators when `duration` was empty — now filtered).
- Route cache gate (`hasMeasuredPrice`) is **conservative-only**: it can only cache fewer responses than
  before, never more; the engine contract is untouched.
- `NO_PRICE_LABEL` lives in `surprise.ts` (already watched by the tripwire) and is imported by the route
  gate, so the gate cannot drift from the value it tests.
- `route.test.ts` mock now spreads `importOriginal` so the real `NO_PRICE_LABEL` constant flows through —
  correct pattern, no masking.
- `travelpayouts-client.test.ts` had the OLD bug written down as an expectation
  (`stops: "Nonstop"` from an item with no transfers key) — corrected to `""` with explicit 0/1/2
  discrimination cases through the real `searchFlights`.
- Removed test was the worthless mock-above-the-bug one; net unit count 132 → 137.

## Non-blocking observations (for the backlog, none affect this ship)

- **N1 (cosmetic typing):** `TpFlightItem.transfers?: number` — TP can send explicit `null`; runtime
  `?? null` handles it and the wire test pins the null case, but the type could say
  `number | null | undefined`.
- **N2 (pre-existing, chat surface):** `formatPrice(null)` renders `"$0"` — a priceless TP item on the
  chat path would show `$0`. Identical on `main` (formatPrice not in the branch diff); same class as the
  prior report's F5 but for price. Candidate for the same absence-honesty treatment in a follow-up.
- **N3 (cosmetic):** FMY/HNL render as raw IATA codes — honest `IATA_TO_CITY` fallback, faithful port.
- **N4 (F4 carryover, pre-existing):** dead `EntryTabs.tsx`/`DestinationSuggestions.tsx` still carry
  fabricated hotel prices with zero importers — delete in a cleanup pass.

## Environment notes

- All probes/mutations ran in a throwaway `git worktree` at `87226b2` under the session scratchpad
  (removed after use, `git worktree list` clean). The branch worktree code was never modified: end-state
  `git status` shows only `next-env.d.ts` + `playwright-report/index.html` build artifacts and untracked
  review docs.
- Dev server on :3001 answered 200 before and after `npm run build`; post-build smoke re-confirmed
  (JFK flexible → 3 real cards, `degraded = None`). No restart was needed this pass.

## Final verdict

**SHIP.** The F1 blocker is verifiably dead on both the surprise card path and the Atlas chat stops
path — proven by adversarial wire-level probes that reproduce the original attack and fail against the
pre-fix code. The new wire test bites at the right layer, cannot be cheated (positive controls), and
measured nonstops still render truthfully (no over-correction). All five gates pass at their expected
baselines (lint 0/30, unit 137/137, build clean, e2e 41/41, FastAPI grep zero). All five live smokes
pass against real TravelPayouts data. F2 is fixed and proven end-to-end. The rate budget, untouched chat
surfaces, and missing-token honesty all hold. The two fix commits introduce no new regression. Deploy
requires `TRAVELPAYOUTS_TOKEN` (+ `ANTHROPIC_API_KEY` for the broader Phase 2 surface) on the VPS before
production smoke-testing, exactly as `docs/deployment/local-to-vps.md` states.
