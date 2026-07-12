# Vibe Vocabulary Unification + Destination Coverage + Atlas Pre-Flight Intent Check

**Date:** 2026-07-12
**Repo:** `travelplaninfo-prototype`
**Branch:** `feat/surprise-me-workstation-independence` (continues the de-fabrication work; PR #7)
**Status:** Spec — pending plan

---

## 1. Problem

Three defects, discovered while visually reviewing the Surprise Me de-fabrication fix. The first is severe and has been live since the feature shipped.

### 1.1 The vibe filter has never worked (CRITICAL)

The vibe picker and the destination taxonomy speak **different vocabularies**. Only three words overlap.

| | |
|---|---|
| `PRESET_VIBES` — what a user can click (`trip-types.ts:51`) | `beach, city, adventure, food, culture, nature, nightlife, wellness` |
| `DESTINATION_VIBES` tags — what the data carries | `tropical(30), beach(40), romantic(24), nightlife(21), big_city(44), cultural(50), adventure(16), foodie(39), mountain(5)` |
| **Dead** — user can pick, nothing can ever match | **`city`, `culture`, `food`, `nature`, `wellness`** (5 of 8) |
| **Orphan** — tagged, but no user can ever select | `big_city`, `cultural`, `foodie`, `tropical`, `romantic`, `mountain` |

Because ranking requires `min_overlap = 2` when 2+ vibes are selected, **any combination containing a dead vibe filters out every destination.** Only combos drawn entirely from `{beach, adventure, nightlife}` can return anything: **3 of 28 two-vibe combos (11%).**

Proven live against `/api/surprise-me` (origin JFK):

```
culture,food      -> 0 cards, degraded
city,food         -> 0 cards, degraded
nature,wellness   -> 0 cards, degraded
culture,nightlife -> 0 cards, degraded
beach,adventure   -> 3 cards   OK
beach,nightlife   -> 3 cards   OK
```

**Why nobody noticed:** the fabricated `FALLBACK` (removed earlier on this branch) fired whenever the filter returned nothing — so a user picking "Culture + Food" got the invented Cancún/$89-a-night cards and the feature *looked* fine. **The fabrication was masking a completely broken filter.** Deleting the fabrication is what made this visible.

The taxonomy's richest tags are the orphaned ones: `cultural` (50 destinations) is one rename away from `culture`.

This bug exists in the Python original (`routers/assistant.py`) too; the faithful port faithfully reproduced it.

### 1.2 Destination coverage — users see raw airport codes

TravelPayouts returns **city** codes for destinations, but our tables are keyed on **airport** codes.

- **Naming:** of 100 distinct codes TP returned across 12 origins, **62 are absent from `IATA_TO_CITY`** and render as bare codes — `CHI`, `WAS`, `FMY`, `HNL`, `ORL`. A card reading "Plan a trip to CHI" is meaningless to a traveller. (Jose, 2026-07-12: labels must be decoded for the average/older end user — **no raw code may ever reach a user.**)
- **Tagging:** the most-returned destinations carry **no vibe tags at all**, so they are invisible to every vibe search: **New York (35×), Chicago (24×), Orlando (15×)**, Washington (5×), Paris (4×), London (3×), Toronto (2×).

### 1.3 A dead end instead of a conversation

When a search yields nothing, the user gets a degraded banner. Honest — but a dead end. It never establishes what the user actually meant. Free-text custom vibes (`vibe:custom:*`, supported by `SurpriseMeQuiz.tsx`) can never match anything and fail silently the same way.

---

## 2. Goals / Non-Goals

**Goals**

- G1. One canonical vibe vocabulary shared by the picker and the taxonomy. Every user-selectable vibe **must** be matchable.
- G2. A **regression guard** that fails the build if picker and taxonomy ever drift apart again. This is the fix that matters most — the bug was a silent drift.
- G3. Add a **`family`** vibe (Jose, 2026-07-12).
- G4. No raw IATA code ever rendered to a user.
- G5. The destinations TP actually returns most (NYC, CHI, ORL, …) participate in vibe search.
- G6. **Atlas pre-flight intent check**: when we cannot confidently satisfy the user's intent, Atlas *asks* instead of dead-ending.
- G7. Zero fabrication, on every path. Non-negotiable, inherited from this branch.

**Non-Goals**

- Redesigning the quiz/picker UI beyond adding the new vibe chips.
- Restructuring curated-vs-live ranking (still deferred).
- The `/destinations` + `/hot-deals` + `affiliates.ts` hardcoded-price sweep (separate follow-up).

---

## 3. Design

### 3.1 Canonical vocabulary

The **picker's words win** — they are what users read. The taxonomy migrates to them, eliminating drift at the source rather than patching it with an alias layer.

```
CANONICAL_VIBES = beach · city · adventure · food · culture ·
                  nature · nightlife · wellness · family · romantic
```

Tag migration across all destinations:

| old tag | new tag | note |
|---|---|---|
| `big_city` (44) | `city` | rename |
| `cultural` (50) | `culture` | rename |
| `foodie` (39) | `food` | rename |
| `mountain` (5) | `nature` | `mountain` is a subtype of `nature`; folded in, then `nature` is broadened to coastal/park/wilderness destinations |
| `tropical` (30) | `beach` | folded — every `tropical` destination is already `beach`-tagged; the distinction was never user-selectable and adds no discriminating power |
| `romantic` (24) | `romantic` | **kept, and now exposed in the picker** — 24 destinations already carry it, so exposing it works immediately |
| — | `family` | **new** — tagged editorially |
| — | `wellness` | **new** — tagged editorially |

`family` and `wellness` and the broadened `nature` require genuine editorial tagging across the destination set — they cannot be derived mechanically.

**Picker becomes 10 vibes** (adds `family`, `romantic`).

### 3.2 The regression guard (G2 — the most important deliverable)

A unit test that fails if the two ever drift:

```ts
// every vibe a user can pick MUST exist in the taxonomy
for (const vibe of PRESET_VIBES) expect(ALL_TAXONOMY_TAGS).toContain(vibe);
// and no tag may exist that no user can ever reach
expect(ALL_TAXONOMY_TAGS).toEqual(new Set(CANONICAL_VIBES));
```

Plus a coverage floor: **every canonical vibe must be carried by at least N destinations** (N=8), so a vibe can never be technically-present-but-useless. Had this test existed, the live bug would have been impossible.

### 3.3 Destination naming (G4)

- `IATA_TO_CITY` (127 curated, nicer names like "Nashville, Tennessee") stays the **primary** lookup.
- New generated fallback `city-names.ts`, derived from TravelPayouts' own authoritative `cities.json` + `airports.json` + `countries.json` (~9,369 entries, ~290 KB, **server-side only** — it is consumed in the API route, never shipped to the browser).
  - Label format: `"Chicago, United States"`.
  - Cities with **≥2 airports** get a `" (all airports)"` suffix — honest, because TP's `CHI` price may be O'Hare *or* Midway, and silently printing "Chicago" invites the assumption of O'Hare. (Detected by counting airports per city; note TP lists some metro codes as pseudo-airports, so "is it an airport code" is NOT a valid test.)
  - Explicitly **not** doing: mapping `CHI → ORD`. That would be a quiet fabrication.
- **Hard rule:** if a code resolves to no name, the destination is **dropped**, never rendered as a code. A test asserts no card name matches `/^[A-Z]{3}$/`.

### 3.4 Destination tagging (G5)

Tag the high-frequency city codes TP actually returns. Initial set (frequency-ordered): `NYC, CHI, ORL, WAS, PAR, LON, YTO, HOU, PIT, MOW, RDU, ANC, BEG` — plus `family`/`wellness`/`nature` tags across the existing 82.

Examples: `NYC → city, culture, food, nightlife, romantic` · `CHI → city, culture, food, nightlife` · `ORL → family, adventure` · `PAR → romantic, culture, food, city` · `ANC → nature, adventure`.

### 3.5 Atlas pre-flight intent check (G6)

**The pre-flight itself is deterministic — no LLM call.** Pure set math against the taxonomy. Atlas only spends tokens if the user *engages* with the clarification, keeping this at $0 against the $10/mo Atlas spend cap.

New pure module `src/lib/atlas/vibe-preflight.ts`:

```ts
preflightVibes(vibes: string[]): 
  | { status: "ok" }
  | { status: "unknown_vibes";  unknown: string[]; suggestions: string[] }   // incl. custom free-text
  | { status: "no_match_possible"; wouldMatchIfAny: number }                 // known vibes, but min_overlap=2 can never be met
```

- `unknown_vibes` — a vibe (typically `vibe:custom:*` free text like "wine tasting") is not in the canonical vocabulary. Suggest the nearest canonical vibes.
- `no_match_possible` — all vibes are known, but **no destination in the taxonomy satisfies `min_overlap = 2`** for this combination. Computed by set intersection against the taxonomy — **before any TravelPayouts call is made.** This also saves the wasted API call.

**UI:** instead of the dead-end degraded banner, render an **interactive clarification card**:

- states the situation plainly, in the user's language;
- offers concrete one-click actions:
  - **"Match any of these, not all"** → re-runs with `min_overlap = 1` (reports how many destinations that would find, from the pre-flight);
  - **"Try a different month"**;
  - **"Ask Atlas"** → opens the existing chat, **seeded with structured intent context** (origin, month, selected vibes, and precisely why we could not satisfy them) so Atlas converses about the real problem instead of guessing.
- It **never** fabricates a destination to fill the gap.

This is what "make sure Atlas has the user's intention defined" means concretely: we detect the ambiguity deterministically and cheaply, and hand Atlas a precise brief when the user asks for help.

---

## 4. Testing

- **Regression guard (§3.2)** — picker ⊆ taxonomy; taxonomy == canonical; coverage floor ≥8 destinations per vibe. *This test must fail against today's `main`.*
- **Vocabulary migration** — every destination's tags are a subset of `CANONICAL_VIBES`; no `big_city`/`cultural`/`foodie`/`tropical`/`mountain` string survives anywhere in `src/`.
- **The live bug, pinned** — `culture,food`, `city,food`, `nature,wellness`, `culture,nightlife` each return **≥1 destination** (mocked TP). These assertions must fail pre-fix.
- **Naming** — no card name matches `/^[A-Z]{3}$/`; `CHI → "Chicago, United States (all airports)"`; unnameable codes are dropped, not shown.
- **Pre-flight** — `ok` / `unknown_vibes` (custom free text) / `no_match_possible`; asserts **zero** TP calls on `no_match_possible` (it must short-circuit before the fetch).
- **No fabrication** — existing tripwire extended to the new files.
- **Visual** (this class of bug was found by eye, not by tests): screenshot the clarification card and a `culture + food` search rendering real cards, in EN and one non-EN locale.
- Gates: lint 0 errors · unit (156 baseline + new) · build clean · Playwright 41/41.

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| Tag migration silently drops a destination's tags | Test: every destination retains ≥1 tag; total tag count per destination never decreases |
| Editorial `family`/`wellness`/`nature` tagging is subjective | Coverage floor test (≥8 per vibe); tags reviewed in the plan review |
| 290 KB name table bloats the client bundle | Server-side only (API route); test asserts it is not imported by any client component |
| The `(all airports)` suffix reads oddly | Applied only to genuine multi-airport cities; verified visually |
| Pre-flight fires an LLM call per empty search | Deterministic by construction — pure set math, no model call; asserted by test |
| Scope creep into the pending deploy | Same branch/PR #7, same gates; `main` untouched until Jose merges |
