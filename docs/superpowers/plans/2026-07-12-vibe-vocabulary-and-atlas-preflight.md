# Vibe Vocabulary Unification + Destination Coverage + Atlas Pre-Flight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-12-vibe-vocabulary-and-atlas-preflight-design.md` (approved — this plan implements it, it does not redesign it)

**Goal:** Make every user-selectable vibe actually matchable (one canonical vocabulary, guarded by tests), name every destination a user sees (no raw IATA codes, ever), and replace the dead-end empty-result banner with a deterministic, zero-LLM pre-flight clarification card.

**Architecture:** The picker's words become the canonical vocabulary; the 95-destination taxonomy is migrated/extended editorially (full table below — it is the deliverable, not an exercise for the implementer). A `server-only` generated name table (from TravelPayouts' own city/airport/country data) backs a `resolveCityName()` lookup with the curated 127-entry table as primary. A pure `preflightVibes()` module short-circuits the TravelPayouts fetch when the request can never match, and the UI turns that into an interactive clarification card in all six locales.

**Tech Stack:** Next.js (App Router), TypeScript, next-intl, vitest + RTL, Playwright, better-sqlite3. No new npm dependencies (`server-only` is provided by Next.js itself and is already used by `src/lib/assistant-health.ts`; vitest already aliases it to `src/test/stubs/server-only-stub.ts`).

## Global Constraints

- **Worktree:** `/home/jarvis/.openclaw/workspace/jarvis-project/travelplaninfo-prototype/.worktrees/surprise-me`, branch `feat/surprise-me-workstation-independence`. All paths below are relative to it. All commands run from it.
- **Zero fabrication on every path** (spec G7). Never invent a destination, price, airline, or name. If a code cannot be named, DROP the destination. Never map `CHI → ORD`.
- **Canonical vibes (exactly 10):** `beach, city, adventure, food, culture, nature, nightlife, wellness, family, romantic`.
- **Zero LLM calls in the pre-flight** (Atlas has a $10/mo cap). `vibe-preflight.ts` is pure set math + string distance. No imports from `tool-loop`, `spend`, or any Anthropic SDK path.
- **`min_overlap` semantics preserved:** 2 when 2+ vibes and matchMode `all` (default); 1 for a single vibe; 1 when matchMode `any`.
- **Generated name table is server-side only.** It must never be imported by a client component (`import "server-only"` guard + build gate).
- **All new user-facing copy in all six locales** (`en, es, pt, fr, de, it`), genuinely translated (exact strings provided below — do not re-translate, do not paste English into non-EN files). No API jargon, no "IATA", no parameter names in any user-facing string.
- **Do not use the word `FALLBACK` (or the other literals banned by `src/lib/atlas/no-fabrication.test.ts`: `$89`, `$95`, `$75`, `$127`, `$159`, `$189`, `/night`, `hotelPrice`, `Spirit NK`, `JetBlue`, `V1_FALLBACK`) anywhere in the surprise-path source files, including comments.** The tripwire scans file text.
- **Fresh-measured baselines (2026-07-12, HEAD `470b86a`):** `npm run lint` → 0 errors / 30 warnings · `npm run test:unit` → 21 files, 156 tests, all pass · `npx playwright test --list` → 41 tests in 8 files · `npm run build` → clean.
- **Playwright needs a dev server on :3001** (`playwright.config.ts` has NO `webServer` block): start it with `npm run dev -- -p 3001` in a separate shell/background before `npx playwright test`. If ALL tests fail in ~300ms, the server died — restart it, don't debug the tests.
- **Commit per task** with the messages given. Do not push or merge — this branch is PR #7's branch and Jose reviews before anything ships.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/trip-types.ts` | Modify | `PRESET_VIBES` grows to the 10 canonical vibes; typed `VIBE_ICONS` / `VIBE_OPTIONS` (compile-time drift guard for pickers) |
| `src/lib/atlas/destination-vibes.ts` | Rewrite | 95-destination taxonomy in canonical vocabulary, typed `ReadonlySet<PresetVibe>` |
| `src/lib/atlas/vibe-vocabulary.guard.test.ts` | Create | THE regression guard: picker ⊆ taxonomy, taxonomy vocabulary == canonical, coverage floor ≥ 8, every taxonomy key nameable |
| `src/lib/atlas/destination-vibes.test.ts` | Rewrite | Migration no-loss test (frozen old table → mechanical map ⊆ new), spot checks, shape checks |
| `scripts/generate-city-names.mjs` | Create | Regenerates the name table from TravelPayouts' public data (provenance) |
| `src/lib/atlas/generated/city-names.json` | Create (generated) | ~9,471 `code → "City, Country"` entries, 545 with `" (all airports)"` |
| `src/lib/atlas/city-names.ts` | Create | `resolveCityName()` — curated `IATA_TO_CITY` first, generated second, `null` = drop; `server-only` |
| `src/lib/atlas/city-names.test.ts` | Create | Naming behavior + server-only tripwire + generated-table sanity |
| `src/lib/atlas/vibe-preflight.ts` | Create | Pure `preflightVibes()` + suggestion engine (synonyms + edit distance) |
| `src/lib/atlas/vibe-preflight.test.ts` | Create | ok / unknown_vibes / no_match_possible / suggestions / determinism |
| `src/lib/atlas/surprise.ts` | Modify | preflight short-circuit, `matchMode`, shared `minOverlap`, name resolution + drop, same-city dedupe, `originName` |
| `src/lib/atlas/surprise.test.ts` | Modify | live-bug pins, preflight short-circuit (zero fetch), matchMode, naming/drop tests; fixture vocab update |
| `src/lib/atlas/surprise.wire.test.ts`, `surprise.http-budget.test.ts` | Modify | `"tropical,beach"` fixtures → `"beach,romantic"` (same expected counts) |
| `src/lib/atlas/surprise-degrade.ts` + `.test.ts` | Modify | `unknown_vibes`, `no_match_possible` codes + i18n keys |
| `src/lib/atlas/surprise-query.ts` + `.test.ts` | Modify | `matchAny` + `departMonthOverride` in `buildSurpriseQuery` |
| `src/app/api/surprise-me/route.ts` + `route.test.ts` | Modify | `match` query param, cache key, pass-through |
| `messages/{en,es,pt,fr,de,it}/common.json` | Modify | `atlasHero.clarify*` + 2 degraded keys; `tripForm.vibes` (10 canonical); `quiz.vibe_*` (10) |
| `src/components/SurpriseClarificationCard.tsx` + `.test.tsx` | Create | The interactive clarification card |
| `src/components/SurpriseMeSection.tsx` + `.test.tsx` | Modify | Render card for preflight codes; match-any / month / suggestion / ask-Atlas actions |
| `src/components/TripForm.tsx` | Modify | Live picker uses canonical `VIBE_OPTIONS` + i18n labels (kills the third vocabulary) |
| `src/components/TripContextStrip.tsx` | Modify | Vibe icon map keyed on canonical vibes |
| `src/lib/atlas/no-fabrication.test.ts` | Modify | Tripwire extended to new files + old-vocabulary ban |
| `src/lib/help-content.ts` | Modify | Feature help reflects new vibes + clarification card (standing rule: `feedback_update_help_with_features`) |
| `tests/e2e/planner-trust.spec.ts` | Modify | 2 new e2e tests for the clarification card |

**Not touched (explicitly):** `src/components/BootstrapModal.tsx` (`GUEST_INTERESTS` contains `'mountains'` but those are *interests*, not vibes — they never enter the vibe pipeline); `src/components/EntryTabs.tsx` / `SurpriseMeQuiz.tsx` beyond what `PRESET_VIBES` gives them for free (EntryTabs is unmounted, rejected 2026-04-10 — confirmed: nothing imports it); `preferences.climatePlaceholder` i18n string ("warm, tropical, temperate" is prose about climate, not a vibe tag).

---

## The Canonical Tag Table (the editorial deliverable)

Mechanical renames applied everywhere: `big_city→city`, `cultural→culture`, `foodie→food`, `mountain→nature`, `tropical→beach` (fold — every `tropical` destination was already `beach`-tagged, so the fold only removes the duplicate). `romantic` kept. Editorial additions marked **bold**. This table was machine-validated: all tags ⊆ canonical; every destination ≥ 1 tag; every canonical vibe carried by ≥ 8 destinations (actual floor: `wellness` = 11); every entry is a superset of its mechanically-migrated old tags; every code resolves to a display name.

**Coverage after migration (95 destinations):** beach 41 · city 55 · adventure 20 · food 46 · culture 59 · nature 16 · nightlife 30 · wellness 11 · family 18 · romantic 29.

**Known property:** exactly one 2-vibe combination remains unsatisfiable at `min_overlap=2`: **`nature + nightlife`** (no destination carries both). This is intentional — it is a genuinely rare ask, it is the natural real-data fixture for the `no_match_possible` path, and the clarification card handles it. Every other 2-vibe combo (44/45) matches ≥ 1 destination.

### Caribbean & Mexico

| Code | City (for reviewer orientation) | New tags | Editorial rationale for additions |
|---|---|---|---|
| CUN | Cancún | beach, city, nightlife, romantic, **family**, **wellness** | The mass-market do-everything resort hub: family all-inclusives and Riviera Maya spa resorts are both core products |
| SJU | San Juan | beach, city, culture, nightlife | — |
| PUJ | Punta Cana | beach, romantic, **family**, **wellness** | All-inclusive family resorts + resort spas are the destination's identity |
| MBJ | Montego Bay | beach, romantic, adventure | — |
| NAS | Nassau | beach, romantic, **family** | Atlantis / water-park resort tourism |
| GCM | Grand Cayman | beach, romantic, **family** | Seven Mile Beach + Stingray City are family staples |
| BGI | Bridgetown | beach, romantic, culture | — |
| ANU | Antigua | beach, romantic | — |
| STT | St. Thomas | beach, romantic, adventure | — |
| STX | St. Croix | beach, adventure | — |
| SXM | Sint Maarten | beach, nightlife, romantic | — |
| PLS | Providenciales | beach, romantic, **family** | Grace Bay family-resort market |
| SJD | Los Cabos | beach, romantic, adventure, **wellness** | Cabo spa-resort corridor |
| PVR | Puerto Vallarta | beach, romantic, nightlife | — |
| CTG | Cartagena | beach, culture, romantic | — |
| SDQ | Santo Domingo | beach, city | — |
| ZIH | Zihuatanejo | beach, romantic, **wellness** | Quiet retreat/spa positioning vs. party resorts |
| HAV | Havana | beach, culture, **nightlife** | Live-music/club scene is a primary draw |
| MCO | Orlando (airport code) | beach, city, adventure, **family** | Theme-park capital; `beach` retained from the old table (no-loss rule; day-trip coast) |
| MIA | Miami | beach, city, nightlife | — |
| FLL | Fort Lauderdale | beach, **family** | Family beach market |
| TPA | Tampa | beach, **family** | Busch Gardens + gulf beaches |
| RSW | Fort Myers | beach, **family**, **nature** | Sanibel shelling, Everglades edge |
| SAN | San Diego | beach, city, food, **family** | Zoo, Legoland, family beaches |
| HNL | Honolulu | beach, romantic, adventure, **family**, **nature** | Family resort + volcano/trail nature |

### US & Canada cities

| Code | City | New tags | Editorial rationale |
|---|---|---|---|
| JFK | New York | city, culture, food, nightlife, **romantic** | Aligned with the NYC city-code entry (same city must carry the same tags) |
| LGA | New York | city, culture, food, nightlife, **romantic** | Same as JFK |
| EWR | Newark/NYC | city, culture, food, nightlife, **romantic** | Same as JFK |
| LAX | Los Angeles | beach, city, culture, food, nightlife | — |
| ORD | Chicago | city, culture, food, **nightlife** | Aligned with the CHI city-code entry |
| LAS | Las Vegas | nightlife, city, adventure | — |
| ATL | Atlanta | city, culture, food | — |
| DFW | Dallas | city, food | — |
| DEN | Denver | nature, adventure, city | — |
| SEA | Seattle | city, culture, food, nature | — |
| BOS | Boston | city, culture, food | — |
| SFO | San Francisco | city, culture, food | — |
| MSY | New Orleans | culture, food, nightlife | — |
| BNA | Nashville | culture, nightlife, food | — |
| AUS | Austin | culture, nightlife, food | — |
| PDX | Portland | food, culture, **nature** | Columbia Gorge / Mt. Hood day-trips |
| PHX | Phoenix | adventure, nature, **wellness** | Scottsdale/Sedona spa-resort market |

### Europe

| Code | City | New tags | Editorial rationale |
|---|---|---|---|
| LHR | London | city, culture, food, **nightlife** | Aligned with the LON city-code entry |
| CDG | Paris | city, culture, food, romantic | — |
| FCO | Rome | city, culture, food, romantic | — |
| BCN | Barcelona | city, beach, culture, food, nightlife | — |
| MAD | Madrid | city, culture, food, nightlife | — |
| AMS | Amsterdam | city, culture, nightlife | — |
| LIS | Lisbon | city, culture, food, beach, romantic | — |
| ATH | Athens | culture, beach, food, romantic | — |
| IST | Istanbul | city, culture, food | — |
| DUB | Dublin | culture, food, **nightlife** | Pub/live-music culture is the headline draw |
| CPH | Copenhagen | culture, food, city, **family** | Tivoli Gardens; famously child-friendly city |
| PRG | Prague | culture, romantic, nightlife | — |
| BUD | Budapest | culture, nightlife, romantic, **wellness** | Thermal-bath city — canonical European wellness |
| KEF | Reykjavik | adventure, romantic, **nature**, **wellness** | Glaciers/waterfalls; Blue Lagoon hot springs |

### Latin America

| Code | City | New tags | Editorial rationale |
|---|---|---|---|
| GIG | Rio de Janeiro | beach, city, culture, nightlife | — |
| GRU | São Paulo | city, culture, food | — |
| EZE | Buenos Aires | city, culture, food, nightlife | — |
| BOG | Bogotá | city, culture, food, nature | — |
| MDE | Medellín | city, culture, food, nature | — |
| LIM | Lima | city, culture, food | — |
| SJO | San José CR | adventure, beach, **nature** | Rainforest/volcano — Costa Rica IS a nature product |
| PTY | Panama City | city, beach | — |
| BZE | Belize City | beach, adventure, **nature** | Reef + jungle |

### Asia, Pacific, Middle East, Africa

| Code | City | New tags | Editorial rationale |
|---|---|---|---|
| BKK | Bangkok | city, culture, food, nightlife, beach, **wellness** | Thai massage/wellness tourism (beach comes from the tropical fold) |
| DPS | Bali | beach, culture, romantic, adventure, **wellness**, **nature** | Ubud retreats; rice terraces/volcanoes |
| SIN | Singapore | city, culture, food, **family** | Zoo, Sentosa, Gardens by the Bay |
| HKG | Hong Kong | city, culture, food | — |
| NRT | Tokyo | city, culture, food | — |
| HND | Tokyo | city, culture, food | — |
| ICN | Seoul | city, culture, food | — |
| DXB | Dubai | city, beach, **family** | Water-park/aquarium family resort market |
| CMB | Colombo | beach, culture, **wellness** | Ayurveda tradition |
| SYD | Sydney | city, beach, culture, food | — |
| AKL | Auckland | adventure, culture, **nature** | New Zealand outdoors |
| CPT | Cape Town | city, beach, adventure, culture, food, **nature** | Table Mountain / Cape Peninsula |
| NBO | Nairobi | adventure, culture, **nature** | Safari gateway |
| RAK | Marrakech | culture, food, romantic, **wellness** | Hammam/riad-spa tradition |
| CAI | Cairo | culture, city | — |
| HRG | Hurghada | beach, **adventure** | Red Sea diving |
| SSH | Sharm el-Sheikh | beach, **adventure** | Red Sea diving |

### NEW — high-frequency TravelPayouts CITY codes (spec §3.4; previously untagged, invisible to every vibe search)

| Code | City | Tags | Rationale |
|---|---|---|---|
| NYC | New York (35× in TP samples) | city, culture, food, nightlife, romantic | Spec's own example |
| CHI | Chicago (24×) | city, culture, food, nightlife | Spec's own example |
| ORL | Orlando (15×) | family, adventure | Spec's own example (theme parks) |
| WAS | Washington (5×) | city, culture, family | Smithsonian/National Mall — the classic family city trip |
| PAR | Paris (4×) | romantic, culture, food, city | Spec's own example |
| LON | London (3×) | city, culture, food, nightlife | World city; aligned with LHR |
| YTO | Toronto (2×) | city, culture, food, family | Diverse food city; zoo/Wonderland family draws |
| HOU | Houston | city, food, family | Space Center Houston; major food city |
| PIT | Pittsburgh | city, culture | Museum/heritage city |
| MOW | Moscow | city, culture, nightlife | — |
| RDU | Raleigh/Durham | city, food | Research-Triangle dining scene |
| ANC | Anchorage | nature, adventure | Spec's own example (Alaska) |
| BEG | Belgrade | city, nightlife, culture | Famous river-barge nightlife |

---

### Task 1: Canonical vocabulary, taxonomy migration, and THE regression guard

The core bug fix. After this task alone, `culture,food`-style searches return real cards. The guard is written first and **must be observed failing against the pre-fix state** (spec requirement) before the migration lands; test + fix commit together so the branch stays green.

**Files:**
- Modify: `src/lib/trip-types.ts` (lines 51–53)
- Rewrite: `src/lib/atlas/destination-vibes.ts`
- Create: `src/lib/atlas/vibe-vocabulary.guard.test.ts`
- Rewrite: `src/lib/atlas/destination-vibes.test.ts`
- Modify: `src/lib/atlas/surprise.test.ts`, `src/lib/atlas/surprise.wire.test.ts`, `src/lib/atlas/surprise.http-budget.test.ts` (fixture vocabulary only)

**Interfaces:**
- Produces: `PRESET_VIBES: readonly ["beach","city","adventure","food","culture","nature","nightlife","wellness","family","romantic"]`, `type PresetVibe = (typeof PRESET_VIBES)[number]`, `VIBE_ICONS: Record<PresetVibe, string>`, `VIBE_OPTIONS: { value: PresetVibe; icon: string }[]` (all from `@/lib/trip-types`); `DESTINATION_VIBES: Record<string, ReadonlySet<PresetVibe>>` with 95 keys (from `@/lib/atlas/destination-vibes`). Tasks 3, 4, 7 consume these exact names.

- [ ] **Step 1: Write the regression guard (failing)**

Create `src/lib/atlas/vibe-vocabulary.guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { PRESET_VIBES } from "@/lib/trip-types";
import { DESTINATION_VIBES } from "./destination-vibes";

// The single most important test in this change. The live bug (culture,food -> 0
// cards, masked for months by a fabricated fallback) was a silent drift between
// the words users can pick and the words the taxonomy carries. If this file
// fails, the vibe filter is broken for real users — do not weaken it.

const COVERAGE_FLOOR = 8;

function taxonomyVocabulary(): Set<string> {
  const vocabulary = new Set<string>();
  for (const tags of Object.values(DESTINATION_VIBES)) {
    for (const tag of tags) vocabulary.add(tag);
  }
  return vocabulary;
}

describe("vibe vocabulary regression guard", () => {
  it("every vibe a user can pick exists in the taxonomy", () => {
    const vocabulary = taxonomyVocabulary();
    for (const vibe of PRESET_VIBES) {
      expect(vocabulary.has(vibe), `picker vibe "${vibe}" matches nothing in DESTINATION_VIBES`).toBe(true);
    }
  });

  it("the taxonomy vocabulary EQUALS the canonical picker set (no orphan tags)", () => {
    expect([...taxonomyVocabulary()].sort()).toEqual([...PRESET_VIBES].sort());
  });

  it(`every canonical vibe is carried by at least ${COVERAGE_FLOOR} destinations`, () => {
    for (const vibe of PRESET_VIBES) {
      const carriers = Object.values(DESTINATION_VIBES).filter((tags) => tags.has(vibe)).length;
      expect(carriers, `"${vibe}" is carried by only ${carriers} destinations`).toBeGreaterThanOrEqual(COVERAGE_FLOOR);
    }
  });

  it("the picker exposes exactly the 10 canonical vibes", () => {
    expect([...PRESET_VIBES].sort()).toEqual(
      ["adventure", "beach", "city", "culture", "family", "food", "nature", "nightlife", "romantic", "wellness"]
    );
  });
});
```

**Amendment once Task 2 lands** (leave a `TODO(task-2)` comment now, resolve it in Task 2 Step 8): add a fifth guard asserting every taxonomy key is nameable, so a curated destination can never silently vanish from the filler:

```ts
  it("every taxonomy destination resolves to a display name (unnameable = invisible to users)", async () => {
    const { resolveCityName } = await import("./city-names");
    for (const code of Object.keys(DESTINATION_VIBES)) {
      expect(resolveCityName(code), `taxonomy code ${code} has no display name`).not.toBeNull();
    }
  });
```

- [ ] **Step 2: Run the guard — it MUST fail against the pre-fix state (record this output as evidence)**

Run: `npx vitest run src/lib/atlas/vibe-vocabulary.guard.test.ts`
Expected: FAIL — all four tests. (`city` etc. missing from taxonomy; vocabulary is the old 9-tag set; `PRESET_VIBES` has 8 entries.)

- [ ] **Step 3: Update `src/lib/trip-types.ts`**

Replace lines 51–53 with:

```ts
export const PRESET_VIBES = [
  'beach', 'city', 'adventure', 'food', 'culture', 'nature', 'nightlife', 'wellness', 'family', 'romantic',
] as const;

export type PresetVibe = (typeof PRESET_VIBES)[number];

// Typed against PresetVibe so a picker can never carry a vibe the taxonomy
// doesn't know: adding/renaming a vibe without updating this map is a compile error.
export const VIBE_ICONS: Record<PresetVibe, string> = {
  beach: '🌊',
  city: '🏙️',
  adventure: '🏕️',
  food: '🍜',
  culture: '🏛️',
  nature: '🌲',
  nightlife: '🎶',
  wellness: '🧘',
  family: '👨‍👩‍👧‍👦',
  romantic: '💕',
};

export const VIBE_OPTIONS: { value: PresetVibe; icon: string }[] = PRESET_VIBES.map((value) => ({
  value,
  icon: VIBE_ICONS[value],
}));
```

- [ ] **Step 4: Rewrite `src/lib/atlas/destination-vibes.ts` with the full canonical table**

Replace the entire file content. Every entry below is the exact set from the Canonical Tag Table above — transcribe it verbatim:

```ts
import type { PresetVibe } from "@/lib/trip-types";

// Canonical vibe taxonomy. Vocabulary is exactly PRESET_VIBES — enforced at
// compile time by PresetVibe and at test time by vibe-vocabulary.guard.test.ts.
// Keys are the codes TravelPayouts returns: mostly airport codes, plus metro
// CITY codes (NYC, CHI, ORL, ...) which TP uses for its most popular destinations.
export const DESTINATION_VIBES: Record<string, ReadonlySet<PresetVibe>> = {
  // ── Caribbean & Mexico ──────────────────────────────────────────────
  CUN: new Set<PresetVibe>(['beach', 'city', 'nightlife', 'romantic', 'family', 'wellness']),
  SJU: new Set<PresetVibe>(['beach', 'city', 'culture', 'nightlife']),
  PUJ: new Set<PresetVibe>(['beach', 'romantic', 'family', 'wellness']),
  MBJ: new Set<PresetVibe>(['beach', 'romantic', 'adventure']),
  NAS: new Set<PresetVibe>(['beach', 'romantic', 'family']),
  GCM: new Set<PresetVibe>(['beach', 'romantic', 'family']),
  BGI: new Set<PresetVibe>(['beach', 'romantic', 'culture']),
  ANU: new Set<PresetVibe>(['beach', 'romantic']),
  STT: new Set<PresetVibe>(['beach', 'romantic', 'adventure']),
  STX: new Set<PresetVibe>(['beach', 'adventure']),
  SXM: new Set<PresetVibe>(['beach', 'nightlife', 'romantic']),
  PLS: new Set<PresetVibe>(['beach', 'romantic', 'family']),
  SJD: new Set<PresetVibe>(['beach', 'romantic', 'adventure', 'wellness']),
  PVR: new Set<PresetVibe>(['beach', 'romantic', 'nightlife']),
  CTG: new Set<PresetVibe>(['beach', 'culture', 'romantic']),
  SDQ: new Set<PresetVibe>(['beach', 'city']),
  ZIH: new Set<PresetVibe>(['beach', 'romantic', 'wellness']),
  HAV: new Set<PresetVibe>(['beach', 'culture', 'nightlife']),
  MCO: new Set<PresetVibe>(['beach', 'city', 'adventure', 'family']),
  MIA: new Set<PresetVibe>(['beach', 'city', 'nightlife']),
  FLL: new Set<PresetVibe>(['beach', 'family']),
  TPA: new Set<PresetVibe>(['beach', 'family']),
  RSW: new Set<PresetVibe>(['beach', 'family', 'nature']),
  SAN: new Set<PresetVibe>(['beach', 'city', 'food', 'family']),
  HNL: new Set<PresetVibe>(['beach', 'romantic', 'adventure', 'family', 'nature']),
  // ── US & Canada ─────────────────────────────────────────────────────
  JFK: new Set<PresetVibe>(['city', 'culture', 'food', 'nightlife', 'romantic']),
  LGA: new Set<PresetVibe>(['city', 'culture', 'food', 'nightlife', 'romantic']),
  EWR: new Set<PresetVibe>(['city', 'culture', 'food', 'nightlife', 'romantic']),
  LAX: new Set<PresetVibe>(['city', 'beach', 'culture', 'food', 'nightlife']),
  ORD: new Set<PresetVibe>(['city', 'culture', 'food', 'nightlife']),
  LAS: new Set<PresetVibe>(['nightlife', 'city', 'adventure']),
  ATL: new Set<PresetVibe>(['city', 'culture', 'food']),
  DFW: new Set<PresetVibe>(['city', 'food']),
  DEN: new Set<PresetVibe>(['nature', 'adventure', 'city']),
  SEA: new Set<PresetVibe>(['city', 'culture', 'food', 'nature']),
  BOS: new Set<PresetVibe>(['city', 'culture', 'food']),
  SFO: new Set<PresetVibe>(['city', 'culture', 'food']),
  MSY: new Set<PresetVibe>(['culture', 'food', 'nightlife']),
  BNA: new Set<PresetVibe>(['culture', 'nightlife', 'food']),
  AUS: new Set<PresetVibe>(['culture', 'nightlife', 'food']),
  PDX: new Set<PresetVibe>(['food', 'culture', 'nature']),
  PHX: new Set<PresetVibe>(['adventure', 'nature', 'wellness']),
  // ── Europe ──────────────────────────────────────────────────────────
  LHR: new Set<PresetVibe>(['city', 'culture', 'food', 'nightlife']),
  CDG: new Set<PresetVibe>(['city', 'culture', 'food', 'romantic']),
  FCO: new Set<PresetVibe>(['city', 'culture', 'food', 'romantic']),
  BCN: new Set<PresetVibe>(['city', 'beach', 'culture', 'food', 'nightlife']),
  MAD: new Set<PresetVibe>(['city', 'culture', 'food', 'nightlife']),
  AMS: new Set<PresetVibe>(['city', 'culture', 'nightlife']),
  LIS: new Set<PresetVibe>(['city', 'culture', 'food', 'beach', 'romantic']),
  ATH: new Set<PresetVibe>(['culture', 'beach', 'food', 'romantic']),
  IST: new Set<PresetVibe>(['city', 'culture', 'food']),
  DUB: new Set<PresetVibe>(['culture', 'food', 'nightlife']),
  CPH: new Set<PresetVibe>(['culture', 'food', 'city', 'family']),
  PRG: new Set<PresetVibe>(['culture', 'romantic', 'nightlife']),
  BUD: new Set<PresetVibe>(['culture', 'nightlife', 'romantic', 'wellness']),
  KEF: new Set<PresetVibe>(['adventure', 'romantic', 'nature', 'wellness']),
  // ── Latin America ───────────────────────────────────────────────────
  GIG: new Set<PresetVibe>(['beach', 'city', 'culture', 'nightlife']),
  GRU: new Set<PresetVibe>(['city', 'culture', 'food']),
  EZE: new Set<PresetVibe>(['city', 'culture', 'food', 'nightlife']),
  BOG: new Set<PresetVibe>(['city', 'culture', 'food', 'nature']),
  MDE: new Set<PresetVibe>(['city', 'culture', 'food', 'nature']),
  LIM: new Set<PresetVibe>(['city', 'culture', 'food']),
  SJO: new Set<PresetVibe>(['adventure', 'beach', 'nature']),
  PTY: new Set<PresetVibe>(['city', 'beach']),
  BZE: new Set<PresetVibe>(['beach', 'adventure', 'nature']),
  // ── Asia, Pacific, Middle East, Africa ──────────────────────────────
  BKK: new Set<PresetVibe>(['city', 'culture', 'food', 'nightlife', 'beach', 'wellness']),
  DPS: new Set<PresetVibe>(['beach', 'culture', 'romantic', 'adventure', 'wellness', 'nature']),
  SIN: new Set<PresetVibe>(['city', 'culture', 'food', 'family']),
  HKG: new Set<PresetVibe>(['city', 'culture', 'food']),
  NRT: new Set<PresetVibe>(['city', 'culture', 'food']),
  HND: new Set<PresetVibe>(['city', 'culture', 'food']),
  ICN: new Set<PresetVibe>(['city', 'culture', 'food']),
  DXB: new Set<PresetVibe>(['city', 'beach', 'family']),
  CMB: new Set<PresetVibe>(['beach', 'culture', 'wellness']),
  SYD: new Set<PresetVibe>(['city', 'beach', 'culture', 'food']),
  AKL: new Set<PresetVibe>(['adventure', 'culture', 'nature']),
  CPT: new Set<PresetVibe>(['city', 'beach', 'adventure', 'culture', 'food', 'nature']),
  NBO: new Set<PresetVibe>(['adventure', 'culture', 'nature']),
  RAK: new Set<PresetVibe>(['culture', 'food', 'romantic', 'wellness']),
  CAI: new Set<PresetVibe>(['culture', 'city']),
  HRG: new Set<PresetVibe>(['beach', 'adventure']),
  SSH: new Set<PresetVibe>(['beach', 'adventure']),
  // ── TravelPayouts metro CITY codes (TP's most-returned destinations) ─
  NYC: new Set<PresetVibe>(['city', 'culture', 'food', 'nightlife', 'romantic']),
  CHI: new Set<PresetVibe>(['city', 'culture', 'food', 'nightlife']),
  ORL: new Set<PresetVibe>(['family', 'adventure']),
  WAS: new Set<PresetVibe>(['city', 'culture', 'family']),
  PAR: new Set<PresetVibe>(['romantic', 'culture', 'food', 'city']),
  LON: new Set<PresetVibe>(['city', 'culture', 'food', 'nightlife']),
  YTO: new Set<PresetVibe>(['city', 'culture', 'food', 'family']),
  HOU: new Set<PresetVibe>(['city', 'food', 'family']),
  PIT: new Set<PresetVibe>(['city', 'culture']),
  MOW: new Set<PresetVibe>(['city', 'culture', 'nightlife']),
  RDU: new Set<PresetVibe>(['city', 'food']),
  ANC: new Set<PresetVibe>(['nature', 'adventure']),
  BEG: new Set<PresetVibe>(['city', 'nightlife', 'culture']),
};
```

- [ ] **Step 5: Rewrite `src/lib/atlas/destination-vibes.test.ts` (migration no-loss + spot checks)**

The old file asserts the old vocabulary — replace it entirely. The no-loss test freezes the OLD table as a fixture and asserts the new table is a superset of the mechanically-migrated old tags (renames applied, `tropical` folded). This is the spec-risk mitigation for "tag migration silently drops a destination's tags" — deliberately implemented as *superset of migrated old*, not "count never decreases", because the intentional `tropical→beach` fold reduces raw counts by design (spec §3.1).

```ts
import { describe, expect, it } from 'vitest';

import type { PresetVibe } from '@/lib/trip-types';
import { DESTINATION_VIBES } from './destination-vibes';

const RENAMES: Record<string, string> = {
  big_city: 'city',
  cultural: 'culture',
  foodie: 'food',
  mountain: 'nature',
  tropical: 'beach',
};

// Frozen pre-migration table (destination-vibes.ts as of 470b86a). Test fixture
// only — the legacy tag words below must never appear in product source.
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

const NEW_CITY_CODES = [
  'NYC', 'CHI', 'ORL', 'WAS', 'PAR', 'LON', 'YTO', 'HOU', 'PIT', 'MOW', 'RDU', 'ANC', 'BEG',
];

describe('DESTINATION_VIBES (canonical)', () => {
  it('contains every pre-migration destination plus the 13 TP city codes (95 total)', () => {
    const keys = Object.keys(DESTINATION_VIBES);
    expect(keys).toHaveLength(95);
    for (const code of Object.keys(PRE_MIGRATION_TAGS)) {
      expect(keys, `destination ${code} was dropped by the migration`).toContain(code);
    }
    for (const code of NEW_CITY_CODES) {
      expect(keys, `new city code ${code} is missing`).toContain(code);
    }
  });

  it('no destination lost information: new tags ⊇ mechanically-migrated old tags', () => {
    for (const [code, oldTags] of Object.entries(PRE_MIGRATION_TAGS)) {
      const migrated = new Set(oldTags.map((tag) => RENAMES[tag] ?? tag));
      for (const tag of migrated) {
        expect(
          DESTINATION_VIBES[code].has(tag as PresetVibe),
          `${code} lost migrated tag "${tag}"`
        ).toBe(true);
      }
    }
  });

  it('every destination has at least one tag and three-letter uppercase keys', () => {
    for (const [code, tags] of Object.entries(DESTINATION_VIBES)) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect(tags.size).toBeGreaterThanOrEqual(1);
    }
  });

  it('spot-checks exact editorial tag sets', () => {
    const sorted = (code: string) => [...DESTINATION_VIBES[code]].sort();
    expect(sorted('CUN')).toEqual(['beach', 'city', 'family', 'nightlife', 'romantic', 'wellness']);
    expect(sorted('KEF')).toEqual(['adventure', 'nature', 'romantic', 'wellness']);
    expect(sorted('ORL')).toEqual(['adventure', 'family']);
    expect(sorted('PAR')).toEqual(['city', 'culture', 'food', 'romantic']);
    expect(sorted('ANC')).toEqual(['adventure', 'nature']);
    expect(sorted('NYC')).toEqual(['city', 'culture', 'food', 'nightlife', 'romantic']);
  });
});
```

- [ ] **Step 6: Pin the live bug in `src/lib/atlas/surprise.test.ts`**

Append this describe block (uses the file's existing `popular()` / `item()` helpers; mocked TP as spec §4 requires — these four assertions fail pre-fix because the old taxonomy had no `culture`/`food`/`city`/`nature`/`wellness` tags):

```ts
describe("LIVE BUG PINS: dead-vibe combinations must return destinations (mocked TP)", () => {
  it.each([
    ["culture,food", "FCO", "Rome, Italy"],
    ["city,food", "SFO", "San Francisco, California"],
    ["nature,wellness", "KEF", "Reykjavik, Iceland"],
    ["culture,nightlife", "PRG", "Prague, Czech Republic"],
  ])("vibes=%s returns at least the matching mocked route", async (vibes, code, cityName) => {
    popular([item(code, 150)]);

    const result = await getSurpriseDestinations({ origin: "JFK", vibes, departMonth: "2026-08" });

    expect(result.destinations.length).toBeGreaterThanOrEqual(1);
    expect(result.destinations.map((d) => d.name)).toContain(cityName);
  });
});
```

Also in the same file, update the two fixtures that use the retired word: in the "FLEXIBLE SENTINEL" tests nothing changes (they use `beach`), but search the file for `tropical` and replace any `vibes: "tropical,beach"` with `vibes: "beach,romantic"` (grep first: `grep -n tropical src/lib/atlas/surprise.test.ts`).

- [ ] **Step 7: Update wire-test fixtures**

In `src/lib/atlas/surprise.wire.test.ts` and `src/lib/atlas/surprise.http-budget.test.ts`, replace every `vibes: "tropical,beach"` with `vibes: "beach,romantic"`. Expected counts are unchanged (beach+romantic has ≥ 3 curated destinations with overlap ≥ 2, so the http-budget worst case stays 1 popular fetch + 3 enrichments × 2 attempts = 7).

- [ ] **Step 8: Run the full unit suite**

Run: `npm run test:unit`
Expected: all files pass; total ≥ 165 tests (156 baseline − 4 removed old destination-vibes assertions + new guard/migration/pin tests), 0 failures. If `surprise.test.ts` enrichment expectations drift because the new taxonomy ranks different curated fillers, fix the FIXTURE expectations to the new deterministic ranking — do NOT touch engine code in this task.

- [ ] **Step 9: Commit**

```bash
git add src/lib/trip-types.ts src/lib/atlas/destination-vibes.ts src/lib/atlas/vibe-vocabulary.guard.test.ts src/lib/atlas/destination-vibes.test.ts src/lib/atlas/surprise.test.ts src/lib/atlas/surprise.wire.test.ts src/lib/atlas/surprise.http-budget.test.ts
git commit -m "fix(vibes): unify picker/taxonomy vocabulary, add family+romantic, guard against drift

The vibe filter never worked: 5 of 8 picker vibes matched nothing (culture,food -> 0
cards live). Canonical vocabulary is now the picker's words; 82 destinations migrated
+ 13 TP metro city codes tagged; regression guard fails the build on any future drift."
```

---

### Task 2: City naming — generated table, `resolveCityName()`, and drop-don't-render

**Files:**
- Create: `scripts/generate-city-names.mjs`
- Create: `src/lib/atlas/generated/city-names.json` (script output)
- Create: `src/lib/atlas/city-names.ts`
- Create: `src/lib/atlas/city-names.test.ts`
- Modify: `src/lib/atlas/surprise.ts`
- Modify: `src/lib/atlas/surprise.test.ts` (naming/drop tests)

**Interfaces:**
- Consumes: `IATA_TO_CITY` from `./travelpayouts-client` (unchanged).
- Produces: `resolveCityName(code: string): string | null` from `@/lib/atlas/city-names` (server-only). Task 4 uses it for `originName`; this task wires it into every card-name path in `surprise.ts`.

**Provenance note (why a script, not a blob):** the table derives from TravelPayouts' own public data endpoints (`https://api.travelpayouts.com/data/en/cities.json`, `.../airports.json`, `.../countries.json`, no token required). Recipe, reverse-engineered and validated against live TP data on 2026-07-12: *every city in `cities.json` that has ≥ 1 entry in `airports.json` (matched on `city_code`; ALL airport-table entries count — TP lists some metro codes as pseudo-airports, so "is it an airport" is deliberately NOT filtered), labeled `"{city name}, {country name}"` with whitespace collapsed, plus `" (all airports)"` when the city has ≥ 2 airport-table entries.* Cities with zero airport entries are excluded (they can't be flight destinations). Expected output: **9,471 entries, 545 suffixed** (as of 2026-07-12 TP data; upstream data drifts over time, so tests assert invariants, not exact counts).

This recipe intentionally **includes** the 127 curated codes (unlike the pre-generated scratchpad copy at `/tmp/claude-1000/-home-jarvis/661731b7-02cd-4330-b3ce-88b51f589913/scratchpad/tp-city-names.json`, which excluded them): runtime lookup checks curated FIRST so behavior is identical, and the script needs no knowledge of the TS module — no drift risk. If the network is unavailable when you run the script, fall back to copying the scratchpad file (it is the same recipe minus curated keys and minus whitespace normalization — a strict subset; all tests below still pass).

- [ ] **Step 1: Write `scripts/generate-city-names.mjs`**

```js
#!/usr/bin/env node
// Regenerates src/lib/atlas/generated/city-names.json from TravelPayouts' own
// public data (no token needed). Run: node scripts/generate-city-names.mjs
//
// Recipe (do not change without updating city-names.test.ts):
//   - source of truth: api.travelpayouts.com/data/en/{cities,airports,countries}.json
//   - include every city that has >= 1 entry in airports.json (city_code match).
//     ALL airport-table rows count: TP lists metro codes and pseudo-stations
//     there, and that is exactly the population its price API can return.
//   - label: "{city name}, {country name}" (whitespace collapsed)
//   - ">= 2 airports" => append " (all airports)" — a CHI price may be O'Hare
//     OR Midway; printing bare "Chicago" would invite a false assumption.
//   - a city we cannot label (missing name/country) is omitted: the runtime
//     DROPS unnameable codes rather than showing them.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://api.travelpayouts.com/data";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "atlas", "generated", "city-names.json");

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

const [cities, airports, countries] = await Promise.all([
  getJson("/en/cities.json"),
  getJson("/en/airports.json"),
  getJson("/en/countries.json"),
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
writeFileSync(OUT, `${JSON.stringify(sorted, null, 1)}\n`);
console.log(`wrote ${Object.keys(sorted).length} city names (${Object.values(sorted).filter((v) => v.endsWith("(all airports)")).length} multi-airport) to ${OUT}`);
```

- [ ] **Step 2: Generate the table**

```bash
mkdir -p src/lib/atlas/generated
node scripts/generate-city-names.mjs
```

Expected output: `wrote 9471 city names (545 multi-airport) to .../src/lib/atlas/generated/city-names.json` (±small upstream drift is acceptable; > 9,000 and > 400 respectively is the sanity band).

- [ ] **Step 3: Write the failing tests — `src/lib/atlas/city-names.test.ts`**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveCityName } from "./city-names";
import generated from "./generated/city-names.json";

describe("resolveCityName", () => {
  it("curated names win over generated ones", () => {
    // JFK is curated as "New York, New York" — nicer than any generated label.
    expect(resolveCityName("JFK")).toBe("New York, New York");
    expect(resolveCityName("BNA")).toBe("Nashville, Tennessee");
  });

  it("resolves TP metro city codes via the generated table with the multi-airport suffix", () => {
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

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run src/lib/atlas/city-names.test.ts`
Expected: FAIL — `Cannot find module './city-names'`.

- [ ] **Step 5: Implement `src/lib/atlas/city-names.ts`**

```ts
import "server-only";

import { IATA_TO_CITY } from "./travelpayouts-client";
import generatedNames from "./generated/city-names.json";

// Two-tier destination naming. Curated IATA_TO_CITY (127 hand-written labels
// like "Nashville, Tennessee") is primary; the generated TravelPayouts-derived
// table (~9,400 entries, see scripts/generate-city-names.mjs for provenance)
// is the fallback. null means "we cannot honestly name this code" — callers
// must DROP the destination. A raw code must never reach a user.
const GENERATED: Record<string, string> = generatedNames;

export function resolveCityName(code: string): string | null {
  const cleaned = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(cleaned)) return null;
  return IATA_TO_CITY[cleaned] ?? GENERATED[cleaned] ?? null;
}
```

Run: `npx vitest run src/lib/atlas/city-names.test.ts` → Expected: PASS (vitest resolves `server-only` via the existing alias in `vitest.config.ts`; `resolveJsonModule` is already on in `tsconfig.json`).

- [ ] **Step 6: Write failing engine tests (naming + drop + same-city exclusion) in `src/lib/atlas/surprise.test.ts`**

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

  it("excludes destinations in the origin's own city (JFK origin must not be offered NYC)", async () => {
    popular([item("NYC", 60), item("CUN", 120), item("MBJ", 150), item("TPA", 90)]);

    const result = await getSurpriseDestinations({ origin: "JFK", departMonth: "2026-08" });

    expect(result.destinations.map((d) => d.name).join("|")).not.toContain("New York");
    expect(result.destinations).toHaveLength(3);
  });
});
```

Run: `npx vitest run src/lib/atlas/surprise.test.ts` → Expected: the two new tests FAIL (`ZZZ` currently renders as the bare code; `NYC` renders as a destination from JFK).

- [ ] **Step 7: Wire naming into `src/lib/atlas/surprise.ts`**

Four exact changes:

1. Add the import and a city-key helper near the top (after existing imports):

```ts
import { resolveCityName } from "./city-names";
```

```ts
// "New York, New York" and "New York, United States (all airports)" are the
// same place for trip purposes: compare on the city part, suffix stripped.
function cityKey(name: string): string {
  return name.replace(/ \(all airports\)$/, "").split(",")[0].trim().toLowerCase();
}
```

2. Change `toDestination` to take the already-resolved name (no `?? route.destination` escape hatch — that was the raw-code leak):

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

3. In `getSurpriseDestinations`, immediately after the `seenCodes` dedupe loop that builds `candidates`, resolve names, drop unnameables, and drop the origin's own city:

```ts
  const originCityKey = (() => {
    const originName = resolveCityName(origin);
    return originName ? cityKey(originName) : null;
  })();

  let namedCandidates = candidates
    .map((route) => ({ route, name: resolveCityName(route.destination) }))
    .filter((entry): entry is { route: RouteCandidate; name: string } => entry.name !== null)
    .filter(({ name }) => originCityKey === null || cityKey(name) !== originCityKey);
```

Then replace the existing vibe-ranking block (`if (requestedVibes.size > 0) { const minOverlap = ...; candidates = candidates.map(...)... }`) and the card slice with these exact blocks (the `minOverlap` const stays local in this task; Task 4 hoists it):

```ts
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

(The original `candidates` build loop stays as-is upstream; only the post-dedupe pipeline switches to the `{ route, name }` pairs. Since `candidates` is no longer reassigned, change its declaration from `let` to `const` — `push` still works and it avoids a new `prefer-const` lint warning.)

4. In the curated-filler section, replace **both** occurrences of `const cityName = IATA_TO_CITY[code] ?? code;` with:

```ts
      const cityName = resolveCityName(code);
      if (!cityName) continue;
      if (originCityKey !== null && cityKey(cityName) === originCityKey) continue;
```

and change the `seen` set to store city keys: initialize `const seen = new Set(destinations.map((destination) => cityKey(destination.name)));`, check `if (seen.has(cityKey(cityName))) continue;`, add with `seen.add(cityKey(cityName));`. Remove the now-unused `IATA_TO_CITY` import from `surprise.ts` if nothing else in the file uses it (lint enforces this).

- [ ] **Step 8: Add the nameability guard and run the suite**

Resolve the `TODO(task-2)` in `vibe-vocabulary.guard.test.ts`: add the fifth guard test from Task 1 ("every taxonomy destination resolves to a display name").

Run: `npm run test:unit`
Expected: all pass. Watch specifically: existing enrichment/wire tests still pass because every old taxonomy code resolves via curated/generated names (validated during planning: all 82 airport codes are curated except HNL, which the generated table names).

- [ ] **Step 9: Build gate for the server-only guard**

Run: `npm run build`
Expected: clean build (the JSON lands in the server bundle only). This is the enforcement mechanism: if anyone ever imports `city-names.ts` from a `"use client"` component, Next.js fails the build with the `server-only` poison error.

- [ ] **Step 10: Commit**

```bash
git add scripts/generate-city-names.mjs src/lib/atlas/generated/city-names.json src/lib/atlas/city-names.ts src/lib/atlas/city-names.test.ts src/lib/atlas/surprise.ts src/lib/atlas/surprise.test.ts src/lib/atlas/vibe-vocabulary.guard.test.ts
git commit -m "feat(surprise): name every destination or drop it — no raw IATA code reaches a user

Generated 9.4k-entry name table from TravelPayouts' own city/airport/country data
(scripts/generate-city-names.mjs documents the recipe), server-only, curated
IATA_TO_CITY stays primary. Multi-airport cities get an honest '(all airports)'
suffix (CHI may be O'Hare OR Midway — never silently mapped to ORD). Unnameable
codes and the origin's own city are dropped, never rendered."
```

---

### Task 3: `vibe-preflight.ts` — deterministic intent check (zero LLM)

**Files:**
- Create: `src/lib/atlas/vibe-preflight.ts`
- Create: `src/lib/atlas/vibe-preflight.test.ts`

**Interfaces:**
- Consumes: `PRESET_VIBES`, `PresetVibe` from `@/lib/trip-types`; `DESTINATION_VIBES` from `./destination-vibes`.
- Produces (Tasks 4 and 6 depend on these exact names):

```ts
export type PreflightResult =
  | { status: "ok" }
  | { status: "unknown_vibes"; unknown: string[]; suggestions: PresetVibe[] }
  | { status: "no_match_possible"; wouldMatchIfAny: number };

export function preflightVibes(vibes: string[], opts?: { matchMode?: "all" | "any" }): PreflightResult;
export function suggestVibes(input: string): PresetVibe[];
```

- [ ] **Step 1: Write the failing tests — `src/lib/atlas/vibe-preflight.test.ts`**

```ts
import { describe, expect, it } from "vitest";

import { preflightVibes, suggestVibes } from "./vibe-preflight";

describe("preflightVibes", () => {
  it("returns ok for empty input and for canonical vibes that can match", () => {
    expect(preflightVibes([])).toEqual({ status: "ok" });
    expect(preflightVibes(["beach"])).toEqual({ status: "ok" });
    expect(preflightVibes(["culture", "food"])).toEqual({ status: "ok" });
  });

  it("flags free-text custom vibes as unknown with canonical suggestions", () => {
    const result = preflightVibes(["wine tasting", "beach"]);
    expect(result.status).toBe("unknown_vibes");
    if (result.status !== "unknown_vibes") throw new Error("unreachable");
    expect(result.unknown).toEqual(["wine tasting"]);
    expect(result.suggestions).toContain("food");
  });

  it("maps legacy tag words (pre-migration vocabulary in stored trips) to suggestions", () => {
    const result = preflightVibes(["big_city"]);
    expect(result.status).toBe("unknown_vibes");
    if (result.status !== "unknown_vibes") throw new Error("unreachable");
    expect(result.suggestions).toContain("city");
  });

  it("suggests via small-typo tolerance", () => {
    const result = preflightVibes(["cultre"]);
    expect(result.status).toBe("unknown_vibes");
    if (result.status !== "unknown_vibes") throw new Error("unreachable");
    expect(result.suggestions).toContain("culture");
  });

  it("detects the genuinely impossible combination (nature+nightlife) before any fetch", () => {
    const result = preflightVibes(["nature", "nightlife"]);
    expect(result.status).toBe("no_match_possible");
    if (result.status !== "no_match_possible") throw new Error("unreachable");
    // taxonomy destinations carrying nature OR nightlife — enough for a useful any-match
    expect(result.wouldMatchIfAny).toBeGreaterThanOrEqual(8);
  });

  it("matchMode any rescues combinations that are impossible under match-all", () => {
    expect(preflightVibes(["nature", "nightlife"], { matchMode: "any" })).toEqual({ status: "ok" });
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
    ["spa", "wellness"],
    ["hiking", "nature"],
    ["museums", "culture"],
    ["kids", "family"],
    ["honeymoon", "romantic"],
    ["clubbing", "nightlife"],
    ["diving", "adventure"],
    ["tropical", "beach"],
    ["mountains", "nature"],
    ["praia", "beach"],
    ["famille", "family"],
    ["natur", "nature"],
  ])("%s -> includes %s", (input, expected) => {
    expect(suggestVibes(input)).toContain(expected);
  });

  it("caps suggestions at 3 and returns [] when nothing is close", () => {
    expect(suggestVibes("xyzzyplugh")).toEqual([]);
    expect(suggestVibes("beach party spa").length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/atlas/vibe-preflight.test.ts`
Expected: FAIL — `Cannot find module './vibe-preflight'`.

- [ ] **Step 3: Implement `src/lib/atlas/vibe-preflight.ts`**

```ts
import { PRESET_VIBES, type PresetVibe } from "@/lib/trip-types";
import { DESTINATION_VIBES } from "./destination-vibes";

// Deterministic pre-flight intent check. Pure set math + string distance —
// NO model call, ever (Atlas runs under a hard monthly spend cap; this module
// is what lets the empty-result path cost $0). Runs BEFORE any TravelPayouts
// request and short-circuits it when no destination could possibly satisfy
// the ask, so the wasted API call is saved too.

export type PreflightResult =
  | { status: "ok" }
  | { status: "unknown_vibes"; unknown: string[]; suggestions: PresetVibe[] }
  | { status: "no_match_possible"; wouldMatchIfAny: number };

const CANONICAL = new Set<string>(PRESET_VIBES);

// Curated synonym map: legacy tag words (pre-migration vocabulary that may
// survive in stored trips), common English travel words, and one everyday word
// per vibe for each supported locale. Keys must be lowercase.
const SYNONYMS: Record<string, PresetVibe[]> = {
  // legacy taxonomy + legacy TripForm picker values
  tropical: ["beach"], big_city: ["city"], cultural: ["culture"], foodie: ["food"],
  mountain: ["nature"], mountains: ["nature"], winter: ["nature", "adventure"],
  // English travel vocabulary
  spa: ["wellness"], yoga: ["wellness"], relax: ["wellness"], relaxing: ["wellness"], retreat: ["wellness"],
  hiking: ["nature", "adventure"], hike: ["nature", "adventure"], trekking: ["nature", "adventure"],
  skiing: ["nature", "adventure"], ski: ["nature", "adventure"], snow: ["nature"],
  camping: ["nature", "adventure"], wildlife: ["nature"], safari: ["nature", "adventure"],
  surfing: ["beach", "adventure"], surf: ["beach", "adventure"], diving: ["beach", "adventure"],
  scuba: ["beach", "adventure"], snorkeling: ["beach", "adventure"], island: ["beach"], islands: ["beach"],
  sun: ["beach"], museum: ["culture"], museums: ["culture"], history: ["culture"], historic: ["culture"],
  art: ["culture"], architecture: ["culture"], shopping: ["city"], urban: ["city"],
  party: ["nightlife"], clubs: ["nightlife"], clubbing: ["nightlife"], bars: ["nightlife"],
  music: ["nightlife"], concerts: ["nightlife"],
  wine: ["food"], winery: ["food"], dining: ["food"], restaurants: ["food"], gastronomy: ["food"],
  kids: ["family"], children: ["family"], waterpark: ["family"],
  honeymoon: ["romantic"], romance: ["romantic"], anniversary: ["romantic"], couples: ["romantic"],
  // es / pt / fr / de / it everyday words
  playa: ["beach"], praia: ["beach"], plage: ["beach"], strand: ["beach"], spiaggia: ["beach"],
  ciudad: ["city"], cidade: ["city"], ville: ["city"], stadt: ["city"], "città": ["city"],
  aventura: ["adventure"], aventure: ["adventure"], abenteuer: ["adventure"], avventura: ["adventure"],
  comida: ["food"], "gastronomía": ["food"], gastronomia: ["food"], gastronomie: ["food"],
  essen: ["food"], cibo: ["food"],
  cultura: ["culture"], kultur: ["culture"],
  naturaleza: ["nature"], natureza: ["nature"], natur: ["nature"], natura: ["nature"],
  "montaña": ["nature"], montanha: ["nature"], montagne: ["nature"], berge: ["nature"], montagna: ["nature"],
  bienestar: ["wellness"], "bem-estar": ["wellness"], "bien-être": ["wellness"], benessere: ["wellness"],
  familia: ["family"], "família": ["family"], famille: ["family"], familie: ["family"], famiglia: ["family"],
  "romántico": ["romantic"], romantico: ["romantic"], romantique: ["romantic"], romantisch: ["romantic"],
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

export function suggestVibes(input: string): PresetVibe[] {
  const normalized = input.trim().toLowerCase();
  if (normalized.length === 0) return [];

  const found: PresetVibe[] = [];
  const push = (vibes: PresetVibe[]) => {
    for (const vibe of vibes) {
      if (!found.includes(vibe)) found.push(vibe);
    }
  };

  const tokens = [normalized, ...normalized.split(/\s+/)];
  for (const token of tokens) {
    if (CANONICAL.has(token)) push([token as PresetVibe]);
    if (SYNONYMS[token]) push(SYNONYMS[token]);
  }

  // typo tolerance against canonical names and synonym keys (words >= 4 chars)
  for (const token of tokens) {
    if (token.length < 4) continue;
    for (const vibe of PRESET_VIBES) {
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
    const suggestions: PresetVibe[] = [];
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
      if (tags.has(vibe as PresetVibe)) overlap += 1;
    }
    if (overlap >= 1) wouldMatchIfAny += 1;
    if (overlap >= minOverlap) satisfiable = true;
  }

  if (!satisfiable) return { status: "no_match_possible", wouldMatchIfAny };
  return { status: "ok" };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/atlas/vibe-preflight.test.ts`
Expected: PASS (all). If a suggestion assertion fails, fix the SYNONYMS table, not the test — the test encodes the product behavior.

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/vibe-preflight.ts src/lib/atlas/vibe-preflight.test.ts
git commit -m "feat(atlas): deterministic vibe pre-flight — pure set math, zero LLM calls"
```

---

### Task 4: Engine + API integration — short-circuit, matchMode, degrade codes

**Files:**
- Modify: `src/lib/atlas/surprise.ts`
- Modify: `src/lib/atlas/surprise-degrade.ts` + `src/lib/atlas/surprise-degrade.test.ts`
- Modify: `src/app/api/surprise-me/route.ts` + `src/app/api/surprise-me/route.test.ts`
- Modify: `src/lib/atlas/surprise-query.ts` + `src/lib/atlas/surprise-query.test.ts`
- Modify: `src/lib/atlas/surprise.test.ts`

**Interfaces:**
- Consumes: `preflightVibes`, `PreflightResult` (Task 3); `resolveCityName` (Task 2).
- Produces:
  - `getSurpriseDestinations(params: { origin: string; vibes?: string; departMonth?: string; tripLength?: string; matchMode?: "all" | "any" })`
  - `SurpriseResult` gains `originName?: string` and `preflight?: PreflightResult`
  - `SurpriseDegradeCode` gains `"unknown_vibes" | "no_match_possible"`
  - `buildSurpriseQuery(args)` gains `matchAny?: boolean` and `departMonthOverride?: string | null` → sets `match=any` / overrides `depart_month`
  - API `GET /api/surprise-me` accepts `match=any`

- [ ] **Step 1: Write failing engine tests**

**(a)** The zero-TP-calls assertions go in `src/lib/atlas/surprise.http-budget.test.ts` — NOT in `surprise.test.ts`. Reason (anti-self-defeat): `surprise.test.ts` module-mocks `tpGet`, so a `fetch` spy there could never fire even if the short-circuit were missing — the test would pass vacuously. The http-budget file has no module mocks; `fetch` IS the wire boundary there, and these tests genuinely fail before the implementation (today the engine fetches popular routes for these inputs). Append to that file (it already has the `afterEach` env/global unstub hooks):

```ts
describe("PRE-FLIGHT: impossible or unknown vibes short-circuit before any TravelPayouts call", () => {
  it("no_match_possible fires ZERO wire requests", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "test-token");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await getSurpriseDestinations({
      origin: "JFK",
      vibes: "nature,nightlife",
      departMonth: "2026-08",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.destinations).toEqual([]);
    expect(result.degraded?.code).toBe("no_match_possible");
    expect(result.preflight?.status).toBe("no_match_possible");

    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("unknown custom vibes short-circuit with suggestions and zero wire requests", async () => {
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

    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
```

**(b)** The matchMode/filler tests use the `popular()`/`item()` helpers, so they go in `src/lib/atlas/surprise.test.ts`. Append:

```ts
describe("MATCH MODE any: min overlap drops to 1 for ranking AND curated filler", () => {
  it("nature,nightlife in any-mode returns cards from routes matching a single vibe", async () => {
    popular([item("DEN", 90), item("MSY", 110), item("DFW", 70)]);

    const result = await getSurpriseDestinations({
      origin: "JFK",
      vibes: "nature,nightlife",
      departMonth: "2026-08",
      matchMode: "any",
    });

    const names = result.destinations.map((d) => d.name);
    expect(names).toContain("Denver, Colorado");        // nature
    expect(names).toContain("New Orleans, Louisiana");  // nightlife
    expect(names).not.toContain("Dallas, Texas");       // matches neither
  });

  it("single-vibe searches let the curated filler work at overlap 1 (previously required 2)", async () => {
    emptyPopular();

    const result = await getSurpriseDestinations({ origin: "JFK", vibes: "wellness", departMonth: "2026-08" });

    // Popular routes empty -> filler must still offer wellness destinations (unpriced, honest).
    expect(result.destinations.length).toBeGreaterThanOrEqual(1);
    expect(result.degraded).toBeUndefined();
  });
});
```

Run: `npx vitest run src/lib/atlas/surprise.http-budget.test.ts src/lib/atlas/surprise.test.ts` → Expected: all four new tests FAIL (pre-flight tests fail because the engine still fetches; matchMode tests fail because `matchMode` is not a parameter yet).

*(Note: the single-vibe filler test should stub `vi.mocked(rawSearchFlights).mockResolvedValue({ flights: [] })` inside the test — the file's `vi.mock` makes `rawSearchFlights` a bare `vi.fn()`, and the engine's try/catch would otherwise mask the undefined return; the explicit stub keeps the test's intent readable.)*

- [ ] **Step 2: Implement in `src/lib/atlas/surprise.ts`**

1. Imports:

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

`getSurpriseDestinations` signature gains `matchMode?: "all" | "any"`.

4. Right after `const requestedVibes = new Set(normalizeVibes(params.vibes));` insert the short-circuit (BEFORE `departMonth` is even needed and before any `tpGet`):

```ts
  const originName = resolveCityName(origin) ?? undefined;

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

5. Hoist the overlap threshold: insert immediately after the preflight block (so it is in scope for both the ranking filter and the curated filler), and DELETE the local `const minOverlap = requestedVibes.size >= 2 ? 2 : 1;` inside the ranking block:

```ts
  const minOverlap = params.matchMode === "any" ? 1 : requestedVibes.size >= 2 ? 2 : 1;
```

Then replace the curated filler's two `if (overlap < 2) continue;` checks with `if (overlap < minOverlap) continue;`.

6. Add `originName` to both `return` statements at the end of the function.

Run: `npx vitest run src/lib/atlas/surprise.http-budget.test.ts src/lib/atlas/surprise.test.ts` → Expected: PASS.

- [ ] **Step 3: Degrade codes — failing test first**

In `src/lib/atlas/surprise-degrade.test.ts`, extend `EXPECTED_DEGRADE_CODES` with `"unknown_vibes", "no_match_possible"`. Run `npx vitest run src/lib/atlas/surprise-degrade.test.ts` → FAIL (map missing the codes). Then in `src/lib/atlas/surprise-degrade.ts` extend the union and map:

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

```ts
  unknown_vibes: "degradedUnknownVibesBody",
  no_match_possible: "degradedNoMatchPossibleBody",
```

The same test file's locale sweep will now FAIL until Task 5 adds `degradedUnknownVibesBody` / `degradedNoMatchPossibleBody` to all six locales — to keep this task independently green, add those two keys to all six `messages/*/common.json` `atlasHero` blocks NOW using the exact translations from the Task 5 table (rows `degradedUnknownVibesBody` and `degradedNoMatchPossibleBody`), and leave the rest of the copy for Task 5.

- [ ] **Step 4: API route — failing test first**

Append to `src/app/api/surprise-me/route.test.ts` (uses the file's existing `request()`/mock helpers):

```ts
  it("MATCH MODE: forwards match=any to the engine and varies the cache key", async () => {
    mockedGetSurpriseDestinations.mockResolvedValue({ origin: "JFK", destinations: [] });

    await GET(request("origin=JFK&vibes=nature%2Cnightlife&match=any"));

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
      preflight: { status: "no_match_possible", wouldMatchIfAny: 46 },
    };
    mockedGetSurpriseDestinations.mockResolvedValue(preflightResult as never);

    const first = await GET(request("origin=JFK&vibes=nature%2Cnightlife"));
    expect(await json(first)).toMatchObject({
      preflight: { status: "no_match_possible" },
      originName: "New York, New York",
    });

    await GET(request("origin=JFK&vibes=nature%2Cnightlife"));
    expect(mockedGetSurpriseDestinations).toHaveBeenCalledTimes(2); // degraded => never cached
  });
```

Run → FAIL. Then in `src/app/api/surprise-me/route.ts`: parse `const match = clampQueryValue(searchParams.get("match"), 10);`, derive `const matchMode = match === "any" ? ("any" as const) : ("all" as const);`, append `matchMode` to the `cacheKey` array, and pass `matchMode` into `getSurpriseDestinations`. Run → PASS. (The existing "cache only non-degraded priced results" logic already keeps preflight responses uncached — no change needed there.)

- [ ] **Step 5: `buildSurpriseQuery` — failing test first**

Append to `src/lib/atlas/surprise-query.test.ts`:

```ts
  it("adds match=any and honors a depart-month override when the clarification card re-runs", () => {
    const params = buildSurpriseQuery({
      originCode: "JFK",
      vibesSummary: "nature + nightlife",
      matchAny: true,
      departMonthOverride: "2026-11",
    });

    expect(params.get("match")).toBe("any");
    expect(params.get("depart_month")).toBe("2026-11");
    expect(params.get("vibes")).toBe("nature,nightlife");
  });

  it("omits match unless explicitly any", () => {
    const params = buildSurpriseQuery({ originCode: "JFK", vibesSummary: "beach" });
    expect(params.get("match")).toBeNull();
  });
```

Run → FAIL. Then in `src/lib/atlas/surprise-query.ts` extend the args type with `matchAny?: boolean; departMonthOverride?: string | null;` and implement:

```ts
  const departMonth = args.departMonthOverride?.trim() || deriveDepartMonth(args.flexibleWindow, args.startDate);
```

and after the vibes block:

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

### Task 5: i18n — all new copy, six locales

**Files:**
- Modify: `messages/en/common.json`, `messages/es/common.json`, `messages/pt/common.json`, `messages/fr/common.json`, `messages/de/common.json`, `messages/it/common.json`

**Interfaces:**
- Produces: `atlasHero.clarify*` keys (Task 6 component), `tripForm.vibes.*` canonical 10 (Tasks 6, 7), `quiz.vibe_*` canonical 10.

Add the following keys. Use these EXACT strings — they are written for an average/older traveller (no jargon, no codes-as-concepts) and match each locale's existing register (ES/PT/DE/IT informal, FR `vous`; "vibes" is rendered per-locale as ambientes/vibes/ambiances/Stimmungen/atmosfere, consistent with the existing `degradedNoVibeMatchBody` strings).

- [ ] **Step 1: `atlasHero` additions (place after `degradedInternalErrorBody`)**

`{vibes}` interpolates a human-readable list, `{count}` a number, `{origin}`/`{month}` resolved names — never raw codes (the component passes `originName` when available).

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
"degradedUnknownVibesBody": "We didn't recognize some of the vibes on this trip, so the search couldn't use them. Adjust your vibes or ask Atlas.",
"degradedNoMatchPossibleBody": "No destination we know combines all of those vibes at once. Try matching any of them, or ask Atlas."
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
"degradedUnknownVibesBody": "No reconocimos algunos de los ambientes de este viaje, así que la búsqueda no pudo usarlos. Ajusta tus ambientes o pregunta a Atlas.",
"degradedNoMatchPossibleBody": "Ningún destino que conozcamos combina todos esos ambientes a la vez. Prueba a buscar con cualquiera de ellos o pregunta a Atlas."
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
"degradedUnknownVibesBody": "Não reconhecemos algumas das vibes desta viagem, então a busca não pôde usá-las. Ajuste suas vibes ou pergunte ao Atlas.",
"degradedNoMatchPossibleBody": "Nenhum destino que conhecemos combina todas essas vibes ao mesmo tempo. Tente buscar com qualquer uma delas ou pergunte ao Atlas."
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
"degradedUnknownVibesBody": "Nous n'avons pas reconnu certaines ambiances de ce voyage, la recherche n'a donc pas pu les utiliser. Ajustez vos ambiances ou demandez à Atlas.",
"degradedNoMatchPossibleBody": "Aucune destination connue ne combine toutes ces ambiances à la fois. Essayez d'en chercher au moins une, ou demandez à Atlas."
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
"degradedUnknownVibesBody": "Einige Stimmungen dieser Reise haben wir nicht erkannt, deshalb konnte die Suche sie nicht verwenden. Passe deine Stimmungen an oder frage Atlas.",
"degradedNoMatchPossibleBody": "Kein uns bekanntes Reiseziel vereint alle diese Stimmungen auf einmal. Versuche es mit mindestens einer davon oder frage Atlas."
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
"degradedUnknownVibesBody": "Non abbiamo riconosciuto alcune atmosfere di questo viaggio, quindi la ricerca non ha potuto usarle. Modifica le tue atmosfere o chiedi ad Atlas.",
"degradedNoMatchPossibleBody": "Nessuna destinazione che conosciamo combina tutte queste atmosfere insieme. Prova a cercarne almeno una o chiedi ad Atlas."
```

(If Task 4 already added the two `degraded*` keys, skip re-adding them — verify values match this table.)

- [ ] **Step 2: Replace `tripForm.vibes` in each locale with the canonical 10**

| key | en | es | pt | fr | de | it |
|---|---|---|---|---|---|---|
| beach | Beach | Playa | Praia | Plage | Strand | Spiaggia |
| city | City | Ciudad | Cidade | Ville | Stadt | Città |
| adventure | Adventure | Aventura | Aventura | Aventure | Abenteuer | Avventura |
| food | Food | Gastronomía | Gastronomia | Gastronomie | Kulinarik | Gastronomia |
| culture | Culture | Cultura | Cultura | Culture | Kultur | Cultura |
| nature | Nature | Naturaleza | Natureza | Nature | Natur | Natura |
| nightlife | Nightlife | Vida nocturna | Vida noturna | Vie nocturne | Nachtleben | Vita notturna |
| wellness | Wellness | Bienestar | Bem-estar | Bien-être | Wellness | Benessere |
| family | Family | En familia | Em família | En famille | Familie | In famiglia |
| romantic | Romantic | Romántico | Romântico | Romantique | Romantik | Romantico |

Delete the old `tropical/mountains/big_city/winter/cultural` keys from `tripForm.vibes` (keep `beach`/`adventure`, updating values per the table).

- [ ] **Step 3: Update `quiz.vibe_*` in each locale to the same 10 words** (`vibe_beach` … `vibe_romantic`, values identical to the `tripForm.vibes` table above). The quiz component is currently unmounted (EntryTabs rejected 2026-04-10) but reads `PRESET_VIBES`, so its key set must track the canonical 10.

- [ ] **Step 4: Validate + locale-parity test**

```bash
for f in messages/*/common.json; do python3 -m json.tool "$f" > /dev/null && echo "OK $f"; done
```

Expected: `OK` × 6. Then extend the locale sweep in `src/lib/atlas/surprise-degrade.test.ts` by appending inside the `describe("degraded body locale messages", ...)` block:

```ts
  const CLARIFY_KEYS = [
    "clarifyUnknownTitle", "clarifyUnknownBody", "clarifySuggestionsLead", "clarifyUseKnown",
    "clarifyImpossibleTitle", "clarifyImpossibleBody", "clarifyMatchAny", "clarifyTryMonthLead",
    "clarifyAskAtlas", "clarifyAtlasSeed",
  ] as const;

  it.each(LOCALES)("%s has every clarification-card key", (locale) => {
    const common = JSON.parse(
      readFileSync(resolve(process.cwd(), "messages", locale, "common.json"), "utf-8")
    ) as { atlasHero?: Record<string, string> };
    for (const key of CLARIFY_KEYS) {
      expect(common.atlasHero?.[key], `${locale}.atlasHero.${key}`).toEqual(expect.any(String));
    }
  });

  it("non-English clarification bodies are not pasted English", () => {
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

- [ ] **Step 5: Commit**

```bash
git add messages src/lib/atlas/surprise-degrade.test.ts
git commit -m "i18n(surprise): clarification-card + canonical vibe labels across en/es/pt/fr/de/it"
```

---

### Task 6: The interactive clarification card

**Files:**
- Create: `src/components/SurpriseClarificationCard.tsx`
- Create: `src/components/SurpriseClarificationCard.test.tsx`
- Modify: `src/components/SurpriseMeSection.tsx`
- Modify: `src/components/SurpriseMeSection.test.tsx` (wiring test)

**Interfaces:**
- Consumes: `PreflightResult` type (Task 3, type-only import — the JSON payload carries the data), `buildSurpriseQuery` with `matchAny`/`departMonthOverride` (Task 4), i18n keys (Task 5), existing `atlas-open` CustomEvent contract (`window.dispatchEvent(new CustomEvent("atlas-open", { detail: { message } }))` — `AssistantChat.tsx:632-649` opens the chat and auto-sends `detail.message`).
- Produces: `<SurpriseClarificationCard>` with `data-testid="surprise-clarification-card"` (e2e in Task 8 depends on this testid, on `data-testid="clarify-match-any"`, and on `data-testid="clarify-suggestion"` chips).

- [ ] **Step 1: Write the failing component test — `src/components/SurpriseClarificationCard.test.tsx`**

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
        preflight={{ status: "no_match_possible", wouldMatchIfAny: 46 }}
        vibes={["nature", "nightlife"]}
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
    expect(card.textContent).toContain("46");
    // localized vibe labels, not raw ids
    expect(card.textContent).toContain("Naturaleza");
    expect(card.textContent).toContain("Vida nocturna");
    // no destination names appear — the card clarifies, it does not invent results
    expect(card.textContent).not.toMatch(/\$\d/);
  });

  it("match-any button reports the count and fires the callback", async () => {
    const onMatchAny = vi.fn();
    renderCard({ onMatchAny });

    await userEvent.click(screen.getByTestId("clarify-match-any"));
    expect(onMatchAny).toHaveBeenCalledTimes(1);
  });

  it("offers month alternatives and Ask Atlas", async () => {
    const onPickMonth = vi.fn();
    const onAskAtlas = vi.fn();
    renderCard({ onPickMonth, onAskAtlas });

    const months = screen.getAllByTestId("clarify-month");
    expect(months.length).toBeGreaterThanOrEqual(3);
    await userEvent.click(months[0]);
    expect(onPickMonth).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}$/));

    await userEvent.click(screen.getByTestId("clarify-ask-atlas"));
    expect(onAskAtlas).toHaveBeenCalledTimes(1);
  });
});

describe("SurpriseClarificationCard — unknown_vibes", () => {
  it("names the unrecognized wish, offers canonical suggestion chips and a known-only search", async () => {
    const onUseSuggestion = vi.fn();
    const onUseKnownOnly = vi.fn();
    renderCard({
      preflight: { status: "unknown_vibes", unknown: ["cata de vinos"], suggestions: ["food"] },
      vibes: ["cata de vinos", "beach"],
      onUseSuggestion,
      onUseKnownOnly,
    });

    const card = screen.getByTestId("surprise-clarification-card");
    expect(card.textContent).toContain("cata de vinos");

    await userEvent.click(screen.getByTestId("clarify-suggestion"));
    expect(onUseSuggestion).toHaveBeenCalledWith("food");

    await userEvent.click(screen.getByTestId("clarify-use-known"));
    expect(onUseKnownOnly).toHaveBeenCalledTimes(1);
  });
});
```

*(If `@testing-library/user-event` is not installed — check `package.json` — use `fireEvent.click` from `@testing-library/react` instead; it is sufficient here.)*

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/SurpriseClarificationCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/SurpriseClarificationCard.tsx`**

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
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

const CANONICAL_LABEL_KEYS = new Set([
  "beach", "city", "adventure", "food", "culture", "nature", "nightlife", "wellness", "family", "romantic",
]);

function upcomingMonths(from: string, count: number): string[] {
  const [year, month] = from.split("-").map(Number);
  const base = Number.isFinite(year) && Number.isFinite(month) ? new Date(Date.UTC(year, month - 1, 1)) : new Date();
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

  const label = (vibe: string) => (CANONICAL_LABEL_KEYS.has(vibe) ? tv(vibe) : vibe);
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

- [ ] **Step 4: Wire into `SurpriseMeSection.tsx` — failing wiring test first**

Append to `src/components/SurpriseMeSection.test.tsx` (uses the file's existing `stubSurpriseFetch`/`renderSurpriseMeSection` helpers; extend the `SurpriseMePayload` interface with `preflight?: unknown; originName?: string;`, and add `fireEvent` to the existing `@testing-library/react` import):

```tsx
describe("SurpriseMeSection preflight clarification", () => {
  it("renders the interactive card instead of the dead-end banner for preflight codes", async () => {
    stubSurpriseFetch({
      origin: "JFK",
      originName: "New York, New York",
      destinations: [],
      degraded: { code: "no_match_possible", reason: "engine prose" },
      preflight: { status: "no_match_possible", wouldMatchIfAny: 46 },
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
      preflight: { status: "no_match_possible", wouldMatchIfAny: 46 },
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
});
```

Run → FAIL. Note: `renderSurpriseMeSection` renders with `vibesSummary="playa"` — a single unknown word. The clarification card renders for the payload's `preflight` regardless; the card's vibe list comes from `normalizeVibes(vibesSummary)`.

- [ ] **Step 5: Implement the wiring in `src/components/SurpriseMeSection.tsx`**

Exact changes:

1. Imports:

```tsx
import { useLocale } from "next-intl";
import { buildSurpriseQuery, normalizeVibes } from "@/lib/atlas/surprise-query";
import type { PreflightResult } from "@/lib/atlas/vibe-preflight";
import SurpriseClarificationCard from "./SurpriseClarificationCard";
```

2. New state + a `Adjust` type near the other `useState` calls:

```tsx
  type Adjust = { vibes?: string[]; month?: string; matchAny?: boolean };
  const [adjust, setAdjust] = useState<Adjust>({});
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [originName, setOriginName] = useState<string | null>(null);
  const locale = useLocale();
```

3. Rework `fetchSuggestions` to read the adjust state and capture the new payload fields (keep the AbortSignal contract and the existing catch/finally exactly). Because `adjust` joins the `useCallback` deps, every `setAdjust` gives the callback a new identity and the existing `useEffect([originCode, fetchSuggestions])` re-runs it with proper abort semantics — the action handlers below therefore only set state and never fetch directly (no double-fetch, no stale closure):

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
  const effectiveMonth = adjust.month ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().slice(0, 7);

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
    const message = t("clarifyAtlasSeed", {
      origin: originName ?? originCode,
      month: monthLabel,
      vibes: effectiveVibes.join(", "),
    });
    window.dispatchEvent(new CustomEvent("atlas-open", { detail: { message } }));
  }
```

5. In the render, split the `degraded` branch — clarification card for preflight codes, existing banner otherwise:

```tsx
      ) : degraded && preflight && (degraded.code === "unknown_vibes" || degraded.code === "no_match_possible") && preflight.status !== "ok" ? (
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
        /* existing PlannerErrorBanner branch unchanged */
```

*(Design note, per spec: the seed message goes through the EXISTING chat auto-send mechanism — Atlas spends tokens only when the user explicitly clicks "Ask Atlas", i.e. engages. The seed carries origin, month, vibes, and the failure framing in the user's own language. `originName ?? originCode` — the code path only triggers when the origin airport cannot be named; the user typed that code themselves as their home airport, so echoing it back in their own chat message is acceptable; it is never rendered as a destination.)*

- [ ] **Step 6: Run component + full suite**

Run: `npx vitest run src/components` then `npm run test:unit`
Expected: all pass, including the pre-existing `SurpriseMeSection.test.tsx` degraded-banner tests (unchanged behavior for non-preflight codes).

- [ ] **Step 7: Commit**

```bash
git add src/components/SurpriseClarificationCard.tsx src/components/SurpriseClarificationCard.test.tsx src/components/SurpriseMeSection.tsx src/components/SurpriseMeSection.test.tsx
git commit -m "feat(surprise): interactive clarification card replaces the dead-end banner for preflight misses"
```

---

### Task 7: Kill the third vocabulary — TripForm/TripContextStrip on canonical vibes + tripwires + help

`TripForm.tsx` is the LIVE vibe picker (the quiz is unmounted): its private `VIBES` list (`tropical, mountains, big_city, beach, winter, cultural, adventure`) is a third vocabulary that would silently regress into `unknown_vibes` for every new trip. It must draw from the canonical set. (Discovered during planning; spec G1 "every user-selectable vibe must be matchable" makes this in-scope.)

**Files:**
- Modify: `src/components/TripForm.tsx`
- Modify: `src/components/TripContextStrip.tsx`
- Modify: `src/lib/atlas/no-fabrication.test.ts`
- Modify: `src/lib/help-content.ts`

**Interfaces:**
- Consumes: `VIBE_OPTIONS`, `VIBE_ICONS` from `@/lib/trip-types` (Task 1); `tripForm.vibes.*` i18n keys (Task 5).

- [ ] **Step 1: Write the failing old-vocabulary tripwire**

Append to `src/lib/atlas/no-fabrication.test.ts`:

```ts
// The vibe pipeline's product source must speak ONLY the canonical vocabulary.
// vibe-preflight.ts is deliberately excluded: it maps legacy words to
// suggestions, so it must contain them. Test files are excluded: fixtures
// legitimately freeze the pre-migration table. BootstrapModal's GUEST_INTERESTS
// ('mountains') are interests, not vibes — out of the vibe pipeline, excluded.
const VIBE_PIPELINE_FILES = [
  "src/lib/trip-types.ts",
  "src/lib/atlas/destination-vibes.ts",
  "src/lib/atlas/surprise.ts",
  "src/lib/atlas/surprise-query.ts",
  "src/components/TripForm.tsx",
  "src/components/TripContextStrip.tsx",
  "src/components/SurpriseMeQuiz.tsx",
  "src/components/SurpriseMeSection.tsx",
  "src/components/SurpriseClarificationCard.tsx",
];

// "mountain" also catches "mountains"; "winter" was a TripForm-only picker value
// that never matched anything. "cultural" does NOT match the canonical "culture"
// (substring runs the other way), so the canonical words are safe.
const RETIRED_VIBE_WORDS = ["big_city", "cultural", "foodie", "tropical", "mountain", "winter"];

describe("retired vibe vocabulary tripwire", () => {
  it.each(VIBE_PIPELINE_FILES)("%s speaks only the canonical vibe vocabulary", (file) => {
    const content = readFileSync(resolve(process.cwd(), file), "utf-8");
    for (const word of RETIRED_VIBE_WORDS) {
      expect(content, `${file} still contains retired vibe word "${word}"`).not.toContain(word);
    }
  });
});
```

Also extend the existing `SURPRISE_PATH_FILES` array in the same file with the new surprise-path sources:

```ts
  "src/lib/atlas/vibe-preflight.ts",
  "src/lib/atlas/city-names.ts",
  "src/components/SurpriseClarificationCard.tsx",
```

Run: `npx vitest run src/lib/atlas/no-fabrication.test.ts`
Expected: the new tripwire FAILS on `TripForm.tsx` and `TripContextStrip.tsx` (they still carry `tropical`/`big_city`/`cultural`/`mountains`/`winter`). The extended fabrication tripwire passes (new files carry no banned literals).

- [ ] **Step 2: Migrate `TripForm.tsx`**

Delete the private `VIBES` constant (lines 27–35) and import instead:

```tsx
import { VIBE_OPTIONS } from "@/lib/trip-types";
```

In the vibes section render (currently `{VIBES.map(v => ... {v.icon} {v.label} ...)}`), switch to i18n labels:

```tsx
              {VIBE_OPTIONS.map(v => (
                <button key={v.value} type="button" onClick={() => toggleVibe(v.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    vibes.includes(v.value)
                      ? 'bg-pink-100 border-pink-400 text-pink-800'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-pink-300'
                  }`}>
                  {v.icon} {t(`vibes.${v.value}`)}
                </button>
              ))}
```

Update the one other `VIBES` reference (`!VIBES.some(v => v.value === i)` in the custom-vibe dedupe around line 267) to `!VIBE_OPTIONS.some(v => v.value === i)`.

- [ ] **Step 3: Migrate `TripContextStrip.tsx`**

Replace the `VIBE_EMOJIS` map with the canonical icon map plus a graceful default for legacy/custom vibes stored on old trips:

```tsx
import { VIBE_ICONS } from "@/lib/trip-types";
```

and where the emoji is looked up, use `VIBE_ICONS[vibe as keyof typeof VIBE_ICONS] ?? "✨"`. Delete the old `VIBE_EMOJIS` constant.

- [ ] **Step 4: Run the tripwire + suite**

Run: `npx vitest run src/lib/atlas/no-fabrication.test.ts` → PASS.
Then evidence sweep (expected output shown — reason about it, don't just run it):

```bash
grep -rn "tropical\|big_city\|foodie" src --include="*.ts" --include="*.tsx" | grep -v ".test."
```

Expected: matches ONLY in `src/lib/atlas/vibe-preflight.ts` (the legacy-synonym map — intentional). Any other file listed = regression, fix it.

- [ ] **Step 5: Update `src/lib/help-content.ts`** (standing rule `feedback_update_help_with_features`: help must track TPI feature changes)

In the `"planner-new-trip"`-area entry (the one whose heading is `"Where are you going?"`, line ~25), replace the parenthetical vibe examples: `"pick a vibe (Tropical, Mountains, Beach, etc.)"` → `"pick a vibe (Beach, Culture, Food, Family, Romantic, etc.)"`.

In `"planner-itinerary"`, append a section (after `"Atlas chat"`):

```ts
      { heading: "When nothing matches", text: "If no destination fits every vibe you picked, Atlas says so honestly and offers real ways forward: match any of your vibes instead of all of them, try a different month, or ask Atlas in chat — it already knows your origin, month, and vibes. Atlas never fills the gap with made-up destinations or prices." },
```

- [ ] **Step 6: Full suite + build + commit**

Run: `npm run test:unit` → all pass. `npm run build` → clean.

```bash
git add src/components/TripForm.tsx src/components/TripContextStrip.tsx src/lib/atlas/no-fabrication.test.ts src/lib/help-content.ts
git commit -m "fix(vibes): live TripForm picker joins the canonical vocabulary; retired-word tripwire; help updated"
```

---

### Task 8: E2E, visual evidence, final gates

**Files:**
- Modify: `tests/e2e/planner-trust.spec.ts`

- [ ] **Step 1: Start the dev server (separate shell / background)**

```bash
npm run dev -- -p 3001
```

Wait for `Ready` on http://localhost:3001. Reminder: if every Playwright test fails in ~300ms, the server died — restart it.

- [ ] **Step 2: Add two e2e tests to `tests/e2e/planner-trust.spec.ts`**

Follow the file's existing interception pattern (see the `Path B → "Plan a trip to X"` test). `POST /api/trips` accepts `interests` (verified: `src/app/api/trips/route.ts:32`).

```ts
test('impossible vibe combo renders the clarification card, and match-any re-runs the search', async ({ page, context }) => {
  const post = await context.request.post('/api/trips', {
    data: {
      name: 'Clarify test', destination: 'Surprise Me', budget: 'midrange', origin: 'MIA',
      interests: ['vibe:nature', 'vibe:nightlife'],
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
            { name: 'Denver, Colorado', flightPrice: '$142', airline: 'UA', nonstop: true, link: '' },
            { name: 'New Orleans, Louisiana', flightPrice: '$98', airline: 'WN', nonstop: true, link: '' },
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
        preflight: { status: 'no_match_possible', wouldMatchIfAny: 46 },
      }),
    });
  });

  await page.goto(`/planner/${trip.id}`);

  const card = page.locator('[data-testid="surprise-clarification-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });
  await expect(card).toContainText('46');
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
      preflight: { status: 'unknown_vibes', unknown: ['wine tasting'], suggestions: ['food'] },
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
Expected: **43/43 pass** (41 baseline + 2 new). If `visual-baseline.spec.ts` snapshots fail, STOP and inspect the diff images in `playwright-report/` — the baseline trips are Path A (destination Cancún) and should be pixel-identical; a diff means an unintended UI change leaked.

- [ ] **Step 4: Visual evidence for Jose (spec §4 — this bug class was found by eye, not by tests)**

With the dev server up and REAL `TRAVELPAYOUTS_TOKEN` in `.env.local` (do NOT mock):
1. Create a Surprise Me trip from origin JFK with vibes Culture + Food (via the planner UI) → screenshot the REAL cards (`/planner/<id>`, EN locale).
2. Create one with Nature + Nightlife → screenshot the clarification card (EN).
3. Repeat #2 under `/es/planner/<id>` → screenshot (ES).
Save to `docs/superpowers/evidence/2026-07-12-vibe-fix/` (create dir) as `culture-food-cards-en.png`, `clarification-en.png`, `clarification-es.png`. Present to Jose for visual review — no deploy without it.

- [ ] **Step 5: Final gates (all four, fresh, in order — record outputs)**

```bash
npm run lint          # expected: 0 errors, 30 warnings (baseline; new code adds none)
npm run test:unit     # expected: 0 failures; > 200 tests (156 baseline + this plan's ~50)
npm run build         # expected: clean; proves the server-only name table stays out of client bundles
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

Every scan gate in this plan was checked against what it would actually match in THIS repo:

1. **Retired-vocabulary tripwire (Task 7)** scans an explicit product-file list — NOT `src/**`. Excluded with stated reasons: `vibe-preflight.ts` (legacy synonyms are its job), all `*.test.*` (frozen pre-migration fixture), `BootstrapModal.tsx` (`'mountains'` is an interest, not a vibe), `messages/` (a translation may legitimately contain words like "Montañas"), and this plan/spec (docs are never scanned).
2. **The evidence grep in Task 7 Step 4** expects `vibe-preflight.ts` matches — the expected output is stated so the implementer doesn't "fix" the synonym map to satisfy a grep.
3. **The fabrication tripwire ban list** (`FALLBACK`, `$89`, …) applies to files this plan creates — called out in Global Constraints so nobody writes the word in a comment and trips it.
4. **No gate asserts exact generated-table counts** — TP's upstream data drifts; tests assert invariants (>9000 entries, label shape, specific known codes).
5. **The regression guard asserts against live exports**, not copies of itself — it cannot be satisfied by editing the test.

## Deviations from the spec (flagged, with rationale)

1. **"total tag count per destination never decreases" (spec §5 risk table)** is implemented as *new tags ⊇ mechanically-migrated old tags*. The literal count rule contradicts the spec's own §3.1 `tropical→beach` fold (30 destinations lose one raw count by design). The superset form catches exactly the risk named (silent tag loss) without forcing padding tags.
2. **TripForm/TripContextStrip migration (Task 7)** is not named in the spec but is required by G1: TripForm is the *live* picker and carries a third vocabulary (`winter`, `mountains`, …) that would land every new trip in `unknown_vibes`. The rejected/unmounted EntryTabs quiz needed no work beyond `PRESET_VIBES` itself.
3. **Generated table includes the 127 curated codes** (the scratchpad pre-build excluded them). Runtime is identical (curated checked first); the regen script gains independence from the TS module. 
4. **`no_vibe_match` (preflight OK but live routes empty) keeps the existing banner.** The spec scopes the interactive card to the two preflight cases ("for these cases"); the banner already carries honest guidance and a retry.
5. **Suggestion i18n depth:** free-text vibes are matched against English + legacy + one everyday word per vibe in each locale, plus typo distance. A Spanish phrase like "cata de vinos" may yield no suggestion — the card still names the unmatched wish and offers known-only/Ask-Atlas paths, so it degrades honestly, never silently.

## Uncertainties (do not guess — check at implementation time)

- **`@testing-library/user-event`** may not be in devDependencies; Task 6 tests note the `fireEvent` substitution.
- **`surprise.test.ts` enrichment expectations** may need fixture-order adjustments after the taxonomy change (Task 1 Step 8 says: fix fixtures to the new deterministic ranking, never the engine).
- **Levenshtein false positives:** `editDistance("food","good")=1` style collisions are possible for short user words; the ≥4-char floor plus suggestion-only usage (never auto-substitution) bounds the blast radius. If review finds an embarrassing pair, tighten to distance ≤1 for 4–5-char tokens.
- **`resolve-surprise` destination strings** now include `" (all airports)"` for metro codes (e.g. trip.destination = "Chicago, United States (all airports)"). Length is well under the route's 200-char cap and the string is honest; downstream affiliate matching treats destination as free text. Flag to Jose in review if it reads oddly in the trip header.
- **Pre-existing raw-code exposure out of scope:** `atlasHero.subtitle` shows the ORIGIN code ("… from JFK") and Atlas tool outputs (`getDeals`) return raw destination codes to the model. Both predate this work; noted for a follow-up, not silently expanded into this plan.
