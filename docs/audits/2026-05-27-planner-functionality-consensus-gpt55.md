# TPI Planner Functionality Audit — GPT-5.5 Consensus Output

**Status:** Final consensus review — GPT-5.5 pass
**Prepared by:** GPT-5.5 via Hermes Agent
**Date:** 2026-05-27
**Source reviewed:** `docs/audits/2026-05-27-planner-functionality-audit.md`
**Repo:** `travelplaninfo-prototype` inside `/home/jarvis/.openclaw/workspace/jarvis-project`
**Review mode:** Grounded document review against live source after incremental jCodemunch re-index at `2026-05-27T19:11:28`

---

## Summary

I agree with the audit's core diagnosis: the planner has a real Path A itinerary flow and a real Path B Surprise Me flow, but the bridge between them is incomplete, Atlas trigger behavior is too aggressive, and several user-visible states silently mislead or fail closed. GPT-5.3-codex's corrections are valid and should be incorporated into the final sprint plan.

My strongest recommendation is to treat this as a **planner trust + trigger-governance sprint**, not a cleanup sprint. Fix the P0s first, build a single consent/state model for Atlas nudges and auto-search, and defer schema/attic cleanup unless it is prerequisite work for a user-facing fix.

---

## Grounding checks performed

Verified against current source:

- `GenerationProgress.tsx` listens for `atlas-progress`; search found no emitters outside the component.
- `src/app/[locale]/planner/[tripId]/page.tsx:54` still branches on `trip.destination === "Surprise Me"`.
- `SurpriseMeSection.tsx` still falls back silently to three MIA-area destinations and maps unknown origin `???` to `MIA`.
- `AssistantChat.tsx:812-866` still auto-opens and auto-sends after 800ms when a destination exists; it does not exclude `"Surprise Me"`.
- `src/app/api/trips/[id]/route.ts` `PUT` still does not update `entry_mode`; it also returns `SELECT *` trip rows.
- `useAtlasBubble.ts` still has idle timer only for `pageContext === 'itinerary'`; planner landing bubbles are interaction-threshold based, not true idle nudges.
- Affiliate `_blank` behavior remains scattered across planner-adjacent surfaces, including Atlas cards, `TripResultsModal`, `ItineraryBuilder`, and inline CTAs.
- `EntryTabs.tsx` has zero importers; `SurpriseMeQuiz`, `DestinationSuggestions`, and `TrendingDestinations` are only imported by dead `EntryTabs`. `CuratedItineraries` is live via `DesignA`. `InterestsModal.tsx` has zero file importers, but the identifier string appears inside `ItineraryBuilder` state names; delete decision should be based on file importers, not raw text hits.
- `OnboardingWrapper.tsx` returns `null` for guests.
- `PlannerDashboard.tsx` still catches `/api/trips` errors by only clearing loading state, creating an empty-state lie.
- Trip APIs and trip pages still leak `SELECT * FROM trips` shapes.

---

## Critical Issues (Must Fix)

### 1. Keep all P0s in the sprint scope

The three original P0s are legitimate:

1. `GenerationProgress` is misleading because it shows backend-like progress without any event source.
2. Surprise Me lacks a destination-resolution path, so Path B cannot naturally become Path A.
3. Surprise Me API fallback is silent and MIA-biased.

Add the Codex P0 as a required fourth item:

4. Atlas auto-trigger must not fire for `destination === "Surprise Me"`.

These are not polish. Together, they create a flow where a user can create a trip, see fake or irrelevant progress, get Caribbean fallback suggestions, and have Atlas auto-search for the literal destination "Surprise Me."

### 2. Surprise Me resolution must update both destination and trip semantics

I agree with Q2's primary CTA:

- Primary: `Plan a trip to [Destination]`
- Secondary: `Tell me more about [Destination]`

But the implementation must not rely on today's `PUT /api/trips/[id]` alone unless that route is expanded. Current `PUT` updates `destination` but not `entry_mode`, `origin_auto`, quiz/vibe metadata, or any resolution marker.

Recommended implementation:

- Add `POST /api/trips/[id]/resolve-surprise` rather than overloading the broad PUT route.
- Validate trip ownership.
- Refuse resolution unless current trip is a Surprise Me trip or `entry_mode` indicates an exploratory flow.
- Atomically write:
  - `destination = selectedDestination`
  - `entry_mode = 'surprise'`
  - optional `origin_auto` / selected card metadata if needed
  - `updated_at = datetime('now')`
- Return an explicit response DTO, not `SELECT *`.
- Client reloads or navigates to the same trip detail route so the existing Path A branch takes over.

### 3. Atlas trigger governance should be one state machine, not scattered timers

I agree with Codex more than with the original 3-second toast framing. A fixed delay is better than 800ms auto-send, but the real fix is **consent before network work**.

Required behavior:

- No automatic SSE/API work on first trip load.
- Show a non-blocking Atlas prompt/chip instead: `Start smart search` / `Not yet`.
- Never auto-trigger on `destination === "Surprise Me"`.
- Planner landing gets idle nudges based on no meaningful progress, not raw inactivity.
- Limit planner-landing nudges to one per session unless the user re-engages.
- Persist a user preference later if Jose wants an always-auto-search mode.

This should cover P1-2, P1-3, and P0-CODEX-1 as a single implementation package.

### 4. Stop silent fallback lies

For both `SurpriseMeSection` and `PlannerDashboard`, empty data must not masquerade as valid empty state.

Minimum requirements:

- Surprise Me API failure: show a banner such as `Atlas couldn't load fresh suggestions. These are example destinations.` plus Retry.
- Unknown origin `???`: do not silently map to MIA. Ask for/set origin, or explicitly label the fallback as Miami-based examples.
- PlannerDashboard fetch failure: show an error state and Retry, not `no trips`.

### 5. Introduce trip response DTOs before schema cleanup

I agree with the Codex pushback on quiz/schema deletion. The app currently returns `SELECT *` from several trip endpoints and the trip detail page reads raw rows. Dropping columns now is an API-shape break.

Add a DTO layer first:

- `toTripDto(row)` or equivalent in a server utility.
- Explicit response fields for list/detail/create/update.
- Parse JSON columns deterministically at the boundary where appropriate.
- Preserve deprecated fields temporarily only if an external consumer still needs them.

Only after this lands should `quiz_*` and `group_*` columns be dropped in a planned migration.

---

## Consensus answers

### Q1. Affiliate link standardization — which pattern?

**Agree / Disagree / Partial:** Partial agreement with both prior takes.

The two-tier policy is directionally right, but Codex's capability-driven framing is the right implementation boundary. The app should not decide behavior by component surface; it should decide by partner/link capability.

Final consensus:

- Create a single affiliate-opening abstraction, e.g. `openAffiliate(link, metadata)` or an `AffiliateLink` component.
- Add partner metadata in `src/config/affiliates.ts`:
  - `embedMode: 'iframe' | 'new_tab' | 'auto'`
  - `sponsored: true`
  - optional `partner`, `campaign`, `surface`
- Use iframe/modal only for allowlisted embeddable partners/widgets.
- Use new tab for deep links or frame-busting partners, but with consistent UX copy and tracking.
- Replace scattered raw `_blank` behavior in planner surfaces over time.

Sprint priority: P1, but not before the P0 planner-flow fixes unless affiliate behavior is part of Jose's immediate revenue goal.

### Q2. Surprise Me trip — should "Tell me more" resolve the destination?

**Agree / Disagree / Partial:** Agree, with a semantic split.

`Tell me more` should stay exploratory and must not mutate the trip. A new primary CTA should resolve the destination.

Final consensus:

- Add `Plan a trip to [Destination]` as the primary card CTA.
- Keep `Tell me more` as secondary chat-only exploration.
- Implement resolution with a dedicated endpoint or an expanded, tested route that updates destination and `entry_mode` together.
- Add an integration/e2e test for: create explore trip -> view suggestions -> resolve destination -> route renders Path A.

### Q3. Atlas auto-trigger — keep, soften, or remove?

**Agree / Disagree / Partial:** Remove automatic network work; keep a consented kickoff.

Final consensus:

- Remove 800ms auto-open + auto-send as default behavior.
- Replace with a non-blocking prompt chip/toast: `Atlas can search flights, hotels, and activities for this trip. [Start smart search] [Not yet]`.
- First click starts the existing prompt/SSE flow.
- Do not show this prompt for Surprise Me until a real destination has been selected.
- Optional later setting: `Auto-search new trips` default off unless Jose chooses otherwise.

### Q4. Dead component chain — preserve as attic or delete?

**Agree / Disagree / Partial:** Agree with Codex correction; reject the bundle-bloat premise.

Final consensus:

- Do not move the full EntryTabs/SurpriseMeQuiz chain to an attic as sprint work.
- Keep `EntryTabs.tsx` and `SurpriseMeQuiz.tsx` preserved because project memory explicitly says they remain as components but are not currently used.
- Do not claim bundle savings unless a bundle analyzer proves inclusion.
- `InterestsModal.tsx` can be deleted only after a normal deletion preflight confirms no file importers and no route/module side effects. Current file-importer check says zero importers; raw text references in `ItineraryBuilder` are state names, not imports.
- `CuratedItineraries.tsx` is live via `DesignA` and must not be included in dead-chain cleanup.

Sprint priority: XS cleanup only if it does not distract from P0/P1 flow work.

### Q5. Quiz schema columns — drop now or wait?

**Agree / Disagree / Partial:** Wait.

Final consensus:

- Do not drop now.
- Add DTOs first to stop leaking raw table shape.
- Mark fields deprecated in code comments/docs if useful.
- Stop writing obsolete quiz/group fields only after confirming no active consumer.
- Drop in a later migration sprint with rollback and production data backup.

### Q6. Planner landing idle nudge — what triggers?

**Agree / Disagree / Partial:** Agree with section-specific messages, refine trigger definition.

Final consensus:

Trigger on **no meaningful progress**, not merely no mouse/keyboard activity.

Examples:

- Chooser visible, no mode selected after 30s: `Not sure where to start? Pick the option that feels closest — you can change it later.`
- Flight mode selected, no origin/destination progress: `Tell me where you're flying from, or tap Atlas and say it in plain English.`
- Explore mode selected, no vibes: `Pick a feeling — chill, adventure, romance. Atlas will narrow the rest.`
- Explore mode with vibes but no interests: `Add two things you like and Atlas can build better suggestions.`

Implementation constraints:

- One landing nudge per session by default.
- Reset/advance state only when required-field completion changes.
- Reuse the same trigger governance mechanism as the auto-search consent fix.
- Store copy in i18n.

### Q7. Anything missed?

Additional items I would add to the final plan/backlog:

1. AssistantChat streaming/tool-marker parser deserves a focused audit before expanding Atlas automation.
2. Add one e2e regression suite that crosses the full planner seam:
   - create explore trip
   - receive Surprise Me suggestions
   - resolve destination
   - Path A renders
   - Atlas smart search starts only after consent
   - batch-add result persists items
3. Add API contract tests for trip DTOs and surprise resolution.
4. Add UI tests for falsy/empty/error states, especially `0`, `null`, empty arrays, and fetch failures.
5. Do a mobile/viewport pass after the full-width layout decision; the current audit did not verify mobile.

---

## Revised sprint scope I recommend

Priority order:

| # | Item | Severity | Effort | Notes |
|---|---|---:|---:|---|
| 1 | Replace/remove fake `GenerationProgress` behavior | P0 | M | Either wire real progress or replace with truthful Atlas handoff state |
| 2 | Add Surprise Me destination resolution CTA + server endpoint | P0 | M | Must update destination + `entry_mode` semantics atomically |
| 3 | Add Surprise Me fallback banner, Retry, and unknown-origin handling | P0 | S | Stop silent MIA-biased fallback |
| 4 | Disable Atlas auto-trigger for `Surprise Me` immediately | P0 | S | Can be a small guard if trigger-governance work is not first |
| 5 | Trigger governance package: consented smart search + planner landing idle nudges | P1 | L | Shared state machine; no auto network work without consent |
| 6 | PlannerDashboard fetch error state + Retry | P1 | S | Small but prevents empty-state lie |
| 7 | Guest-eligible bootstrap onboarding | P1 | M | Home airport/interests stored locally or guest-safe persistence |
| 8 | Trip response DTO layer | P1/P2 | M | Prerequisite for safe schema cleanup |
| 9 | Full-width planner visual QA and layout adjustment if confirmed | P1 | S | Verify at 1280/1440/1920 before changing broadly |
| 10 | Delete `InterestsModal.tsx` only if deletion preflight passes | P2 | XS | Do not attic-move the whole chain this sprint |

Deferred:

- Dropping `quiz_*` / `group_*` columns.
- Full affiliate-link refactor, unless Jose prioritizes revenue UX now.
- Full dead-component attic move.
- Deep `AssistantChat` parser refactor, unless e2e tests expose failures.

---

## Acceptance criteria for the sprint plan

Before implementation starts, the follow-up plan should include tests that prove behavior at the call sites, not just helper-level unit tests:

- Path B to Path A resolution works for a guest trip.
- `entry_mode` is correct after resolution.
- `Tell me more` does not mutate trip state.
- Atlas does not auto-send on Surprise Me or on a new real-destination trip before consent.
- Planner landing idle nudge appears once after no meaningful progress.
- Surprise Me API failure shows an honest fallback banner and Retry.
- PlannerDashboard API failure shows an error state and Retry.
- Trip endpoints return explicit DTOs and no longer depend on raw `SELECT *` response shape in client code.

---

## Final verdict

The audit is credible after the Codex corrections. I would approve it as the basis for sprint planning with these changes:

1. Reframe the sprint around planner trust and Atlas trigger governance.
2. Keep all P0s, including the Surprise Me auto-trigger guard.
3. Replace cleanup-heavy tasks with user-visible error-state and consent-state fixes.
4. Add DTO work as a prerequisite for later schema deletion.
5. Defer the dead-chain attic move and quiz-column drop.

This is ready to become an implementation plan after Jose confirms the product choices around Atlas auto-search consent and affiliate modal behavior.
