# Surprise Me — Workstation Independence + De-Fabrication: Implementation Plan

**Date:** 2026-07-11
**Spec:** `docs/superpowers/specs/2026-07-11-surprise-me-workstation-independence-design.md` (approved — follow it; do not redesign)
**Review folded:** `docs/superpowers/reviews/2026-07-11-surprise-me-plan-review.md` — all findings (B1, I1–I3, N1–N7) applied to this plan AND the spec on 2026-07-11; the two documents are consistent with each other as revised.
**Reference implementation (source of truth for the port):** `/home/jarvis/.openclaw/workspace/jarvis-project/command-post/routers/assistant.py` — `surprise_destinations` (~line 901), `DESTINATION_VIBES` (~line 755), `TRIP_LENGTH_DAYS` (~line 848)
**Worktree:** `/home/jarvis/.openclaw/workspace/jarvis-project/travelplaninfo-prototype/.worktrees/surprise-me` — all paths below are relative to it. Run all commands from the worktree root.

**Baseline gates (must all pass before Task 1 and after every task):** `npm run lint`, `npm run test:unit`, `npm run build`. Playwright baseline is **41/41 passing** (`npx playwright test` against a dev server on port 3001).

One commit per task. Each task leaves the tree green (lint + unit + build). TDD tasks commit tests and implementation together (a red-test-only commit would break the per-task gate).

---

## Spec concerns (explicit — read before implementing)

The spec is approved and this plan follows it. These are the points where the spec is under-specified or literally unsatisfiable, with the resolution used by this plan. None of these is a silent deviation.

1. **§5 literal-ban scope.** As originally written the ban was repo-wide ("the repo contains no `$89`/`$95`/`$75`/`$127`/`$159`/`$189` literals") and unsatisfiable against *pre-existing, unrelated* code: `src/config/affiliates.ts` (`$899` contains `$89`; `price: "$159"`) and `src/app/[locale]/destinations/page.tsx:50-84` (`From $89`, `$89/night`, `$75/night` — a static marketing page outside this spec's scope). **Resolution:** the anti-fabrication guard (Task 6) scans exactly the Surprise Me file set, not the whole repo — spec §5 was corrected to say so in the 2026-07-11 review revision. This is the "self-defeating verification gate" class of bug past reviews caught in 3 plans, and review finding **B1** caught a 4th instance planted in this plan's own Task 3a ↔ Task 6 pairing (the `$127` contract-comment example) — fixed by switching the example to the non-banned `$142` in both documents. Do not widen the scan.
2. **§4.1 step 8 enrichment function.** The spec originally said "enrich with `searchFlights`". The *exported* `searchFlights` in `travelpayouts-client.ts` fans out to nearby airports (`airportsWithNearby` — LAX becomes **4** origins ⇒ up to **8** HTTP calls per enrichment ⇒ worst case **25** calls, blowing the ≤8 F6 budget) and returns display strings (`"$210 round-trip"`), not numbers. The faithful equivalent of Python `client.search_flights` (single origin→dest pair, numeric price, month-granularity fallback) is the module-private **`rawSearchFlights`**. **Resolution:** export `rawSearchFlights` and use it for enrichment — spec §4.1 step 8 was corrected accordingly (2026-07-11 revision). This matches the reference implementation exactly; using the public `searchFlights` would be the actual deviation.
3. **TP call accounting.** The spec originally said worst case "4 TP calls" — it counted logical calls. `rawSearchFlights` (like Python `client.search_flights`) can issue up to **2** HTTP requests (specific-date, then month fallback). True worst case is 1 (popular) + 3×2 (enrichment) = **7 HTTP requests — still within the ≤8 F6 budget**. Spec §4.1 now states 7 (2026-07-11 revision). The budget is pinned at both layers: test 9 caps enrichment *function* calls at 3, and the wire-level test in 3d (review N7) caps *fetch* attempts at ≤ 7.
4. **§4.1 step 9 degraded reason for "TP succeeded but nothing usable".** Step 4's reasons only exist on TP *failure*. Two additional honest reasons are defined in Task 3 (`NO_ROUTES_REASON`, `NO_VIBE_MATCH_REASON`), selected by ONE rule (review I1; now also written into spec §4.1 step 9): **`failureReason` if the TP call failed; otherwise `NO_VIBE_MATCH_REASON` if vibes were requested; otherwise `NO_ROUTES_REASON`.** The discriminator is whether vibes were requested, NOT whether routes existed — `NO_VIBE_MATCH_REASON` covers both "zero routes came back while vibes were requested" and "routes existed but none survived vibes+filler". Both follow the F2 style ("this does NOT mean no flights exist").
5. **The curated filler is dead for single-vibe requests — on purpose.** Python's filler hard-codes `overlap < 2 → skip` regardless of `min_overlap` (assistant.py:1019/1058), so a single-vibe request can never be filled (max overlap is 1). Spec §4.1 step 8 documents this ("skipping … entries with overlap < 2"). Port it verbatim; a unit test pins it so nobody "fixes" it later.
6. **One e2e test currently passes only because of the fabrication.** `tests/e2e/planner-trust.spec.ts` "Path B → Plan a trip to X CTA" waits for `atlas-destination-card` after loading a Surprise Me trip — today the fabricated fallback guarantees cards. After de-fabrication, a token-less/empty-data environment yields a degraded (card-less) response. **Resolution (Task 5):** stub `/api/surprise-me` in that test with `context.route` returning a realistic fixture. Test fixtures are explicitly allowed; the test still exercises the resolve-surprise CTA flow it was written for. Count stays 41.
7. **Absent `origin` query param.** Python defaults an absent origin to `"MIA"` (function signature default). Spec G5/step 1 forbid substituting MIA. **Resolution:** absent origin is treated exactly like an invalid one — degraded with `INVALID_IATA_REASON`, origin echoed as `""`. (The real client always sends `origin`, and `originCode === "???"` never reaches the API — this path is defensive.)
8. **Degraded banner test-id.** The existing e2e asserts `data-testid="surprise-fallback-banner"`. The spec doesn't mandate a rename; **keep the test-id** on the new degraded banner so the e2e passes unmodified.

---

## Task 1 — Export the internals `surprise.ts` needs from `travelpayouts-client.ts`

**Goal:** make the private helpers importable without changing any behavior or signature. `tool-loop.ts` (`getPopularRoutes`, `searchFlights`, `getDeals`) must be completely untouched.

**Files:** `src/lib/atlas/travelpayouts-client.ts` (only).

**Changes** — add `export` to these currently-private declarations (no body changes):

- `tpGet` (function)
- `rawSearchFlights` (function)
- `rawItems` (function)
- `nextMonthUtc` (function)
- `addDays` (function)
- `cleanIata` (function)
- `FAILURE_REASONS` (const)
- `INVALID_IATA_REASON` (const)
- `type TpFailure`, `type TpResult`, `type TpResponse`, `type TpFlightItem` (types — currently non-exported `type` aliases)

Do NOT change: `searchFlights`, `getDeals`, `getPopularRoutes`, `parseIata`, `buildAviasalesLink`, `IATA_TO_CITY`, the rate limiter, or the pre-fetch attempt counting (the `requestTimestamps.push(Date.now())` placement BEFORE the fetch is review finding F6 — leave it exactly where it is).

**Verify:**
```bash
npm run lint && npm run test:unit
```
Expected: lint clean; all existing unit tests pass (`tool-loop.test.ts`, `travelpayouts-client.test.ts`, `no-fabrication.test.ts` unchanged and green).

Commit: `feat(surprise): export travelpayouts-client internals for native surprise module`

---

## Task 2 — `src/lib/atlas/destination-vibes.ts` (TDD)

**Goal:** the 82-entry vibe taxonomy, ported verbatim. Static data only — no prices, nothing fabricated.

**Files:** `src/lib/atlas/destination-vibes.test.ts` (new), `src/lib/atlas/destination-vibes.ts` (new).

**Step 2a — write the test first** (`destination-vibes.test.ts`), run it, watch it fail:

- `Object.keys(DESTINATION_VIBES)` has length **exactly 82**.
- Spot checks (spec §5): `DESTINATION_VIBES["CUN"]` equals `{tropical, beach, big_city, nightlife, romantic}`; `"SJU"` equals `{tropical, beach, big_city, cultural, nightlife}`; `"PUJ"` equals `{tropical, beach, romantic}`.
- Every key matches `/^[A-Z]{3}$/`.
- Every tag is a member of the closed vocabulary `{tropical, beach, romantic, nightlife, big_city, cultural, adventure, foodie, mountain}`.

**Step 2b — implement.** Export:

```ts
export const DESTINATION_VIBES: Record<string, ReadonlySet<string>> = { /* 82 entries */ };
```

Insertion order and tags must match the Python source (assistant.py:755-845) — insertion order matters because the filler's stable sort ties break on it. Full verbatim table (each `XXX: [...]` becomes `XXX: new Set([...])`):

```
CUN: tropical, beach, big_city, nightlife, romantic
SJU: tropical, beach, big_city, cultural, nightlife
PUJ: tropical, beach, romantic
MBJ: tropical, beach, romantic, adventure
NAS: tropical, beach, romantic
GCM: tropical, beach, romantic
BGI: tropical, beach, romantic, cultural
ANU: tropical, beach, romantic
STT: tropical, beach, romantic, adventure
STX: tropical, beach, adventure
SXM: tropical, beach, nightlife, romantic
PLS: tropical, beach, romantic
SJD: tropical, beach, romantic, adventure
PVR: tropical, beach, romantic, nightlife
CTG: tropical, beach, cultural, romantic
SDQ: tropical, beach, big_city
ZIH: tropical, beach, romantic
HAV: tropical, beach, cultural
MCO: beach, big_city, adventure
MIA: beach, big_city, nightlife, tropical
FLL: beach, tropical
TPA: beach
RSW: beach
SAN: beach, big_city, foodie
HNL: tropical, beach, romantic, adventure
JFK: big_city, cultural, foodie, nightlife
LGA: big_city, cultural, foodie, nightlife
EWR: big_city, cultural, foodie, nightlife
LAX: big_city, beach, cultural, foodie, nightlife
ORD: big_city, cultural, foodie
LAS: nightlife, big_city, adventure
ATL: big_city, cultural, foodie
DFW: big_city, foodie
DEN: mountain, adventure, big_city
SEA: big_city, cultural, foodie, mountain
BOS: big_city, cultural, foodie
SFO: big_city, cultural, foodie
MSY: cultural, foodie, nightlife
BNA: cultural, nightlife, foodie
AUS: cultural, nightlife, foodie
PDX: foodie, cultural
PHX: adventure, mountain
LHR: big_city, cultural, foodie
CDG: big_city, cultural, foodie, romantic
FCO: big_city, cultural, foodie, romantic
BCN: big_city, beach, cultural, foodie, nightlife
MAD: big_city, cultural, foodie, nightlife
AMS: big_city, cultural, nightlife
LIS: big_city, cultural, foodie, beach, romantic
ATH: cultural, beach, foodie, romantic
IST: big_city, cultural, foodie
DUB: cultural, foodie
CPH: cultural, foodie, big_city
PRG: cultural, romantic, nightlife
BUD: cultural, nightlife, romantic
KEF: adventure, romantic
GIG: beach, big_city, cultural, nightlife, tropical
GRU: big_city, cultural, foodie
EZE: big_city, cultural, foodie, nightlife
BOG: big_city, cultural, foodie, mountain
MDE: big_city, cultural, foodie, mountain
LIM: big_city, cultural, foodie
SJO: adventure, tropical, beach
PTY: big_city, tropical, beach
BZE: tropical, beach, adventure
BKK: big_city, cultural, foodie, nightlife, tropical
DPS: tropical, beach, cultural, romantic, adventure
SIN: big_city, cultural, foodie
HKG: big_city, cultural, foodie
NRT: big_city, cultural, foodie
HND: big_city, cultural, foodie
ICN: big_city, cultural, foodie
DXB: big_city, beach
CMB: tropical, beach, cultural
SYD: big_city, beach, cultural, foodie
AKL: adventure, cultural
CPT: big_city, beach, adventure, cultural, foodie
NBO: adventure, cultural
RAK: cultural, foodie, romantic
CAI: cultural, big_city
HRG: beach, tropical
SSH: beach, tropical
```

Before committing, diff your file against the Python source (`sed -n '755,845p' /home/jarvis/.openclaw/workspace/jarvis-project/command-post/routers/assistant.py`) — this plan's table was transcribed from it, but the Python file is the source of truth.

**Verify:**
```bash
npx vitest run src/lib/atlas/destination-vibes.test.ts
```
Expected: fails before 2b ("Cannot find module"), then all 4 assertions pass.

Commit: `feat(surprise): port 82-entry DESTINATION_VIBES taxonomy verbatim`

---

## Task 3 — `src/lib/atlas/surprise.ts` (TDD) — the core port

**Goal:** faithful native port of `surprise_destinations`, minus the fabricated last-resort block (assistant.py:1090-1099 is the fabrication site — it does NOT get ported; empty ⇒ `degraded`).

**Files:** `src/lib/atlas/surprise.test.ts` (new), `src/lib/atlas/surprise.http-budget.test.ts` (new — see 3d), `src/lib/atlas/surprise.ts` (new).

### 3a — Module contract (from spec §4.1, verbatim)

```ts
import {
  tpGet, rawSearchFlights, rawItems, nextMonthUtc, addDays, cleanIata,
  parseIata, buildAviasalesLink, FAILURE_REASONS, INVALID_IATA_REASON,
  IATA_TO_CITY, type TpFailure, type TpFlightItem,
} from "./travelpayouts-client";
import { DESTINATION_VIBES } from "./destination-vibes";

export const TRIP_LENGTH_DAYS: Record<string, number> = {
  weekend: 2, week: 7, "10_14_days": 12, "2_weeks": 14, "3_weeks": 21,
};

export const NO_ROUTES_REASON =
  "Live flight search returned no popular routes for this origin and month. This does NOT mean no flights exist — try a different month or ask Atlas.";
export const NO_VIBE_MATCH_REASON =
  "No live routes matched the requested vibes for this origin and month. This does NOT mean no flights exist — try different vibes or ask Atlas.";

export interface SurpriseDestination {
  name: string;        // IATA_TO_CITY[code] ?? code
  flightPrice: string; // "$142" | "$142 rt" | "—"  — never invented
  airline: string;     // TP airline code | ""
  nonstop: boolean;    // transfers === 0
  link: string;        // TP deep link | ""
}

export interface SurpriseResult {
  origin: string;
  destinations: SurpriseDestination[];
  degraded?: { reason: string }; // present iff destinations is empty
}

export async function getSurpriseDestinations(params: {
  origin: string;
  vibes?: string;
  departMonth?: string;
  tripLength?: string;
}): Promise<SurpriseResult>;
```

Note there is **no `hotelPrice` field anywhere** — it cannot be fabricated because the type doesn't admit it.

The `flightPrice` doc-comment example is deliberately **`$142`, NOT `$127`** (review B1): `$127` is one of the six banned literals Task 6 scans this very file for, so a `$127` example here would make Task 6's tripwire fail against this plan's own instructed code. Do not "restore" the original fabricated value in the comment.

Imports MUST be named imports from `"./travelpayouts-client"` (not re-implemented locally), or the test mocks in 3c won't intercept them.

### 3b — Algorithm (mirror assistant.py:900-1101 step for step)

1. **Origin:** `const origin = parseIata(params.origin ?? "")`. If `null` → return `{ origin: (params.origin ?? "").trim().toUpperCase(), destinations: [], degraded: { reason: INVALID_IATA_REASON } }`. **No TP call is made. `"MIA"` never appears as a substitute — grep your implementation for the string `"MIA"` before committing: it must not exist in this file.**
2. **Vibes:** `requestedVibes = new Set(vibes.split(",").map(v => v.trim().toLowerCase()).filter(Boolean))`.
3. **Month:** `departMonth = params.departMonth?.trim() || nextMonthUtc()`.
4. **Round trip** (review N1): only when `departMonth` matches `/^\d{4}-\d{2}$/` **and** `TRIP_LENGTH_DAYS[tripLength]` resolves to `days`: `returnDate = addDays(`${departMonth}-01`, days)`; `isRoundTrip = returnDate !== undefined`. The regex gate — not `addDays` — is what replicates Python's `try/except ValueError` skip. Without it, two input shapes diverge: a full date `"2026-08-15"` would be sliced into a valid month (Python goes one-way; we'd go round-trip), and a garbage month `"2026-13"` would roll over via `Date.UTC` into 2027-01 (Python goes one-way; we'd send a garbage `return_at` to TP). Malformed `departMonth` ⇒ `isRoundTrip` stays false (one-way pricing); the popular fetch in step 5 still uses `departMonth.slice(0, 7)` unchanged, matching Python.
5. **Popular fetch** — one `tpGet("/aviasales/v3/prices_for_dates", p)` with `p = { origin, departure_at: departMonth.slice(0, 7), sorting: "price", currency: "usd", limit: 100, ...(returnDate ? { return_at: returnDate.slice(0, 7) } : {}) }`. Mirrors Python `get_popular` (tp_client.py:264-307): month-granular `return_at`, only when round trip, `limit: 100` (NOT 5 — do not reuse `getPopularRoutes`, which is the chat tool and stays untouched).
   - On `{ failure }`: record `failureReason = FAILURE_REASONS[failure]`, set `popular = []` and **continue** — Python continues into the filler on fetch failure (assistant.py:944-949), and so do we. Degradation only happens if the final list is empty.
   - On success: `popular = rawItems(data)` mapped to candidates: `{ destination: cleanIata(item.destination ?? ""), price: item.price ?? null, airline: item.airline ?? "", transfers: item.transfers ?? 0, link: buildAviasalesLink(origin, dest, item.departure_at ?? "") }`.
6. **`popularPriceByDest`:** first route per destination code, built from ALL popular routes before any filtering (assistant.py:952-956).
7. **Candidates:** drop `code === origin`; dedupe by code keeping the first (API is price-ascending ⇒ keeps cheapest).
8. **Vibe ranking** (only if `requestedVibes.size > 0`): `minOverlap = requestedVibes.size >= 2 ? 2 : 1`; keep candidates with `overlap >= minOverlap` where `overlap = |requestedVibes ∩ (DESTINATION_VIBES[code] ?? ∅)|`; then `scored.sort((a, b) => b.overlap - a.overlap)`. **JS `Array.prototype.sort` is stable (ES2019) — a comparator on overlap alone preserves price-ascending order within equal overlap. Do NOT add a secondary comparator key; stability IS the tiebreak, same as Python's `list.sort`.**
9. **Map top 3** to `SurpriseDestination`: `name = IATA_TO_CITY[code] ?? code`; `flightPrice = price != null ? (isRoundTrip ? `$${price} rt` : `$${price}`) : "—"`; `airline`; `nonstop = transfers === 0`; `link`.
10. **Curated filler** — ONLY when `destinations.length < 3 && requestedVibes.size > 0`. Two passes over `curatedEntries = Object.entries(DESTINATION_VIBES).map(([code, tags]) => ({ code, tags, overlap: |requestedVibes ∩ tags| })).sort((a, b) => b.overlap - a.overlap)` (stable ⇒ insertion-order ties, matching Python's stable `sorted`).
    - **Pre-pass (the F6-critical part — cap enforced BEFORE dispatch):** `slotsRemaining = 3 - destinations.length`. Walk `curatedEntries`; `break` as soon as `enrichmentCodes.length >= slotsRemaining`; skip `code === origin`; skip `overlap < 2` (hard-coded 2 — NOT `minOverlap`; see Spec concern 5); skip `seen.has(cityName)` where `seen` = names already in `destinations`; push `code` onto `enrichmentCodes` only if `!(code in popularPriceByDest)`. The list is therefore structurally ≤ 3 **before any network call is dispatched** — the cap must never be implemented as "fire everything, take 3".
    - **Dispatch:** `await Promise.all(enrichmentCodes.map(...))` calling `rawSearchFlights(origin, code, `${departMonth.slice(0,7)}-01`, returnDate)` wrapped in try/catch. For each result with `flights.length > 0`, pick the cheapest by `price ?? 999999` and store `{ price, airline, transfers, link }` in `enrichmentLookup[code]`. Failures/empties simply produce no entry.
    - **Fill pass:** walk `curatedEntries` again; `break` at `destinations.length >= 3`; same skips (origin, `overlap < 2`, `seen`); `seen.add(cityName)`; `route = popularPriceByDest[code] ?? enrichmentLookup[code]`; if found → price label with the same `" rt"` logic, `airline ?? ""`, `nonstop = (transfers ?? 0) === 0`, `link ?? ""`; if not found → **`flightPrice: "—"`, `airline: ""`, `nonstop: false`, `link: ""` — a dash, never a number** (assistant.py:1073-1077).
11. **Empty result** → `degraded.reason` selected by ONE rule (review I1 — the discriminator is whether vibes were requested, NOT whether routes existed): if the popular fetch failed (step 5 recorded `failureReason`) → **`failureReason`**; else if `requestedVibes.size > 0` → **`NO_VIBE_MATCH_REASON`** (covers both "fetch succeeded with zero routes while vibes were requested" — test 14 — and "routes existed but none survived vibes+filler"); else → **`NO_ROUTES_REASON`** (test 12). Edge case, decided: popular non-empty but every route is the origin itself and no vibes → candidates empty → `NO_ROUTES_REASON` — honest enough, intended. Never degraded when `destinations.length > 0`.

> **Recorded inference — keep, do not "fix" (review N6):** absent `transfers` defaults to `0` ⇒ `nonstop: true` (steps 5/9/10). This is the one remaining field where a claim can outrun the data, kept deliberately for parity with Python's `route.get("transfers", 0)` and the identical default in `normalizeFlights` (`travelpayouts-client.ts:385`). TP v3 payloads carry `transfers` in practice; deviating would break the faithful-port goal.

### 3c — Tests first (`surprise.test.ts`), watch them fail, then implement

Mock the client module, passing through everything real except the two network functions:

```ts
vi.mock("./travelpayouts-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./travelpayouts-client")>();
  return { ...actual, tpGet: vi.fn(), rawSearchFlights: vi.fn() };
});
```

`vi.mocked(tpGet)` / `vi.mocked(rawSearchFlights)` per test; `vi.clearAllMocks()` in `beforeEach`. No live calls anywhere. For default-month assertions compare against the real `nextMonthUtc()` (imported) rather than faking timers. Use explicit `departMonth: "2026-08"` wherever exact dates matter.

Required tests (each maps to spec §5 or a tricky part above):

1. **Live mapping:** no vibes; popular returns CUN (price 120, transfers 0) and MBJ (price 180, transfers 1) → cards `[{name: "Cancún, Mexico", flightPrice: "$120", nonstop: true}, {name: "Montego Bay, Jamaica", flightPrice: "$180", nonstop: false}]`; links contain `aviasales.com/search/`.
2. **Round-trip suffix:** `tripLength: "week"`, `departMonth: "2026-08"` → tpGet called with `return_at: "2026-08"` (from returnDate `2026-08-08`) and prices end `" rt"`. Unknown `tripLength: "fortnight"` → no `return_at` param, no suffix. Malformed `departMonth: "2026-13"` (and a full date `"2026-08-15"`) with `tripLength: "week"` → no `return_at`, no `" rt"` suffix — the `/^\d{4}-\d{2}$/` gate from step 4 (review N1).
3. **Popular fetch params:** exactly one `tpGet` call with `departure_at: "2026-08"`, `sorting: "price"`, `currency: "usd"`, `limit: 100`; `departMonth` omitted → `departure_at === nextMonthUtc()`.
4. **Self-origin dropped + dedupe keeps first/cheapest:** origin `JFK`; popular items `[{destination: "JFK", price: 50}, {destination: "CUN", price: 150}, {destination: "CUN", price: 300}]` → exactly one CUN card at `$150`, no JFK card.
5. **min_overlap:** vibes `"beach"` (1 vibe) keeps overlap-1 candidates; vibes `"beach,nightlife"` requires overlap ≥ 2 (an overlap-1 candidate is excluded).
6. **Stable sort + overlap-desc (review N2 — needs a 3-vibe request; with only 2 vibes the max overlap is 2 and no higher-overlap candidate can exist):** vibes `"tropical,beach,romantic"` (3 vibes ⇒ `minOverlap` 2). Popular (price-ascending): `FLL 60` (tags `{beach, tropical}` — overlap 2), `PUJ 80`, `NAS 95`, `CUN 110` (each overlap 3). Expected output exactly `PUJ ($80), NAS ($95), CUN ($110)`: the overlap-3 trio stays price-ascending (stability IS the tiebreak) and the cheapest candidate FLL is out-ranked to 4th and off the card list despite its price (overlap-desc dominates price).
7. **Filler engages** when live matches < 3 and vibes present: popular yields 1 match, vibes `"tropical,beach"`, `rawSearchFlights` mocked to return priced flights → 3 cards, filler cards carry the mocked real price (e.g. `$210`), never the same fabricated constants.
8. **Filler does NOT engage without vibes:** popular yields 2 candidates, no vibes → exactly 2 cards, `rawSearchFlights` never called.
9. **Enrichment cap = 3, enforced pre-dispatch (F6):** popular returns `{ data: { success: true, data: [] } }` (success, empty), vibes `"tropical,beach"` (dozens of curated codes qualify) → `expect(vi.mocked(rawSearchFlights)).toHaveBeenCalledTimes(3)` — exactly 3, despite ~18 qualifying curated entries.
10. **Enrichment failure → dash:** same as 9 but `rawSearchFlights` resolves `{ flights: [], failure: "timeout" }` → 3 cards each `{flightPrice: "—", airline: "", nonstop: false, link: ""}`. Assert `flightPrice` matches `/^—$/` — no digits.
11. **TP failure reason survives:** `tpGet` → `{ failure: "no_token" }`, no vibes → `destinations: []`, `degraded.reason === FAILURE_REASONS.no_token` (contains "not configured"), and it is NOT `NO_ROUTES_REASON` — a missing token must never read as "no flights exist".
12. **Empty-success reason:** `tpGet` → success with `data: []`, no vibes → `degraded.reason === NO_ROUTES_REASON`.
13. **Invalid origin:** `origin: "Cancun"` → degraded with `INVALID_IATA_REASON`, `result.origin === "CANCUN"` (echo, not "MIA"), `tpGet` never called. Also `origin: ""`. Assert `result.origin !== "MIA"` explicitly.
14. **Single-vibe filler is dead (faithful port):** vibes `"beach"`, popular success-empty → degraded (`NO_VIBE_MATCH_REASON` — per step 11 the fetch succeeded and vibes were requested, so NOT `NO_ROUTES_REASON`), `rawSearchFlights` never called (pre-pass `overlap < 2` skips everything).
15. **TP failure + 2 vibes still fills honestly:** `tpGet` → `{ failure: "no_token" }`, vibes `"tropical,beach"`, `rawSearchFlights` → `{ flights: [], failure: "no_token" }` → 3 curated cards, all `"—"` — not degraded (matches Python control flow).

### 3d — Wire-level F6 budget test (review N7) — `surprise.http-budget.test.ts`

Test 9 caps the budget at the *function-call* layer, but `rawSearchFlights` invokes the module-**local** `tpGet` binding internally (`travelpayouts-client.ts:406,415`) — replacing the module's exports with `vi.mock` (as `surprise.test.ts` does) can never observe those internal HTTP attempts. Pin the budget at the actual HTTP layer instead, in a **separate file** (the `vi.mock` in `surprise.test.ts` is hoisted file-wide, so an unmocked run cannot live there):

- No `vi.mock` of the client module. Instead `vi.stubEnv("TRAVELPAYOUTS_TOKEN", "test-token")` and `vi.stubGlobal("fetch", fetchMock)` where `fetchMock = vi.fn()` always resolving `new Response(JSON.stringify({ success: true, data: [] }), { status: 200 })` — success-empty, which forces the month-granularity fallback inside every enrichment (the true worst case).
- One test: call `getSurpriseDestinations({ origin: "JFK", vibes: "tropical,beach", departMonth: "2026-08", tripLength: "week" })`, then assert `expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(7)` — the wire-level F6 contract (≤7, inside the ≤8 budget with headroom). In this constructed scenario the count is exactly 7 (1 popular + 3 enrichments × 2 attempts each), and all 7 requests carry distinct params, so `tpGet`'s internal response cache cannot deflate the count. Also assert 3 dash-priced cards came back — proof the run really drove the filler end-to-end.
- `vi.unstubAllEnvs()` / `vi.unstubAllGlobals()` in `afterEach`. Keep this file to this single test so module-level state in the client (rate limiter, response cache) cannot bleed between cases.

**Verify:**
```bash
npx vitest run src/lib/atlas/surprise.test.ts             # all 15 pass
npx vitest run src/lib/atlas/surprise.http-budget.test.ts # 1 passes — wire-level F6 budget (review N7)
npm run test:unit                                          # whole suite green
npm run lint && npm run build
```

Commit: `feat(surprise): native surprise-destinations engine (faithful port, no fabrication)`

---

## Task 4 — Rewrite `/api/surprise-me` route (TDD): delete `FALLBACK`, cache success only

**Goal:** the route becomes a thin cached wrapper over `getSurpriseDestinations`. No FastAPI proxy, no fabricated constant, no origin mangling.

**Files:** `src/app/api/surprise-me/route.test.ts` (new), `src/app/api/surprise-me/route.ts` (rewrite).

> Placement note: vitest includes `src/**/*.test.ts`, and Next ignores non-entry files under `app/`. If `next build` unexpectedly rejects the co-located test, move it to `src/lib/atlas/surprise-me-route.test.ts` importing `@/app/api/surprise-me/route` — do not delete tests to make the build pass.

### 4a — Tests first (mock `@/lib/atlas/surprise` with `vi.mock`)

The route keeps a module-level cache Map that persists across tests in the file — **use a distinct `origin`/param set per test** to avoid cross-test cache pollution. Build requests as `new Request(`http://localhost/api/surprise-me?${qs}`) as unknown as NextRequest` (the handler only reads `req.url`).

1. **Pass-through:** GET `?origin=JFK&vibes=beach,romantic&depart_month=2026-08&trip_length=week` → `getSurpriseDestinations` called once with `{ origin: "JFK", vibes: "beach,romantic", departMonth: "2026-08", tripLength: "week" }`; response 200 with the mock's body.
2. **No origin mangling:** GET `?origin=Cancun` → the mock receives `origin: "Cancun"` verbatim (no uppercase-strip-slice, no MIA default). GET with no origin at all → mock receives `origin: ""`.
3. **Success cached (1h):** mock returns `{ origin: "LAX", destinations: [one real-shaped card] }`; two GETs with identical params → mock called **once**; both responses identical.
4. **Degraded NOT cached:** mock returns `{ origin: "ORD", destinations: [], degraded: { reason: "x" } }`; two identical GETs → mock called **twice**.
5. **Empty-but-undegraded NOT cached (defensive):** mock returns `{ origin: "DEN", destinations: [] }` (no `degraded` key); two identical GETs → mock called twice.
6. **No FastAPI fetch:** stub `global.fetch` with `vi.fn()`; one GET → `expect(fetchSpy).not.toHaveBeenCalled()`.
7. **Always 200:** degraded response still `res.status === 200` with `degraded.reason` in the body.
8. **Engine throw degrades in-body, never a 500 (review N5):** mock `getSurpriseDestinations` to reject; GET → `res.status === 200`, body `{ origin, destinations: [], degraded: { reason } }` with a non-empty F2-style reason; a second identical GET calls the mock again (a thrown run is never cached).

### 4b — Implementation

- Delete: `getFastApiBaseUrl` import, the proxy `fetch`, the whole `FALLBACK` constant, the local `SurpriseDestination`/`SurpriseResponse` interfaces (import `SurpriseResult` from `@/lib/atlas/surprise` instead), and the origin default/mangle block (lines 62-65 of the old file).
- Keep: `MAX_CACHE_ENTRIES` (200), `CACHE_TTL_MS` (1h), `clampQueryValue`, `MAX_VIBES_LENGTH`/`MAX_MONTH_LENGTH`/`MAX_TRIP_LENGTH_LENGTH`, `purgeExpiredCacheEntries`, `pruneCacheIfNeeded`.
- Origin handling: `const origin = clampQueryValue(searchParams.get("origin"), 10);` — length clamp only; validation (strict `parseIata`, F7 no-truncation) lives in the module.
- Cache key: `[origin.toUpperCase(), vibes, departMonth, tripLength].map(encodeURIComponent).join("|")` (review N4 — same component set as today; uppercase only for key normalization, the value passed to the module stays raw). Encoding each component closes the pre-existing ambiguity where a `|` inside `vibes` lets a crafted request occupy another parameter combination's cache slot for 1h.
- Flow: purge → cache hit? return → `const result = await getSurpriseDestinations({...})` **wrapped in try/catch** (review N5): the engine shouldn't throw (tpGet returns failures as values; enrichment dispatch is try/caught), but an unexpected throw must degrade in-body, not surface as a 500 → `catch { return NextResponse.json({ origin, destinations: [], degraded: { reason: INTERNAL_ERROR_REASON } }); }` where `INTERNAL_ERROR_REASON` is an F2-style constant (e.g. "Surprise Me hit an unexpected internal error. This does NOT mean no flights exist — try again."); a caught throw is never cached → on normal return, **only if `result.destinations.length > 0 && !result.degraded`**: prune + `cache.set` → `return NextResponse.json(result)` (always 200).

**Verify:**
```bash
npx vitest run src/app/api/surprise-me/route.test.ts   # 8 tests pass
npm run test:unit && npm run lint && npm run build
grep -n "FALLBACK\|getFastApiBaseUrl\|hotelPrice" src/app/api/surprise-me/route.ts
```
Expected: last grep prints nothing (exit code 1).

Note: at this commit the client still holds `V1_FALLBACK`, so e2e stays green (empty/degraded API responses trip the client fallback). That liar dies in Task 5.

Commit: `feat(surprise): route serves native engine; server FALLBACK deleted; degraded responses never cached`

---

## Task 5 — Client de-fabrication: `SurpriseMeSection` + hotelPrice strip + i18n + e2e fixture

**Goal:** delete `V1_FALLBACK`, render honest degraded state, remove `hotelPrice` from the live Surprise Me render chain.

**Files:** `src/components/SurpriseMeSection.tsx`, `src/components/AtlasHeroSection.tsx`, `src/components/DestinationCard.tsx`, `messages/{en,es,de,fr,it,pt}/common.json`, `tests/e2e/planner-trust.spec.ts`.

### 5a — `SurpriseMeSection.tsx`

- Delete `V1_FALLBACK` and the `fallbackUsed` state; replace with `const [degradedReason, setDegradedReason] = useState<string | null>(null)`.
- Remove `hotelPrice?` from the local `Destination` interface.
- `fetchSuggestions` result handling:
  - `data.destinations.length > 0` → `setDestinations(data.destinations); setDegradedReason(null);`
  - else → `setDestinations([]); setDegradedReason(data.degraded?.reason ?? t("degradedNetworkBody"));` — the server reason renders **verbatim** (spec §4.4; F2 strings are intentionally English).
  - `.catch` (non-abort) → `setDestinations([]); setDegradedReason(t("degradedNetworkBody"));`
- Render states (originUnknown branch unchanged):
  - **degraded** (`degradedReason && !loading`): `PlannerErrorBanner` with **`testId="surprise-fallback-banner"`** (kept — Spec concern 8), `title={t("degradedTitle")}`, `body={degradedReason}`, `onRetry={() => fetchSuggestions()}` — plus a "Chat with Atlas" escape-hatch button (existing `t("chatWithAtlas")` key, wired to the existing `handleChatWithAtlas`). Do NOT render `AtlasHeroSection` and do NOT render any destination cards in this state.
  - **destinations** (non-empty): `AtlasHeroSection` exactly as today — 1-3 real cards, **never padded**.
- Keep the loading skeleton, dimmed-planner block, resolve/tell-me-more handlers untouched.

### 5b — Strip `hotelPrice` from the live chain

- `AtlasHeroSection.tsx`: remove `hotelPrice?: string` from its `Destination` interface and the `hotelPrice={dest.hotelPrice}` prop pass (line 66).
- `src/components/DestinationCard.tsx`: remove the `hotelPrice` prop and its render (line 60). Its only importer is `AtlasHeroSection` (verified: `grep -rn "from ['\"].*components/DestinationCard" src/` → only AtlasHeroSection) — safe.
- Do NOT touch `src/components/atlas/DestinationCard.tsx` (different component, AssistantChat's), nor `EntryTabs.tsx`/`DestinationSuggestions.tsx`/`trip-types.ts` (dead/out-of-scope; EntryTabs has no importers).

### 5c — i18n (all 6 locales: `messages/{en,es,de,fr,it,pt}/common.json`, `atlasHero` namespace)

Remove `fallbackTitle` and `fallbackBody` (the "example destinations" copy is now a lie). Also remove the dead `atlasHero` keys **`hotelsFrom`** ("Hotels from {price}/night") and **`flightsFrom`** from the same namespace in all 6 locales (review N3): they have zero consumers in `src/`, and they are the exact hotel-price-fabrication template this change outlaws — one `t("hotelsFrom")` call away from resurrection. Add:

| locale | `degradedTitle` | `degradedNetworkBody` |
|---|---|---|
| en | Atlas couldn't load live suggestions. | We couldn't reach the suggestions service. This does not mean no flights exist — try again. |
| es | Atlas no pudo cargar sugerencias en vivo. | No pudimos conectar con el servicio de sugerencias. Esto no significa que no existan vuelos; inténtalo de nuevo. |
| de | Atlas konnte keine Live-Vorschläge laden. | Der Vorschlagsdienst war nicht erreichbar. Das bedeutet nicht, dass keine Flüge existieren — bitte erneut versuchen. |
| fr | Atlas n'a pas pu charger de suggestions en direct. | Impossible de joindre le service de suggestions. Cela ne signifie pas qu'aucun vol n'existe — réessayez. |
| it | Atlas non è riuscito a caricare suggerimenti in tempo reale. | Impossibile raggiungere il servizio di suggerimenti. Questo non significa che non esistano voli — riprova. |
| pt | O Atlas não conseguiu carregar sugestões ao vivo. | Não foi possível contactar o serviço de sugestões. Isso não significa que não existam voos — tente novamente. |

### 5d — e2e fixture for the Path B CTA test (Spec concern 6)

In `tests/e2e/planner-trust.spec.ts`, test `Path B → "Plan a trip to X" CTA resolves trip and renders Path A`: before `page.goto`, add a deterministic stub so the test no longer depends on live TP data or the deleted fabrication:

```ts
await context.route('/api/surprise-me*', (route) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({
    origin: 'MIA',
    destinations: [
      { name: 'Cancún, Mexico', flightPrice: '$142', airline: 'NK', nonstop: true, link: 'https://www.aviasales.com/search/MIA0108CUN1?marker=164743' },
      { name: 'San Juan, Puerto Rico', flightPrice: '$168', airline: 'B6', nonstop: true, link: '' },
      { name: 'Punta Cana, Dominican Republic', flightPrice: '$203', airline: 'NK', nonstop: false, link: '' },
    ],
  }),
}));
```

(Test fixture — allowed; the anti-fabrication guard in Task 6 deliberately scans only `src/`.) The "non-silent fallback banner" test (route.abort) and "unknown-origin" test need **no changes** — the degraded banner keeps `surprise-fallback-banner` and a Retry button.

**Verify:**
```bash
npm run lint && npm run test:unit && npm run build
grep -n "V1_FALLBACK\|hotelPrice" src/components/SurpriseMeSection.tsx src/components/AtlasHeroSection.tsx src/components/DestinationCard.tsx
# expected: no output (exit 1)
grep -rn "fallbackTitle\|fallbackBody" src/ messages/
# expected: no output (exit 1) — keys and consumers both gone
grep -rn "hotelsFrom\|flightsFrom" messages/
# expected: no output (exit 1) — dead keys gone from all 6 locales.
# Scope is messages/ ONLY and must stay that way: src/app/[locale]/destinations/page.tsx
# carries unrelated LOCAL object keys named hotelsFrom/flightsFrom (out-of-scope static
# marketing page) — widening this grep to src/ makes it a gate that can never pass.
# e2e (dev server on 3001 in another shell: npm run dev -- --port 3001)
npx playwright test tests/e2e/planner-trust.spec.ts
# expected: 12 passed (file baseline — the file has exactly 12 `test(` blocks;
# a count of 13 comes from also matching `test.describe(`, which is not a test)
```

Commit: `feat(surprise): delete client V1_FALLBACK; honest degraded state; strip hotelPrice from live chain`

---

## Task 6 — Extend the anti-fabrication guard (`no-fabrication.test.ts`)

**Goal:** a regression tripwire — re-introducing the fabricated constants or a `hotelPrice` key anywhere in the Surprise Me path fails CI loudly.

**Files:** `src/lib/atlas/no-fabrication.test.ts` (extend — keep the three existing tests).

**Changes** — add a new `describe("Surprise Me fabrication tripwire")` that reads the following files from disk (`fs.readFileSync(path.resolve(process.cwd(), p), "utf-8")`):

```ts
const SURPRISE_PATH_FILES = [
  "src/app/api/surprise-me/route.ts",
  "src/components/SurpriseMeSection.tsx",
  "src/components/AtlasHeroSection.tsx",
  "src/components/DestinationCard.tsx",
  "src/lib/atlas/surprise.ts",
  "src/lib/atlas/destination-vibes.ts",
];
const BANNED_SUBSTRINGS = [
  "$89", "$95", "$75", "$127", "$159", "$189",   // the fabricated price tuple
  "/night",                                        // hotel-price formatting
  "hotelPrice",                                    // the field itself
  "Spirit NK", "JetBlue",                          // invented airlines
  "V1_FALLBACK", "FALLBACK",                       // the constants (case-sensitive — lowercase test-id "surprise-fallback-banner" is fine)
];
```

Assert per file, per substring: `expect(content, `${file} must not contain ${literal}`).not.toContain(literal)`. Add one companion assertion that `src/lib/atlas/surprise.ts` does not contain `"MIA"` (G5 — no origin substitution baked into the engine).

**Scope is deliberate** (Spec concern 1): the guard does NOT scan the whole repo (pre-existing `$89`/`$159` literals live in out-of-scope marketing files) and does NOT scan test files (this test itself and the e2e fixture legitimately contain the literals). Do not "improve" it into a repo-wide grep — that gate can never pass.

**Known trap (review B1):** before running, confirm none of the six scanned files carries a banned literal in a comment — the module-contract comment in Task 3a / spec §4.1 deliberately uses `$142` (non-banned) as its `flightPrice` example. If anyone "corrected" that comment back to `$127`, this tripwire fails against the plan's own instructed code; fix the comment, not the tripwire.

**Verify:**
```bash
npx vitest run src/lib/atlas/no-fabrication.test.ts
```
Expected: all tests pass. Sanity-check the tripwire actually trips: temporarily add `// hotelPrice` to `surprise.ts`, re-run (must fail), revert.

Commit: `test(surprise): anti-fabrication tripwire over the Surprise Me file set`

---

## Task 7 — Cleanup: delete `getFastApiBaseUrl` / `FASTAPI_URL` (gated), fix docs

**Goal:** zero workstation references left in `src/`; runbooks stop contradicting reality.

**Files:** `src/lib/server-config.ts`, `src/lib/server-config.test.ts`, `.env.example`, `docs/deployment/local-to-vps.md`, `docs/product/ARCHITECTURE.md`, `tests/e2e/planner-trust.spec.ts` (one comment).

**Step 7a — THE GATE, before deleting anything:**
```bash
grep -rn "getFastApiBaseUrl\|FASTAPI_URL" src/
```
Expected at this point: hits ONLY in `src/lib/server-config.ts` (definition) and `src/lib/server-config.test.ts` (its test) — the route import died in Task 4. **If any other consumer appears, STOP and reassess; do not delete the helper out from under it.**

**Step 7b — deletions:**
- `src/lib/server-config.ts`: delete `getFastApiBaseUrl` and `DEFAULT_FASTAPI_BASE_URL`. Leave everything else (`getAppBaseUrl`, `normalizeBaseUrl`, key readers) untouched.
- `src/lib/server-config.test.ts`: drop `getFastApiBaseUrl` from the import and the `expect(typeof getFastApiBaseUrl()).toBe('string')` assertion; keep the rest. Optionally swap the `http://localhost:8766` literals in the `normalizeBaseUrl` test for a neutral URL (`https://example.com/`) so no FastAPI ghost lingers.
- `.env.example`: delete the `FASTAPI_URL=` line.

**Step 7c — docs (truthfulness fixes flagged in the xhigh review backlog; extended per review I3):**
- `docs/deployment/local-to-vps.md`: remove `FASTAPI_URL`/sidecar references everywhere — process-layout line ~34 (Next.js has no FastAPI dependency); delete the "FastAPI sidecar calls" bullets ~43-44 and the operational line ~52; remove the env-list entry + its fallback sub-bullet ~66-67; fix the assistant-flows note ~180 to state all assistant + surprise flows are native to Next.js as of 2026-07-11; **delete the deploy-verification step at ~288 (`curl -I http://127.0.0.1:8766/ || true`)** — it instructs the operator to health-check a FastAPI sidecar that no longer exists in any code path; if a post-deploy probe is still wanted there, point it at the app's own `/api/assistant/health` instead.
- `docs/product/ARCHITECTURE.md`: update the env table row for `FASTAPI_URL` (~line 88) to state the variable was removed 2026-07-11 and is no longer read by any code path — **drop the row's `localhost:8766` fallback text**; annotate the pre-D2 diagram (~line 27) as historical; **rewrite line ~163** (the prose saying the runbook's `curl -I http://127.0.0.1:8766/` pattern "must be removed or replaced") to state that step WAS removed 2026-07-11, without repeating the curl literal.
- `tests/e2e/planner-trust.spec.ts` line ~5: rewrite the stale comment claiming a FastAPI backend at `FASTAPI_URL` is expected.
- Straggler checks (each scoped so it can actually pass):
```bash
grep -rn "FASTAPI_URL\|8766" .env* ecosystem* 2>/dev/null
# expected: no tracked-file output — only the gitignored .env.local may still hit on the dev machine (remove the line there too)
grep -n "FASTAPI_URL\|8766" docs/deployment/local-to-vps.md
# expected: no output — the runbook carries ZERO references, including the old line-288 health-check
grep -n "FASTAPI_URL\|8766" docs/product/ARCHITECTURE.md
# expected: hits ONLY in the pre-D2 diagram annotated as historical (~27) and the env-table row documenting the variable's removal (~88);
# any other hit — e.g. the old line-163 curl prose — means the cleanup is incomplete
```

**Verify:**
```bash
grep -rn "getFastApiBaseUrl\|FASTAPI_URL" src/
# expected: NO output, exit code 1  ← the spec's hard gate
npm run lint && npm run test:unit && npm run build
```
(Scoping the gate to `src/` is deliberate: historical plans/specs under `docs/superpowers/` and this plan file mention the symbol by name and must not fail the gate.)

Commit: `chore(surprise): delete getFastApiBaseUrl/FASTAPI_URL — last workstation dependency gone`

---

## Task 8 — Final verification gates + live smoke

**Goal:** evidence, not assertions (verification-before-completion).

**Step 8a — full gates, fresh output:**
```bash
npm run lint          # expected: clean, exit 0
npm run test:unit     # expected: all suites pass, includes new destination-vibes/surprise/surprise.http-budget/route/no-fabrication tests
npm run build         # expected: compiled successfully
# dev server for e2e in another shell:
npm run dev -- --port 3001
npx playwright test   # expected: 41 passed (baseline count — no skips, no failures)
```

**Step 8b — live smoke (real token; `.env.local` already carries `TRAVELPAYOUTS_TOKEN`):** with `npm run dev` on port 3000:
```bash
# Known thin combo from the probe (beach+romantic from JFK measured 0 live matches):
curl -s "http://localhost:3000/api/surprise-me?origin=JFK&vibes=beach,romantic&depart_month=2026-08" | python3 -m json.tool
```
Expected: `origin: "JFK"`; **3** destinations (filler engaged); every `flightPrice` is either a real `$NNN` from TP or `"—"` — never `$89/$95/$75/$127/$159/$189`; **no `hotelPrice` key anywhere in the payload**; links (when present) contain `aviasales.com` with marker `164743`.
```bash
curl -s "http://localhost:3000/api/surprise-me?origin=LAX&vibes=beach,romantic&depart_month=2026-08" | python3 -m json.tool
```
Expected: a **different** payload than JFK (origins are no longer collapsed to one constant), `origin: "LAX"`.
```bash
curl -s "http://localhost:3000/api/surprise-me?origin=Cancun" | python3 -m json.tool
```
Expected: `destinations: []`, `degraded.reason` = the INVALID_IATA text, `origin` is `"CANCUN"` — **not `"MIA"`**.
```bash
curl -s "http://localhost:3000/api/surprise-me?origin=JFK&vibes=beach,romantic&depart_month=2026-08" -o /dev/null -w "%{time_total}\n"
```
Run the JFK query twice; second call should return near-instantly (cache hit) with an identical body — confirms successful results ARE cached.

**Step 8c — housekeeping checks:**
- `src/lib/help-content.ts:25` describes Surprise Me; confirm the copy is still accurate post-change (it describes vibe-driven suggestions — no fallback claims — expected: no edit needed; edit only if it mentions example/fallback destinations). Standing rule `feedback_update_help_with_features` satisfied either way.
- Paste fresh outputs of every 8a/8b command into the PR/handoff notes — no "should work".

No commit unless 8c produced an edit. **Do not deploy** — merge/deploy happens only on Jose's explicit go-ahead (spec Non-Goals).

---

## Out of scope (do not do)

- Hotel pricing or Hotels.com CTA (Phase 3 monetization plan).
- Blended curated+live source restructure (spec §7 follow-up).
- Any change to `tool-loop.ts` / `getPopularRoutes` / the Atlas chat `surprise_me` tool.
- Deleting `EntryTabs.tsx` / `DestinationSuggestions.tsx` dead code (tempting, separate cleanup).
- Deploying to the VPS.

## Uncertainties flagged (for the implementer, not blockers)

- **Route-test file location** under `src/app/api/surprise-me/` — believed fine (Next ignores non-entry files; vitest includes `src/**`); fallback location given in Task 4 if `next build` disagrees.
- **`NextRequest` construction in vitest** — the handler only reads `req.url`, so a cast `Request` suffices; if `next/server` import misbehaves under jsdom, pass `{ url } as unknown as NextRequest`.
- **`NO_ROUTES_REASON` / `NO_VIBE_MATCH_REASON` wording** — spec gap (concern 4); texts proposed above follow the F2 pattern. Adjust wording freely, but keep the "this does NOT mean no flights exist" clause and keep them distinct from `FAILURE_REASONS.no_token`.
- **e2e total (41)** — reconciled per-file (review I2): guest-flow 4 + planner-trust 12 + trip-api-dto 1 + visual-baseline 3 (one `test(` inside a `[1280,1440,1920].forEach` loop) + articles 7 + auth 4 + home 6 + planner 4 = **41**. A raw `grep -c "test("` both undercounts (the loop generates 3 tests from one call site) and overcounts (`test.describe(` also matches) — trust an actual `npx playwright test` run before Task 1 and compare like-for-like at Task 8.
