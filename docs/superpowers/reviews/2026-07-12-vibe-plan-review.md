# Adversarial Plan Review — Vibe Vocabulary + Atlas Pre-Flight

**Plan:** `docs/superpowers/plans/2026-07-12-vibe-vocabulary-and-atlas-preflight.md` (uncommitted, mtime 17:46)
**Spec:** `docs/superpowers/specs/2026-07-12-vibe-vocabulary-and-atlas-preflight-design.md` (authoritative; carries an UNCOMMITTED amendment, mtime 18:13 — **newer than the plan**)
**Worktree:** `.worktrees/surprise-me` @ `1f2c54d` (read-only review; baselines re-verified fresh: unit 21 files / 156 pass, Playwright `--list` 41 tests / 8 files)
**Reviewer stance:** every plan claim checked against the real files; every number recomputed.

**Verdict: NOT APPROVED as written — 2 BLOCKERS, 6 IMPORTANT, 8 NITs.**
Both blockers are cheap, localized fixes (a label cascade and one tag deletion). The engineering core — regression guard, pre-flight short-circuit, naming/drop, test placement — is sound and was verified against the real code, not the plan's description of it.

---

## BLOCKERS

### B1. The plan ships "Winter Escape" — Jose's binding decision is "Winter Escapade", and the spec was amended to say so AFTER the plan was written

- The spec's §3.1 table row (line 98, uncommitted amendment, `git diff HEAD` confirms) now reads: *“relabel the chip → "Winter Escapade" … Internal value stays `winter`; only the label changes (+ i18n ×6).”* The plan (mtime 17:46 < spec mtime 18:13) never mentions "Escapade" anywhere (verified by grep).
- Contradicting plan text:
  - Plan L344 and L801: `VIBE_LABELS` → `winter: 'Winter Escape'`.
  - Task 2 Step 4 (L828): "keep the existing 7 entries EXACTLY as they are" — the existing entries are `en: "Winter Escape"`, `es: "Escape de Invierno"`, `pt: "Fuga de Inverno"`, `fr: "Escapade Hivernale"`, `de: "Winterflucht"`, `it: "Fuga Invernale"` (verified in `messages/*/common.json`).
  - Task 2 Step 8 (L954): help copy says "Winter Escape".
  - Task 7 Step 1 (L2110): `SurpriseClarificationCard.test.tsx` hardcodes the es label `"Escape de Invierno"` — breaks the moment es is relabelled.
  - Task 8 Step 4 (L2667): evidence instruction "Winter Escape + Mountains".
- **Fix:** `VIBE_LABELS.winter → 'Winter Escapade'`; update `tripForm.vibes.winter` in all six locales (fr's existing "Escapade Hivernale" already matches; es → e.g. "Escapada de Invierno", pt/de/it re-translated — confirm strings with Jose); update the help copy, the card test's expected es string, and the Task 8 evidence wording. Value stays `winter`, icon stays ❄️ — no engine change.

### B2. AGP (Málaga) tagged `winter` violates the amended spec's hard rule

- Amended spec line 98: *“Every `winter` destination must be a real snow/ski destination — **no warm-weather destination may be tagged `winter`** merely to reach the coverage floor.”*
- Plan L111 / L461 tag AGP `['beach', 'winter', 'cultural', 'foodie']` with a rationale that includes **"winter-sun staple"** — winter-sun is precisely the escape-FROM-winter reading Jose rejected. A user clicking "Winter Escapade" (a snow/ski adventure) and receiving a Málaga beach card is a mis-sold result on the branch whose whole point is honest output.
- **Removal is safe — machine-verified against the plan's own table:** winter coverage drops 10 → 9 (floor is ≥ 8); `tropical+winter` remains the ONLY unsatisfiable pair (AGP creates no unique pair — beach+winter is also carried by YVR; cultural+winter by ZRH/GVA/MUC/MOW; foodie+winter by MUC); no plan test references AGP-winter (not spot-checked, not pinned, not in the frozen table — AGP is a new entry).
- **Fix:** delete `'winter'` from AGP (keep it as beach/cultural/foodie, or drop the destination entirely), update the Editorial section row, and recompute the stated coverage line (winter 10 → 9).

---

## IMPORTANT

### I1. G4 ("no raw IATA code ever rendered to a user") is claimed but not delivered — three render paths still leak after the plan

1. **`src/app/[locale]/planner/[tripId]/page.tsx:72`** — the trip header renders `· ✈️ from ${trip.origin}` raw ("from JFK") on every Path-A and resolved-surprise trip. Server component; `resolveCityName` is server-only and directly usable here. The file is absent from the plan's File Map.
2. **`src/components/TripContextStrip.tsx:70-79`** — the origin pill renders `✈️ JFK` plus `(+ EWR, LGA)` nearby-airport codes. The plan edits this exact file (vibe pills) and its Task-2 commit message claims the strip "stops rendering raw internal values" — while the pill next to it keeps raw codes.
3. **AtlasHeroSection subtitle** — `messages/*/atlasHero.subtitle` is `"{vibes} vibes from {origin} · {budget} budget"` and receives `vibesSummary` raw: internal values like `big_city`/`foodie` render verbatim in the hero on the SUCCESS path. The plan localizes strip pills (Task 2 Step 7) and the clarification card, but never the hero's vibes.

**Fix:** resolve the origin name server-side in `page.tsx` and pass an `originName` into the header and `TripContextStrip`; localize the hero's vibes (map canonical values through `tripForm.vibes`, echo custom text as typed) in `SurpriseMeSection` before interpolation. If Jose deliberately scopes G4 to destination names for this PR, the plan must say so explicitly instead of claiming G4 whole.

### I2. Task 5 breaks three existing route tests the plan claims stay green

`src/app/api/surprise-me/route.test.ts` lines 46-51, 74-79, 80-85 assert `toHaveBeenCalledWith({ origin, vibes, departMonth, tripLength })` **exactly**. Task 5 Step 4 passes `matchMode` into `getSurpriseDestinations` unconditionally, so all three assertions fail — yet the step says "Run → PASS" and never mentions updating them. Risk: the executing subagent "fixes" it by passing `matchMode` only when `match=any`, which silently changes the cache-key/engine contract.
**Fix:** the plan must instruct updating the three exact-match assertions to include `matchMode: "all"`.

### I3. Clarification card and Atlas seed use the wrong month whenever the trip's window isn't "next month"

Task 7 Step 4: `effectiveMonth = adjust.month ?? <next month>`. But the search month actually used comes from `deriveDepartMonth(flexibleWindow, startDate)` (`surprise-query.ts:13`) — `"2_3_months"` → +2, `"6_months"` → +6, or the specific `startDate`. The card's month chips and the auto-sent `clarifyAtlasSeed` ("around {month}") would misstate the user's real intent — the precise thing the pre-flight exists to hand Atlas correctly.
**Fix:** `effectiveMonth = adjust.month ?? deriveDepartMonth(flexibleWindow, startDate)` (import it; it is exported).

### I4. `originName ?? originCode` fallbacks still print a raw code

AtlasHeroSection subtitle (Task 7 Step 4 pt 6) and `handleAskAtlasWithIntent`'s seed (rendered in the visible chat as the user's message) fall back to the bare code when unnameable. The plan's rationale ("the user typed that code themselves") is an exception Jose's rule does not grant.
**Fix:** when the origin is unnameable, omit the origin phrase (subtitle/seed variants without `{origin}`) rather than printing the code.

### I5. The curated-filler origin-city exclusion is implemented but never tested

The plan's Step-5 naming/exclusion tests exercise only the ranking path (no vibes → filler never engages). Nothing pins Task 3 Step 6 change 4 (filler `cityKey` exclusion). A subagent that lands change 3 but botches change 4 passes every test in the plan — and a JFK user searching `big_city,cultural` with empty popular routes is offered **"New York (LaGuardia)"** (LGA is overlap-2 and early in insertion order).
**Fix:** add one test — origin `JFK`, vibes `big_city,cultural`, `emptyPopular()`, `rawSearchFlights → {flights: []}` → assert no result name contains "New York".

### I6. The chat render path still delivers raw codes to users via the model — buried as a footnote

`AssistantChat.tsx:701/735` send `Departing from: ${origin}` / `Flying from: ${origin}` in page context; `getDeals`/tool outputs return raw destination codes. The model echoes these into user-visible chat text. The plan's Uncertainties note calls this "not to users directly" — through the model IS a render path. Out of scope is defensible; mislabeling the G4 status is not.
**Fix:** promote this from the Uncertainties footnote to an explicit, Jose-visible "accepted G4 gap / follow-up" in the plan body and PR description.

---

## NITs

- **N1.** MOW (Moscow) is spec-sanctioned (§3.4) but US–Russia air links remain suspended for the primary US-origin audience; the filler can surface an unpriced Moscow card users cannot realistically book. Flag at Jose's editorial review.
- **N2.** YVR `beach` makes it "the honest winter+beach carrier" — set-math honest, experientially thin in winter. Acceptable; note for Jose.
- **N3.** `destination-vibes.test.ts` currently has **4** tests, not 3 ("156 − 3 replaced" arithmetic); immaterial since Step 9 asserts "≥ 168" and the file is replaced whole.
- **N4.** The zero-LLM guarantee is enforced only by instruction. Spec §5 says "asserted by test"; the determinism test doesn't prove it. Add a one-line source scan (vibe-preflight.ts must not contain `@anthropic-ai`, `tool-loop`, `spend`) to the tripwire suite.
- **N5.** `deriveDepartMonth`/`upcomingMonths` use local `new Date(...)` → `toISOString()` — month-boundary drift near month end in western timezones (pre-existing pattern, copied into new code).
- **N6.** `clarifyMatchAny` shows "{count}" (destinations matching ANY vibe, e.g. 40) but the re-run renders at most 3 cards; slight expectation mismatch in the copy.
- **N7.** Levenshtein false-positives (e.g. winery→winter) — already flagged in the plan; suggestions are never auto-applied. Fine.
- **N8.** Global Constraints list the banned literal as `Spirit NK JetBlue` items; the actual literal is the single string `"Spirit NK"` (`no-fabrication.test.ts:53`). Doc precision only.

---

## Hunted and NOT found (explicit clearances, all verified against the real repo)

- **Self-defeating gates: NONE found.** No text ban on "mountain" exists anywhere in the plan (drift protection is `CanonicalVibe` typing + the vocabulary-equality test — both checked); the dead-code tripwire uses `existsSync` and scans exactly one product file; the frozen `mountain` fixture lives in `destination-vibes.test.ts`, which is NOT in `SURPRISE_PATH_FILES`; the fabrication tripwire is case-sensitive, so `surprise-fallback-banner` (lowercase) does not trip `FALLBACK`, and `"nightlife"` does not contain `"/night"`; none of the three new scanned files contain a banned literal; `surprise.ts` additions contain no `MIA`.
- **Regression guard genuinely fails pre-fix on all three bug classes.** `VIBE_OPTIONS` is extracted verbatim BEFORE the guard is written, so Step 4 fails on assertions (dud `mountains`/`winter` missing, orphan-vocabulary inequality, floor 0, picker 7≠11), not on a missing import. The ≥8 floor is real: recomputed coverage from the plan's own table = cultural 63 · big_city 58 · foodie 49 · beach 42 · romantic 30 · tropical 30 · nightlife 29 · family 20 · adventure 19 · mountains 13 · winter 10; 101 keys; exactly one impossible pair (`tropical+winter`) — every plan number reproduced exactly.
- **The frozen PRE_MIGRATION_TAGS table matches HEAD `destination-vibes.ts` exactly** (all 82 entries, order and tags compared) — the no-loss test cannot pass vacuously against a weakened baseline.
- **Zero-wire-call tests are correctly placed.** `surprise.test.ts` module-mocks `tpGet`/`rawSearchFlights` (verified L18-21) — a fetch spy there WOULD be vacuous; `surprise.http-budget.test.ts` has no module mocks and stubs global `fetch` (verified) — the new tests genuinely fail pre-implementation, and the F6 worst-case pin of 7 wire calls still passes post-change (traced: enrichment trio CUN/SJU/PUJ unchanged because edits are additive and new entries append).
- **The pre-flight short-circuit sits before the `tpGet` call** (insertion point verified against `surprise.ts:108-128`); `preflightVibes`/`suggestVibes` expectations traced case-by-case against the provided implementation — all pass, including the `playa`-already-selected edge.
- **Existing engine fixtures survive the taxonomy edits** — MIN_OVERLAP, REAL VIBES (exact array), STABLE SORT (exact array), FILLER ENGAGES, ENRICHMENT CAP, http-budget: each traced against the new table; no ordering or overlap changes.
- **Deletions are safe.** `EntryTabs` has zero importers; `SurpriseMeQuiz`/`DestinationSuggestions` are imported only by `EntryTabs`; `PRESET_VIBES`/`BUDGET_TIERS`/`QUIZ_WHO_OPTIONS`/`Quiz*`/`EntryMode` appear only in `trip-types.ts` + the doomed files; `quiz`/`entryTabs` namespaces exist in all six locales with zero `useTranslations` consumers; the two e2e `quiz_budget` hits are DTO-absence checks; `trip.entry_mode === 'surprise'` uses string literals, unaffected by deleting the type.
- **Raw-code drop paths hold.** `resolve-surprise` accepts free text ≤ 200 chars (no city-list validation), so "(all airports)" names flow through; `IATA_TO_CITY` = 127 entries with JFK/LGA/DEN/SEA/BNA/PRG/MSY/MCO/ZRH/MUC present and YVR/SLC/GVA/AGP absent (Task 1 Step 7 is both necessary and correctly anchored); HNL is NOT curated, consistent with the generated-table test expectation.
- **Infrastructure claims all true.** vitest `include` covers the new test paths; `server-only` is aliased for vitest and ships inside `next/dist/compiled` (no new dependency — verified, and two existing files already import it); `resolveJsonModule` on; Playwright baseURL :3001 with no `webServer`; fresh baselines match the plan (156 unit / 41 e2e); the offline TP data cache exists at the stated scratchpad path; `visual-baseline.spec.ts` trips are Path A "Cancún" with no vibes and no origin, so the strip/hero changes cannot diff the snapshots; the `atlas-open` `detail.message` auto-send contract exists in `AssistantChat.tsx:630-648`; `/api/trips` destructures `interests = []`.
- **TripForm test mechanics verified against the real component:** `usePlacesAutocomplete` result is never destructured (an undefined-returning mock is safe); `PackageDealsCarousel` is a default import; the `whatVibes` h3's `closest("div")` is the section container that wraps the chips; selected-chip class is `bg-pink-100`; `pathBTitle` click bubbles to the mode button.
- **`vibesSummary` carries values, not labels** (`page.tsx:53-58` strips `vibe:`/`vibe:custom:` prefixes and joins with " + "), so the pre-flight sees canonical values and custom free text in the user's own words — the plan's assumption holds.

---

## Bottom line

Reject in current form; approve after: (1) the Winter Escapade relabel cascade (B1), (2) deleting AGP's `winter` tag (B2), (3) the three route-test assertion updates written into Task 5 (I2), (4) the effectiveMonth derivation fix (I3), and an explicit Jose decision on the G4 scope items (I1/I4/I6) plus the filler-exclusion test (I5). None of these touch the plan's architecture; all are edits to the plan document before implementation starts.
