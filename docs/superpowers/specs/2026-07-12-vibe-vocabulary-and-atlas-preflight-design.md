# Vibe Vocabulary Unification + Destination Coverage + Atlas Pre-Flight Intent Check

**Date:** 2026-07-12
**Repo:** `travelplaninfo-prototype`
**Branch:** `feat/surprise-me-workstation-independence` (continues the de-fabrication work; PR #7)
**Status:** Spec — pending plan

---

## 1. Problem

Three defects, discovered while visually reviewing the Surprise Me de-fabrication fix. The first is severe and has been live since the feature shipped.

### 1.1 Two of the seven vibe chips are duds (CRITICAL)

> **⚠ CORRECTION (2026-07-12).** An earlier revision of this spec analysed `PRESET_VIBES` (`trip-types.ts:51`). **That was wrong.** `PRESET_VIBES` is consumed only by `SurpriseMeQuiz`, which is reachable only through `EntryTabs` — and `EntryTabs` has **no importers** (it was rejected 2026-04-10). It is dead code. Everything below is measured against the **live** picker, `TripForm.tsx`.

The codebase contains **three** competing vibe vocabularies:

| Source | Words | Status |
|---|---|---|
| `TripForm.tsx:27` `VIBES` | `tropical, mountains, big_city, beach, winter, cultural, adventure` | **LIVE — what users actually click** |
| `destination-vibes.ts` tags | `cultural(50), big_city(44), beach(40), foodie(39), tropical(30), romantic(24), nightlife(21), adventure(16), mountain(5)` | the data |
| `trip-types.ts:51` `PRESET_VIBES` | `beach, city, adventure, food, culture, nature, nightlife, wellness` | **DEAD** (SurpriseMeQuiz/EntryTabs) |

**Two live chips can never match anything:**

- **`mountains`** 🏔️ — the taxonomy tag is **`mountain`** (singular). A one-letter mismatch.
- **`winter`** ❄️ ("Winter Escape") — **no destination carries a `winter` tag at all.**

Because ranking requires `min_overlap = 2` when 2+ vibes are selected, **any combination containing a dud filters out every destination**: **11 of 21 two-vibe combos (52%) return zero.**

Proven live against `/api/surprise-me` (origin JFK):

```
mountains,cultural -> 0 cards, degraded
winter,beach       -> 0 cards, degraded
mountains,winter   -> 0 cards, degraded
beach,cultural     -> 3 cards   OK
tropical,beach     -> 3 cards   OK
```

**Orphan tags — richly populated, but no user can select them:** `foodie` (39 destinations), `romantic` (24), `nightlife` (21). The data has been sitting there unused; simply exposing these as chips makes them work immediately.

**Why nobody noticed:** the fabricated `FALLBACK` (removed earlier on this branch) fired whenever the filter returned nothing — so a user clicking **Mountains** or **Winter Escape** got the invented Cancún/$89-a-night cards and the feature *looked* fine. **The fabrication was masking a broken filter.** Deleting the fabrication is what made this visible.

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
- G3. Add a **`family`** vibe (Jose, 2026-07-12), fix the two dud chips (`mountains`, `winter`), and expose the three orphan tags (`foodie`, `romantic`, `nightlife`) that already have data.
- G4. No raw IATA code ever rendered to a user. **Scope (Jose, 2026-07-12 — "Name everything on-screen; let Atlas speak naturally"):** applies to ALL rendered UI (destination cards, trip header, context-strip origin pill, hero subtitle, auto-sent chat seeds) and equally bans raw internal enum values (`big_city`) on screen; when an origin cannot be named, the origin phrase is omitted — never a bare-code fallback. **Accepted deliberate gap:** Atlas's conversational chat prose may still say "JFK" (the model receives raw codes via page context and tool outputs) — forcing city names there would worsen JFK-vs-Newark disambiguation. Jose-approved; documented in the plan and PR description.
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

**Keep the live chip values as canonical.** No gratuitous renames: `big_city`/`cultural`/`foodie` are internal *values* whose user-facing *labels* are already "Big City"/"Cultural"/"Food". Renaming them buys nothing and churns 133 tags. Fix only what is actually broken, then expose the data we already have.

```
CANONICAL_VIBES = tropical · mountains · big_city · beach · winter ("Winter Escapade") ·
                  cultural · adventure · foodie · romantic · nightlife · family
```

Changes required:

| change | why |
|---|---|
| taxonomy `mountain` → **`mountains`** (5 dests) | one-letter mismatch with the live chip. This alone fixes the Mountains chip. |
| **relabel the chip → "Winter Escapade" + add `winter` tags** | **Jose, 2026-07-12.** "Winter Escape ❄️" was ambiguous — *escape to* winter (ski) or *escape from* winter (somewhere warm)? The label and the icon disagreed. **"Winter Escapade"** resolves it: an escapade is something you go *on*, so the chip unambiguously means a **snow/ski adventure**, and ❄️ is now correct. Internal value stays `winter`; only the label changes (+ i18n ×6).<br>The chip has *zero* backing destinations today. ⚠ **The existing `mountain` tags are NOT a usable seed** — they are `DEN, SEA, PHX, BOG, MDE` (Phoenix and Bogotá are not snow destinations; `mountain` here means "mountainous", not "snowy"). Genuine ski destinations must be **added** to the taxonomy (Vancouver, Salt Lake, Zurich, Geneva, Munich…); TravelPayouts does return them (`SLC`, `EGE`, `FCA` all appear in live results). Every `winter` destination must be a real snow/ski destination — **no warm-weather destination may be tagged `winter`** merely to reach the coverage floor. |
| **expose `foodie`, `romantic`, `nightlife` as chips** | 39/24/21 destinations already carry these tags and **no user can select them**. Pure upside: the data works the moment the chips exist. |
| **add `family` chip + tags** | requested by Jose (2026-07-12). Tagged editorially — theme parks, beaches with calm water, zoos/aquaria cities (ORL is the archetype). |

**Single source of truth.** Export one `VIBE_OPTIONS` (value + label + icon) consumed by `TripForm`. Delete the dead `PRESET_VIBES` and, with it, the dead `SurpriseMeQuiz` + `EntryTabs` (no importers) — or at minimum make `PRESET_VIBES` derive from `VIBE_OPTIONS` so a third vocabulary cannot re-emerge.

**Picker becomes 11 chips** (adds `foodie`, `romantic`, `nightlife`, `family`).

Only `winter` and `family` require genuine editorial tagging; everything else is either a rename or already tagged.

### 3.2 The regression guard (G2 — the most important deliverable)

A unit test that fails if the picker and the data ever drift again:

```ts
// every vibe a user can CLICK must exist in the taxonomy
for (const { value } of VIBE_OPTIONS) expect(ALL_TAXONOMY_TAGS).toContain(value);
// and no tag may exist that no user can ever reach
expect(ALL_TAXONOMY_TAGS).toEqual(new Set(VIBE_OPTIONS.map(v => v.value)));
```

Plus a **coverage floor**: every canonical vibe must be carried by at least **8** destinations — this is what catches `winter`, a chip that technically "exists" but backs onto zero data. A vibe that is present-but-useless is exactly the failure we shipped.

This test must **fail against today's `main`** (on `mountains`, on `winter`, and on the three orphans). Had it existed, none of this could have shipped.

### 3.3 Destination naming (G4)

- `IATA_TO_CITY` (127 curated, nicer names like "Nashville, Tennessee") stays the **primary** lookup.
- New generated fallback `city-names.ts`, derived from TravelPayouts' own authoritative `cities.json` + `airports.json` + `countries.json` (~9,369 entries, ~290 KB, **server-side only** — it is consumed in the API route, never shipped to the browser).
  - Label format: `"Chicago, United States"`.
  - Cities with **≥2 airports** get a `" (all airports)"` suffix — honest, because TP's `CHI` price may be O'Hare *or* Midway, and silently printing "Chicago" invites the assumption of O'Hare. (Detected by counting airports per city; note TP lists some metro codes as pseudo-airports, so "is it an airport code" is NOT a valid test.)
  - Explicitly **not** doing: mapping `CHI → ORD`. That would be a quiet fabrication.
- **Hard rule:** if a code resolves to no name, the destination is **dropped**, never rendered as a code. A test asserts no card name matches `/^[A-Z]{3}$/`.

### 3.4 Destination tagging (G5)

Tag the high-frequency city codes TP actually returns. Initial set (frequency-ordered): `NYC, CHI, ORL, WAS, PAR, LON, YTO, HOU, PIT, MOW, RDU, ANC, BEG` — plus `family` and `winter` tags across the existing 82.

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

- **Regression guard (§3.2)** — every `VIBE_OPTIONS` value exists in the taxonomy; taxonomy vocabulary == canonical set; coverage floor ≥8 destinations per vibe. *This test must fail against today's `main` — on `mountains`, on `winter`, and on the three orphans.*
- **Vocabulary integrity** — every destination's tags are a subset of `CANONICAL_VIBES`; the singular string `'mountain'` no longer appears as a tag anywhere in `src/` (scope the grep to the taxonomy + picker files — do NOT write a repo-wide ban, since "mountain" appears in prose, city names and tests, which would make the gate unsatisfiable).
- **The live bug, pinned** — `mountains,cultural`, `winter,beach`, `mountains,winter` each return **≥1 destination** (mocked TP). These assertions must fail pre-fix.
- **The orphans, unlocked** — `foodie`, `romantic`, `nightlife` each return **≥1 destination** and are each selectable from `VIBE_OPTIONS`.
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
| Editorial `family` + `winter` tagging is subjective | Coverage floor test (≥8 per vibe); tags reviewed in the plan review |
| 290 KB name table bloats the client bundle | Server-side only (API route); test asserts it is not imported by any client component |
| The `(all airports)` suffix reads oddly | Applied only to genuine multi-airport cities; verified visually |
| Pre-flight fires an LLM call per empty search | Deterministic by construction — pure set math, no model call; asserted by test |
| Scope creep into the pending deploy | Same branch/PR #7, same gates; `main` untouched until Jose merges |
