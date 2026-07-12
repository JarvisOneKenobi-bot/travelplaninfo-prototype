# Adversarial Plan Review — Surprise Me Workstation Independence + De-Fabrication

**Date:** 2026-07-11
**Reviewed:** `docs/superpowers/plans/2026-07-11-surprise-me-workstation-independence.md` (plan), `docs/superpowers/specs/2026-07-11-surprise-me-workstation-independence-design.md` (spec)
**Reference:** `command-post/routers/assistant.py` (surprise_destinations 900-1101, DESTINATION_VIBES 755-845, TRIP_LENGTH_DAYS 848-854), `command-post/tp_client.py` (search_flights 111-165, get_popular 264-307)
**Verdict:** 1 BLOCKER, 3 IMPORTANT, 7 NIT. The port design itself is faithful and fabrication-free; the blocker is a self-defeating verification gate the plan planted in its own Task 3 → Task 6 pipeline. Fix the blocker + the two internal contradictions (I1, I2) before implementation starts.

---

## BLOCKER

### B1 — Task 6 tripwire can never pass if Task 3 is followed as written (`$127` self-defeating gate)

- **Evidence:** Plan Task 3a (line ~204) instructs the module contract be written into `src/lib/atlas/surprise.ts` **"verbatim"**, including the comment:
  ```ts
  flightPrice: string; // "$127" | "$127 rt" | "—"  — never invented
  ```
  The same literal comment is in spec §4.1 (line ~96: `// "$127" | "$127 rt" | "—"   (never invented)`).
  Plan Task 6 (lines ~423-432) then scans `src/lib/atlas/surprise.ts` from disk for `BANNED_SUBSTRINGS` which include `"$127"` — one of the fabricated V1_FALLBACK prices (`SurpriseMeSection.tsx:29`).
- **Consequence:** an implementer who follows Task 3a verbatim writes `$127` into surprise.ts; Task 6's tripwire then fails against the plan's own instructed code. This is exactly the "self-defeating verification gate" class of bug previously found in 3 plans — this time planted across two tasks of the same plan instead of one grep.
- **Fix:** change the doc-comment example price in plan Task 3a AND spec §4.1 to a non-banned value (e.g. `// "$142" | "$142 rt" | "—"`), or strip dollar literals from the comment entirely (`// real TP price, optionally suffixed " rt", or "—"`). Add a line to Task 6: "before running, confirm none of the six scanned files carries a banned literal in comments — the Task 3a contract comment is the known trap."

---

## IMPORTANT

### I1 — Task 3 test 14 contradicts algorithm step 11; a correct implementation of the written algorithm fails the written test

- **Evidence:** Step 11 (plan line ~245): degraded reason priority is `failureReason` → `NO_ROUTES_REASON` "(fetch succeeded, zero routes)" → `NO_VIBE_MATCH_REASON` "(routes existed, none survived vibes+filler)".
  Test 14 (plan line ~275): vibes `"beach"` + **popular success-empty** → expects `NO_VIBE_MATCH_REASON`.
  In test 14 the fetch succeeded with zero routes, so step 11 as written selects `NO_ROUTES_REASON`. Test 12 (no vibes, success-empty → `NO_ROUTES_REASON`) shows the intended discriminator is actually *whether vibes were requested*, not *whether routes existed* — but step 11 doesn't say that.
- **Consequence:** implementer follows step 11 → test 14 red; implementer satisfies test 14 → violates step 11. Guaranteed churn at implementation time, and whichever way it lands, one of the two honest-reason texts lies slightly ("No live routes matched the requested vibes" when there were zero routes at all is arguably fine; the reverse is not).
- **Fix:** rewrite step 11 to match the tests' intent explicitly, e.g.: empty result → `failureReason` if the popular fetch failed; else `NO_VIBE_MATCH_REASON` if `requestedVibes.size > 0` (covers both "zero routes + vibes" and "routes existed but none survived"); else `NO_ROUTES_REASON`. Also decide the edge "popular non-empty but every route is the origin itself, no vibes" (candidates empty, routes technically existed) — with the fix above it lands on `NO_ROUTES_REASON`, which is honest enough; say so.

### I2 — Task 5 verification gate "expected: 13 passed (file baseline)" is factually wrong — the file has 12 tests

- **Evidence:** `tests/e2e/planner-trust.spec.ts` contains exactly **12** `test(` blocks (lines 11, 44, 59, 84, 96, 108, 116, 134, 149, 160, 187, 203). A count of 13 comes from also matching `test.describe(` at line 10. Cross-check of the 41 total: guest-flow 4 + planner-trust 12 + trip-api-dto 1 + visual-baseline 3 (one `test(` inside a `[1280,1440,1920].forEach` loop) + articles 7 + auth 4 + home 6 + planner 4 = **41** ✓ (the suite baseline claim is right; the file claim is not).
- **Consequence:** the Task 5 gate as written can never be satisfied — the implementer runs the file, sees "12 passed", and either wastes time hunting a phantom missing test or (worse) adds one to make the number match.
- **Fix:** change Task 5's expected output to "12 passed". While there, drop the plan-footer uncertainty note's "39-40" grep estimate or correct it (the loop-generated visual-baseline tests are the reconciliation).

### I3 — Task 7c docs cleanup misses live workstation references, leaving the deploy runbook contradicting itself

- **Evidence:** Task 7c edits `docs/deployment/local-to-vps.md` lines ~34/43-44/52/66/180 and `docs/product/ARCHITECTURE.md` ~27/88 (all verified present). It does NOT touch:
  - `docs/deployment/local-to-vps.md:288` — `curl -I http://127.0.0.1:8766/ || true`, a deploy **verification step** instructing the operator to health-check the FastAPI sidecar that will no longer exist in any code path;
  - `docs/product/ARCHITECTURE.md:163` — prose referencing that same curl pattern as something that "must be removed or replaced".
  The Task 7c straggler grep (`grep -rn "FASTAPI_URL" .env* ecosystem*`) can't catch these — they say `8766`, not `FASTAPI_URL`.
- **Consequence:** after Task 7, line ~180 says "all assistant + surprise flows are native to Next.js" while line 288 of the same runbook still tells whoever executes the pending deploy to curl the dead sidecar. The plan's own Task 7 goal is "runbooks stop contradicting reality".
- **Fix:** add local-to-vps.md:288 (and any other `8766` hits: `grep -n "8766" docs/deployment/local-to-vps.md docs/product/ARCHITECTURE.md`) to Task 7c; extend the straggler grep to include `8766`.

---

## NIT

### N1 — The `addDays`-replicates-Python claim in step 4 is false for two input shapes (behavioral divergence, output stays honest)

- Plan step 3b.4 claims `addDays` returning `undefined` "replicates" Python's `try/except ValueError` skip. Two counterexamples:
  1. `depart_month="2026-08-15"` (full date): Python `strptime("2026-08-15-01")` → ValueError → **one-way**; plan slices to `"2026-08"` first → valid returnDate → **round-trip**.
  2. `depart_month="2026-13"`: Python ValueError → one-way; JS `Date.UTC(2026, 12, 1)` **rolls over to 2027-01** → round-trip with a garbage month sent to TP.
- Output remains honest in both cases (when returnDate is computed, `return_at` IS sent to TP, so the `" rt"` label matches what was priced), so this is faithfulness drift, not fabrication. Fix: either validate `departMonth` against `/^\d{4}-\d{2}$/` before the round-trip block, or delete the false equivalence claim and document the (harmless) divergence. The real client only ever sends `YYYY-MM` (`SurpriseMeSection.tsx:40-64`).

### N2 — Task 3 test 6's second clause is unconstructible as phrased

- "with vibes `tropical,beach` … add a higher-overlap cheaper-last entry to prove overlap-desc ordering" — with 2 requested vibes the maximum possible overlap is 2; no "higher-overlap" candidate can exist. The overlap-desc half needs a 3-vibe request (e.g. `tropical,beach,romantic`, where PUJ/NAS scoring 3 beats CUN's… note CUN also has romantic — pick `MBJ` overlap 2 vs `PUJ` overlap 3). Reword the test spec.

### N3 — Dead fabricated-price scaffolding survives in i18n

- `atlasHero.hotelsFrom` = "Hotels from {price}/night" and `atlasHero.flightsFrom` exist in all 6 `messages/*/common.json` (en:486-487) with **zero consumers** in `src/` (grep hits are unrelated local object keys in `destinations/page.tsx`). They are the exact hotel-price-fabrication shape this change outlaws, one `t("hotelsFrom")` call away from resurrection. Recommend deleting them in Task 5c alongside `fallbackTitle`/`fallbackBody` (all 6 locales), or explicitly recording why they stay.

### N4 — Route cache key is ambiguous when `vibes` contains `|`

- Task 4's key `${origin.toUpperCase()}|${vibes}|${departMonth}|${tripLength}` (same shape as today, `route.ts:79`): `vibes="beach|2026-09"` + empty month collides with `vibes="beach"` + `month="2026-09"`. A crafted request can occupy another combo's cache slot for 1h (serves real-but-wrong-params data; not fabrication). Pre-existing; cheap fix while rewriting: `[origin, vibes, departMonth, tripLength].map(encodeURIComponent).join("|")`.

### N5 — No catch around `getSurpriseDestinations` in the rewritten route

- The engine shouldn't throw (tpGet returns failures; enrichment dispatch is try/caught), but a bug would surface as a 500 → client generic `degradedNetworkBody`. Honest, but consider `try { … } catch { return NextResponse.json({ origin, destinations: [], degraded: { reason: <F2-style internal-error text> } }) }` so degradation is uniformly in-body per spec §4.3. Optional.

### N6 — `transfers` absent ⇒ `nonstop: true` is an inference from missing data

- `item.transfers ?? 0` → `=== 0` → nonstop badge (plan steps 5/9/10; Python parity: `route.get("transfers", 0)`; same default already in `normalizeFlights`, `travelpayouts-client.ts:385`). TP's v3 payloads carry `transfers` in practice, and deviating would break the faithful-port goal — keep it, but this is the one remaining field where a claim can outrun the data. Noting for the record; no action.

### N7 — F6 evidence is asserted at the wrong layer (function calls, not HTTP attempts)

- Test 9 caps `rawSearchFlights` invocations at 3, but `rawSearchFlights` is mocked, so nothing in the suite observes the true HTTP worst case (1 + 3×2 = 7 `tpGet` attempts). The 2-call month-fallback property of `rawSearchFlights` is pre-existing and untouched, so this is not a regression — but one extra test mocking **only `tpGet`** (drive the filler end-to-end, assert `tpGet` called ≤ 7) would pin the budget where F6 actually lives. Optional hardening.

---

## Verification of the plan's 8 self-reported spec concerns

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Repo-wide literal ban unsatisfiable | **TRUE** | `src/app/[locale]/destinations/page.tsx:50-51` (`From $89`, `$89/night`; also `$75/night` at 62), `src/config/affiliates.ts:104-105` (`$899` ⊃ `$89`) and `:123` (`price: "$159"` — plan cites 104-105 for this; actual line is 123, trivial). Scoping the guard to the file set is the correct resolution. |
| 2 | Public `searchFlights` unsuitable; `rawSearchFlights` is the faithful equivalent | **TRUE — and understated** | `travelpayouts-client.ts:458-475`: origin fan-out via `airportsWithNearby`; LAX → **4** airports ⇒ up to 8 tpGet per enrichment ⇒ worst case 1+3×8=**25**, worse than the plan's 19 (MIA). Returns display strings (`"$210 round-trip"`, line 484). `rawSearchFlights` (390-423) matches `tp_client.search_flights` (111-165): single pair, numeric price, one month-granularity retry. |
| 3 | True worst case 7 HTTP calls, within ≤8 | **TRUE** | `tp_client.get_popular` = 1 call, no fallback (264-307); `rawSearchFlights` ≤ 2 each; 1+3×2=7. Rate limiter still counts pre-fetch (`travelpayouts-client.ts:341-345`), untouched by Task 1. |
| 4 | Spec gap on success-but-empty reasons | TRUE — but the plan's own resolution is internally inconsistent | See **I1**. |
| 5 | Single-vibe filler dead by design | **TRUE** | `assistant.py:1019` and `:1058` hard-code `< 2` regardless of `min_overlap`. Pinning it is right. |
| 6 | Path B CTA e2e passes only via fabrication | **TRUE** | Test waits for `atlas-destination-card` (`planner-trust.spec.ts:124`); trip created with no vibes → cards today are guaranteed by `V1_FALLBACK` on empty/error. Stub is appropriate; same `context.route('/api/surprise-me*')` pattern already works at line 136 (baseURL `http://localhost:3001` configured in `playwright.config.ts`). |
| 7 | Python defaults absent origin to MIA | **TRUE** | `assistant.py:902` (`origin: str = "MIA"`). Treating absent as invalid is the spec-mandated (G5) divergence, correctly defensive — the client always sends `origin` and gates `"???"` client-side (`SurpriseMeSection.tsx:91,121`). |
| 8 | Keep `surprise-fallback-banner` test-id | **TRUE** | Asserted at `planner-trust.spec.ts:145`; Retry matched via role+name `/retry/i` → `plannerErrorBanner.retry` = "Retry" (en). PlannerErrorBanner props (`testId/title/body/onRetry`) all exist. |

## Faithfulness audit of the port (hunt item 5)

- **Vibe table:** automated diff of the plan's 82-line table vs `assistant.py:755-845` — 82/82 entries, identical insertion order, identical tag sets. No transcription errors.
- **City names:** all 82 vibe codes resolve to identical strings in both `IATA_TO_CITY` maps; `HNL` is missing from **both** (falls back to `"HNL"` in both) — no dedupe/name divergence.
- **Ordering/stability:** JS stable sort with single-key comparators matches Python's stable `sort`/`sorted(reverse=True)`; `Object.entries` preserves insertion order for these non-numeric keys. Plan's "no secondary comparator" instruction is correct.
- **Dedupe keeps first (= cheapest, price-ascending API):** matches `assistant.py:959-966`. `popularPriceByDest` from ALL routes pre-filter matches 952-956. Pre-pass skip conditions and the not-adding-to-`seen`-during-pre-pass subtlety both match 1009-1025. Round-trip `" rt"` suffix and `"—"` fallbacks match 989 and 1073-1077.
- **Cheapest-pick:** plan's `price ?? 999999` vs Python's `price or 999999` differ only for a literal price of 0 (JS keeps it; Python discards). Harmless; JS is the saner behavior. No action.
- **Fabrication block:** `assistant.py:1090-1099` correctly identified as the only fabrication site in the reference and excluded from the port.

## Untouched-surface & deployability (hunt items 6-7)

- `tool-loop.ts:7,59,110-111` — chat `surprise_me` → `getPopularRoutes`, `search_flights` → public `searchFlights`: Task 1 adds `export` keywords only; no signature/body changes; `tool-loop.test.ts`, `travelpayouts-client.test.ts`, existing `no-fabrication.test.ts` (3 tests) unaffected.
- Importer claims verified: `DestinationCard` ← only `AtlasHeroSection`; `AtlasHeroSection` ← only `SurpriseMeSection`; `EntryTabs`/`DestinationSuggestions` — zero importers (dead, correctly out of scope).
- Task 7a gate pre-verified: current `src/` hits for `getFastApiBaseUrl|FASTAPI_URL` are exactly `route.ts:2,93` (dies in Task 4), `server-config.ts:91,93`, `server-config.test.ts:2,6`. Gate is satisfiable and correctly scoped to `src/` (this plan file and older specs mention the symbol).
- Task 5 grep gate satisfiable: `fallbackTitle|fallbackBody` exist only in the 6 locale files + `SurpriseMeSection.tsx:203-204`; all removed by the task. Exactly 6 locales exist. `chatWithAtlas` key exists (en:485).
- `visual-baseline.spec.ts` screenshots a **Path A** trip (destination 'Cancún') — SurpriseMeSection never renders; snapshots unaffected by de-fabrication.
- Route-test placement: vitest `include: src/**/*.test.{ts,tsx}`, `@` alias configured; precedent of src-colocated tests building clean exists (`server-config.test.ts`). `main` stays deployable per-task (each task gates lint+unit+build).
- Fabrication leak sweep: with B1 fixed, no code path in the design can emit an invented price/airline/nonstop/origin — the engine type has no `hotelPrice`, empty ⇒ degraded, client renders server reason verbatim, and the tripwire covers the six live files. Residual invented prices remain in the out-of-scope static `destinations` marketing page (`destinations/page.tsx:14-70`) — pre-existing, correctly excluded, but worth a follow-up ticket since it's the same `$NN/night` pattern D3 outlawed.
