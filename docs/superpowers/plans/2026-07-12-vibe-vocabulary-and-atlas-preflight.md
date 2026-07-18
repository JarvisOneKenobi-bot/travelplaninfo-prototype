# Vibe Vocabulary Unification + Destination Coverage + Atlas Pre-Flight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-12-vibe-vocabulary-and-atlas-preflight-design.md` (CORRECTED 2026-07-12 — this plan implements the corrected spec; it does not redesign it).

> **RE-AUTHORED 2026-07-12.** The previous revision of this plan was built on a wrong premise: it treated the dead
> `PRESET_VIBES` (`SurpriseMeQuiz`/`EntryTabs`, zero importers, rejected 2026-04-10) as the live picker and planned a
> 95-entry mass rename to a `city/culture/food/nature/wellness` vocabulary. **The live picker is `TripForm.tsx`
> (`VIBES`, line 27)** and its values are kept as canonical. No mass rename. Fix only what is broken, expose the data
> that already exists, and delete the dead code so a third vocabulary cannot re-emerge.

> **REVISED 2026-07-12 (post-review).** Folds in every finding of the adversarial review
> (`docs/superpowers/reviews/2026-07-12-vibe-plan-review.md`): the winter chip relabels to **"Winter Escapade"**
> everywhere (B1, Jose's binding decision), AGP (Málaga) loses its `winter` tag (B2, winter coverage 10 → 9),
> G4 is scoped by Jose's decision "Name everything on-screen; let Atlas speak naturally" (I1/I4/I6 — see the
> **G4 Scope** section below), the three route-test assertions that `matchMode` breaks are updated in Task 5 (I2),
> the clarification card/Atlas seed derive the REAL search month via `deriveDepartMonth` (I3), the curated-filler
> origin-city exclusion gains a pinning test (I5), and the NITs are fixed or flagged for Jose (N1–N8).

**Goal:** Make every user-selectable vibe actually matchable (one 11-word canonical vocabulary guarded by a test that fails the build on drift), name everything a user sees on-screen — destination, origin, vibe — with no raw IATA code or internal enum value in any rendered UI (Atlas's conversational chat prose is a Jose-approved exception, see **G4 Scope** below), and replace the dead-end empty-result banner with a deterministic, zero-LLM pre-flight clarification card.

**Architecture:** The live picker's chip values ARE the canonical vocabulary (`tropical, mountains, big_city, beach, winter, cultural, adventure` + newly exposed `foodie, romantic, nightlife` + new `family`). One exported `VIBE_OPTIONS` in `trip-types.ts` drives the picker, the context strip, and the regression guard; the taxonomy is typed against `CanonicalVibe` so a stray tag is a compile error. The taxonomy gets one rename (`mountain → mountains`), editorial `winter`/`family` tagging, 6 new destinations (5 genuine ski/winter + Málaga, which carries NO `winter` tag), and 13 TravelPayouts metro CITY codes. A `server-only` generated name table (from TravelPayouts' own city/airport/country data) backs `resolveCityName()` with the curated table as primary. A pure `preflightVibes()` module short-circuits the TravelPayouts fetch when a request can never match, and the UI turns that into an interactive clarification card in six locales.

**Tech Stack:** Next.js (App Router), TypeScript, next-intl, vitest + RTL (`fireEvent` — `@testing-library/user-event` is NOT installed), Playwright, better-sqlite3. No new npm dependencies (`server-only` is provided by Next.js and already stubbed for vitest at `src/test/stubs/server-only-stub.ts` via the alias in `vitest.config.ts`; `resolveJsonModule` is already on in `tsconfig.json`).

## Global Constraints

- **Worktree:** `/home/jarvis/.openclaw/workspace/jarvis-project/travelplaninfo-prototype/.worktrees/surprise-me`, branch `feat/surprise-me-workstation-independence`. All paths relative to it; all commands run from it.
- **Zero fabrication on every path** (spec G7). Never invent a destination, price, airline, or name. If a code cannot be named, DROP the destination. **NEVER map `CHI → ORD`** — that is fabrication.
- **Canonical vibes (exactly 11, these exact internal values):** `tropical, mountains, big_city, beach, winter, cultural, adventure, foodie, romantic, nightlife, family`. No renames of `big_city`/`cultural`/`foodie` — their user-facing labels are already "Big City"/"Cultural"/"Food".
- **No stored-trip migration needed:** the live picker's values never change, so every existing trip's `vibe:*` interests remain canonical. (`vibe:custom:*` free text is handled by the pre-flight, not migrated.)
- **Zero LLM calls in the pre-flight** (Atlas has a $10/mo cap). `vibe-preflight.ts` is pure set math + string distance. No imports from `tool-loop`, `spend`, or any Anthropic SDK path.
- **`min_overlap` semantics:** 2 when 2+ vibes and matchMode `all` (default); 1 for a single vibe; 1 when matchMode `any`. The curated filler uses the SAME threshold (today it hardcodes 2, which also starves single-vibe searches — fixed in Task 5).
- **Generated name table is server-side only** (`import "server-only"` + build gate). Never imported by a client component.
- **All new user-facing copy in all six locales** (`en, es, pt, fr, de, it`), genuinely translated — exact strings are provided below; do not re-translate, do not paste English into non-EN files. No jargon, no "IATA", no parameter names in any user-facing string. Audience is an average/older traveller (Jose, 2026-07-12: "we must decodify for the user").
- **Fabrication tripwire:** `src/lib/atlas/no-fabrication.test.ts` scans these files for the banned literals `"$89"`, `"$95"`, `"$75"`, `"$127"`, `"$159"`, `"$189"`, `"/night"`, `"hotelPrice"`, `"Spirit NK"` (one single literal — verified against `no-fabrication.test.ts:53`), `"JetBlue"`, `"V1_FALLBACK"`, `"FALLBACK"`: `route.ts, SurpriseMeSection.tsx, AtlasHeroSection.tsx, DestinationCard.tsx, surprise-query.ts, surprise.ts, destination-vibes.ts` — plus the files this plan adds to the list (`vibe-preflight.ts, city-names.ts, SurpriseClarificationCard.tsx`). Do not write any banned literal in those files, **including comments**. Additionally `surprise.ts` must not contain the literal `MIA` and `SurpriseMeSection.tsx` must not contain `new URLSearchParams` and MUST contain `buildSurpriseQuery` (existing tripwires).
- **Fresh-measured baselines (2026-07-12, HEAD `1f2c54d`; only docs changed since the last code commit):** `npm run test:unit` → 21 files, 156 tests, all pass · `npm run lint` → 0 errors / 30 warnings · `npx playwright test --list` → 41 tests in 8 files · build clean.
- **Playwright needs a dev server on :3001** (`playwright.config.ts` has NO `webServer` block): start `npm run dev -- -p 3001` in a separate shell/background first. If ALL tests fail in ~300ms, the server died — restart it, don't debug the tests.
- **Commit per task** with the messages given. Do not push or merge — this is PR #7's branch; Jose reviews before anything ships.

---

## G4 Scope — Jose's Binding Decision (2026-07-12)

> **"Name everything on-screen; let Atlas speak naturally."**

This resolves review findings I1/I4/I6 and scopes goal G4 precisely. Two halves, both binding:

**1. ALL rendered UI must be decoded — no bare `/^[A-Z]{3}$/` and no internal enum value ever reaches a user's screen.** Concretely, this plan fixes every known render-path leak:

- `src/app/[locale]/planner/[tripId]/page.tsx:72` — the trip header renders `· ✈️ from JFK` raw on every Path-A and resolved-surprise trip → renders the decoded label, e.g. **"from New York, New York (JFK)"** (the code alongside the name is fine — it is never *bare*). Fixed in Task 3.
- `src/components/TripContextStrip.tsx:70-79` — the origin pill renders `✈️ JFK` plus raw `(+ EWR, LGA)` nearby codes → decoded (e.g. "New York, New York (JFK)" + "Newark, New Jersey · New York (LaGuardia)"). Fixed in Task 3.
- The Atlas hero subtitle (`atlasHero.subtitle`) interpolates **raw internal vibe values** (`big_city`) via `vibesSummary` → renders localized labels ("Big City"); custom free-text vibes echo as the user typed them. An internal enum value on screen is a bug. Fixed in Task 7.
- **Fallback rule:** `originName ?? originCode` fallbacks (hero subtitle, auto-sent Atlas chat seed, trip header) must **NOT** fall back to a bare code. When the origin cannot be named, **omit the origin phrase entirely** (dedicated no-origin i18n variants — Tasks 6/7) or omit the pill/header fragment (Task 3). "The user typed that code themselves" is an exception Jose's rule does not grant.

**2. Atlas's conversational prose MAY still say "JFK"** — natural language; forcing city names would make the assistant worse at disambiguating JFK vs Newark. Therefore the chat-path code exposure is an **ACCEPTED, DELIBERATE, JOSE-APPROVED GAP** — do NOT "fix" it in this plan:

- `AssistantChat.tsx:701` sends `Departing from: ${origin}` and `:735` sends `Flying from: ${origin}` in the page context given to the model.
- `getDeals` / tool outputs return raw destination codes to the model, which may echo them into chat text.

This gap must be restated in PR #7's description as explicitly Jose-approved (Task 8 carries the reminder). Any future tightening is a separate follow-up, not silent scope creep here.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/trip-types.ts` | Modify | `CANONICAL_VIBES` (11) + `CanonicalVibe` + `VIBE_ICONS`/`VIBE_LABELS`/`VIBE_OPTIONS` (single source of truth); `PRESET_VIBES` and the quiz-only types DELETED |
| `src/lib/atlas/destination-vibes.ts` | Rewrite | 101-destination taxonomy typed `ReadonlySet<CanonicalVibe>` (82 existing + 6 new [5 ski/winter + Málaga] + 13 TP city codes) |
| `src/lib/atlas/vibe-vocabulary.guard.test.ts` | Create | THE regression guard: picker values ⊆ taxonomy, taxonomy vocabulary == picker vocabulary, coverage floor ≥ 8, picker == the 11 canonical, every taxonomy key nameable |
| `src/lib/atlas/destination-vibes.test.ts` | Rewrite | Migration no-loss test (frozen pre-fix table ⊆ new, with the one rename applied), 101-key count, spot checks |
| `src/lib/atlas/travelpayouts-client.ts` | Modify | `IATA_TO_CITY` += 4 curated names (`YVR SLC GVA AGP`) for the new taxonomy destinations |
| `src/components/TripForm.tsx` | Modify | Live picker consumes `VIBE_OPTIONS` (7 → 11 chips) with i18n labels; private `VIBES` deleted |
| `src/components/TripForm.test.tsx` | Create | 11 chips render with localized labels; new chips are selectable |
| `src/components/TripContextStrip.tsx` | Modify | Vibe pills use `VIBE_ICONS` + localized labels (raw `big_city` no longer reaches users); custom vibes render as typed; origin pill decoded (`originLabel`/`extraAirportLabels` props — never a bare code) |
| `src/components/TripContextStrip.test.tsx` | Create | Origin pill renders decoded labels; nothing renders when the origin is unnameable |
| `src/app/[locale]/planner/[tripId]/page.tsx` | Modify | Resolves the origin server-side (`resolveCityName` — server component, legal); trip header "from …" + context strip receive decoded labels; unnameable origin → phrase omitted, never a bare code (G4 Scope) |
| `src/components/EntryTabs.tsx`, `SurpriseMeQuiz.tsx`, `DestinationSuggestions.tsx` | **Delete** | Dead code (zero importers, rejected 2026-04-10; `DestinationSuggestions` is only imported by `EntryTabs`) |
| `messages/{en,es,pt,fr,de,it}/common.json` | Modify | `tripForm.vibes` += 4 keys and `winter` relabeled "Winter Escapade" (B1); `quiz` + `entryTabs` namespaces deleted; `atlasHero` += clarify\* + 2 degraded keys + `subtitleNoOrigin` + `clarifyAtlasSeedNoOrigin` |
| `scripts/generate-city-names.mjs` | Create | Regenerates the name table from TravelPayouts' public data (provenance; offline `TP_DATA_DIR` fallback) |
| `src/lib/atlas/generated/city-names.json` | Create (generated) | 9,471 `code → "City, Country"` entries, 545 with `" (all airports)"` (measured 2026-07-12) |
| `src/lib/atlas/city-names.ts` | Create | `resolveCityName()` — curated `IATA_TO_CITY` first, generated second, `null` = drop; `server-only` |
| `src/lib/atlas/city-names.test.ts` | Create | Naming behavior + server-only tripwire + generated-table sanity |
| `src/lib/atlas/vibe-preflight.ts` | Create | Pure `preflightVibes()` + `suggestVibes()` (synonyms + edit distance), zero LLM |
| `src/lib/atlas/vibe-preflight.test.ts` | Create | ok / unknown_vibes / no_match_possible / suggestions / determinism |
| `src/lib/atlas/surprise.ts` | Modify | Pre-flight short-circuit, `matchMode`, shared `minOverlap`, name resolution + drop, same-city dedupe, `originName` |
| `src/lib/atlas/surprise.test.ts` | Modify | Live-bug pins (duds + orphans + family), matchMode, naming/drop tests |
| `src/lib/atlas/surprise.http-budget.test.ts` | Modify | Zero-wire-call assertions for pre-flight short-circuits |
| `src/lib/atlas/surprise-degrade.ts` + `.test.ts` | Modify | `unknown_vibes`, `no_match_possible` codes + i18n keys + locale parity for clarify keys |
| `src/lib/atlas/surprise-query.ts` + `.test.ts` | Modify | `matchAny` + `departMonthOverride` in `buildSurpriseQuery` |
| `src/app/api/surprise-me/route.ts` + `route.test.ts` | Modify | `match` query param, cache key, pass-through |
| `src/components/SurpriseClarificationCard.tsx` + `.test.tsx` | Create | The interactive clarification card |
| `src/components/SurpriseMeSection.tsx` + `.test.tsx` | Modify | Render the card for preflight codes; match-any / month / suggestion / ask-Atlas actions; `originName` capture; hero vibes localized before interpolation; real `deriveDepartMonth` month; no-origin seed variant |
| `src/components/AtlasHeroSection.tsx` | Modify | `originName` prop replaces `originCode` — subtitle shows "New York, New York" when nameable, the `subtitleNoOrigin` variant otherwise; NEVER a bare code |
| `src/lib/atlas/no-fabrication.test.ts` | Modify | Tripwire extended to new files + dead-entry-system-stays-dead guard |
| `src/lib/help-content.ts` | Modify | Vibe examples reflect the 11 chips; "When nothing matches" section (standing rule: `feedback_update_help_with_features`) |
| `tests/e2e/planner-trust.spec.ts` | Modify | 2 new e2e tests for the clarification card |

**Not touched (explicitly):** `src/components/BootstrapModal.tsx` — `GUEST_INTERESTS` contains `'mountains'` but those are *interests*, not vibes; they never enter the vibe pipeline. The `surprise_me` Atlas TOOL (`tool-loop.ts` → `getPopularRoutes`) takes no vibes and is out of scope. `preferences.climatePlaceholder` i18n prose is not a vibe tag.

---

## The Editorial Tag Changes (the deliverable — reviewed by Jose with this plan)

The taxonomy keeps its current 82 entries **in their current order** (the curated filler iterates insertion order on overlap ties — reordering would silently change which cards users see). Only the changes below are applied; the full resulting table is transcribed verbatim in Task 1 Step 5 and is the single source of truth.

**1. The one rename:** `mountain → mountains` on `DEN, SEA, PHX, BOG, MDE` (the one-letter mismatch that killed the Mountains chip).

**2. `family` additions to existing destinations (14):**

| Code | City | Rationale |
|---|---|---|
| CUN | Cancún | Family all-inclusives are a core Riviera Maya product |
| PUJ | Punta Cana | All-inclusive family resorts define the destination |
| NAS | Nassau | Atlantis water-park resort tourism |
| GCM | Grand Cayman | Seven Mile Beach + Stingray City are family staples |
| PLS | Providenciales | Grace Bay family-resort market |
| MCO | Orlando (airport) | Theme-park capital of the world |
| FLL | Fort Lauderdale | Family beach market |
| TPA | Tampa | Busch Gardens + gulf beaches |
| RSW | Fort Myers | Sanibel shelling, calm gulf water |
| SAN | San Diego | Zoo, Legoland, family beaches |
| HNL | Honolulu | Family resort corridor |
| CPH | Copenhagen | Tivoli Gardens; famously child-friendly |
| SIN | Singapore | Zoo, Sentosa, Gardens by the Bay |
| DXB | Dubai | Water-park/aquarium family resort market |

**3. `winter` + `mountains` additions to existing destinations (spec: seed from the ski/mountain set):** `DEN` +winter (Rockies ski gateway) · `KEF` +mountains +winter (glaciers, ice caves, northern-lights winter product) · `SJO` +mountains (Arenal volcano, Monteverde cloud forest — makes `tropical+mountains` honestly satisfiable) · `CPT` +mountains (Table Mountain IS the product).

**4. Same-city tag alignment (small, deliberate):** `JFK/LGA/EWR` +romantic (their metro code NYC carries it — same city must carry the same tags) · `ORD` +nightlife (aligns with CHI) · `LHR` +nightlife (aligns with LON) · `MDE` +nightlife (Medellín's Parque Lleras nightlife is genuinely famous; also removes a spurious "no destination matches mountains+nightlife" dead end).

**5. NEW destinations (6) — five genuine snow/ski winter escapes + Málaga (warm-weather, NO `winter` tag).** The spec's seed list (Denver, Salt Lake, Zurich, Geneva…) requires adding destinations; Aspen (ASE) is deliberately omitted — a tiny airport TP rarely prices, and the coverage floor is met without it:

| Code | City | Tags | Rationale |
|---|---|---|---|
| YVR | Vancouver | mountains, winter, big_city, foodie, family | Whistler/Grouse skiing + Stanley Park/aquarium + a real food city. **N2 RESOLVED — Jose, 2026-07-12: "vancouver is not a beach city destination IMO." YVR carries NO `beach` tag.** Consequence, machine-verified: YVR was the sole `beach+winter` carrier, so **`beach+winter` becomes a second impossible pair** alongside `tropical+winter`. Both are genuinely contradictory under the snow/ski reading of Winter Escapade and both route to `no_match_possible` → the clarification card. That is correct behaviour, NOT a defect. No destination may be invented to carry the pair — that is the fabrication this branch exists to eliminate. |
| SLC | Salt Lake City | mountains, winter, adventure, family | Utah ski corridor, heavily family-marketed |
| ZRH | Zurich | mountains, winter, big_city, cultural | Alps gateway |
| GVA | Geneva | mountains, winter, romantic, cultural | Lake Geneva, Alps, Montreux |
| MUC | Munich | big_city, cultural, foodie, winter | Christmas markets + Bavarian Alps gateway |
| AGP | Málaga | beach, cultural, foodie | Costa del Sol beaches, Picasso museum + old-town culture, tapas food scene. **Deliberately NOT tagged `winter` (review B2):** Málaga is a winter-*sun* destination — exactly the escape-FROM-winter reading Jose rejected, and the amended spec bans tagging any warm-weather destination `winter`. Removal is machine-verified safe: winter coverage 10 → 9 (floor ≥ 8); `tropical+winter` remains the only impossible pair; no test references AGP-winter. |

**6. NEW TravelPayouts metro CITY codes (13, spec §3.4, frequency-ordered).** These are TP's most-returned destinations and today carry NO tags — invisible to every vibe search:

| Code | City (freq) | Tags |
|---|---|---|
| NYC | New York (35×) | big_city, cultural, foodie, nightlife, romantic |
| CHI | Chicago (24×) | big_city, cultural, foodie, nightlife |
| ORL | Orlando (15×) | family, adventure |
| WAS | Washington (5×) | big_city, cultural, family |
| PAR | Paris (4×) | romantic, cultural, foodie, big_city |
| LON | London (3×) | big_city, cultural, foodie, nightlife |
| YTO | Toronto (2×) | big_city, cultural, foodie, family |
| HOU | Houston | big_city, foodie, family |
| PIT | Pittsburgh | big_city, cultural |
| MOW | Moscow | big_city, cultural, nightlife, winter |
| RDU | Raleigh/Durham | big_city, foodie |
| ANC | Anchorage | mountains, adventure, winter |
| BEG | Belgrade | big_city, nightlife, cultural |

**⚠ N1 — MOW (Moscow) flagged for Jose:** the spec (§3.4) sanctions MOW, but US–Russia air links remain suspended for the primary US-origin audience — the curated filler can surface an unpriced Moscow card users cannot realistically book. Jose decides keep/drop at this plan's editorial review; dropping MOW entirely would leave winter at 8 (exactly at floor), nightlife 28, big_city 57, cultural 62 — all still passing. Do not decide silently.

**Resulting coverage (101 destinations; machine-validated while planning, re-validated after the B2 AGP-winter removal AND Jose's YVR-beach removal):** cultural 63 · big_city 58 · foodie 49 · beach 41 · tropical 30 · romantic 30 · nightlife 29 · family 20 · adventure 19 · mountains 13 · **winter 9**. Floor is winter at 9 — above the guard's ≥ 8, with one destination of buffer. Winter carriers: ANC DEN GVA KEF MOW MUC SLC YVR ZRH.

**Known property:** exactly **two** 2-vibe combinations are unsatisfiable at `min_overlap = 2`: **`tropical + winter`** and **`beach + winter`** — both physically contradictory under the spec's snow/ski reading of Winter Escapade, and therefore the natural real-data fixtures for the `no_match_possible` path (the clarification card handles both). Every other 2-vibe combo (53/55) matches ≥ 1 destination. (Machine-verified after Jose's YVR-beach removal: `cultural+winter` is carried by ZRH/GVA/MUC/MOW, `foodie+winter` by MUC/YVR, `mountains+winter` by DEN/KEF/YVR/SLC/ZRH/GVA/ANC — no *third* impossible pair emerged.)

---

### Task 1: Canonical vocabulary, taxonomy fix, and THE regression guard

The core bug fix. After this task alone, the Mountains and Winter Escapade chips return real destinations and the orphan data (`foodie`/`romantic`/`nightlife`) plus the new `family` vibe are reachable through the engine. The guard is written against the REAL pre-fix picker (extracted verbatim into `VIBE_OPTIONS` first) and **must be observed failing on all three bug classes** — the dud chips, the orphan tags, and the zero-coverage floor — before the fix lands. Test + fix commit together so the branch stays green.

**Files:**
- Modify: `src/lib/trip-types.ts` (add vibe exports; `PRESET_VIBES` is deleted later, in Task 2)
- Modify: `src/components/TripForm.tsx` (lines 27–35: private `VIBES` → shared `VIBE_OPTIONS`)
- Rewrite: `src/lib/atlas/destination-vibes.ts`
- Modify: `src/lib/atlas/travelpayouts-client.ts` (4 `IATA_TO_CITY` additions)
- Create: `src/lib/atlas/vibe-vocabulary.guard.test.ts`
- Rewrite: `src/lib/atlas/destination-vibes.test.ts`
- Modify: `src/lib/atlas/surprise.test.ts` (append pins)

**Interfaces:**
- Produces (Tasks 2, 4, 7 consume these exact names from `@/lib/trip-types`):
  - `CANONICAL_VIBES: readonly ["tropical","mountains","big_city","beach","winter","cultural","adventure","foodie","romantic","nightlife","family"]`
  - `type CanonicalVibe = (typeof CANONICAL_VIBES)[number]`
  - `VIBE_ICONS: Record<CanonicalVibe, string>`, `VIBE_LABELS: Record<CanonicalVibe, string>`
  - `VIBE_OPTIONS: { value: CanonicalVibe; label: string; icon: string }[]`
- Produces: `DESTINATION_VIBES: Record<string, ReadonlySet<CanonicalVibe>>` with 101 keys (from `@/lib/atlas/destination-vibes`).

- [ ] **Step 1: Extract the live picker into `VIBE_OPTIONS` (pure refactor, zero behavior change)**

In `src/lib/trip-types.ts`, add below `BUDGET_TIERS` (leave `PRESET_VIBES` alone for now — Task 2 deletes it):

```ts
// The LIVE vibe picker's options, extracted verbatim from TripForm so tests can
// see exactly what users can click. Grows to the full canonical vocabulary in
// this same task; see vibe-vocabulary.guard.test.ts.
export const VIBE_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: 'tropical', icon: '🌴', label: 'Tropical' },
  { value: 'mountains', icon: '🏔️', label: 'Mountains' },
  { value: 'big_city', icon: '🏙️', label: 'Big City' },
  { value: 'beach', icon: '🌊', label: 'Beach' },
  { value: 'winter', icon: '❄️', label: 'Winter Escape' },
  { value: 'cultural', icon: '🏛️', label: 'Cultural' },
  { value: 'adventure', icon: '🏕️', label: 'Adventure' },
];
```

*(Note: this block deliberately still reads `'Winter Escape'` — it is the VERBATIM pre-fix picker, extracted unchanged so the regression guard fails against the real current state. The relabel to `'Winter Escapade'` — Jose's binding decision, review B1 — lands in Step 5 together with the rest of the canonical vocabulary.)*

In `src/components/TripForm.tsx`: delete the private `VIBES` constant (lines 27–35), add `import { VIBE_OPTIONS } from "@/lib/trip-types";`, and replace the two `VIBES` references: the render loop `{VIBES.map(v => ...)}` → `{VIBE_OPTIONS.map(v => ...)}` (body unchanged — still `{v.icon} {v.label}`), and in `addCustomVibes` (~line 267) `!VIBES.some(v => v.value === i)` → `!VIBE_OPTIONS.some(v => v.value === i)`.

Run: `npm run test:unit` → Expected: 21 files, 156 tests, all pass (nothing observable changed).

- [ ] **Step 2: Write the regression guard (it will fail — that is the point)**

Create `src/lib/atlas/vibe-vocabulary.guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { VIBE_OPTIONS } from "@/lib/trip-types";
import { DESTINATION_VIBES } from "./destination-vibes";

// THE regression guard (spec §3.2, the most important deliverable). The live
// bug — the Mountains chip dead on a one-letter mismatch, the winter chip
// (now "Winter Escapade") backed by zero data, and foodie/romantic/nightlife
// data no user could
// select — was a silent drift between the words users can click and the words
// the taxonomy carries. Because min_overlap=2 for 2+ vibes, one dud chip
// zeroed 11 of 21 two-vibe combos (52%), and a fabricated fallback masked it
// for months. If any test in this file fails, the vibe filter is broken for
// real users: fix the data, never weaken this file.

const COVERAGE_FLOOR = 8;

// The canonical vocabulary this change ships. Sorted for comparison.
const CANONICAL_TARGET = [
  "adventure", "beach", "big_city", "cultural", "family", "foodie",
  "mountains", "nightlife", "romantic", "tropical", "winter",
];

const pickerValues = () => VIBE_OPTIONS.map((option) => option.value);

function taxonomyVocabulary(): Set<string> {
  const vocabulary = new Set<string>();
  for (const tags of Object.values(DESTINATION_VIBES)) {
    for (const tag of tags) vocabulary.add(tag);
  }
  return vocabulary;
}

describe("vibe vocabulary regression guard", () => {
  it("every vibe a user can click exists in the taxonomy (no dud chips)", () => {
    const vocabulary = taxonomyVocabulary();
    for (const value of pickerValues()) {
      expect(vocabulary.has(value), `picker vibe "${value}" matches nothing in DESTINATION_VIBES`).toBe(true);
    }
  });

  it("the taxonomy vocabulary EQUALS the picker vocabulary (no orphan tags)", () => {
    expect([...taxonomyVocabulary()].sort()).toEqual([...pickerValues()].sort());
  });

  it(`every pickable vibe is carried by at least ${COVERAGE_FLOOR} destinations (a chip that exists but matches nothing is the bug we shipped)`, () => {
    for (const value of pickerValues()) {
      const carriers = Object.values(DESTINATION_VIBES).filter((tags) =>
        (tags as ReadonlySet<string>).has(value)
      ).length;
      expect(carriers, `"${value}" is carried by only ${carriers} destinations`).toBeGreaterThanOrEqual(COVERAGE_FLOOR);
    }
  });

  it("the picker exposes exactly the 11 canonical vibes", () => {
    expect([...pickerValues()].sort()).toEqual(CANONICAL_TARGET);
  });

  // TODO(task-3): add the nameability guard here once resolveCityName exists
  // ("every taxonomy destination resolves to a display name").
});
```

- [ ] **Step 3: Write the engine pins (they will also fail)**

Append to `src/lib/atlas/surprise.test.ts` (uses the file's existing `popular()` / `item()` helpers; mocked TP per spec §4):

```ts
describe("LIVE BUG PINS: the dud chips must return destinations (mocked TP)", () => {
  // Proven live 2026-07-12 (origin JFK): mountains,cultural -> 0 · winter,cultural -> 0 ·
  // mountains,winter -> 0. Pre-fix these fail because the taxonomy tag was the
  // singular 'mountain' and no destination carried 'winter' at all.
  // NOTE: winter+beach is deliberately NOT pinned here. Vancouver lost its
  // 'beach' tag (Jose, 2026-07-12), making beach+winter a genuinely impossible
  // pair -> it routes to the no_match_possible clarification card.
  it.each([
    ["mountains,cultural", "SEA", "Seattle, Washington"],
    ["winter,cultural", "ZRH", "Zurich, Switzerland"],
    ["mountains,winter", "DEN", "Denver, Colorado"],
  ])("vibes=%s returns at least the matching mocked route", async (vibes, code, cityName) => {
    popular([item(code, 150)]);

    const result = await getSurpriseDestinations({ origin: "JFK", vibes, departMonth: "2026-08" });

    expect(result.destinations.length).toBeGreaterThanOrEqual(1);
    expect(result.destinations.map((d) => d.name)).toContain(cityName);
  });
});

describe("ORPHANS UNLOCKED + NEW VIBES: each newly exposed vibe matches real routes", () => {
  it.each([
    ["foodie", "BNA", "Nashville, Tennessee"],
    ["romantic", "PRG", "Prague, Czech Republic"],
    ["nightlife", "MSY", "New Orleans, Louisiana"],
    ["family", "MCO", "Orlando, Florida"],
    ["winter", "DEN", "Denver, Colorado"],
  ])("single vibe %s surfaces the matching mocked route", async (vibes, code, cityName) => {
    popular([item(code, 99)]);

    const result = await getSurpriseDestinations({ origin: "JFK", vibes, departMonth: "2026-08" });

    expect(result.destinations.map((d) => d.name)).toContain(cityName);
  });
});
```

(`foodie`/`romantic`/`nightlife` single-vibe searches already work at the ENGINE level pre-fix — their orphan-ness is that no user could select them, which the guard's equality test pins. `family`, `winter`, and the dud pins fail pre-fix at the engine level too.)

- [ ] **Step 4: Run the new tests — record the pre-fix failure as evidence**

```bash
mkdir -p docs/superpowers/evidence/2026-07-12-vibe-fix
npx vitest run src/lib/atlas/vibe-vocabulary.guard.test.ts src/lib/atlas/surprise.test.ts 2>&1 | tee docs/superpowers/evidence/2026-07-12-vibe-fix/guard-prefix-failure.txt
```

Expected: FAIL, specifically —
- guard "no dud chips": `mountains` and `winter` missing from the taxonomy (the two dud chips);
- guard "no orphan tags": vocabulary mismatch listing `foodie`, `romantic`, `nightlife`, `mountain` as taxonomy words no picker exposes;
- guard floor: `mountains` carried by 0 (singular mismatch), `winter` by 0;
- guard "exactly 11": picker has 7;
- pins: `mountains,cultural`, `winter,cultural`, `mountains,winter`, `family`, `winter` return 0 destinations.

This file IS the spec-required demonstration that the guard would have failed pre-fix. Keep it — it ships with the evidence in Task 8.

- [ ] **Step 5: Fix `src/lib/trip-types.ts` — the full canonical vocabulary**

Replace the Step-1 `VIBE_OPTIONS` block with:

```ts
// The canonical vibe vocabulary — the single source of truth for every vibe a
// user can pick anywhere in the product. The taxonomy in
// src/lib/atlas/destination-vibes.ts is typed against CanonicalVibe (a stray
// tag is a compile error) and vibe-vocabulary.guard.test.ts fails the build if
// picker and taxonomy ever drift apart again.
export const CANONICAL_VIBES = [
  'tropical', 'mountains', 'big_city', 'beach', 'winter', 'cultural', 'adventure',
  'foodie', 'romantic', 'nightlife', 'family',
] as const;

export type CanonicalVibe = (typeof CANONICAL_VIBES)[number];

export const VIBE_ICONS: Record<CanonicalVibe, string> = {
  tropical: '🌴',
  mountains: '🏔️',
  big_city: '🏙️',
  beach: '🌊',
  winter: '❄️',
  cultural: '🏛️',
  adventure: '🏕️',
  foodie: '🍜',
  romantic: '💕',
  nightlife: '🎶',
  family: '👨‍👩‍👧‍👦',
};

// English default labels; the UI renders localized labels from
// messages/*/common.json tripForm.vibes (same keys).
export const VIBE_LABELS: Record<CanonicalVibe, string> = {
  tropical: 'Tropical',
  mountains: 'Mountains',
  big_city: 'Big City',
  beach: 'Beach',
  winter: 'Winter Escapade',
  cultural: 'Cultural',
  adventure: 'Adventure',
  foodie: 'Food',
  romantic: 'Romantic',
  nightlife: 'Nightlife',
  family: 'Family',
};

export const VIBE_OPTIONS: { value: CanonicalVibe; label: string; icon: string }[] =
  CANONICAL_VIBES.map((value) => ({ value, label: VIBE_LABELS[value], icon: VIBE_ICONS[value] }));
```

TripForm now renders 11 chips automatically (still English labels — Task 2 localizes them; the current 7 are hardcoded English today, so this is no regression).

- [ ] **Step 6: Rewrite `src/lib/atlas/destination-vibes.ts` with the full canonical table**

Replace the entire file. This is the exact table — transcribe verbatim (existing 82 entries keep their current order; edits per the Editorial Tag Changes section; 19 new entries appended at the END so the curated filler's tie order for existing destinations is unchanged):

```ts
import type { CanonicalVibe } from "@/lib/trip-types";

// Canonical vibe taxonomy. Vocabulary is exactly CANONICAL_VIBES — enforced at
// compile time by CanonicalVibe and at test time by
// vibe-vocabulary.guard.test.ts. Keys are the codes TravelPayouts returns:
// mostly airport codes, plus metro CITY codes (NYC, CHI, ORL, ...) which TP
// uses for its most popular destinations. Entry order matters: the curated
// filler breaks overlap ties by insertion order, so new entries go at the end.
export const DESTINATION_VIBES: Record<string, ReadonlySet<CanonicalVibe>> = {
  CUN: new Set<CanonicalVibe>(['tropical', 'beach', 'big_city', 'nightlife', 'romantic', 'family']),
  SJU: new Set<CanonicalVibe>(['tropical', 'beach', 'big_city', 'cultural', 'nightlife']),
  PUJ: new Set<CanonicalVibe>(['tropical', 'beach', 'romantic', 'family']),
  MBJ: new Set<CanonicalVibe>(['tropical', 'beach', 'romantic', 'adventure']),
  NAS: new Set<CanonicalVibe>(['tropical', 'beach', 'romantic', 'family']),
  GCM: new Set<CanonicalVibe>(['tropical', 'beach', 'romantic', 'family']),
  BGI: new Set<CanonicalVibe>(['tropical', 'beach', 'romantic', 'cultural']),
  ANU: new Set<CanonicalVibe>(['tropical', 'beach', 'romantic']),
  STT: new Set<CanonicalVibe>(['tropical', 'beach', 'romantic', 'adventure']),
  STX: new Set<CanonicalVibe>(['tropical', 'beach', 'adventure']),
  SXM: new Set<CanonicalVibe>(['tropical', 'beach', 'nightlife', 'romantic']),
  PLS: new Set<CanonicalVibe>(['tropical', 'beach', 'romantic', 'family']),
  SJD: new Set<CanonicalVibe>(['tropical', 'beach', 'romantic', 'adventure']),
  PVR: new Set<CanonicalVibe>(['tropical', 'beach', 'romantic', 'nightlife']),
  CTG: new Set<CanonicalVibe>(['tropical', 'beach', 'cultural', 'romantic']),
  SDQ: new Set<CanonicalVibe>(['tropical', 'beach', 'big_city']),
  ZIH: new Set<CanonicalVibe>(['tropical', 'beach', 'romantic']),
  HAV: new Set<CanonicalVibe>(['tropical', 'beach', 'cultural']),
  MCO: new Set<CanonicalVibe>(['beach', 'big_city', 'adventure', 'family']),
  MIA: new Set<CanonicalVibe>(['beach', 'big_city', 'nightlife', 'tropical']),
  FLL: new Set<CanonicalVibe>(['beach', 'tropical', 'family']),
  TPA: new Set<CanonicalVibe>(['beach', 'family']),
  RSW: new Set<CanonicalVibe>(['beach', 'family']),
  SAN: new Set<CanonicalVibe>(['beach', 'big_city', 'foodie', 'family']),
  HNL: new Set<CanonicalVibe>(['tropical', 'beach', 'romantic', 'adventure', 'family']),
  JFK: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'nightlife', 'romantic']),
  LGA: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'nightlife', 'romantic']),
  EWR: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'nightlife', 'romantic']),
  LAX: new Set<CanonicalVibe>(['big_city', 'beach', 'cultural', 'foodie', 'nightlife']),
  ORD: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'nightlife']),
  LAS: new Set<CanonicalVibe>(['nightlife', 'big_city', 'adventure']),
  ATL: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie']),
  DFW: new Set<CanonicalVibe>(['big_city', 'foodie']),
  DEN: new Set<CanonicalVibe>(['mountains', 'adventure', 'big_city', 'winter']),
  SEA: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'mountains']),
  BOS: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie']),
  SFO: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie']),
  MSY: new Set<CanonicalVibe>(['cultural', 'foodie', 'nightlife']),
  BNA: new Set<CanonicalVibe>(['cultural', 'nightlife', 'foodie']),
  AUS: new Set<CanonicalVibe>(['cultural', 'nightlife', 'foodie']),
  PDX: new Set<CanonicalVibe>(['foodie', 'cultural']),
  PHX: new Set<CanonicalVibe>(['adventure', 'mountains']),
  LHR: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'nightlife']),
  CDG: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'romantic']),
  FCO: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'romantic']),
  BCN: new Set<CanonicalVibe>(['big_city', 'beach', 'cultural', 'foodie', 'nightlife']),
  MAD: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'nightlife']),
  AMS: new Set<CanonicalVibe>(['big_city', 'cultural', 'nightlife']),
  LIS: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'beach', 'romantic']),
  ATH: new Set<CanonicalVibe>(['cultural', 'beach', 'foodie', 'romantic']),
  IST: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie']),
  DUB: new Set<CanonicalVibe>(['cultural', 'foodie']),
  CPH: new Set<CanonicalVibe>(['cultural', 'foodie', 'big_city', 'family']),
  PRG: new Set<CanonicalVibe>(['cultural', 'romantic', 'nightlife']),
  BUD: new Set<CanonicalVibe>(['cultural', 'nightlife', 'romantic']),
  KEF: new Set<CanonicalVibe>(['adventure', 'romantic', 'mountains', 'winter']),
  GIG: new Set<CanonicalVibe>(['beach', 'big_city', 'cultural', 'nightlife', 'tropical']),
  GRU: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie']),
  EZE: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'nightlife']),
  BOG: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'mountains']),
  MDE: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'mountains', 'nightlife']),
  LIM: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie']),
  SJO: new Set<CanonicalVibe>(['adventure', 'tropical', 'beach', 'mountains']),
  PTY: new Set<CanonicalVibe>(['big_city', 'tropical', 'beach']),
  BZE: new Set<CanonicalVibe>(['tropical', 'beach', 'adventure']),
  BKK: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'nightlife', 'tropical']),
  DPS: new Set<CanonicalVibe>(['tropical', 'beach', 'cultural', 'romantic', 'adventure']),
  SIN: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'family']),
  HKG: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie']),
  NRT: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie']),
  HND: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie']),
  ICN: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie']),
  DXB: new Set<CanonicalVibe>(['big_city', 'beach', 'family']),
  CMB: new Set<CanonicalVibe>(['tropical', 'beach', 'cultural']),
  SYD: new Set<CanonicalVibe>(['big_city', 'beach', 'cultural', 'foodie']),
  AKL: new Set<CanonicalVibe>(['adventure', 'cultural']),
  CPT: new Set<CanonicalVibe>(['big_city', 'beach', 'adventure', 'cultural', 'foodie', 'mountains']),
  NBO: new Set<CanonicalVibe>(['adventure', 'cultural']),
  RAK: new Set<CanonicalVibe>(['cultural', 'foodie', 'romantic']),
  CAI: new Set<CanonicalVibe>(['cultural', 'big_city']),
  HRG: new Set<CanonicalVibe>(['beach', 'tropical']),
  SSH: new Set<CanonicalVibe>(['beach', 'tropical']),
  // ── NEW: genuine snow/ski winter destinations (back the Winter Escapade
  // chip) + Málaga, which carries NO winter tag (warm-weather; spec bans it) ──
  YVR: new Set<CanonicalVibe>(['mountains', 'winter', 'big_city', 'foodie', 'family']),
  SLC: new Set<CanonicalVibe>(['mountains', 'winter', 'adventure', 'family']),
  ZRH: new Set<CanonicalVibe>(['mountains', 'winter', 'big_city', 'cultural']),
  GVA: new Set<CanonicalVibe>(['mountains', 'winter', 'romantic', 'cultural']),
  MUC: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'winter']),
  AGP: new Set<CanonicalVibe>(['beach', 'cultural', 'foodie']),
  // ── NEW: TravelPayouts metro CITY codes (TP's most-returned destinations) ──
  NYC: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'nightlife', 'romantic']),
  CHI: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'nightlife']),
  ORL: new Set<CanonicalVibe>(['family', 'adventure']),
  WAS: new Set<CanonicalVibe>(['big_city', 'cultural', 'family']),
  PAR: new Set<CanonicalVibe>(['romantic', 'cultural', 'foodie', 'big_city']),
  LON: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'nightlife']),
  YTO: new Set<CanonicalVibe>(['big_city', 'cultural', 'foodie', 'family']),
  HOU: new Set<CanonicalVibe>(['big_city', 'foodie', 'family']),
  PIT: new Set<CanonicalVibe>(['big_city', 'cultural']),
  MOW: new Set<CanonicalVibe>(['big_city', 'cultural', 'nightlife', 'winter']),
  RDU: new Set<CanonicalVibe>(['big_city', 'foodie']),
  ANC: new Set<CanonicalVibe>(['mountains', 'adventure', 'winter']),
  BEG: new Set<CanonicalVibe>(['big_city', 'nightlife', 'cultural']),
};
```

- [ ] **Step 7: Add the 4 curated names to `src/lib/atlas/travelpayouts-client.ts`**

The engine names curated-filler destinations via `IATA_TO_CITY` until Task 3 lands, so the new taxonomy destinations must be curated NOW or a `winter` search would render raw `SLC`/`YVR` codes mid-branch. `ZRH` and `MUC` are already curated. Add, matching each section's style:

In the `// US domestic` block (after `"JAX": "Jacksonville, Florida",`):

```ts
  "SLC": "Salt Lake City, Utah",
  // Canada
  "YVR": "Vancouver, Canada",
```

In the `// Europe` block (after `"ZRH": "Zurich, Switzerland",`):

```ts
  "GVA": "Geneva, Switzerland",
```

and (after `"MAD": "Madrid, Spain",`):

```ts
  "AGP": "Málaga, Spain",
```

- [ ] **Step 8: Rewrite `src/lib/atlas/destination-vibes.test.ts` (migration no-loss + spot checks)**

The old file asserts the pre-fix vocabulary (`CLOSED_VOCABULARY` with `mountain`, 82 keys) — replace it entirely. The no-loss test freezes the OLD table and asserts every destination's new tags are a superset of its old tags with the single rename applied (spec §5 risk: "tag migration silently drops a destination's tags"):

```ts
import { describe, expect, it } from 'vitest';

import type { CanonicalVibe } from '@/lib/trip-types';
import { DESTINATION_VIBES } from './destination-vibes';

// The only rename in the migration. Everything else is purely additive.
const RENAMES: Record<string, string> = { mountain: 'mountains' };

// Frozen pre-fix table (destination-vibes.ts as of 1f2c54d). Test fixture only —
// the singular 'mountain' below is the frozen BUG, not product vocabulary.
const PRE_MIGRATION_TAGS: Record<string, string[]> = {
  CUN: ['tropical', 'beach', 'big_city', 'nightlife', 'romantic'],
  SJU: ['tropical', 'beach', 'big_city', 'cultural', 'nightlife'],
  PUJ: ['tropical', 'beach', 'romantic'],
  MBJ: ['tropical', 'beach', 'romantic', 'adventure'],
  NAS: ['tropical', 'beach', 'romantic'],
  GCM: ['tropical', 'beach', 'romantic'],
  BGI: ['tropical', 'beach', 'romantic', 'cultural'],
  ANU: ['tropical', 'beach', 'romantic'],
  STT: ['tropical', 'beach', 'romantic', 'adventure'],
  STX: ['tropical', 'beach', 'adventure'],
  SXM: ['tropical', 'beach', 'nightlife', 'romantic'],
  PLS: ['tropical', 'beach', 'romantic'],
  SJD: ['tropical', 'beach', 'romantic', 'adventure'],
  PVR: ['tropical', 'beach', 'romantic', 'nightlife'],
  CTG: ['tropical', 'beach', 'cultural', 'romantic'],
  SDQ: ['tropical', 'beach', 'big_city'],
  ZIH: ['tropical', 'beach', 'romantic'],
  HAV: ['tropical', 'beach', 'cultural'],
  MCO: ['beach', 'big_city', 'adventure'],
  MIA: ['beach', 'big_city', 'nightlife', 'tropical'],
  FLL: ['beach', 'tropical'],
  TPA: ['beach'],
  RSW: ['beach'],
  SAN: ['beach', 'big_city', 'foodie'],
  HNL: ['tropical', 'beach', 'romantic', 'adventure'],
  JFK: ['big_city', 'cultural', 'foodie', 'nightlife'],
  LGA: ['big_city', 'cultural', 'foodie', 'nightlife'],
  EWR: ['big_city', 'cultural', 'foodie', 'nightlife'],
  LAX: ['big_city', 'beach', 'cultural', 'foodie', 'nightlife'],
  ORD: ['big_city', 'cultural', 'foodie'],
  LAS: ['nightlife', 'big_city', 'adventure'],
  ATL: ['big_city', 'cultural', 'foodie'],
  DFW: ['big_city', 'foodie'],
  DEN: ['mountain', 'adventure', 'big_city'],
  SEA: ['big_city', 'cultural', 'foodie', 'mountain'],
  BOS: ['big_city', 'cultural', 'foodie'],
  SFO: ['big_city', 'cultural', 'foodie'],
  MSY: ['cultural', 'foodie', 'nightlife'],
  BNA: ['cultural', 'nightlife', 'foodie'],
  AUS: ['cultural', 'nightlife', 'foodie'],
  PDX: ['foodie', 'cultural'],
  PHX: ['adventure', 'mountain'],
  LHR: ['big_city', 'cultural', 'foodie'],
  CDG: ['big_city', 'cultural', 'foodie', 'romantic'],
  FCO: ['big_city', 'cultural', 'foodie', 'romantic'],
  BCN: ['big_city', 'beach', 'cultural', 'foodie', 'nightlife'],
  MAD: ['big_city', 'cultural', 'foodie', 'nightlife'],
  AMS: ['big_city', 'cultural', 'nightlife'],
  LIS: ['big_city', 'cultural', 'foodie', 'beach', 'romantic'],
  ATH: ['cultural', 'beach', 'foodie', 'romantic'],
  IST: ['big_city', 'cultural', 'foodie'],
  DUB: ['cultural', 'foodie'],
  CPH: ['cultural', 'foodie', 'big_city'],
  PRG: ['cultural', 'romantic', 'nightlife'],
  BUD: ['cultural', 'nightlife', 'romantic'],
  KEF: ['adventure', 'romantic'],
  GIG: ['beach', 'big_city', 'cultural', 'nightlife', 'tropical'],
  GRU: ['big_city', 'cultural', 'foodie'],
  EZE: ['big_city', 'cultural', 'foodie', 'nightlife'],
  BOG: ['big_city', 'cultural', 'foodie', 'mountain'],
  MDE: ['big_city', 'cultural', 'foodie', 'mountain'],
  LIM: ['big_city', 'cultural', 'foodie'],
  SJO: ['adventure', 'tropical', 'beach'],
  PTY: ['big_city', 'tropical', 'beach'],
  BZE: ['tropical', 'beach', 'adventure'],
  BKK: ['big_city', 'cultural', 'foodie', 'nightlife', 'tropical'],
  DPS: ['tropical', 'beach', 'cultural', 'romantic', 'adventure'],
  SIN: ['big_city', 'cultural', 'foodie'],
  HKG: ['big_city', 'cultural', 'foodie'],
  NRT: ['big_city', 'cultural', 'foodie'],
  HND: ['big_city', 'cultural', 'foodie'],
  ICN: ['big_city', 'cultural', 'foodie'],
  DXB: ['big_city', 'beach'],
  CMB: ['tropical', 'beach', 'cultural'],
  SYD: ['big_city', 'beach', 'cultural', 'foodie'],
  AKL: ['adventure', 'cultural'],
  CPT: ['big_city', 'beach', 'adventure', 'cultural', 'foodie'],
  NBO: ['adventure', 'cultural'],
  RAK: ['cultural', 'foodie', 'romantic'],
  CAI: ['cultural', 'big_city'],
  HRG: ['beach', 'tropical'],
  SSH: ['beach', 'tropical'],
};

const NEW_CODES = [
  'YVR', 'SLC', 'ZRH', 'GVA', 'MUC', 'AGP',
  'NYC', 'CHI', 'ORL', 'WAS', 'PAR', 'LON', 'YTO', 'HOU', 'PIT', 'MOW', 'RDU', 'ANC', 'BEG',
];

describe('DESTINATION_VIBES (canonical)', () => {
  it('contains every pre-fix destination plus the 19 new codes (101 total)', () => {
    const keys = Object.keys(DESTINATION_VIBES);
    expect(keys).toHaveLength(101);
    for (const code of Object.keys(PRE_MIGRATION_TAGS)) {
      expect(keys, `destination ${code} was dropped by the migration`).toContain(code);
    }
    for (const code of NEW_CODES) {
      expect(keys, `new code ${code} is missing`).toContain(code);
    }
  });

  it('no destination lost information: new tags ⊇ old tags with the rename applied', () => {
    for (const [code, oldTags] of Object.entries(PRE_MIGRATION_TAGS)) {
      for (const oldTag of oldTags) {
        const migrated = RENAMES[oldTag] ?? oldTag;
        expect(
          DESTINATION_VIBES[code].has(migrated as CanonicalVibe),
          `${code} lost tag "${oldTag}" (expected "${migrated}")`
        ).toBe(true);
      }
    }
  });

  it('every destination has a three-letter uppercase key and at least one tag', () => {
    for (const [code, tags] of Object.entries(DESTINATION_VIBES)) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect(tags.size).toBeGreaterThanOrEqual(1);
    }
  });

  it('spot-checks exact editorial tag sets', () => {
    const sorted = (code: string) => [...DESTINATION_VIBES[code]].sort();
    expect(sorted('CUN')).toEqual(['beach', 'big_city', 'family', 'nightlife', 'romantic', 'tropical']);
    expect(sorted('DEN')).toEqual(['adventure', 'big_city', 'mountains', 'winter']);
    expect(sorted('KEF')).toEqual(['adventure', 'mountains', 'romantic', 'winter']);
    // Jose 2026-07-12: Vancouver is NOT a beach destination. No 'beach' here.
    expect(sorted('YVR')).toEqual(['big_city', 'family', 'foodie', 'mountains', 'winter']);
    expect(sorted('ORL')).toEqual(['adventure', 'family']);
    expect(sorted('PAR')).toEqual(['big_city', 'cultural', 'foodie', 'romantic']);
    expect(sorted('ANC')).toEqual(['adventure', 'mountains', 'winter']);
    expect(sorted('NYC')).toEqual(['big_city', 'cultural', 'foodie', 'nightlife', 'romantic']);
  });

  it('exactly one 2-vibe combination is unsatisfiable at overlap 2: tropical+winter (the designed no-match fixture)', () => {
    const all = Object.values(DESTINATION_VIBES);
    const vocabulary = [...new Set(all.flatMap((tags) => [...tags]))].sort();
    const impossible: string[] = [];
    for (let i = 0; i < vocabulary.length; i += 1) {
      for (let j = i + 1; j < vocabulary.length; j += 1) {
        const a = vocabulary[i] as CanonicalVibe;
        const b = vocabulary[j] as CanonicalVibe;
        if (!all.some((tags) => tags.has(a) && tags.has(b))) impossible.push(`${a}+${b}`);
      }
    }
    expect(impossible).toEqual(['tropical+winter']);
  });
});
```

- [ ] **Step 9: Run the guard, pins, and full suite**

Run: `npx vitest run src/lib/atlas/vibe-vocabulary.guard.test.ts src/lib/atlas/destination-vibes.test.ts src/lib/atlas/surprise.test.ts`
Expected: PASS (all).

Then: `npm run test:unit`
Expected: 0 failures, ≥ 167 tests (156 baseline − 4 replaced destination-vibes tests [the current file has FOUR tests, not three — verified] + ~15 new). The existing `surprise.test.ts` fixtures were checked against the new table during planning — `beach,nightlife`, `beach,romantic`, `tropical,beach,romantic`, and the enrichment/wire/http-budget fixtures produce identical results (all edits are additive and new entries sit after existing ones in iteration order). If an enrichment expectation drifts anyway, fix the FIXTURE to the new deterministic ranking — do NOT touch engine code in this task.

- [ ] **Step 10: Commit**

```bash
git add src/lib/trip-types.ts src/components/TripForm.tsx src/lib/atlas/destination-vibes.ts src/lib/atlas/travelpayouts-client.ts src/lib/atlas/vibe-vocabulary.guard.test.ts src/lib/atlas/destination-vibes.test.ts src/lib/atlas/surprise.test.ts docs/superpowers/evidence/2026-07-12-vibe-fix/guard-prefix-failure.txt
git commit -m "fix(vibes): repair the dud Mountains/Winter chips, expose orphan vibes, guard against drift

Two of seven live chips matched nothing (taxonomy said 'mountain', nothing carried
'winter') so 11 of 21 two-vibe combos returned zero — masked for months by the
fabricated fallback this branch removed. The live picker's words are now the
canonical vocabulary (VIBE_OPTIONS, single source of truth), the taxonomy is typed
against it, foodie/romantic/nightlife/family become selectable, 5 genuine ski/winter
destinations + Málaga + 13 TP metro city codes are tagged, the winter chip is
relabeled 'Winter Escapade' (Jose, 2026-07-12), and a regression guard fails the
build on any future drift (pre-fix failure recorded in evidence/)."
```

---

### Task 2: Kill the dead vocabulary sources; localize the 11 chips

Deletes `PRESET_VIBES` + `SurpriseMeQuiz` + `EntryTabs` (and `DestinationSuggestions`, which only `EntryTabs` imports) so a third vocabulary cannot re-emerge, switches the chips to genuinely localized labels (today non-EN users see hardcoded English), and updates the context strip so the raw internal value `big_city` never renders as a pill label.

**Files:**
- Delete: `src/components/EntryTabs.tsx`, `src/components/SurpriseMeQuiz.tsx`, `src/components/DestinationSuggestions.tsx`
- Modify: `src/lib/trip-types.ts` (remove `PRESET_VIBES` + quiz-only exports)
- Modify: `src/components/TripForm.tsx` (i18n labels)
- Create: `src/components/TripForm.test.tsx`
- Modify: `src/components/TripContextStrip.tsx`
- Modify: `messages/{en,es,pt,fr,de,it}/common.json` (+4 vibe labels; −`quiz`/`entryTabs` namespaces)
- Modify: `src/lib/atlas/no-fabrication.test.ts` (dead-code-stays-dead tripwire)
- Modify: `src/lib/help-content.ts` (vibe examples)

**Interfaces:**
- Consumes: `VIBE_OPTIONS`, `VIBE_ICONS`, `CANONICAL_VIBES`, `CanonicalVibe` from `@/lib/trip-types` (Task 1); existing `tripForm.vibes.*` i18n keys.
- Produces: `tripForm.vibes.{foodie,romantic,nightlife,family}` in all six locales (Task 7's clarification card labels vibes through these same keys).

- [ ] **Step 1: Write the failing dead-code tripwire**

Append to `src/lib/atlas/no-fabrication.test.ts` (add `existsSync` to the existing `node:fs` import):

```ts
// The three-mode entry system was rejected 2026-04-10 and its PRESET_VIBES was
// a second, dead vibe vocabulary that fooled two analyses. It is deleted, and
// this guard keeps it deleted. NOTE (anti-self-defeat): this scans exactly one
// product file for "PRESET_VIBES" — never test files or docs — and uses
// existsSync for the components, so nothing here can match the guard itself.
describe("dead entry-system stays dead", () => {
  it.each([
    "src/components/EntryTabs.tsx",
    "src/components/SurpriseMeQuiz.tsx",
    "src/components/DestinationSuggestions.tsx",
  ])("%s stays deleted", (file) => {
    expect(existsSync(resolve(process.cwd(), file)), `${file} has been resurrected`).toBe(false);
  });

  it("trip-types.ts no longer carries a second vibe vocabulary", () => {
    const content = readFileSync(resolve(process.cwd(), "src/lib/trip-types.ts"), "utf-8");
    expect(content).not.toContain("PRESET_VIBES");
  });
});
```

Run: `npx vitest run src/lib/atlas/no-fabrication.test.ts` → Expected: the 4 new assertions FAIL (files exist, `PRESET_VIBES` present); everything else passes.

- [ ] **Step 2: Verify zero importers, then delete**

```bash
grep -rn "EntryTabs" src tests --include="*.ts" --include="*.tsx" | grep -v "no-fabrication.test"
grep -rn "SurpriseMeQuiz\|from ['\"]./DestinationSuggestions['\"]" src tests --include="*.ts" --include="*.tsx" | grep -v "no-fabrication.test"
grep -rn "PRESET_VIBES\|QuizAnswers\|QuizBudgetTier\|QuizWhen\|QuizWho\|BUDGET_TIERS\|QUIZ_WHO_OPTIONS\|EntryMode" src tests --include="*.ts" --include="*.tsx"
```

Expected (verified during planning): the first two match only the three doomed files themselves (`EntryTabs.tsx` imports the other two); the third matches only `trip-types.ts`, the doomed files, and the Step-1 tripwire you just wrote in `no-fabrication.test.ts` (it names `PRESET_VIBES` in order to ban it — that match is expected and stays). `DestinationSuggestion` **singular** in `travelpayouts-client.ts` is a different, live interface — do not touch it. If any OTHER file matches, STOP and flag before deleting.

```bash
git rm src/components/EntryTabs.tsx src/components/SurpriseMeQuiz.tsx src/components/DestinationSuggestions.tsx
```

Then replace `src/lib/trip-types.ts` in full with (this deletes `EntryMode`, the `Quiz*` types, `DestinationSuggestion`, `BUDGET_TIERS`, `QUIZ_WHO_OPTIONS`, and `PRESET_VIBES` — their only consumers just died; `TrendingDestination` stays for `src/config/destinations.ts`):

```ts
// Shared trip-planning constants and types.

export interface TrendingDestination {
  city: string;
  country: string;
  code: string; // airport code
  image: string;
  viatorDestId?: string;
  gygLocationId?: string;
  discoverCarsSlug?: string;
  articleSlug?: string;
}

// The canonical vibe vocabulary — the single source of truth for every vibe a
// user can pick anywhere in the product. The taxonomy in
// src/lib/atlas/destination-vibes.ts is typed against CanonicalVibe (a stray
// tag is a compile error) and vibe-vocabulary.guard.test.ts fails the build if
// picker and taxonomy ever drift apart again.
export const CANONICAL_VIBES = [
  'tropical', 'mountains', 'big_city', 'beach', 'winter', 'cultural', 'adventure',
  'foodie', 'romantic', 'nightlife', 'family',
] as const;

export type CanonicalVibe = (typeof CANONICAL_VIBES)[number];

export const VIBE_ICONS: Record<CanonicalVibe, string> = {
  tropical: '🌴',
  mountains: '🏔️',
  big_city: '🏙️',
  beach: '🌊',
  winter: '❄️',
  cultural: '🏛️',
  adventure: '🏕️',
  foodie: '🍜',
  romantic: '💕',
  nightlife: '🎶',
  family: '👨‍👩‍👧‍👦',
};

// English default labels; the UI renders localized labels from
// messages/*/common.json tripForm.vibes (same keys).
export const VIBE_LABELS: Record<CanonicalVibe, string> = {
  tropical: 'Tropical',
  mountains: 'Mountains',
  big_city: 'Big City',
  beach: 'Beach',
  winter: 'Winter Escapade',
  cultural: 'Cultural',
  adventure: 'Adventure',
  foodie: 'Food',
  romantic: 'Romantic',
  nightlife: 'Nightlife',
  family: 'Family',
};

export const VIBE_OPTIONS: { value: CanonicalVibe; label: string; icon: string }[] =
  CANONICAL_VIBES.map((value) => ({ value, label: VIBE_LABELS[value], icon: VIBE_ICONS[value] }));
```

Run: `npx vitest run src/lib/atlas/no-fabrication.test.ts` → Expected: PASS.

- [ ] **Step 3: Delete the dead i18n namespaces**

In EACH of `messages/{en,es,pt,fr,de,it}/common.json`, delete the entire `"quiz": { ... },` and `"entryTabs": { ... },` blocks by hand (they are contiguous; zero consumers — verified: no `useTranslations("quiz")` / `useTranslations("entryTabs")` anywhere; the two `quiz_budget` mentions in e2e are DB-column DTO checks, unrelated). Do NOT round-trip the files through a formatter — edit surgically to keep the diff reviewable. Then validate:

```bash
for f in messages/*/common.json; do python3 -m json.tool "$f" > /dev/null && echo "OK $f"; done
```

Expected: `OK` × 6.

- [ ] **Step 4: Relabel `winter` to "Winter Escapade" and add the 4 new vibe labels, in all six locales**

**The relabel is Jose's binding decision (2026-07-12, spec §3.1, review B1).** "Winter Escape ❄️" was ambiguous — escape *to* winter (ski) or escape *from* winter (somewhere warm)? An **escapade** is something you go *on*, so "Winter Escapade" unambiguously means a snow/ski adventure and ❄️ is correct. This is a LABEL cascade only: the internal value stays `winter`, the icon stays ❄️, no engine change.

In each locale's `tripForm.vibes` block, do BOTH of the following (the other 6 existing entries stay exactly as they are):

**(a) UPDATE the `winter` entry:**

| locale | old | new |
|---|---|---|
| en | `"winter": "Winter Escape"` | `"winter": "Winter Escapade"` |
| es | `"winter": "Escape de Invierno"` | `"winter": "Escapada de Invierno"` |
| pt | `"winter": "Fuga de Inverno"` | `"winter": "Escapada de Inverno"` |
| fr | `"winter": "Escapade Hivernale"` | **unchanged — already the escapade reading** |
| de | `"winter": "Winterflucht"` | `"winter": "Winterabenteuer"` (Winterflucht is literally "flight FROM winter" — the reading Jose rejected) |
| it | `"winter": "Fuga Invernale"` | `"winter": "Avventura Invernale"` (Fuga = escape/flight — same problem) |

⚠ The es/pt/de/it strings are the planner's renderings of Jose's English decision — **confirm these four strings with Jose at plan review** (en is Jose's own wording; fr needs no change).

**(b) Append the 4 new keys after `"adventure"`:**

**en:** `"foodie": "Food", "romantic": "Romantic", "nightlife": "Nightlife", "family": "Family"`
**es:** `"foodie": "Gastronomía", "romantic": "Romántico", "nightlife": "Vida Nocturna", "family": "En Familia"`
**pt:** `"foodie": "Gastronomia", "romantic": "Romântico", "nightlife": "Vida Noturna", "family": "Em Família"`
**fr:** `"foodie": "Gastronomie", "romantic": "Romantique", "nightlife": "Vie Nocturne", "family": "En Famille"`
**de:** `"foodie": "Kulinarik", "romantic": "Romantisch", "nightlife": "Nachtleben", "family": "Familie"`
**it:** `"foodie": "Gastronomia", "romantic": "Romantico", "nightlife": "Vita Notturna", "family": "In Famiglia"`

Re-run the JSON validation loop → `OK` × 6.

- [ ] **Step 5: Write the failing picker test — `src/components/TripForm.test.tsx`**

This is the user-facing half of the orphan fix: the chips must actually render and toggle. Uses the ES locale so it also proves labels are genuinely localized (pre-fix, labels were hardcoded English).

```tsx
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import esMessages from "../../messages/es/common.json";
import { CANONICAL_VIBES } from "@/lib/trip-types";
import TripForm from "./TripForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/usePlacesAutocomplete", () => ({ usePlacesAutocomplete: () => {} }));
vi.mock("./PackageDealsCarousel", () => ({ default: () => null }));

const vibeLabels = esMessages.tripForm.vibes as Record<string, string>;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderExploreForm() {
  // preferences prefetch on mount — keep it inert
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
  render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <TripForm />
    </NextIntlClientProvider>
  );
  fireEvent.click(screen.getByText(esMessages.tripForm.pathBTitle));
}

// Labels like "Aventura" also exist in the INTERESTS section — scope every
// query to the vibes section (its heading is tripForm.whatVibes).
function vibesSection() {
  const heading = screen.getByText(esMessages.tripForm.whatVibes);
  return within(heading.closest("div") as HTMLElement);
}

describe("TripForm vibe picker (canonical, localized)", () => {
  it("renders all 11 canonical vibes as chips with localized labels", () => {
    renderExploreForm();

    expect(CANONICAL_VIBES).toHaveLength(11);
    for (const vibe of CANONICAL_VIBES) {
      expect(vibeLabels[vibe], `missing es translation for tripForm.vibes.${vibe}`).toBeTruthy();
      expect(
        vibesSection().getByRole("button", { name: new RegExp(vibeLabels[vibe]) }),
        `chip for "${vibe}" not rendered`
      ).toBeTruthy();
    }
  });

  it("the previously unreachable vibes are selectable", () => {
    renderExploreForm();

    for (const vibe of ["foodie", "romantic", "nightlife", "family"]) {
      const chip = vibesSection().getByRole("button", { name: new RegExp(vibeLabels[vibe]) });
      fireEvent.click(chip);
      expect(chip.className, `"${vibe}" chip did not toggle selected`).toContain("bg-pink-100");
    }
  });
});
```

*(Query note: within the vibes section, "Tropical" is unique — the interests section's similar words live outside the scoped container. If a regex still double-matches (e.g., a label that is a substring of another chip's label in some locale), anchor it: `new RegExp(\`${label}$\`)`.)*

Run: `npx vitest run src/components/TripForm.test.tsx`
Expected: FAIL — chips currently render `v.label` (English), so `getByRole` with "Montañas"/"Gastronomía" finds nothing.

- [ ] **Step 6: Localize the chip labels in `TripForm.tsx`**

In the vibes render loop, change the button text from `{v.icon} {v.label}` to:

```tsx
                  {v.icon} {t(`vibes.${v.value}`)}
```

(`t` is the component's existing `useTranslations("tripForm")`.)

Run: `npx vitest run src/components/TripForm.test.tsx` → Expected: PASS.

- [ ] **Step 7: Localize the context-strip vibe pills — `src/components/TripContextStrip.tsx`**

Today a trip's pills render the raw internal value (`big_city`) — exactly the class of leak Jose banned. Replace the `VIBE_EMOJIS` constant (delete it) with imports and localized labels:

```tsx
import { CANONICAL_VIBES, VIBE_ICONS, type CanonicalVibe } from "@/lib/trip-types";

const CANONICAL = new Set<string>(CANONICAL_VIBES);
```

Inside the component add `const tVibes = useTranslations("tripForm.vibes");` next to the existing `t`, and change the vibe pill body from

```tsx
          {VIBE_EMOJIS[vibe] ? `${VIBE_EMOJIS[vibe]} ` : ""}
          {vibe}
```

to

```tsx
          {CANONICAL.has(vibe)
            ? `${VIBE_ICONS[vibe as CanonicalVibe]} ${tVibes(vibe)}`
            : vibe}
```

(Custom vibes render as the user typed them — their own words, not codes.)

- [ ] **Step 8: Update the help copy — `src/lib/help-content.ts`** (standing rule `feedback_update_help_with_features`)

In the `"planner-new"` entry's `"Where are you going?"` section (line ~25), replace the parenthetical `pick a vibe (Tropical, Mountains, Beach, etc.)` with `pick one or more vibes (Beach, Mountains, Winter Escapade, Food, Romantic, Nightlife, Family, and more)`.

- [ ] **Step 9: Full suite + build + commit**

Run: `npm run test:unit` → all pass (≥ 170). Then `npm run build` → clean (proves nothing still imports the deleted components).

```bash
git add -A src/components src/lib/trip-types.ts src/lib/atlas/no-fabrication.test.ts src/lib/help-content.ts messages
git commit -m "feat(vibes): 11 localized chips from one VIBE_OPTIONS source; delete dead quiz/EntryTabs vocabulary

foodie/romantic/nightlife/family become clickable (39/24/21/20 destinations of data
that no user could reach). Chip labels are genuinely localized (were hardcoded
English) and the winter chip reads 'Winter Escapade' in all six locales (Jose,
2026-07-12 — an escapade is something you go ON: snow/ski, not winter-sun).
PRESET_VIBES + SurpriseMeQuiz + EntryTabs + DestinationSuggestions deleted
(zero importers, rejected 2026-04-10) with a stays-dead tripwire; context-strip
pills stop rendering raw internal values like big_city."
```

---

### Task 3: City naming — generated table, `resolveCityName()`, and drop-don't-render

TP returns CITY codes; 62 of 100 sampled codes are absent from `IATA_TO_CITY` and render as raw codes ("Plan a trip to CHI"). This task derives a full name table from TravelPayouts' OWN data, keeps the curated table primary, drops anything unnameable, and dedupes/excludes by city so a JFK user is never offered "New York".

**Files:**
- Create: `scripts/generate-city-names.mjs`
- Create: `src/lib/atlas/generated/city-names.json` (script output)
- Create: `src/lib/atlas/city-names.ts`
- Create: `src/lib/atlas/city-names.test.ts`
- Modify: `src/lib/atlas/surprise.ts`
- Modify: `src/lib/atlas/surprise.test.ts` (naming/drop tests)
- Modify: `src/lib/atlas/vibe-vocabulary.guard.test.ts` (resolve the `TODO(task-3)`)
- Modify: `src/lib/atlas/no-fabrication.test.ts` (`SURPRISE_PATH_FILES` += `city-names.ts`)

**Interfaces:**
- Consumes: `IATA_TO_CITY` from `./travelpayouts-client` (unchanged apart from Task 1's 4 additions).
- Produces: `resolveCityName(code: string): string | null` from `@/lib/atlas/city-names` (server-only). Task 5 uses it for `originName`; this task wires it into every card-name path in `surprise.ts`.

**Provenance (why a script, not a blob):** the table derives from TravelPayouts' public data endpoints (`https://api.travelpayouts.com/data/en/{cities,airports,countries}.json`, no token required). Recipe, validated against live TP data on 2026-07-12 and re-validated against the cached copies: *every city in `cities.json` with ≥ 1 entry in `airports.json` (matched on `city_code`; ALL airport-table rows count — TP lists metro codes as pseudo-airports, so "is it an airport code" is deliberately NOT a filter), labeled `"{city name}, {country name}"` with whitespace collapsed, plus `" (all airports)"` when the city has ≥ 2 airport rows.* Cities with zero airport rows are excluded (they cannot be flight destinations). **Measured output: 9,471 entries, 545 suffixed** (2026-07-12; upstream drifts, so tests assert invariants, not exact counts). Measured spot values: `CHI → "Chicago, United States (all airports)"`, `NYC → "New York, United States (all airports)"`, `WAS → "Washington, United States (all airports)"`, `PAR → "Paris, France (all airports)"`, `ORL → "Orlando, United States (all airports)"`, `HNL → "Honolulu, United States"` (single airport). The three source files are cached at `/tmp/claude-1000/-home-jarvis/661731b7-02cd-4330-b3ce-88b51f589913/scratchpad/{cities,airports,countries}.json` — if the network is unavailable, run the script with `TP_DATA_DIR=` pointing there.

- [ ] **Step 1: Write `scripts/generate-city-names.mjs`**

```js
#!/usr/bin/env node
// Regenerates src/lib/atlas/generated/city-names.json from TravelPayouts' own
// public data (no token needed).
//   Run:            node scripts/generate-city-names.mjs
//   Offline rerun:  TP_DATA_DIR=/path/to/cached node scripts/generate-city-names.mjs
//
// Recipe (do not change without updating city-names.test.ts):
//   - source of truth: api.travelpayouts.com/data/en/{cities,airports,countries}.json
//   - include every city that has >= 1 entry in airports.json (city_code match).
//     ALL airport-table rows count: TP lists metro codes and pseudo-stations
//     there, and that is exactly the population its price API can return.
//   - label: "{city name}, {country name}" (whitespace collapsed)
//   - ">= 2 airports" => append " (all airports)" — a CHI price may be O'Hare
//     OR Midway; printing bare "Chicago" would invite a false assumption.
//     Never remap a metro code to one airport: that would fabricate precision.
//   - a city we cannot label (missing name/country) is omitted: the runtime
//     DROPS unnameable codes rather than showing them.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://api.travelpayouts.com/data/en";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "atlas", "generated");
const OUT = join(OUT_DIR, "city-names.json");

async function getJson(name) {
  if (process.env.TP_DATA_DIR) {
    return JSON.parse(await readFile(join(process.env.TP_DATA_DIR, name), "utf-8"));
  }
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`${name} -> HTTP ${res.status}`);
  return res.json();
}

const [cities, airports, countries] = await Promise.all([
  getJson("cities.json"),
  getJson("airports.json"),
  getJson("countries.json"),
]);

const countryName = new Map(countries.map((c) => [c.code, c.name]));

const airportCount = new Map();
for (const airport of airports) {
  const cityCode = airport.city_code;
  if (cityCode) airportCount.set(cityCode, (airportCount.get(cityCode) ?? 0) + 1);
}

const table = {};
for (const city of cities) {
  const code = city.code;
  const name = (city.name ?? "").replace(/\s+/g, " ").trim();
  const country = countryName.get(city.country_code);
  const count = airportCount.get(code) ?? 0;
  if (!code || !name || !country || count === 0) continue;
  table[code] = `${name}, ${country}${count >= 2 ? " (all airports)" : ""}`;
}

const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, `${JSON.stringify(sorted, null, 1)}\n`);
console.log(
  `wrote ${Object.keys(sorted).length} city names (${Object.values(sorted).filter((v) => v.endsWith("(all airports)")).length} multi-airport) to ${OUT}`
);
```

- [ ] **Step 2: Generate the table**

```bash
node scripts/generate-city-names.mjs
```

Expected output: `wrote 9471 city names (545 multi-airport) to .../src/lib/atlas/generated/city-names.json` (small upstream drift acceptable; > 9,000 and > 400 is the sanity band). If the fetch fails: `TP_DATA_DIR=/tmp/claude-1000/-home-jarvis/661731b7-02cd-4330-b3ce-88b51f589913/scratchpad node scripts/generate-city-names.mjs` → exactly 9471/545.

- [ ] **Step 3: Write the failing tests — `src/lib/atlas/city-names.test.ts`**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveCityName } from "./city-names";
import generated from "./generated/city-names.json";

describe("resolveCityName", () => {
  it("curated names win over generated ones", () => {
    expect(resolveCityName("JFK")).toBe("New York, New York");
    expect(resolveCityName("BNA")).toBe("Nashville, Tennessee");
    // YVR exists in BOTH tables — curated ("Vancouver, Canada") must win over
    // the generated "Vancouver, Canada (all airports)".
    expect(resolveCityName("YVR")).toBe("Vancouver, Canada");
  });

  it("resolves TP metro city codes via the generated table with the honest multi-airport suffix", () => {
    expect(resolveCityName("CHI")).toBe("Chicago, United States (all airports)");
    expect(resolveCityName("NYC")).toBe("New York, United States (all airports)");
    expect(resolveCityName("WAS")).toBe("Washington, United States (all airports)");
    expect(resolveCityName("PAR")).toBe("Paris, France (all airports)");
  });

  it("single-airport cities get no suffix", () => {
    expect(resolveCityName("HNL")).toBe("Honolulu, United States");
  });

  it("returns null for codes it cannot name — callers must DROP, never render the code", () => {
    expect(resolveCityName("ZZZ")).toBeNull();
    expect(resolveCityName("")).toBeNull();
    expect(resolveCityName("TOOLONG")).toBeNull();
  });

  it("is case/whitespace tolerant", () => {
    expect(resolveCityName(" chi ")).toBe("Chicago, United States (all airports)");
  });
});

describe("generated table sanity (regenerable via scripts/generate-city-names.mjs)", () => {
  const entries = Object.entries(generated as Record<string, string>);

  it("has broad coverage and honest multi-airport labeling", () => {
    expect(entries.length).toBeGreaterThan(9000);
    expect(entries.filter(([, v]) => v.endsWith(" (all airports)")).length).toBeGreaterThan(400);
  });

  it("every key is a 3-letter code and every value is a real label, never a bare code", () => {
    for (const [code, label] of entries) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect(label).toMatch(/, /); // "City, Country" shape
      expect(label).not.toMatch(/^[A-Z]{3}$/);
    }
  });
});

describe("server-only guard", () => {
  it("city-names.ts keeps its server-only import (client bundles must never carry ~290 KB of names)", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/atlas/city-names.ts"), "utf-8");
    expect(source).toContain('import "server-only";');
  });
});
```

Run: `npx vitest run src/lib/atlas/city-names.test.ts` → Expected: FAIL — `Cannot find module './city-names'`.

- [ ] **Step 4: Implement `src/lib/atlas/city-names.ts`**

```ts
import "server-only";

import { IATA_TO_CITY } from "./travelpayouts-client";
import generatedNames from "./generated/city-names.json";

// Two-tier destination naming. Curated IATA_TO_CITY (~131 hand-written labels
// like "Nashville, Tennessee") is primary; the generated TravelPayouts-derived
// table (~9,400 entries, see scripts/generate-city-names.mjs for provenance)
// is second. null means "we cannot honestly name this code" — callers must
// DROP the destination. A raw code must never reach a user.
const GENERATED: Record<string, string> = generatedNames;

export function resolveCityName(code: string): string | null {
  const cleaned = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(cleaned)) return null;
  return IATA_TO_CITY[cleaned] ?? GENERATED[cleaned] ?? null;
}
```

Run: `npx vitest run src/lib/atlas/city-names.test.ts` → Expected: PASS (vitest resolves `server-only` via the existing alias in `vitest.config.ts`).

- [ ] **Step 5: Write the failing engine tests (naming + drop + same-city exclusion on BOTH the ranking path and the curated filler) in `src/lib/atlas/surprise.test.ts`**

Append:

```ts
describe("DESTINATION NAMING: no raw code ever reaches a card", () => {
  it("names TP metro city codes and drops unnameable codes instead of rendering them", async () => {
    popular([item("ZZZ", 80), item("CHI", 120), item("ORL", 140), item("CUN", 160)]);

    const result = await getSurpriseDestinations({ origin: "JFK", departMonth: "2026-08" });

    const names = result.destinations.map((d) => d.name);
    expect(names).toContain("Chicago, United States (all airports)");
    expect(names).toContain("Orlando, United States (all airports)");
    for (const name of names) {
      expect(name).not.toMatch(/^[A-Z]{3}$/);
    }
    expect(names.join("|")).not.toContain("ZZZ");
  });

  it("excludes destinations in the origin's own city (JFK origin must not be offered NYC or LGA)", async () => {
    popular([item("NYC", 60), item("LGA", 70), item("CUN", 120), item("MBJ", 150), item("TPA", 90)]);

    const result = await getSurpriseDestinations({ origin: "JFK", departMonth: "2026-08" });

    expect(result.destinations.map((d) => d.name).join("|")).not.toContain("New York");
    expect(result.destinations).toHaveLength(3);
  });

  it("the curated FILLER also excludes the origin's own city (a JFK user must never be offered LaGuardia)", async () => {
    // Review I5: the popular-routes exclusion above never exercises the filler.
    // Without the filler-side exclusion (Step 6 change 4), LGA — overlap-2 for
    // big_city+cultural and early in insertion order — is offered to a JFK
    // user as "New York (LaGuardia)". This test pins the filler path itself.
    emptyPopular();
    vi.mocked(rawSearchFlights).mockResolvedValue({ flights: [] });

    const result = await getSurpriseDestinations({ origin: "JFK", vibes: "big_city,cultural", departMonth: "2026-08" });

    expect(result.destinations.length).toBeGreaterThanOrEqual(1);
    expect(result.destinations.map((d) => d.name).join("|")).not.toContain("New York");
  });
});
```

(`emptyPopular()` and the `rawSearchFlights` module mock already exist in `surprise.test.ts` — verified.)

Run: `npx vitest run src/lib/atlas/surprise.test.ts` → Expected: the three new tests FAIL (`ZZZ` currently renders as the bare code; `NYC`/`LGA` render as destinations from JFK; the filler offers "New York (LaGuardia)").

- [ ] **Step 6: Wire naming into `src/lib/atlas/surprise.ts`**

Four exact changes:

1. Add the import (after the existing imports) and a city-key helper (near `overlapCount`):

```ts
import { resolveCityName } from "./city-names";
```

```ts
// "New York, New York", "New York (LaGuardia)" and "New York, United States
// (all airports)" are the same place for trip purposes: compare on the city
// part, trailing parenthetical stripped.
function cityKey(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").split(",")[0].trim().toLowerCase();
}
```

2. Change `toDestination` to take the already-resolved name — the `IATA_TO_CITY[route.destination] ?? route.destination` escape hatch WAS the raw-code leak:

```ts
function toDestination(route: RouteCandidate, name: string, isRoundTrip: boolean): SurpriseDestination {
  return {
    name,
    flightPrice: priceLabel(route.price, isRoundTrip),
    airline: route.airline,
    nonstop: route.transfers === 0,
    link: route.link,
  };
}
```

3. Immediately after the `seenCodes` dedupe loop that builds `candidates`, resolve names, drop unnameables, and drop the origin's own city; then replace the existing vibe-ranking block and the card slice:

```ts
  const originResolved = resolveCityName(origin);
  const originCityKey = originResolved ? cityKey(originResolved) : null;

  let namedCandidates = candidates
    .map((route) => ({ route, name: resolveCityName(route.destination) }))
    .filter((entry): entry is { route: RouteCandidate; name: string } => entry.name !== null)
    .filter(({ name }) => originCityKey === null || cityKey(name) !== originCityKey);

  if (requestedVibes.size > 0) {
    const minOverlap = requestedVibes.size >= 2 ? 2 : 1;
    namedCandidates = namedCandidates
      .map((entry) => ({
        ...entry,
        overlap: overlapCount(requestedVibes, DESTINATION_VIBES[entry.route.destination]),
      }))
      .filter(({ overlap }) => overlap >= minOverlap)
      .sort((a, b) => b.overlap - a.overlap)
      .map(({ route, name }) => ({ route, name }));
  }

  const destinations: SurpriseDestination[] = namedCandidates
    .slice(0, 3)
    .map(({ route, name }) => toDestination(route, name, isRoundTrip));
```

(The upstream `candidates` build loop stays as-is. Since `candidates` is no longer reassigned, change its declaration from `let` to `const` — `push` still works and it avoids a new `prefer-const` lint warning. The `minOverlap` const stays local in this task; Task 5 hoists it.)

4. In the curated-filler section, replace **both** occurrences of `const cityName = IATA_TO_CITY[code] ?? code;` (the enrichment-selection loop and the final fill loop) with:

```ts
      const cityName = resolveCityName(code);
      if (!cityName) continue;
      if (originCityKey !== null && cityKey(cityName) === originCityKey) continue;
```

and make the filler's `seen` set operate on city keys: initialize `const seen = new Set(destinations.map((destination) => cityKey(destination.name)));`, check `if (seen.has(cityKey(cityName))) continue;`, add with `seen.add(cityKey(cityName));`. Remove the now-unused `IATA_TO_CITY` import from `surprise.ts` if nothing else in the file uses it (lint enforces this).

Run: `npx vitest run src/lib/atlas/surprise.test.ts` → Expected: PASS, including all three Step-5 tests (the filler-exclusion test proves Step-6 change 4 actually landed — review I5).

- [ ] **Step 7: Resolve the nameability TODO in the guard**

In `src/lib/atlas/vibe-vocabulary.guard.test.ts`, replace the `TODO(task-3)` comment with:

```ts
  it("every taxonomy destination resolves to a display name (unnameable = invisible to users)", async () => {
    const { resolveCityName } = await import("./city-names");
    for (const code of Object.keys(DESTINATION_VIBES)) {
      expect(resolveCityName(code), `taxonomy code ${code} has no display name`).not.toBeNull();
    }
  });
```

Also extend `SURPRISE_PATH_FILES` in `src/lib/atlas/no-fabrication.test.ts` with `"src/lib/atlas/city-names.ts",`.

- [ ] **Step 8: Decode the on-screen origin — trip header + context-strip pill (G4 Scope, review I1)**

Two render paths still leak bare codes after the card-name work above: the trip header (`page.tsx:72` renders `· ✈️ from JFK`) and the context-strip origin pill (`TripContextStrip.tsx:70-79` renders `✈️ JFK (+ EWR, LGA)`). `TripContextStrip` is a client component and `resolveCityName` is `server-only`, so `page.tsx` (a server component — direct import is legal) resolves the names and passes display-ready strings down.

**(a) Failing test first — create `src/components/TripContextStrip.test.tsx`:**

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import enMessages from "../../messages/en/common.json";
import TripContextStrip from "./TripContextStrip";

afterEach(cleanup);

function renderStrip(props: Partial<Parameters<typeof TripContextStrip>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <TripContextStrip
        originLabel="New York, New York (JFK)"
        extraAirportLabels={["Newark, New Jersey", "New York (LaGuardia)"]}
        budget="midrange"
        vibes={["big_city"]}
        interests={[]}
        adults={2}
        childrenCount={0}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

describe("TripContextStrip origin pill (decoded — G4)", () => {
  it("renders the decoded origin city (code alongside the name is fine — never bare) and decoded nearby airports", () => {
    renderStrip();
    expect(screen.getByText(/New York, New York \(JFK\)/)).toBeTruthy();
    expect(screen.getByText(/Newark, New Jersey/)).toBeTruthy();
    expect(screen.getByText(/LaGuardia/)).toBeTruthy();
    // the old raw nearby-airport codes must be gone
    expect(screen.queryByText(/EWR|LGA\b/)).toBeNull();
  });

  it("renders NO origin pill when the origin has no decoded label — a bare code is never the fallback", () => {
    renderStrip({ originLabel: null, extraAirportLabels: [] });
    expect(screen.queryByText(/JFK/)).toBeNull();
  });
});
```

Run: `npx vitest run src/components/TripContextStrip.test.tsx` → Expected: FAIL (the component still takes `origin`/`nearbyAirports` code props and renders them raw).

**(b) `src/components/TripContextStrip.tsx`** — first verify `page.tsx` is the only importer (verified during planning; re-check):

```bash
grep -rn "TripContextStrip" src tests --include="*.ts" --include="*.tsx" | grep -v "components/TripContextStrip"
```

Then replace the props `origin: string | null` and `nearbyAirports: string[]` with `originLabel: string | null` and `extraAirportLabels: string[]`, delete the internal `extraAirports` filter (moves server-side), and change the origin pill to:

```tsx
      {originLabel && (
        <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs">
          {"✈️"} {originLabel}
          {extraAirportLabels.length > 0 && (
            <span className="ml-1 text-amber-600">
              (+ {extraAirportLabels.join(" · ")})
            </span>
          )}
        </span>
      )}
```

(Joined with `" · "`, not `", "` — decoded labels like "Newark, New Jersey" contain commas.)

**(c) `src/app/[locale]/planner/[tripId]/page.tsx`** — add `import { resolveCityName } from "@/lib/atlas/city-names";`, then next to the existing `vibesSummary` derivation add:

```tsx
  // G4: decode the origin server-side. Unnameable ⇒ the phrase is OMITTED —
  // a bare 3-letter code must never be the fallback (Jose, 2026-07-12).
  const originName = trip.origin ? resolveCityName(trip.origin) : null;
  const originLabel = originName ? `${originName} (${trip.origin})` : null;
  const extraAirportLabels = nearbyAirports
    .filter((code) => code !== trip.origin)
    .map((code) => resolveCityName(code))
    .filter((name): name is string => name !== null);
```

In the header, replace `{trip.origin && ` · ✈️ from ${trip.origin}`}` with `{originLabel && ` · ✈️ from ${originLabel}`}` — e.g. "✈️ from New York, New York (JFK)". In the `<TripContextStrip>` invocation, replace `origin={trip.origin || null}` and `nearbyAirports={nearbyAirports}` with `originLabel={originLabel}` and `extraAirportLabels={extraAirportLabels}`. (The `atlas-trip-context` JSON script keeps `origin`/`nearbyAirports` raw — that is model context, part of the Jose-approved chat gap, NOT rendered UI. Do not touch it.)

Run: `npx vitest run src/components/TripContextStrip.test.tsx` → PASS. (Visual-baseline safety: the snapshot trips are Path A "Cancún" with no origin — no pill, no header phrase — so `visual-baseline.spec.ts` cannot diff. Verified by the reviewer.)

- [ ] **Step 9: Full suite + build gate**

Run: `npm run test:unit` → all pass. (Existing enrichment/wire tests keep passing: every code they use is curated, and the origin-city exclusion only removes same-city codes those fixtures don't rely on.)

Run: `npm run build` → clean. This is the enforcement mechanism for server-only: if anyone imports `city-names.ts` from a `"use client"` component, Next.js fails the build with the server-only poison error. It also proves `page.tsx`'s new `resolveCityName` import is server-side only.

- [ ] **Step 10: Commit**

```bash
git add scripts/generate-city-names.mjs src/lib/atlas/generated/city-names.json src/lib/atlas/city-names.ts src/lib/atlas/city-names.test.ts src/lib/atlas/surprise.ts src/lib/atlas/surprise.test.ts src/lib/atlas/vibe-vocabulary.guard.test.ts src/lib/atlas/no-fabrication.test.ts src/components/TripContextStrip.tsx src/components/TripContextStrip.test.tsx src/app
git commit -m "feat(surprise): name every destination or drop it — no raw code reaches a user

9.4k-entry name table generated from TravelPayouts' own city/airport/country data
(scripts/generate-city-names.mjs documents the recipe; offline rerun supported),
server-only, curated IATA_TO_CITY primary. Multi-airport metro codes get an honest
'(all airports)' suffix — a CHI price may be O'Hare OR Midway, and we never remap
it to one airport. Unnameable codes and the origin's own city are dropped, never
rendered — on the ranking path AND the curated filler. The trip header and
context-strip origin pill render decoded names (never a bare code; unnameable
origins are omitted), per Jose's G4 decision."
```

(`git add src/app` captures the `[locale]`-bracketed `page.tsx` path without pathspec-glob trouble; at this point in the plan it contains no other changes.)

---

### Task 4: `vibe-preflight.ts` — deterministic intent check (zero LLM)

**Files:**
- Create: `src/lib/atlas/vibe-preflight.ts`
- Create: `src/lib/atlas/vibe-preflight.test.ts`
- Modify: `src/lib/atlas/no-fabrication.test.ts` (`SURPRISE_PATH_FILES` += `vibe-preflight.ts`)

**Interfaces:**
- Consumes: `CANONICAL_VIBES`, `CanonicalVibe` from `@/lib/trip-types`; `DESTINATION_VIBES` from `./destination-vibes`.
- Produces (Tasks 5 and 7 depend on these exact names):

```ts
export type PreflightResult =
  | { status: "ok" }
  | { status: "unknown_vibes"; unknown: string[]; suggestions: CanonicalVibe[] }
  | { status: "no_match_possible"; wouldMatchIfAny: number };

export function preflightVibes(vibes: string[], opts?: { matchMode?: "all" | "any" }): PreflightResult;
export function suggestVibes(input: string): CanonicalVibe[];
```

- [ ] **Step 1: Write the failing tests — `src/lib/atlas/vibe-preflight.test.ts`**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { DESTINATION_VIBES } from "./destination-vibes";
import { preflightVibes, suggestVibes } from "./vibe-preflight";

describe("preflightVibes", () => {
  it("returns ok for empty input and for canonical vibes that can match", () => {
    expect(preflightVibes([])).toEqual({ status: "ok" });
    expect(preflightVibes(["beach"])).toEqual({ status: "ok" });
    expect(preflightVibes(["mountains", "cultural"])).toEqual({ status: "ok" });
    expect(preflightVibes(["winter", "cultural"])).toEqual({ status: "ok" });
  });

  it("flags free-text custom vibes as unknown with canonical suggestions", () => {
    const result = preflightVibes(["wine tasting", "beach"]);
    expect(result.status).toBe("unknown_vibes");
    if (result.status !== "unknown_vibes") throw new Error("unreachable");
    expect(result.unknown).toEqual(["wine tasting"]);
    expect(result.suggestions).toContain("foodie");
  });

  it("maps everyday English words that are not internal values to suggestions", () => {
    const city = preflightVibes(["city"]);
    expect(city.status).toBe("unknown_vibes");
    if (city.status !== "unknown_vibes") throw new Error("unreachable");
    expect(city.suggestions).toContain("big_city");

    const nature = preflightVibes(["nature"]);
    if (nature.status !== "unknown_vibes") throw new Error("unreachable");
    expect(nature.suggestions).toContain("mountains");
  });

  it("suggests via small-typo tolerance", () => {
    const result = preflightVibes(["cultral"]);
    expect(result.status).toBe("unknown_vibes");
    if (result.status !== "unknown_vibes") throw new Error("unreachable");
    expect(result.suggestions).toContain("cultural");
  });

  // Both genuinely impossible pairs must route here. beach+winter joined
  // tropical+winter when Vancouver lost its 'beach' tag (Jose, 2026-07-12).
  it.each([["tropical"], ["beach"]])(
    "detects the genuinely impossible combination (%s+winter) as no_match_possible",
    (other) => {
      expect(preflightVibes([other, "winter"]).status).toBe("no_match_possible");
    }
  );

  it("detects the genuinely impossible combination (tropical+winter) with an honest any-match count", () => {
    const result = preflightVibes(["tropical", "winter"]);
    expect(result.status).toBe("no_match_possible");
    if (result.status !== "no_match_possible") throw new Error("unreachable");
    // Honest count, derived from the same taxonomy — never hardcoded.
    const expected = Object.values(DESTINATION_VIBES).filter(
      (tags) => tags.has("tropical") || tags.has("winter")
    ).length;
    expect(result.wouldMatchIfAny).toBe(expected);
    expect(result.wouldMatchIfAny).toBeGreaterThanOrEqual(16); // two coverage floors
  });

  it("matchMode any rescues combinations that are impossible under match-all", () => {
    expect(preflightVibes(["tropical", "winter"], { matchMode: "any" })).toEqual({ status: "ok" });
  });

  it("unknown vibes take precedence over impossibility and never suggest already-selected vibes", () => {
    const result = preflightVibes(["beach", "playa"]);
    expect(result.status).toBe("unknown_vibes");
    if (result.status !== "unknown_vibes") throw new Error("unreachable");
    expect(result.unknown).toEqual(["playa"]);
    expect(result.suggestions).not.toContain("beach");
  });

  it("is pure and deterministic (same input, same output, no I/O)", () => {
    const a = preflightVibes(["spa", "hiking"]);
    const b = preflightVibes(["spa", "hiking"]);
    expect(a).toEqual(b);
  });
});

describe("suggestVibes", () => {
  it.each([
    ["ski", "winter"],
    ["snow", "winter"],
    ["hiking", "mountains"],
    ["museums", "cultural"],
    ["culture", "cultural"],
    ["food", "foodie"],
    ["wine", "foodie"],
    ["city", "big_city"],
    ["kids", "family"],
    ["honeymoon", "romantic"],
    ["clubbing", "nightlife"],
    ["island", "tropical"],
    ["diving", "adventure"],
    ["playa", "beach"],
    ["famille", "family"],
    ["montaña", "mountains"],
    ["inverno", "winter"],
  ])("%s -> includes %s", (input, expected) => {
    expect(suggestVibes(input)).toContain(expected);
  });

  it("caps suggestions at 3 and returns [] when nothing is close", () => {
    expect(suggestVibes("xyzzyplugh")).toEqual([]);
    expect(suggestVibes("beach party spa").length).toBeLessThanOrEqual(3);
  });
});

describe("zero-LLM guarantee (spec §5: 'deterministic by construction — asserted by test', review N4)", () => {
  it("vibe-preflight.ts imports no model, SDK, or spend path", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/atlas/vibe-preflight.ts"), "utf-8");
    // Anti-self-defeat: these are import-shaped bans checked against the real
    // module. The module's own comment says "spend cap" in prose, so the spend
    // ban matches import specifiers only — never the word itself.
    expect(source).not.toContain("@anthropic-ai");
    expect(source).not.toContain("tool-loop");
    expect(source).not.toMatch(/from\s+["'][^"']*spend/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/atlas/vibe-preflight.test.ts`
Expected: FAIL — `Cannot find module './vibe-preflight'`.

- [ ] **Step 3: Implement `src/lib/atlas/vibe-preflight.ts`**

```ts
import { CANONICAL_VIBES, type CanonicalVibe } from "@/lib/trip-types";
import { DESTINATION_VIBES } from "./destination-vibes";

// Deterministic pre-flight intent check. Pure set math + string distance —
// NO model call, ever (Atlas runs under a hard monthly spend cap; this module
// is what keeps the empty-result path at $0). Runs BEFORE any TravelPayouts
// request and short-circuits it when no destination could possibly satisfy
// the ask, so the wasted wire call is saved too.

export type PreflightResult =
  | { status: "ok" }
  | { status: "unknown_vibes"; unknown: string[]; suggestions: CanonicalVibe[] }
  | { status: "no_match_possible"; wouldMatchIfAny: number };

const CANONICAL = new Set<string>(CANONICAL_VIBES);

// Curated synonym map: everyday travel words (users type these as free-text
// custom vibes) and one everyday word per vibe for each supported locale.
// Suggestions only — never auto-substituted. Keys must be lowercase.
const SYNONYMS: Record<string, CanonicalVibe[]> = {
  // singular/plural and near-canonical words
  mountain: ["mountains"],
  city: ["big_city"], urban: ["big_city"], shopping: ["big_city"],
  culture: ["cultural"], museum: ["cultural"], museums: ["cultural"], history: ["cultural"],
  historic: ["cultural"], art: ["cultural"], architecture: ["cultural"],
  food: ["foodie"], wine: ["foodie"], winery: ["foodie"], dining: ["foodie"],
  restaurants: ["foodie"], gastronomy: ["foodie"],
  nature: ["mountains", "adventure"], hiking: ["mountains", "adventure"], hike: ["mountains", "adventure"],
  trekking: ["mountains", "adventure"], camping: ["mountains", "adventure"],
  wildlife: ["adventure"], safari: ["adventure"],
  ski: ["winter", "mountains"], skiing: ["winter", "mountains"], snow: ["winter"],
  snowboarding: ["winter", "mountains"], christmas: ["winter"],
  wellness: ["beach", "romantic"], spa: ["beach", "romantic"], yoga: ["beach"],
  relax: ["beach"], relaxing: ["beach"], retreat: ["romantic"],
  island: ["tropical", "beach"], islands: ["tropical", "beach"], sun: ["tropical", "beach"],
  caribbean: ["tropical"],
  surfing: ["beach", "adventure"], surf: ["beach", "adventure"], diving: ["beach", "adventure"],
  scuba: ["beach", "adventure"], snorkeling: ["beach", "adventure"],
  party: ["nightlife"], clubs: ["nightlife"], clubbing: ["nightlife"], bars: ["nightlife"],
  music: ["nightlife"], concerts: ["nightlife"],
  kids: ["family"], children: ["family"], waterpark: ["family"], zoo: ["family"], aquarium: ["family"],
  honeymoon: ["romantic"], romance: ["romantic"], anniversary: ["romantic"], couples: ["romantic"],
  // es / pt / fr / de / it everyday words
  playa: ["beach"], praia: ["beach"], plage: ["beach"], strand: ["beach"], spiaggia: ["beach"],
  ciudad: ["big_city"], cidade: ["big_city"], ville: ["big_city"], stadt: ["big_city"], "città": ["big_city"],
  "montaña": ["mountains"], "montañas": ["mountains"], montanha: ["mountains"], montanhas: ["mountains"],
  montagne: ["mountains"], montagnes: ["mountains"], berge: ["mountains"], montagna: ["mountains"],
  invierno: ["winter"], inverno: ["winter"], hiver: ["winter"],
  aventura: ["adventure"], aventure: ["adventure"], abenteuer: ["adventure"], avventura: ["adventure"],
  comida: ["foodie"], "gastronomía": ["foodie"], gastronomia: ["foodie"], gastronomie: ["foodie"],
  essen: ["foodie"], cibo: ["foodie"],
  cultura: ["cultural"], kultur: ["cultural"],
  familia: ["family"], "família": ["family"], famille: ["family"], familie: ["family"], famiglia: ["family"],
  "romántico": ["romantic"], romantico: ["romantic"], romantique: ["romantic"], romantisch: ["romantic"],
  fiesta: ["nightlife"], festa: ["nightlife"],
};

function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j += 1) distances[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const substitution = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + substitution
      );
    }
  }
  return distances[rows - 1][cols - 1];
}

export function suggestVibes(input: string): CanonicalVibe[] {
  const normalized = input.trim().toLowerCase();
  if (normalized.length === 0) return [];

  const found: CanonicalVibe[] = [];
  const push = (vibes: CanonicalVibe[]) => {
    for (const vibe of vibes) {
      if (!found.includes(vibe)) found.push(vibe);
    }
  };

  const tokens = [normalized, ...normalized.split(/\s+/)];
  for (const token of tokens) {
    if (CANONICAL.has(token)) push([token as CanonicalVibe]);
    if (SYNONYMS[token]) push(SYNONYMS[token]);
  }

  // typo tolerance against canonical names and synonym keys (tokens >= 4 chars)
  for (const token of tokens) {
    if (token.length < 4) continue;
    for (const vibe of CANONICAL_VIBES) {
      if (editDistance(token, vibe) <= 2) push([vibe]);
    }
    for (const [key, vibes] of Object.entries(SYNONYMS)) {
      if (key.length >= 4 && editDistance(token, key) <= 1) push(vibes);
    }
  }

  return found.slice(0, 3);
}

export function preflightVibes(
  vibes: string[],
  opts?: { matchMode?: "all" | "any" }
): PreflightResult {
  const normalized = vibes.map((vibe) => vibe.trim().toLowerCase()).filter((vibe) => vibe.length > 0);
  if (normalized.length === 0) return { status: "ok" };

  const unknown = normalized.filter((vibe) => !CANONICAL.has(vibe));
  if (unknown.length > 0) {
    const selected = new Set(normalized);
    const suggestions: CanonicalVibe[] = [];
    for (const word of unknown) {
      for (const vibe of suggestVibes(word)) {
        if (!selected.has(vibe) && !suggestions.includes(vibe)) suggestions.push(vibe);
      }
    }
    return { status: "unknown_vibes", unknown, suggestions: suggestions.slice(0, 3) };
  }

  const requested = new Set(normalized);
  const minOverlap = opts?.matchMode === "any" ? 1 : requested.size >= 2 ? 2 : 1;

  let wouldMatchIfAny = 0;
  let satisfiable = false;
  for (const tags of Object.values(DESTINATION_VIBES)) {
    let overlap = 0;
    for (const vibe of requested) {
      if ((tags as ReadonlySet<string>).has(vibe)) overlap += 1;
    }
    if (overlap >= 1) wouldMatchIfAny += 1;
    if (overlap >= minOverlap) satisfiable = true;
  }

  if (!satisfiable) return { status: "no_match_possible", wouldMatchIfAny };
  return { status: "ok" };
}
```

- [ ] **Step 4: Run tests + extend the tripwire**

Run: `npx vitest run src/lib/atlas/vibe-preflight.test.ts`
Expected: PASS (all). If a suggestion assertion fails, fix the SYNONYMS table, not the test — the test encodes product behavior.

Extend `SURPRISE_PATH_FILES` in `src/lib/atlas/no-fabrication.test.ts` with `"src/lib/atlas/vibe-preflight.ts",` and run `npx vitest run src/lib/atlas/no-fabrication.test.ts` → PASS (the module carries no banned literal).

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/vibe-preflight.ts src/lib/atlas/vibe-preflight.test.ts src/lib/atlas/no-fabrication.test.ts
git commit -m "feat(atlas): deterministic vibe pre-flight — pure set math, zero LLM calls"
```

---

### Task 5: Engine + API integration — short-circuit, matchMode, degrade codes

**Files:**
- Modify: `src/lib/atlas/surprise.ts`
- Modify: `src/lib/atlas/surprise.test.ts`, `src/lib/atlas/surprise.http-budget.test.ts`
- Modify: `src/lib/atlas/surprise-degrade.ts` + `src/lib/atlas/surprise-degrade.test.ts`
- Modify: `src/app/api/surprise-me/route.ts` + `route.test.ts`
- Modify: `src/lib/atlas/surprise-query.ts` + `surprise-query.test.ts`
- Modify: `messages/{en,es,pt,fr,de,it}/common.json` (2 degraded keys)

**Interfaces:**
- Consumes: `preflightVibes`, `PreflightResult` (Task 4); `resolveCityName` (Task 3).
- Produces:
  - `getSurpriseDestinations(params: { origin: string; vibes?: string; departMonth?: string; tripLength?: string; matchMode?: "all" | "any" })`
  - `SurpriseResult` gains `originName?: string` and `preflight?: PreflightResult`
  - `SurpriseDegradeCode` gains `"unknown_vibes" | "no_match_possible"`
  - `buildSurpriseQuery(args)` gains `matchAny?: boolean` and `departMonthOverride?: string | null` → sets `match=any` / overrides `depart_month`
  - API `GET /api/surprise-me` accepts `match=any`

- [ ] **Step 1: Write the failing zero-wire-call tests**

**(a)** These go in `src/lib/atlas/surprise.http-budget.test.ts` — NOT in `surprise.test.ts`. Reason (anti-self-defeat): `surprise.test.ts` module-mocks `tpGet`, so a `fetch` spy there could never fire even if the short-circuit were missing — the test would pass vacuously. The http-budget file has no module mocks; `fetch` IS the wire boundary there, and these genuinely fail before the implementation (today the engine fetches popular routes for these inputs). Append (the file's `afterEach` already unstubs env/globals):

```ts
describe("PRE-FLIGHT: impossible or unknown vibes short-circuit before any TravelPayouts call", () => {
  it("no_match_possible fires ZERO wire requests", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "test-token");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await getSurpriseDestinations({
      origin: "JFK",
      vibes: "tropical,winter",
      departMonth: "2026-08",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.destinations).toEqual([]);
    expect(result.degraded?.code).toBe("no_match_possible");
    expect(result.preflight?.status).toBe("no_match_possible");
  });

  it("unknown custom vibes short-circuit with suggestions, zero wire requests, and a named origin", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "test-token");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await getSurpriseDestinations({
      origin: "JFK",
      vibes: "wine tasting,beach",
      departMonth: "2026-08",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.degraded?.code).toBe("unknown_vibes");
    expect(result.preflight).toMatchObject({ status: "unknown_vibes", unknown: ["wine tasting"] });
    expect(result.originName).toBe("New York, New York");
  });
});
```

**(b)** The matchMode/filler tests use the `popular()`/`item()` helpers, so they go in `src/lib/atlas/surprise.test.ts`. Append:

```ts
describe("MATCH MODE any: min overlap drops to 1 for ranking AND curated filler", () => {
  it("tropical,winter in any-mode returns cards from routes matching a single vibe", async () => {
    popular([item("CUN", 120), item("DEN", 90), item("DFW", 70)]);
    vi.mocked(rawSearchFlights).mockResolvedValue({ flights: [] });

    const result = await getSurpriseDestinations({
      origin: "JFK",
      vibes: "tropical,winter",
      departMonth: "2026-08",
      matchMode: "any",
    });

    const names = result.destinations.map((d) => d.name);
    expect(names).toContain("Cancún, Mexico");     // tropical
    expect(names).toContain("Denver, Colorado");   // winter
    expect(names).not.toContain("Dallas, Texas");  // matches neither
  });

  it("single-vibe searches let the curated filler work at overlap 1 (it previously demanded 2 and starved them)", async () => {
    emptyPopular();
    vi.mocked(rawSearchFlights).mockResolvedValue({ flights: [] });

    const result = await getSurpriseDestinations({ origin: "JFK", vibes: "winter", departMonth: "2026-08" });

    // Popular routes empty -> the filler must still offer winter destinations,
    // honestly unpriced ("—"), instead of a degraded dead end.
    expect(result.destinations.length).toBeGreaterThanOrEqual(1);
    expect(result.degraded).toBeUndefined();
  });
});
```

Run: `npx vitest run src/lib/atlas/surprise.http-budget.test.ts src/lib/atlas/surprise.test.ts` → Expected: the four new tests FAIL (the engine still fetches for impossible asks; `matchMode` is not a parameter; single-vibe filler returns nothing).

- [ ] **Step 2: Implement in `src/lib/atlas/surprise.ts`**

1. Import:

```ts
import { preflightVibes, type PreflightResult } from "./vibe-preflight";
```

2. New exported reasons (next to `NO_ROUTES_REASON`; same honest-tone contract):

```ts
export const UNKNOWN_VIBES_REASON =
  "Some requested vibes are not part of the search vocabulary, so the search did not run. This does NOT mean no flights exist — adjust the vibes or ask Atlas.";
export const NO_MATCH_POSSIBLE_REASON =
  "No known destination combines all the requested vibes at once, so the search did not run. This does NOT mean no flights exist — try matching any vibe, or ask Atlas.";
```

3. Extend the result type and params:

```ts
export interface SurpriseResult {
  origin: string;
  originName?: string;
  destinations: SurpriseDestination[];
  degraded?: SurpriseDegraded;
  preflight?: PreflightResult;
}
```

`getSurpriseDestinations`'s params gain `matchMode?: "all" | "any";`.

4. Right after `const requestedVibes = new Set(normalizeVibes(params.vibes));` insert the short-circuit (BEFORE any `tpGet`). Note this reuses Task 3's `originResolved` — move that `const originResolved = resolveCityName(origin);` line up here, keep `originCityKey` derived from it where Task 3 put it:

```ts
  const originResolved = resolveCityName(origin);
  const originName = originResolved ?? undefined;

  if (requestedVibes.size > 0) {
    const preflight = preflightVibes([...requestedVibes], { matchMode: params.matchMode });
    if (preflight.status !== "ok") {
      return {
        origin,
        originName,
        destinations: [],
        degraded:
          preflight.status === "unknown_vibes"
            ? { code: "unknown_vibes", reason: UNKNOWN_VIBES_REASON }
            : { code: "no_match_possible", reason: NO_MATCH_POSSIBLE_REASON },
        preflight,
      };
    }
  }
```

5. Hoist the overlap threshold so ranking AND filler share it: immediately after the preflight block add

```ts
  const minOverlap = params.matchMode === "any" ? 1 : requestedVibes.size >= 2 ? 2 : 1;
```

then DELETE the local `const minOverlap = ...` inside the ranking block, and in the curated filler replace **both** `if (overlap < 2) continue;` checks with `if (overlap < minOverlap) continue;`.

6. Add `originName` to both final `return` statements (`{ origin, originName, destinations, ... }`).

Run: `npx vitest run src/lib/atlas/surprise.http-budget.test.ts src/lib/atlas/surprise.test.ts` → Expected: PASS. (The http-budget worst-case pin of 7 wire calls still passes: `tropical,beach` is satisfiable and never short-circuits.)

- [ ] **Step 3: Degrade codes — failing test first**

In `src/lib/atlas/surprise-degrade.test.ts`, extend the expected-codes assertion with `"unknown_vibes"` and `"no_match_possible"`. Run `npx vitest run src/lib/atlas/surprise-degrade.test.ts` → FAIL. Then in `src/lib/atlas/surprise-degrade.ts`:

```ts
export type SurpriseDegradeCode =
  | TpFailure
  | "invalid_origin"
  | "no_routes"
  | "no_vibe_match"
  | "unknown_vibes"
  | "no_match_possible"
  | "internal_error";
```

and in `DEGRADE_CODE_TO_KEY`:

```ts
  unknown_vibes: "degradedUnknownVibesBody",
  no_match_possible: "degradedNoMatchPossibleBody",
```

The same file's locale sweep will now FAIL until the two keys exist in all six locales — add them NOW to each `atlasHero` block (after `degradedInternalErrorBody`), using EXACTLY these strings:

**en:**
```json
"degradedUnknownVibesBody": "We didn't recognize some of the vibes on this trip, so the search couldn't use them. Adjust your vibes or ask Atlas.",
"degradedNoMatchPossibleBody": "No destination we know combines all of those vibes at once. Try matching any of them, or ask Atlas."
```
**es:**
```json
"degradedUnknownVibesBody": "No reconocimos algunos de los ambientes de este viaje, así que la búsqueda no pudo usarlos. Ajusta tus ambientes o pregunta a Atlas.",
"degradedNoMatchPossibleBody": "Ningún destino que conozcamos combina todos esos ambientes a la vez. Prueba a buscar con cualquiera de ellos o pregunta a Atlas."
```
**pt:**
```json
"degradedUnknownVibesBody": "Não reconhecemos algumas das vibes desta viagem, então a busca não pôde usá-las. Ajuste suas vibes ou pergunte ao Atlas.",
"degradedNoMatchPossibleBody": "Nenhum destino que conhecemos combina todas essas vibes ao mesmo tempo. Tente buscar com qualquer uma delas ou pergunte ao Atlas."
```
**fr:**
```json
"degradedUnknownVibesBody": "Nous n'avons pas reconnu certaines ambiances de ce voyage, la recherche n'a donc pas pu les utiliser. Ajustez vos ambiances ou demandez à Atlas.",
"degradedNoMatchPossibleBody": "Aucune destination connue ne combine toutes ces ambiances à la fois. Essayez d'en chercher au moins une, ou demandez à Atlas."
```
**de:**
```json
"degradedUnknownVibesBody": "Einige Stimmungen dieser Reise haben wir nicht erkannt, deshalb konnte die Suche sie nicht verwenden. Passe deine Stimmungen an oder frage Atlas.",
"degradedNoMatchPossibleBody": "Kein uns bekanntes Reiseziel vereint alle diese Stimmungen auf einmal. Versuche es mit mindestens einer davon oder frage Atlas."
```
**it:**
```json
"degradedUnknownVibesBody": "Non abbiamo riconosciuto alcune atmosfere di questo viaggio, quindi la ricerca non ha potuto usarle. Modifica le tue atmosfere o chiedi ad Atlas.",
"degradedNoMatchPossibleBody": "Nessuna destinazione che conosciamo combina tutte queste atmosfere insieme. Prova a cercarne almeno una o chiedi ad Atlas."
```

Run: `npx vitest run src/lib/atlas/surprise-degrade.test.ts` → PASS.

- [ ] **Step 4: API route — failing test first**

Append to `src/app/api/surprise-me/route.test.ts` (uses the file's existing `request()`/`json()` helpers and `mockedGetSurpriseDestinations`):

```ts
  it("MATCH MODE: forwards match=any to the engine and varies the cache key", async () => {
    mockedGetSurpriseDestinations.mockResolvedValue({ origin: "JFK", destinations: [] });

    await GET(request("origin=JFK&vibes=tropical%2Cwinter&match=any"));

    expect(mockedGetSurpriseDestinations).toHaveBeenCalledWith(
      expect.objectContaining({ matchMode: "any" })
    );
  });

  it("PRE-FLIGHT PASS-THROUGH: degraded preflight results reach the client body and are not cached", async () => {
    const preflightResult = {
      origin: "JFK",
      originName: "New York, New York",
      destinations: [],
      degraded: { code: "no_match_possible", reason: "engine prose" },
      preflight: { status: "no_match_possible", wouldMatchIfAny: 40 },
    };
    mockedGetSurpriseDestinations.mockResolvedValue(preflightResult as never);

    const first = await GET(request("origin=JFK&vibes=tropical%2Cwinter"));
    expect(await json(first)).toMatchObject({
      preflight: { status: "no_match_possible" },
      originName: "New York, New York",
    });

    await GET(request("origin=JFK&vibes=tropical%2Cwinter"));
    expect(mockedGetSurpriseDestinations).toHaveBeenCalledTimes(2); // degraded => never cached
  });
```

Run → FAIL. Then in `src/app/api/surprise-me/route.ts`: parse `const match = clampQueryValue(searchParams.get("match"), 10);`, derive `const matchMode = match === "any" ? ("any" as const) : ("all" as const);`, append `matchMode` to the `cacheKey` array, and pass `matchMode` into `getSurpriseDestinations`.

**⚠ In the SAME step, update the three existing exact-match assertions (review I2 — passing `matchMode` unconditionally changes the engine-call shape, so all three fail otherwise; an earlier revision of this plan wrongly claimed they stay green).** In `route.test.ts`, each expected call object gains `matchMode: "all"`:

- PASS-THROUGH test (~line 46): `expect(mockedGetSurpriseDestinations).toHaveBeenCalledWith({ origin: "JFK", vibes: "beach,romantic", departMonth: "2026-08", tripLength: "week", matchMode: "all" });`
- NO ORIGIN MANGLING test, first call (~line 74): `toHaveBeenNthCalledWith(1, { origin: "Cancun", vibes: "", departMonth: "", tripLength: "", matchMode: "all" })`
- NO ORIGIN MANGLING test, second call (~line 80): `toHaveBeenNthCalledWith(2, { origin: "", vibes: "no-origin-mangling", departMonth: "", tripLength: "", matchMode: "all" })`

Do NOT "fix" this by passing `matchMode` only when `match=any` — that would silently fork the cache-key/engine contract (the exact failure mode the review warned about).

Run → PASS, including the three updated assertions. (The existing "cache only priced, non-degraded results" logic already keeps preflight responses uncached — no change there.)

- [ ] **Step 5: `buildSurpriseQuery` — failing test first**

Append to `src/lib/atlas/surprise-query.test.ts`:

```ts
  it("adds match=any and honors a depart-month override when the clarification card re-runs", () => {
    const params = buildSurpriseQuery({
      originCode: "JFK",
      vibesSummary: "tropical + winter",
      matchAny: true,
      departMonthOverride: "2026-11",
    });

    expect(params.get("match")).toBe("any");
    expect(params.get("depart_month")).toBe("2026-11");
    expect(params.get("vibes")).toBe("tropical,winter");
  });

  it("omits match unless explicitly any", () => {
    const params = buildSurpriseQuery({ originCode: "JFK", vibesSummary: "beach" });
    expect(params.get("match")).toBeNull();
  });
```

Run → FAIL. Then in `src/lib/atlas/surprise-query.ts` extend the args type with `matchAny?: boolean; departMonthOverride?: string | null;`, change the first line of `buildSurpriseQuery` to

```ts
  const departMonth = args.departMonthOverride?.trim() || deriveDepartMonth(args.flexibleWindow, args.startDate);
```

and after the vibes block add

```ts
  if (args.matchAny) params.set("match", "any");
```

Run → PASS.

- [ ] **Step 6: Full suite + commit**

Run: `npm run test:unit` → all pass. Then:

```bash
git add src/lib/atlas/surprise.ts src/lib/atlas/surprise.test.ts src/lib/atlas/surprise.http-budget.test.ts src/lib/atlas/surprise-degrade.ts src/lib/atlas/surprise-degrade.test.ts src/app/api/surprise-me/route.ts src/app/api/surprise-me/route.test.ts src/lib/atlas/surprise-query.ts src/lib/atlas/surprise-query.test.ts messages/en/common.json messages/es/common.json messages/pt/common.json messages/fr/common.json messages/de/common.json messages/it/common.json
git commit -m "feat(surprise): pre-flight short-circuit + match-any mode — impossible asks skip TravelPayouts entirely"
```

---

### Task 6: i18n — the clarification-card copy, six locales

**Files:**
- Modify: `messages/{en,es,pt,fr,de,it}/common.json` (`atlasHero` additions)
- Modify: `src/lib/atlas/surprise-degrade.test.ts` (locale-parity tests)

**Interfaces:**
- Produces: `atlasHero.clarify*` keys consumed by Task 7's component. `{vibes}` interpolates a human-readable, localized list; `{count}` a number; `{origin}`/`{month}` resolved names — never raw codes.
- Produces: the **no-origin variants** `atlasHero.subtitleNoOrigin` and `atlasHero.clarifyAtlasSeedNoOrigin` (G4 Scope / review I4: when the origin cannot be named, the origin phrase is OMITTED — a bare code is never the fallback).

- [ ] **Step 1: Add the `atlasHero` keys (place after the two `degraded*` keys Task 5 added). Use these EXACT strings** — written for an average/older traveller (no jargon, no codes-as-concepts), matching each locale's register (ES/PT/DE/IT informal, FR `vous`; "vibes" rendered per-locale as ambientes/vibes/ambiances/Stimmungen/atmosfere, consistent with the existing `degradedNoVibeMatchBody` strings):

**en:**
```json
"clarifyUnknownTitle": "Let's fine-tune what you're looking for",
"clarifyUnknownBody": "We don't have a \"{vibes}\" category in our search yet, so we couldn't use it to find places.",
"clarifySuggestionsLead": "Closest things we can search:",
"clarifyUseKnown": "Search with {vibes} only",
"clarifyImpossibleTitle": "No single place offers all of that together",
"clarifyImpossibleBody": "We couldn't find a destination that combines everything you picked: {vibes}. But {count} places offer at least one of them.",
"clarifyMatchAny": "Show places with any of my vibes ({count})",
"clarifyTryMonthLead": "Or try a different month:",
"clarifyAskAtlas": "Ask Atlas for ideas",
"clarifyAtlasSeed": "I'm planning a trip from {origin} around {month}. I'd love something that feels like: {vibes}. The automatic search couldn't find a destination that matches everything — can you suggest a few places that come close?",
"clarifyAtlasSeedNoOrigin": "I'm planning a trip around {month}. I'd love something that feels like: {vibes}. The automatic search couldn't find a destination that matches everything — can you suggest a few places that come close?",
"subtitleNoOrigin": "{vibes} vibes · {budget} budget"
```

**es:**
```json
"clarifyUnknownTitle": "Afinemos lo que buscas",
"clarifyUnknownBody": "Todavía no tenemos una categoría \"{vibes}\" en nuestro buscador, así que no pudimos usarla para encontrar lugares.",
"clarifySuggestionsLead": "Lo más parecido que sí podemos buscar:",
"clarifyUseKnown": "Buscar solo con {vibes}",
"clarifyImpossibleTitle": "Ningún lugar reúne todo eso a la vez",
"clarifyImpossibleBody": "No encontramos un destino que combine todo lo que elegiste: {vibes}. Pero {count} lugares ofrecen al menos una de esas opciones.",
"clarifyMatchAny": "Ver lugares con cualquiera de mis ambientes ({count})",
"clarifyTryMonthLead": "O prueba con otro mes:",
"clarifyAskAtlas": "Pedir ideas a Atlas",
"clarifyAtlasSeed": "Estoy planeando un viaje desde {origin} hacia {month}. Me gustaría algo con este estilo: {vibes}. La búsqueda automática no encontró un destino que lo tenga todo — ¿puedes sugerirme lugares que se acerquen?",
"clarifyAtlasSeedNoOrigin": "Estoy planeando un viaje hacia {month}. Me gustaría algo con este estilo: {vibes}. La búsqueda automática no encontró un destino que lo tenga todo — ¿puedes sugerirme lugares que se acerquen?",
"subtitleNoOrigin": "Vibes {vibes} · presupuesto {budget}"
```

**pt:**
```json
"clarifyUnknownTitle": "Vamos ajustar o que você procura",
"clarifyUnknownBody": "Ainda não temos uma categoria \"{vibes}\" na nossa busca, então não pudemos usá-la para encontrar lugares.",
"clarifySuggestionsLead": "O mais parecido que podemos buscar:",
"clarifyUseKnown": "Buscar apenas com {vibes}",
"clarifyImpossibleTitle": "Nenhum lugar reúne tudo isso ao mesmo tempo",
"clarifyImpossibleBody": "Não encontramos um destino que combine tudo o que você escolheu: {vibes}. Mas {count} lugares oferecem pelo menos uma dessas opções.",
"clarifyMatchAny": "Ver lugares com qualquer uma das minhas vibes ({count})",
"clarifyTryMonthLead": "Ou tente outro mês:",
"clarifyAskAtlas": "Pedir ideias ao Atlas",
"clarifyAtlasSeed": "Estou planejando uma viagem saindo de {origin} por volta de {month}. Quero algo nesse estilo: {vibes}. A busca automática não encontrou um destino que combine com tudo — pode sugerir alguns lugares que cheguem perto?",
"clarifyAtlasSeedNoOrigin": "Estou planejando uma viagem por volta de {month}. Quero algo nesse estilo: {vibes}. A busca automática não encontrou um destino que combine com tudo — pode sugerir alguns lugares que cheguem perto?",
"subtitleNoOrigin": "Vibes {vibes} · orçamento {budget}"
```

**fr:**
```json
"clarifyUnknownTitle": "Affinons ce que vous recherchez",
"clarifyUnknownBody": "Nous n'avons pas encore de catégorie « {vibes} » dans notre recherche, nous n'avons donc pas pu l'utiliser pour trouver des lieux.",
"clarifySuggestionsLead": "Ce qui s'en rapproche le plus :",
"clarifyUseKnown": "Rechercher uniquement avec {vibes}",
"clarifyImpossibleTitle": "Aucun endroit ne réunit tout cela à la fois",
"clarifyImpossibleBody": "Nous n'avons pas trouvé de destination combinant tous vos choix : {vibes}. Mais {count} lieux offrent au moins l'un d'entre eux.",
"clarifyMatchAny": "Voir les lieux avec n'importe laquelle de mes ambiances ({count})",
"clarifyTryMonthLead": "Ou essayez un autre mois :",
"clarifyAskAtlas": "Demander des idées à Atlas",
"clarifyAtlasSeed": "Je prépare un voyage au départ de {origin} vers {month}. J'aimerais quelque chose dans cet esprit : {vibes}. La recherche automatique n'a pas trouvé de destination qui corresponde à tout — pouvez-vous me suggérer quelques endroits qui s'en approchent ?",
"clarifyAtlasSeedNoOrigin": "Je prépare un voyage vers {month}. J'aimerais quelque chose dans cet esprit : {vibes}. La recherche automatique n'a pas trouvé de destination qui corresponde à tout — pouvez-vous me suggérer quelques endroits qui s'en approchent ?",
"subtitleNoOrigin": "Ambiances {vibes} · budget {budget}"
```

**de:**
```json
"clarifyUnknownTitle": "Lass uns eingrenzen, was du suchst",
"clarifyUnknownBody": "Eine Kategorie „{vibes}“ gibt es in unserer Suche noch nicht, deshalb konnten wir sie nicht verwenden, um Orte zu finden.",
"clarifySuggestionsLead": "Das Ähnlichste, wonach wir suchen können:",
"clarifyUseKnown": "Nur mit {vibes} suchen",
"clarifyImpossibleTitle": "Kein Ort vereint all das auf einmal",
"clarifyImpossibleBody": "Wir haben kein Reiseziel gefunden, das alles vereint, was du gewählt hast: {vibes}. Aber {count} Orte bieten mindestens eines davon.",
"clarifyMatchAny": "Orte mit irgendeiner meiner Stimmungen zeigen ({count})",
"clarifyTryMonthLead": "Oder probiere einen anderen Monat:",
"clarifyAskAtlas": "Atlas um Ideen bitten",
"clarifyAtlasSeed": "Ich plane eine Reise ab {origin}, ungefähr im {month}. Ich hätte gern etwas in dieser Richtung: {vibes}. Die automatische Suche hat kein Ziel gefunden, das alles vereint — kannst du mir ein paar Orte vorschlagen, die nah dran sind?",
"clarifyAtlasSeedNoOrigin": "Ich plane eine Reise ungefähr im {month}. Ich hätte gern etwas in dieser Richtung: {vibes}. Die automatische Suche hat kein Ziel gefunden, das alles vereint — kannst du mir ein paar Orte vorschlagen, die nah dran sind?",
"subtitleNoOrigin": "{vibes} Vibes · {budget} Budget"
```

**it:**
```json
"clarifyUnknownTitle": "Mettiamo a fuoco cosa cerchi",
"clarifyUnknownBody": "Non abbiamo ancora una categoria \"{vibes}\" nella nostra ricerca, quindi non abbiamo potuto usarla per trovare luoghi.",
"clarifySuggestionsLead": "Le cose più simili che possiamo cercare:",
"clarifyUseKnown": "Cerca solo con {vibes}",
"clarifyImpossibleTitle": "Nessun posto riunisce tutto questo insieme",
"clarifyImpossibleBody": "Non abbiamo trovato una destinazione che combini tutto ciò che hai scelto: {vibes}. Ma {count} luoghi ne offrono almeno una.",
"clarifyMatchAny": "Mostra luoghi con una qualsiasi delle mie atmosfere ({count})",
"clarifyTryMonthLead": "Oppure prova un altro mese:",
"clarifyAskAtlas": "Chiedi idee ad Atlas",
"clarifyAtlasSeed": "Sto organizzando un viaggio in partenza da {origin}, verso {month}. Vorrei qualcosa in questo stile: {vibes}. La ricerca automatica non ha trovato una destinazione che abbia tutto — puoi suggerirmi qualche posto che ci si avvicini?",
"clarifyAtlasSeedNoOrigin": "Sto organizzando un viaggio verso {month}. Vorrei qualcosa in questo stile: {vibes}. La ricerca automatica non ha trovato una destinazione che abbia tutto — puoi suggerirmi qualche posto che ci si avvicini?",
"subtitleNoOrigin": "Atmosfere {vibes} · budget {budget}"
```

Validate: `for f in messages/*/common.json; do python3 -m json.tool "$f" > /dev/null && echo "OK $f"; done` → `OK` × 6.

- [ ] **Step 2: Locale-parity tests**

Extend `src/lib/atlas/surprise-degrade.test.ts` inside the `describe("degraded body locale messages", ...)` block:

```ts
  const CLARIFY_KEYS = [
    "clarifyUnknownTitle", "clarifyUnknownBody", "clarifySuggestionsLead", "clarifyUseKnown",
    "clarifyImpossibleTitle", "clarifyImpossibleBody", "clarifyMatchAny", "clarifyTryMonthLead",
    "clarifyAskAtlas", "clarifyAtlasSeed",
    // no-origin variants (G4 Scope / review I4): used when the origin cannot
    // be named — the origin phrase is omitted, never a bare code
    "clarifyAtlasSeedNoOrigin", "subtitleNoOrigin",
  ] as const;

  it.each(LOCALES)("%s has every clarification-card key", (locale) => {
    const common = JSON.parse(
      readFileSync(resolve(process.cwd(), "messages", locale, "common.json"), "utf-8")
    ) as { atlasHero?: Record<string, string> };
    for (const key of CLARIFY_KEYS) {
      expect(common.atlasHero?.[key], `${locale}.atlasHero.${key}`).toEqual(expect.any(String));
    }
  });

  it("non-English clarification bodies are genuinely translated, not pasted English", () => {
    const en = JSON.parse(readFileSync(resolve(process.cwd(), "messages", "en", "common.json"), "utf-8")) as {
      atlasHero: Record<string, string>;
    };
    for (const locale of LOCALES.filter((l) => l !== "en")) {
      const common = JSON.parse(
        readFileSync(resolve(process.cwd(), "messages", locale, "common.json"), "utf-8")
      ) as { atlasHero: Record<string, string> };
      expect(common.atlasHero.clarifyImpossibleBody).not.toBe(en.atlasHero.clarifyImpossibleBody);
      expect(common.atlasHero.clarifyAtlasSeed).not.toBe(en.atlasHero.clarifyAtlasSeed);
    }
  });
```

Run: `npx vitest run src/lib/atlas/surprise-degrade.test.ts` → PASS.

- [ ] **Step 3: Commit**

```bash
git add messages src/lib/atlas/surprise-degrade.test.ts
git commit -m "i18n(surprise): clarification-card copy across en/es/pt/fr/de/it with parity tests"
```

---

### Task 7: The interactive clarification card

**Files:**
- Create: `src/components/SurpriseClarificationCard.tsx` + `SurpriseClarificationCard.test.tsx`
- Modify: `src/components/SurpriseMeSection.tsx` + `SurpriseMeSection.test.tsx`
- Modify: `src/components/AtlasHeroSection.tsx` (optional `originName`)
- Modify: `src/lib/atlas/no-fabrication.test.ts` (`SURPRISE_PATH_FILES` += `SurpriseClarificationCard.tsx`)
- Modify: `src/lib/help-content.ts` ("When nothing matches" section)

**Interfaces:**
- Consumes: `PreflightResult` type (Task 4, type-only import — the JSON payload carries the data), `buildSurpriseQuery` with `matchAny`/`departMonthOverride` (Task 5), i18n keys (Tasks 2, 6), the existing `atlas-open` CustomEvent contract (`window.dispatchEvent(new CustomEvent("atlas-open", { detail: { message } }))` — `AssistantChat.tsx` opens the chat and auto-sends `detail.message`; SurpriseMeSection already uses it).
- Produces: `<SurpriseClarificationCard>` with `data-testid="surprise-clarification-card"` (Task 8's e2e depends on it, on `data-testid="clarify-match-any"`, and on `data-testid="clarify-suggestion"` chips).

- [ ] **Step 1: Write the failing component test — `src/components/SurpriseClarificationCard.test.tsx`**

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import esMessages from "../../messages/es/common.json";
import SurpriseClarificationCard from "./SurpriseClarificationCard";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const noop = () => {};

function renderCard(props: Partial<Parameters<typeof SurpriseClarificationCard>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <SurpriseClarificationCard
        preflight={{ status: "no_match_possible", wouldMatchIfAny: 40 }}
        vibes={["tropical", "winter"]}
        departMonth="2026-08"
        onMatchAny={noop}
        onPickMonth={noop}
        onUseSuggestion={noop}
        onUseKnownOnly={noop}
        onAskAtlas={noop}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

describe("SurpriseClarificationCard — no_match_possible", () => {
  it("renders localized copy with the honest any-match count and never a fabricated destination", () => {
    renderCard();

    const card = screen.getByTestId("surprise-clarification-card");
    expect(card.textContent).toContain("40");
    // localized vibe labels, not raw internal values
    expect(card.textContent).toContain("Tropical");
    expect(card.textContent).toContain("Escapada de Invierno");
    expect(card.textContent).not.toContain("big_city");
    // no destination or price appears — the card clarifies, it does not invent results
    expect(card.textContent).not.toMatch(/\$\d/);
  });

  it("match-any button reports the count and fires the callback", () => {
    const onMatchAny = vi.fn();
    renderCard({ onMatchAny });

    fireEvent.click(screen.getByTestId("clarify-match-any"));
    expect(onMatchAny).toHaveBeenCalledTimes(1);
  });

  it("offers month alternatives and Ask Atlas", () => {
    const onPickMonth = vi.fn();
    const onAskAtlas = vi.fn();
    renderCard({ onPickMonth, onAskAtlas });

    const months = screen.getAllByTestId("clarify-month");
    expect(months.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(months[0]);
    expect(onPickMonth).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}$/));

    fireEvent.click(screen.getByTestId("clarify-ask-atlas"));
    expect(onAskAtlas).toHaveBeenCalledTimes(1);
  });
});

describe("SurpriseClarificationCard — unknown_vibes", () => {
  it("names the unrecognized wish, offers canonical suggestion chips and a known-only search", () => {
    const onUseSuggestion = vi.fn();
    const onUseKnownOnly = vi.fn();
    renderCard({
      preflight: { status: "unknown_vibes", unknown: ["cata de vinos"], suggestions: ["foodie"] },
      vibes: ["cata de vinos", "beach"],
      onUseSuggestion,
      onUseKnownOnly,
    });

    const card = screen.getByTestId("surprise-clarification-card");
    expect(card.textContent).toContain("cata de vinos");
    // the suggestion chip carries the localized label, not the internal value
    expect(screen.getByTestId("clarify-suggestion").textContent).toContain("Gastronomía");

    fireEvent.click(screen.getByTestId("clarify-suggestion"));
    expect(onUseSuggestion).toHaveBeenCalledWith("foodie");

    fireEvent.click(screen.getByTestId("clarify-use-known"));
    expect(onUseKnownOnly).toHaveBeenCalledTimes(1);
  });
});
```

Run: `npx vitest run src/components/SurpriseClarificationCard.test.tsx` → Expected: FAIL — module not found.

- [ ] **Step 2: Implement `src/components/SurpriseClarificationCard.tsx`**

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { CANONICAL_VIBES, type CanonicalVibe } from "@/lib/trip-types";
import type { PreflightResult } from "@/lib/atlas/vibe-preflight";

type NonOkPreflight = Exclude<PreflightResult, { status: "ok" }>;

interface SurpriseClarificationCardProps {
  preflight: NonOkPreflight;
  vibes: string[];
  departMonth: string; // "YYYY-MM"
  onMatchAny: () => void;
  onPickMonth: (month: string) => void;
  onUseSuggestion: (vibe: string) => void;
  onUseKnownOnly: () => void;
  onAskAtlas: () => void;
}

const CANONICAL = new Set<string>(CANONICAL_VIBES);

function upcomingMonths(from: string, count: number): string[] {
  const [year, month] = from.split("-").map(Number);
  const base =
    Number.isFinite(year) && Number.isFinite(month) ? new Date(Date.UTC(year, month - 1, 1)) : new Date();
  const months: string[] = [];
  for (let offset = 1; offset <= count; offset += 1) {
    const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1));
    months.push(next.toISOString().slice(0, 7));
  }
  return months;
}

export default function SurpriseClarificationCard({
  preflight,
  vibes,
  departMonth,
  onMatchAny,
  onPickMonth,
  onUseSuggestion,
  onUseKnownOnly,
  onAskAtlas,
}: SurpriseClarificationCardProps) {
  const t = useTranslations("atlasHero");
  const tv = useTranslations("tripForm.vibes");
  const locale = useLocale();

  // Canonical vibes get their localized label; a user's free-text wish is
  // echoed back in their own words.
  const label = (vibe: string) => (CANONICAL.has(vibe) ? tv(vibe as CanonicalVibe) : vibe);
  const monthLabel = (month: string) => {
    const [year, monthNum] = month.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, monthNum - 1, 1))
    );
  };

  const isUnknown = preflight.status === "unknown_vibes";
  const unknown = isUnknown ? preflight.unknown : [];
  const suggestions = isUnknown ? preflight.suggestions : [];
  const known = vibes.filter((vibe) => !unknown.includes(vibe));
  const vibesLabel = vibes.map(label).join(" · ");
  const knownLabel = known.map(label).join(" · ");

  const actionClass =
    "inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors";
  const chipClass =
    "px-3 py-1.5 rounded-full border-2 border-orange-300 bg-white text-sm font-medium text-orange-800 hover:border-orange-500 transition-colors";

  return (
    <div
      data-testid="surprise-clarification-card"
      className="rounded-xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-6 space-y-4"
    >
      {isUnknown ? (
        <div>
          <p className="font-bold text-lg text-orange-950">{t("clarifyUnknownTitle")}</p>
          <p className="text-sm text-orange-900 mt-1">
            {t("clarifyUnknownBody", { vibes: unknown.join(", ") })}
          </p>
        </div>
      ) : (
        <div>
          <p className="font-bold text-lg text-orange-950">{t("clarifyImpossibleTitle")}</p>
          <p className="text-sm text-orange-900 mt-1">
            {t("clarifyImpossibleBody", { vibes: vibesLabel, count: preflight.wouldMatchIfAny })}
          </p>
        </div>
      )}

      {isUnknown && suggestions.length > 0 && (
        <div>
          <p className="text-sm font-medium text-orange-900 mb-2">{t("clarifySuggestionsLead")}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                data-testid="clarify-suggestion"
                onClick={() => onUseSuggestion(suggestion)}
                className={chipClass}
              >
                {label(suggestion)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {!isUnknown && (
          <button type="button" data-testid="clarify-match-any" onClick={onMatchAny} className={actionClass}>
            {t("clarifyMatchAny", { count: preflight.wouldMatchIfAny })}
          </button>
        )}
        {isUnknown && known.length > 0 && (
          <button type="button" data-testid="clarify-use-known" onClick={onUseKnownOnly} className={actionClass}>
            {t("clarifyUseKnown", { vibes: knownLabel })}
          </button>
        )}
        <button
          type="button"
          data-testid="clarify-ask-atlas"
          onClick={onAskAtlas}
          className="inline-flex items-center rounded-lg border-2 border-orange-600 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors"
        >
          {t("clarifyAskAtlas")}
        </button>
      </div>

      <div>
        <p className="text-sm font-medium text-orange-900 mb-2">{t("clarifyTryMonthLead")}</p>
        <div className="flex flex-wrap gap-2">
          {upcomingMonths(departMonth, 4).map((month) => (
            <button
              key={month}
              type="button"
              data-testid="clarify-month"
              onClick={() => onPickMonth(month)}
              className={chipClass}
            >
              {monthLabel(month)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

Run: `npx vitest run src/components/SurpriseClarificationCard.test.tsx` → PASS.

- [ ] **Step 3: Wire into `SurpriseMeSection.tsx` — failing wiring test first**

Append to `src/components/SurpriseMeSection.test.tsx` (uses the file's existing `stubSurpriseFetch`/`renderSurpriseMeSection` helpers; extend its local `SurpriseMePayload` interface with `preflight?: unknown; originName?: string;`, and add `fireEvent` to the `@testing-library/react` import). Also extend `renderSurpriseMeSection` to accept prop overrides — existing calls stay valid:

```tsx
import type { ComponentProps } from "react";

function renderSurpriseMeSection(props: Partial<ComponentProps<typeof SurpriseMeSection>> = {}) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <SurpriseMeSection tripId={123} originCode="CANCUN" vibesSummary="playa" budgetLabel="moderado" {...props} />
    </NextIntlClientProvider>
  );
}
```

```tsx
describe("SurpriseMeSection preflight clarification", () => {
  it("renders the interactive card instead of the dead-end banner for preflight codes", async () => {
    stubSurpriseFetch({
      origin: "JFK",
      originName: "New York, New York",
      destinations: [],
      degraded: { code: "no_match_possible", reason: "engine prose" },
      preflight: { status: "no_match_possible", wouldMatchIfAny: 40 },
    });

    renderSurpriseMeSection();

    await waitFor(() => {
      expect(screen.getByTestId("surprise-clarification-card")).toBeTruthy();
    });
    expect(screen.queryByTestId("surprise-fallback-banner")).toBeNull();
  });

  it("match-any action re-fetches with match=any", async () => {
    stubSurpriseFetch({
      origin: "JFK",
      destinations: [],
      degraded: { code: "no_match_possible", reason: "engine prose" },
      preflight: { status: "no_match_possible", wouldMatchIfAny: 40 },
    });

    renderSurpriseMeSection();
    await waitFor(() => expect(screen.getByTestId("clarify-match-any")).toBeTruthy());

    fireEvent.click(screen.getByTestId("clarify-match-any"));

    await waitFor(() => {
      const fetchMock = vi.mocked(globalThis.fetch);
      const calledUrls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(calledUrls.some((url) => url.includes("match=any"))).toBe(true);
    });
  });

  it("keeps the plain degraded banner for non-preflight codes (TP failures stay honest)", async () => {
    stubSurpriseFetch({
      origin: "JFK",
      destinations: [],
      degraded: { code: "no_vibe_match", reason: "engine prose" },
    });

    renderSurpriseMeSection();

    await waitFor(() => {
      expect(screen.getByTestId("surprise-fallback-banner")).toBeTruthy();
    });
    expect(screen.queryByTestId("surprise-clarification-card")).toBeNull();
  });

  it("passes the resolved origin name into the hero subtitle when destinations render", async () => {
    stubSurpriseFetch({
      origin: "JFK",
      originName: "New York, New York",
      destinations: [
        { name: "Lisbon, Portugal", airline: "TP", flightPrice: "$412 rt", nonstop: true, link: "" },
      ],
    });

    renderSurpriseMeSection();

    await waitFor(() => {
      expect(screen.getByText(/New York, New York/)).toBeTruthy();
    });
  });

  it("hero subtitle renders LOCALIZED vibe labels — an internal enum value on screen is a bug (G4 Scope)", async () => {
    stubSurpriseFetch({
      origin: "JFK",
      originName: "New York, New York",
      destinations: [
        { name: "Lisbon, Portugal", airline: "TP", flightPrice: "$412 rt", nonstop: true, link: "" },
      ],
    });

    renderSurpriseMeSection({ vibesSummary: "big_city + winter" });

    await waitFor(() => {
      expect(screen.getByText(/Gran Ciudad/)).toBeTruthy(); // es label for big_city
    });
    expect(screen.getByText(/Escapada de Invierno/)).toBeTruthy(); // es label for winter
    expect(screen.queryByText(/big_city/)).toBeNull();
  });

  it("omits the origin phrase when the origin cannot be named — a bare code is never the fallback (review I4)", async () => {
    // originCode "CANCUN" is not a nameable 3-letter code and the payload has
    // no originName — the subtitle must use the no-origin variant.
    stubSurpriseFetch({
      origin: "CANCUN",
      destinations: [
        { name: "Lisbon, Portugal", airline: "TP", flightPrice: "$412 rt", nonstop: true, link: "" },
      ],
    });

    renderSurpriseMeSection();

    await waitFor(() => {
      expect(screen.queryAllByTestId("atlas-destination-card")).toHaveLength(1);
    });
    expect(screen.queryByText(/CANCUN/)).toBeNull();
  });
});
```

Run → FAIL. (Note: `renderSurpriseMeSection` defaults to `vibesSummary="playa"` — a single unknown word. The card renders for whatever `preflight` the payload carries; its vibe list comes from `normalizeVibes(vibesSummary)`.)

- [ ] **Step 4: Implement the wiring in `src/components/SurpriseMeSection.tsx`**

Exact changes:

1. Imports:

```tsx
import { useLocale } from "next-intl";
import { buildSurpriseQuery, deriveDepartMonth, normalizeVibes } from "@/lib/atlas/surprise-query";
import { CANONICAL_VIBES, type CanonicalVibe } from "@/lib/trip-types";
import type { PreflightResult } from "@/lib/atlas/vibe-preflight";
import SurpriseClarificationCard from "./SurpriseClarificationCard";
```

(`buildSurpriseQuery` is already imported — extend that line with `deriveDepartMonth` and `normalizeVibes`; both are exported.) Add a module-level `const CANONICAL = new Set<string>(CANONICAL_VIBES);` and, inside the component next to the existing `t`, `const tVibes = useTranslations("tripForm.vibes");` plus a labeling helper — canonical vibes get their localized label, custom free text echoes in the user's own words (G4 Scope: no internal enum value ever renders):

```tsx
  const vibeLabel = (vibe: string) => (CANONICAL.has(vibe) ? tVibes(vibe as CanonicalVibe) : vibe);
```

2. New state near the other `useState` calls:

```tsx
  type Adjust = { vibes?: string[]; month?: string; matchAny?: boolean };
  const [adjust, setAdjust] = useState<Adjust>({});
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [originName, setOriginName] = useState<string | null>(null);
  const locale = useLocale();
```

3. Rework `fetchSuggestions` to read the adjust state and capture the new payload fields (keep the AbortSignal contract and the existing catch/finally exactly). Because `adjust` joins the `useCallback` deps, every `setAdjust` gives the callback a new identity and the existing `useEffect([originCode, fetchSuggestions])` re-runs it with proper abort semantics — the handlers below therefore only set state and never fetch directly (no double-fetch, no stale closure):

```tsx
  const fetchSuggestions = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setDegraded(null);
    setPreflight(null);

    const params = buildSurpriseQuery({
      originCode,
      vibesSummary: adjust.vibes ? adjust.vibes.join(",") : vibesSummary,
      flexibleWindow,
      tripLength,
      startDate,
      matchAny: adjust.matchAny,
      departMonthOverride: adjust.month,
    });

    return fetch(`/api/surprise-me?${params.toString()}`, { signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        setOriginName(typeof data?.originName === "string" ? data.originName : null);
        if (Array.isArray(data?.destinations) && data.destinations.length > 0) {
          setDestinations(data.destinations);
          setDegraded(null);
        } else {
          setDestinations([]);
          setDegraded(data?.degraded ?? { reason: t("degradedNetworkBody") });
          setPreflight((data?.preflight as PreflightResult | undefined) ?? null);
        }
      })
      .catch((e) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        console.warn("[SurpriseMeSection] fetch failed", e);
        setDestinations([]);
        setDegraded({ reason: t("degradedNetworkBody") });
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [adjust, originCode, vibesSummary, flexibleWindow, startDate, tripLength, t]);
```

4. Handlers (place after `handleChatWithAtlas`):

```tsx
  const effectiveVibes = adjust.vibes ?? normalizeVibes(vibesSummary);
  // Review I3: the month shown on the card's chips and told to Atlas MUST be
  // the month the search actually used — deriveDepartMonth handles
  // "2_3_months" (+2), "6_months" (+6) and dated trips. A hardcoded
  // next-month here would misstate the user's intent back to them.
  const effectiveMonth = adjust.month ?? deriveDepartMonth(flexibleWindow, startDate);

  // setAdjust alone triggers the refetch: fetchSuggestions depends on `adjust`,
  // so the [originCode, fetchSuggestions] effect re-runs with abort handling.
  function handleMatchAny() {
    setAdjust({ ...adjust, matchAny: true });
  }

  function handlePickMonth(month: string) {
    setAdjust({ ...adjust, month });
  }

  function handleUseSuggestion(vibe: string) {
    const unknown = preflight?.status === "unknown_vibes" ? preflight.unknown : [];
    const known = effectiveVibes.filter((v) => !unknown.includes(v));
    setAdjust({ ...adjust, vibes: [...new Set([...known, vibe])] });
  }

  function handleUseKnownOnly() {
    const unknown = preflight?.status === "unknown_vibes" ? preflight.unknown : [];
    setAdjust({ ...adjust, vibes: effectiveVibes.filter((v) => !unknown.includes(v)) });
  }

  function handleAskAtlasWithIntent() {
    const [year, monthNum] = effectiveMonth.split("-").map(Number);
    const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, monthNum - 1, 1))
    );
    // The seed renders in the visible chat as the user's own message: vibes are
    // localized labels (never internal values), and when the origin cannot be
    // named the origin phrase is OMITTED — never a bare code (review I4; Jose's
    // rule grants no "the user typed it themselves" exception).
    const seedVibes = effectiveVibes.map(vibeLabel).join(", ");
    const message = originName
      ? t("clarifyAtlasSeed", { origin: originName, month: monthLabel, vibes: seedVibes })
      : t("clarifyAtlasSeedNoOrigin", { month: monthLabel, vibes: seedVibes });
    window.dispatchEvent(new CustomEvent("atlas-open", { detail: { message } }));
  }
```

5. In the render, split the `degraded` branch — clarification card for preflight codes, existing banner otherwise:

```tsx
      ) : degraded && preflight && preflight.status !== "ok" &&
        (degraded.code === "unknown_vibes" || degraded.code === "no_match_possible") ? (
        <SurpriseClarificationCard
          preflight={preflight}
          vibes={effectiveVibes}
          departMonth={effectiveMonth}
          onMatchAny={handleMatchAny}
          onPickMonth={handlePickMonth}
          onUseSuggestion={handleUseSuggestion}
          onUseKnownOnly={handleUseKnownOnly}
          onAskAtlas={handleAskAtlasWithIntent}
        />
      ) : degraded ? (
        /* existing PlannerErrorBanner branch — UNCHANGED */
```

6. Fix the hero subtitle's TWO leaks (G4 Scope — review I1 + I4). In `SurpriseMeSection`, compute the localized vibes display BEFORE interpolation and pass it in place of the raw summary:

```tsx
  // G4: the subtitle renders localized vibe labels, never internal values like
  // "big_city". Custom free text (and the "flexible" sentinel) echo as-is.
  const vibesLabel = vibesSummary
    .split(" + ")
    .map((v) => vibeLabel(v.trim()))
    .join(" + ");
```

then render `<AtlasHeroSection destinations={destinations} originName={originName} vibesSummary={vibesLabel} budgetLabel={budgetLabel} ...>`. In `src/components/AtlasHeroSection.tsx`, **replace** the `originCode: string` prop with `originName?: string | null` (the subtitle was `originCode`'s only consumer — verify with a quick grep before deleting) and change the subtitle render to:

```tsx
          <p className="text-sm text-orange-800">
            {originName
              ? t("subtitle", { vibes: vibesSummary, origin: originName, budget: budgetLabel })
              : t("subtitleNoOrigin", { vibes: vibesSummary, budget: budgetLabel })}
          </p>
```

There is NO fallback to the bare code: when the origin cannot be named, the `subtitleNoOrigin` variant omits the origin phrase entirely (review I4 — "the user typed that code themselves" is an exception Jose's rule does not grant).

*(Design note, per spec: the Ask-Atlas seed goes through the EXISTING chat auto-send mechanism — Atlas spends tokens only when the user explicitly clicks "Ask Atlas". The seed carries origin, month, vibes, and the failure framing, in the user's own language. The card never fabricates a destination to fill the gap.)*

- [ ] **Step 5: Extend the tripwire + run**

Add `"src/components/SurpriseClarificationCard.tsx",` to `SURPRISE_PATH_FILES` in `src/lib/atlas/no-fabrication.test.ts`.

Run: `npx vitest run src/components src/lib/atlas/no-fabrication.test.ts` then `npm run test:unit`
Expected: all pass, including the pre-existing `SurpriseMeSection.test.tsx` degraded-banner tests (unchanged behavior for non-preflight codes) and the `buildSurpriseQuery`/no-`new URLSearchParams` tripwires (the wiring keeps query construction delegated).

- [ ] **Step 6: Update the help copy** (standing rule `feedback_update_help_with_features`)

In `src/lib/help-content.ts`, `"planner-itinerary"` sections, append after the `"Atlas chat"` entry:

```ts
      { heading: "When nothing matches", text: "If no destination fits every vibe you picked, Atlas says so honestly and offers real ways forward: match any of your vibes instead of all of them, try a different month, or ask Atlas in chat — it already knows your starting city, month, and vibes. Atlas never fills the gap with made-up destinations or prices." },
```

- [ ] **Step 7: Commit**

```bash
git add src/components/SurpriseClarificationCard.tsx src/components/SurpriseClarificationCard.test.tsx src/components/SurpriseMeSection.tsx src/components/SurpriseMeSection.test.tsx src/components/AtlasHeroSection.tsx src/lib/atlas/no-fabrication.test.ts src/lib/help-content.ts
git commit -m "feat(surprise): interactive clarification card replaces the dead-end banner for preflight misses"
```

---

### Task 8: E2E, visual evidence, final gates

**Files:**
- Modify: `tests/e2e/planner-trust.spec.ts`
- Create: `docs/superpowers/evidence/2026-07-12-vibe-fix/*.png`

- [ ] **Step 1: Start the dev server (separate shell / background)**

```bash
npm run dev -- -p 3001
```

Wait for `Ready` on http://localhost:3001. Reminder: if every Playwright test fails in ~300ms, the server died — restart it, don't debug the tests.

- [ ] **Step 2: Add two e2e tests to `tests/e2e/planner-trust.spec.ts`**

Follow the file's existing interception pattern (see the `Path B → "Plan a trip to X"` test). `POST /api/trips` accepts `interests` (verified: `src/app/api/trips/route.ts`, `interests = []` destructure).

```ts
test('impossible vibe combo renders the clarification card, and match-any re-runs the search', async ({ page, context }) => {
  const post = await context.request.post('/api/trips', {
    data: {
      name: 'Clarify test', destination: 'Surprise Me', budget: 'midrange', origin: 'MIA',
      interests: ['vibe:tropical', 'vibe:winter'],
    },
  });
  const trip = await post.json();

  await context.route('/api/surprise-me*', (route) => {
    const url = route.request().url();
    if (url.includes('match=any')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          origin: 'MIA',
          originName: 'Miami, Florida',
          destinations: [
            { name: 'Cancún, Mexico', flightPrice: '$142', airline: 'AA', nonstop: true, link: '' },
            { name: 'Denver, Colorado', flightPrice: '$98', airline: 'UA', nonstop: true, link: '' },
          ],
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        origin: 'MIA',
        originName: 'Miami, Florida',
        destinations: [],
        degraded: { code: 'no_match_possible', reason: 'engine prose' },
        preflight: { status: 'no_match_possible', wouldMatchIfAny: 40 },
      }),
    });
  });

  await page.goto(`/planner/${trip.id}`);

  const card = page.locator('[data-testid="surprise-clarification-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });
  await expect(card).toContainText('40');
  // it clarifies — it never invents a destination card
  await expect(page.locator('[data-testid="atlas-destination-card"]')).toHaveCount(0);

  await page.click('[data-testid="clarify-match-any"]');
  await expect(page.locator('[data-testid="atlas-destination-card"]')).toHaveCount(2, { timeout: 10000 });
  await expect(page.locator('[data-testid="surprise-clarification-card"]')).toHaveCount(0);
});

test('unknown free-text vibe renders suggestions instead of a silent dead end', async ({ page, context }) => {
  const post = await context.request.post('/api/trips', {
    data: {
      name: 'Unknown vibe test', destination: 'Surprise Me', budget: 'midrange', origin: 'MIA',
      interests: ['vibe:custom:wine tasting', 'vibe:beach'],
    },
  });
  const trip = await post.json();

  await context.route('/api/surprise-me*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      origin: 'MIA',
      originName: 'Miami, Florida',
      destinations: [],
      degraded: { code: 'unknown_vibes', reason: 'engine prose' },
      preflight: { status: 'unknown_vibes', unknown: ['wine tasting'], suggestions: ['foodie'] },
    }),
  }));

  await page.goto(`/planner/${trip.id}`);

  const card = page.locator('[data-testid="surprise-clarification-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });
  await expect(card).toContainText('wine tasting');
  await expect(page.locator('[data-testid="clarify-suggestion"]').first()).toBeVisible();
  await expect(page.locator('[data-testid="surprise-fallback-banner"]')).toHaveCount(0);
});
```

- [ ] **Step 3: Run the e2e suite**

Run: `npx playwright test`
Expected: **43/43 pass** (41 baseline + 2 new). If `visual-baseline.spec.ts` snapshots fail, STOP and inspect the diff images in `playwright-report/` — the baseline trips are Path A (destination Cancún, no vibes), so context-strip and Surprise-hero changes must not touch them; a diff means an unintended UI change leaked.

- [ ] **Step 4: Visual evidence for Jose (spec §4 — this bug class was found by eye, not by tests)**

With the dev server up and the REAL `TRAVELPAYOUTS_TOKEN` in `.env.local` (do NOT mock):
1. Via the planner UI, create a Surprise Me trip from origin JFK with vibes **Cultural + Food** → screenshot the REAL cards (`/planner/<id>`, EN locale) → `cultural-foodie-cards-en.png`.
2. Create one with **Winter Escapade + Mountains** → screenshot the REAL cards (this was a dead combination before this branch) → `winter-mountains-cards-en.png`.
3. Create one with **Tropical + Winter Escapade** → screenshot the clarification card (EN) → `clarification-en.png`.
4. Repeat #3 under `/es/planner/<id>` → `clarification-es.png`.

Save all to `docs/superpowers/evidence/2026-07-12-vibe-fix/`. Present to Jose for visual review — **no deploy without it**.

**PR-description note (review I6):** when PR #7's description is next updated, it MUST restate the accepted G4 gap from the **G4 Scope** section — Atlas's chat path (AssistantChat page context `Departing from:`/`Flying from:` and `getDeals` tool outputs) still passes raw codes to the model by Jose's explicit decision ("let Atlas speak naturally"). This is a documented, approved exception — not an oversight and not a TODO to sneak-fix.

- [ ] **Step 5: Final gates (all four, fresh, in order — record outputs)**

```bash
npm run lint          # expected: 0 errors, 30 warnings (baseline; new code adds none)
npm run test:unit     # expected: 0 failures; ≥ 200 tests (156 baseline + this plan's ~50)
npm run build         # expected: clean; also proves the server-only name table stays out of client bundles
npx playwright test   # expected: 43/43 (dev server on :3001)
```

Any gate failure → fix and re-run ALL four. Do not report done on stale output.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/planner-trust.spec.ts docs/superpowers/evidence/2026-07-12-vibe-fix
git commit -m "test(e2e): clarification-card flows + visual evidence for the vibe-vocabulary fix"
```

---

## Verification-gate design notes (anti-self-defeat audit)

Every scan/gate in this plan was checked against what it would actually match in THIS repo. This bug class has appeared in five prior plans here — reason before adding any new gate.

1. **There is deliberately NO text-ban on retired vibe words.** A substring ban on `mountain` is UNSATISFIABLE — it matches the canonical `mountains` everywhere, plus prose, city names, and the frozen test fixture. Same for `city` (substring of `big_city`) and the other dead `PRESET_VIBES` words. Drift protection is structural instead: `DESTINATION_VIBES` is TYPED `ReadonlySet<CanonicalVibe>` (a stray tag is a compile error) and the guard's vocabulary-EQUALITY test catches anything the types cannot.
2. **The dead-code tripwire uses `existsSync`** for the three deleted components (matches nothing textual, cannot match itself) and scans exactly ONE product file (`trip-types.ts`) for `PRESET_VIBES` — never test files, never docs, never this plan.
3. **Zero-wire-call assertions live in `surprise.http-budget.test.ts`, not `surprise.test.ts`** — the latter module-mocks `tpGet`, so a fetch spy there would pass vacuously even without the short-circuit. In the http-budget file, `fetch` IS the wire boundary and the tests genuinely fail pre-implementation.
4. **No gate asserts exact generated-table counts** — TP's upstream data drifts; tests assert invariants (> 9,000 entries, > 400 suffixed, label shape, specific known codes). The measured 9,471/545 figures appear only as expected script output, with a stated drift band.
5. **`wouldMatchIfAny` is asserted against a count DERIVED from `DESTINATION_VIBES` in the test itself**, never a hardcoded 40 — future editorial tag additions won't break it.
6. **The regression guard asserts live exports** (`VIBE_OPTIONS`, `DESTINATION_VIBES`) — it cannot be satisfied by editing copies of itself, and its pre-fix failure is captured as evidence (`guard-prefix-failure.txt`) rather than re-demonstrated by later gymnastics.
7. **The fabrication tripwire's banned-literal list** applies to three files this plan creates and several it edits — called out in Global Constraints so nobody writes `FALLBACK` (or `MIA` in `surprise.ts`) in a comment and trips it.
8. **The zero-LLM source scan (review N4) was checked against the module it scans.** `vibe-preflight.ts`'s own header comment contains the word "spend" ("hard monthly spend cap"), so a bare substring ban on `spend` would be self-defeating. The scan therefore bans `@anthropic-ai` and `tool-loop` as substrings (absent from the module, verified against the Task 4 implementation) and `spend` only as an import specifier (`/from\s+["'][^"']*spend/`). It scans exactly one file — never the test that contains the banned strings by necessity.

## Deviations from the PLAN, found during implementation (2026-07-12)

1. **The clarification card's "try a different month" chips were REMOVED — the plan was wrong.**
   Found by adversarial review (SOL xhigh) during Task 7. `preflightVibes(vibes, matchMode)` never
   inspects the month, and the card renders ONLY when preflight status ≠ `ok`. So clicking a month
   re-ran the same deterministic check, got the identical status back, and re-rendered the SAME card
   — now offering four *later* months. The user could click forever and nothing could ever change:
   a dead-end control disguised as an escape hatch, inside the component whose entire job is ending
   dead ends. Month cannot matter for the pre-flight by construction, so the control was deleted
   (along with `upcomingMonths`, `onPickMonth`, `handlePickMonth`, `adjust.month`). `clarifyTryMonthLead`
   is now an unused i18n key (left in place, dropped from the parity list). If month-retry has value
   it belongs on the `no_vibe_match` banner, where the month genuinely changes the result — out of
   scope here. The card's real actions remain: match-any, use-suggestion / use-known-only, ask-Atlas.

2. **The Ask-Atlas seed was reworded in all six locales.** It claimed "couldn't find a destination
   that matches everything" even for `unknown_vibes`, where the search never ran at all. The seed is
   sent as the user's OWN message to a paid model, so it must be true for both card states.

## Deviations from the spec (flagged, with rationale)

1. **Six new destinations added to the taxonomy** (`YVR SLC ZRH GVA MUC AGP`). The spec's own winter seed list (Denver, Salt Lake, Zurich, Geneva, Aspen…) names cities that are not in the taxonomy, and the ≥ 8 coverage floor for `winter` is unreachable from the existing 82 + 13 city codes alone without dishonest tagging. Aspen (ASE) omitted: tiny airport TP rarely prices; floor met without it. **AGP carries NO `winter` tag** (review B2 — Málaga is winter-*sun*, the escape-FROM-winter reading Jose rejected and the amended spec bans); it stays as a genuine beach/cultural/foodie destination, leaving winter coverage at 9 (≥ 8).
2. **Same-city tag alignment** (`JFK/LGA/EWR` +romantic, `ORD/LHR` +nightlife, `MDE` +nightlife) is not in the spec but prevents "same city, different tags" inconsistencies now that metro codes and their airports coexist in the taxonomy and dedupe by city name. All additions are editorially true.
3. **`DestinationSuggestions.tsx` is deleted along with the spec's trio** — its only importer was `EntryTabs`; leaving it would just create fresh zero-importer dead code. The quiz-only types in `trip-types.ts` go for the same reason.
4. **`no_vibe_match` (preflight OK but live routes empty) keeps the existing banner.** The spec scopes the interactive card to the two preflight cases; the banner already carries honest guidance and a retry.
5. **The origin decode (hero subtitle, trip header, context-strip pill, Atlas seed) exceeds §3.3's destination-only scope** — deliberately, per Jose's G4 decision ("Name everything on-screen", see the G4 Scope section). There is NO fallback to a bare code anywhere: unnameable origins get dedicated no-origin i18n variants (subtitle/seed) or the phrase/pill is omitted (header/strip).
6. **`TripContextStrip` localized vibe labels** — the strip rendered the raw internal value (`big_city`) as a pill; same rationale.

## Resolved at plan review (2026-07-12 — do NOT re-litigate)

- **AGP (Málaga) `winter` tag → REMOVED** (review B2 + amended spec). Winter-sun is the escape-FROM-winter reading Jose rejected; no warm-weather destination may carry `winter`. AGP stays as beach/cultural/foodie. Winter coverage 9 (≥ 8) — machine-verified by the reviewer.
- **YVR (Vancouver) `beach` tag → REMOVED** (Jose, 2026-07-12: *"vancouver is not a beach city destination IMO."*). N2 is thereby resolved. YVR keeps mountains/winter/big_city/foodie/family. **Consequence, machine-verified against the final table: `beach+winter` becomes a SECOND impossible pair** (YVR was its sole carrier), joining `tropical+winter`. No third pair emerged; `beach` coverage 42 → 41, `winter` stays 9. Both impossible pairs route to `no_match_possible` → the clarification card, which is correct and honest. **Inventing a destination to carry beach+winter is forbidden** — that is precisely the fabrication this branch eliminates.
- **Winter chip label → "Winter Escapade"** (review B1, Jose's binding decision, now in the spec). An escapade is something you go ON — the chip unambiguously means a snow/ski adventure; ❄️ is correct. Internal value stays `winter`; the label cascades through `VIBE_LABELS`, all six locales, help copy, tests, and evidence wording. Jose confirms the es/pt/de/it renderings at review (Task 2 Step 4).
- **G4 scope** (review I1/I4/I6) → Jose's decision "Name everything on-screen; let Atlas speak naturally" — see the **G4 Scope** section. The chat-path code exposure is an accepted, Jose-approved gap, restated in the PR description (Task 8); every rendered surface is decoded, with omission (never a bare code) as the unnameable fallback.

## Uncertainties (do not guess — check at implementation time)

- **`surprise.test.ts` enrichment expectations after Task 1:** planning-time analysis says all existing fixtures survive the taxonomy edits (additive tags; new entries appended after existing ones in iteration order). If one drifts anyway, fix the FIXTURE to the new deterministic ranking, never the engine.
- **Levenshtein false positives** in `suggestVibes` (e.g. `winery` → also suggests `winter` at distance 2): bounded — suggestions are never auto-applied, cap 3, ≥ 4-char floor. If review finds an embarrassing pair, tighten canonical-name distance to ≤ 1 for 4–5-char tokens (review N7: acceptable as planned).
- **`resolve-surprise` destination strings** now include `" (all airports)"` for metro codes (trip.destination = "Chicago, United States (all airports)"). Well under the route's length cap and honest; flag to Jose if it reads oddly in the trip header.
- **Multi-airport dedupe deferral is reversed:** same-metro destinations are now excluded on both the live and curated-filler paths. The metro key comes from TravelPayouts' own `airports.json` `city_code` via the generated static table `src/lib/atlas/generated/airport-metros.json` (produced by `scripts/generate-city-names.mjs`), with no runtime call. JFK/LGA/EWR map to NYC; BUR/SNA map to LAX. Honest limit: TP maps ONT -> ONT and LGB -> LGB, so Ontario and Long Beach are separate TP cities and are not excluded for an LAX origin; we do not fabricate a grouping TP does not make. Unresolvable code falls back to exact-code exclusion only. Airline codes are never rendered: display names come from the generated TP `airlines.json` table (`B6` -> `jetBlue`), and unresolvable airlines render nothing, never the raw code.
- **Month-boundary drift (review N5):** `deriveDepartMonth` uses local `new Date(...)` → `toISOString()`, which can drift one month near month-end in western timezones. Pre-existing pattern; the new `upcomingMonths` in the card already uses `Date.UTC`. Noted, not fixed here — flag if Jose wants a sweep.
- **Match-any copy vs. card count (review N6):** `clarifyMatchAny` reports the honest any-match destination count (e.g. 40) while the re-run renders at most 3 cards. The count states how many places QUALIFY, not how many cards we show — kept as-is; flag the wording to Jose at copy review.
- **Editorial flag for Jose (review N1):** MOW's bookability for US origins — flagged inline in the Editorial Tag Changes section. Jose decides; do not decide silently. (**N2 — YVR's `beach` tag — is RESOLVED: Jose removed it**, see "Resolved at plan review".)
