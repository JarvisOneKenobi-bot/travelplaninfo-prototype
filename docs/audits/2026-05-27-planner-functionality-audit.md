# TPI Planner Functionality Audit — 2026-05-27

**Status:** v3 — **CONSENSUS LOCKED**. Three-way consensus complete (Claude Opus 4.7 + GPT-5.3-codex via Hermes/openai-codex + GPT-5.5 via Hermes).
**Canonical sprint-planning source:** [`2026-05-27-planner-functionality-consensus-gpt55.md`](./2026-05-27-planner-functionality-consensus-gpt55.md) — GPT-5.5's final pass is the source of truth for sprint scope.
**Repo:** `travelplaninfo-prototype` @ `main` (Next.js 16.2.6 / next-intl 4.12.0)
**Live URL:** https://travelplaninfo.com/
**Scope:** End-to-end planner: TripForm → POST /api/trips → /[locale]/planner/[tripId] → ItineraryBuilder OR SurpriseMeSection → AssistantChat (Atlas) integration

---

## Read order

1. **`2026-05-27-planner-functionality-consensus-gpt55.md`** — GPT-5.5's final consensus. **Read first.** Contains the locked sprint scope (10 items, reframed as "planner trust + Atlas trigger governance"), acceptance criteria, and final verdict.
2. **This document (v3)** — full audit detail with file:line evidence, severity classifications, and inline GPT-5.3-codex pushback. Use as the technical reference when implementing the sprint plan.
3. **`2026-05-27-planner-audit-codex-raw.md`** — raw GPT-5.3-codex review output (archival).

## Consensus deltas (v3 from v2)

GPT-5.5 broadly endorsed the Codex corrections and added two key refinements:

1. **InterestsModal deletion needs a real preflight, not a raw text match.** GPT-5.5 noticed that `ItineraryBuilder.tsx` references `showInterestsModal` as a state variable — but on inspection that's an **inline modal** (own JSX at `ItineraryBuilder.tsx:717-774`), not the orphan component. Verified `grep -E "^import.*InterestsModal|from.*InterestsModal"` returns empty across `src/`. ✅ Preflight passes — `InterestsModal.tsx` is a true orphan, safe to delete.
2. **Surprise Me resolution should be a dedicated endpoint, not an overloaded PUT.** GPT-5.5 specified `POST /api/trips/[id]/resolve-surprise` with ownership guard, refuse-unless-surprise check, atomic write of `destination + entry_mode + updated_at`, and DTO response. See §"Critical Issues" #2 in the GPT-5.5 doc.

**Sprint scope reframed:** "planner trust + trigger governance" — not "cleanup". 10 items in GPT-5.5's doc. See that doc's table for the canonical list.

---

---

## How to use this doc

I (Claude Opus 4.7) mapped the live planner code and verified every claim with file:line evidence. Each finding is tagged with severity and a proposed direction. The doc closes with **Consensus Questions** — these are the decisions where I want GPT-5.5's second read before we commit work to a sprint plan.

GPT-5.5: please respond inline under each Consensus Question with your take, alternatives, and any findings you'd add or contest. The goal is a 3-way consensus (Jose + me + you) before we plan the sprint.

Severity scale: **P0** = blocks core flow / silent corruption / misinformation, **P1** = north-star UX miss / consistent bug, **P2** = polish / debt, **P3** = future improvement.

---

## 1. Current architecture, one paragraph

The planner is a 3-mode entry form (chooser → flight | explore) that creates a trip via `POST /api/trips` and routes the user to `/[locale]/planner/[tripId]`. That detail page server-renders Path A (`ItineraryBuilder` for a real destination) or Path B (`SurpriseMeSection` for `destination === "Surprise Me"`). Atlas (the assistant) is a global `AssistantChat` panel mounted in the locale layout. It reads trip state from a `<script id="atlas-trip-context">` JSON tag injected by the server-rendered page, plus `window.__atlasFormContext` set live by `TripForm` during fill. Atlas can render inline result cards (Flight/Hotel/Activity/Restaurant) and can open a fullscreen `TripResultsModal` (5 tabs) that batch-adds items to the trip via `POST /api/trips/[id]/items/batch`. Persistence is `better-sqlite3` with guest cookie auth (`tpi_guest`) that merges into a real account on registration.

---

## 2. What works well

These are load-bearing flows that hold up. Calling them out so consensus review doesn't accidentally regress them.

| Working | Evidence |
|---|---|
| Three-mode TripForm with 4 bordered sections (Vibes/Interests/Budget/Travel Details) and `sectionBorder()` gray→green completion gates | `TripForm.tsx` (1066 LOC). Locked design per `feedback_tpi_planner_section_design.md` |
| Path A/B split on tripId page | `src/app/[locale]/planner/[tripId]/page.tsx:54` — `isSurpriseMe = trip.destination === "Surprise Me"` |
| Guest auth + merge | `src/lib/guest.ts` — `tpi_guest` httpOnly cookie + `tpi_guest_hint` client-readable flag. Transactional merge into real user on registration |
| SSR trip + items load (no client-fetch waterfall on tripId page) | `[tripId]/page.tsx:28-50` — DB reads happen server-side, hydrated into `<ItineraryBuilder initialItems={...} />` |
| Atlas context handoff via DOM script tag | `[tripId]/page.tsx:160-188` injects `<script id="atlas-trip-context">`; `AssistantChat.readTripContext()` reads it on every send |
| Batch add via `/api/trips/[id]/items/batch` | Up to 50 items in one transaction. Cleans Atlas placeholder rows (`is_placeholder=1`) for flight/hotel/car before inserting real items |
| Atlas chat rate limiting | 10 req/min per session_id (in-memory map). 401/404/400 paths well-handled in `api/assistant/chat/route.ts:36-299` |
| Atlas response stream resilience | FastAPI unreachable → friendly inline error injected into SSE stream, not a crashed page |
| Auto-summarize background pass | When prior sessions hit 6+ messages with no summary, a fire-and-forget POST to `/api/assistant/summarize` runs |
| Trip ownership enforcement | Every `/api/trips/[id]/*` route checks `user_id = ?` before reading/writing |
| Stable JSON storage of interest prefix encoding (`vibe:X`, `custom:X`, `vibe:custom:X`) | TripForm.tsx:315-322 + `[tripId]/page.tsx` consumption — straightforward and works |

---

## 3. Findings — by severity

### P0 — blocks core flow or silently misinforms

**P0-1. `GenerationProgress` is a dead spinner showing fake activity.**
`src/components/GenerationProgress.tsx:50-51` listens for `window` event `atlas-progress`. Grep confirms **zero emitters** in the entire codebase. The component renders on Path A whenever `items.length === 0` and shows "Searching flights → Finding hotels → Building itinerary → ..." steps that never advance. Atlas's 800ms auto-trigger fires and opens the chat — but the visual progress bar stays pending forever. **This is user-visible misinformation: the spinner looks like backend work is happening when nothing is.**
→ *Direction:* either (a) emit `atlas-progress` events from `AssistantChat` as the auto-trigger walks through search_flights / search_hotels / search_activities tool calls, or (b) remove the component and replace with a clean "Atlas is searching — see chat panel" inline hint that mirrors Atlas's actual state.

**P0-2. "Surprise Me" trip has no destination-resolution path.**
A trip created via explore mode lands at `[tripId]` with `destination = "Surprise Me"`. `SurpriseMeSection.tsx` shows 3 suggestions (via `/api/surprise-me`, fallback to 3 hardcoded MIA destinations). The "Tell me more about X" button dispatches `atlas-open` with a chat prompt — but **there is no mechanism to convert the trip's `destination` field from "Surprise Me" to an actual destination**. The user is permanently stuck on Path B for this trip unless they manually create a new one. This breaks the "Surprise → I'll go" funnel.
→ *Direction:* add a "Plan a trip to X" CTA on each destination card that PATCHes the trip via `PUT /api/trips/[id]` with `{destination: "X", entry_mode: "surprise"}` and reloads the page → re-routes to Path A.

> **✏️ Consensus correction (GPT-5.3-codex):** `PUT /api/trips/[id]` does **not** update `entry_mode` today (verified via grep of `src/app/api/trips/[id]/route.ts` — `entry_mode` does not appear in the COALESCE update list). So the proposed fix is incomplete as written. Either (a) extend the PUT route's schema to accept `entry_mode` and add to the UPDATE statement, or (b) add a dedicated `POST /api/trips/[id]/resolve-surprise` endpoint that atomically writes `destination` + `entry_mode='surprise'` and any related markers. Without that, downstream consumers that gate on `entry_mode` (e.g., the quiz-context chips on tripId page lines 110–129) will be wrong after resolution.

**P0-3. `SurpriseMeSection` silent fallback on API failure.**
`SurpriseMeSection.tsx:99` catches any error from `/api/surprise-me` and silently `setDestinations(V1_FALLBACK)`. The fallback is **3 hardcoded MIA-area destinations** (Cancún, San Juan, Punta Cana). A non-MIA user (e.g., origin DEN) on a network error sees the same 3 destinations every time, irrelevant to their vibes/budget. No telemetry, no user-visible "results unavailable" hint. Combined with P0-2, this means a network blip on the FastAPI backend permanently locks the user into 3 wrong destinations.
→ *Direction:* surface a non-fatal banner "Atlas couldn't load fresh suggestions — these are example destinations" + a Retry button. Or fall back to user's saved preferences if available.

---

### P1 — north-star UX miss or consistent bug

**P1-1. Affiliate link behavior is inconsistent across 4 surfaces.**
The 2026-03-24 north-star rule is *"affiliate links open in modal, not new tab."* Reality (all verified `target="_blank"`):
- `AffiliateRecommendations` (sidebar) → opens `AffiliatePreviewModal` ✅ — but the modal's CTA at `AffiliatePreviewModal.tsx:140` still uses `target="_blank"` (modal-then-newtab = 2-step kick out).
- `TripResultsModal` flight/hotel "Book on" links: `TripResultsModal.tsx:587, 699` — direct `target="_blank"`.
- Atlas card components: `atlas/FlightCard.tsx:45`, `atlas/HotelCard.tsx:46`, `atlas/ActivityCard.tsx:48`, `atlas/DealCard.tsx:30` — all direct `target="_blank"`.
- `AffiliateInlineCTA.tsx:16,24,32` — three different CTAs all direct `target="_blank"`.
- `ItineraryBuilder` stored items' `affiliate_url` — direct `target="_blank"`.
→ *Direction:* commit to one pattern (probably: in-page iframe modal with minimize/close per the 2026-03-24 feedback). Either standardize everywhere or accept the inconsistency and update the north-star.

**P1-2. Atlas idle/help nudge is only on the itinerary page, not on the planner landing — directly contradicting "Jose got lost on planner" feedback.**
`useAtlasBubble.ts:127` enables the idle-timer bubble (`itinerary-idle`) **only when `pageContext === 'itinerary'`** (pathname has `/planner/` AND depth > 3). On the planner landing (mode chooser / TripForm), there's no idle timer at all — and the "Jose got lost" incident on 2026-03-24 was about getting lost ON THE PLANNER LANDING, not on the itinerary page. The feedback explicitly says "30s on planner with no actions → Atlas nudge."
→ *Direction:* extend idle detection to `pageContext === 'planner'` with section-aware messages (e.g., "Stuck on vibes? Tap the mic and just tell me how you want to feel on this trip").

**P1-3. Atlas auto-trigger is aggressive.**
`AssistantChat.tsx:813-870` — 800ms after the tripId page mounts, if items are empty and history is empty, Atlas calls `setIsOpen(true)` and fires "Search flights, hotels, and activities for me." The user just clicked Create Trip → got redirected → Atlas immediately pops open and starts an SSE call without consent. Users who want to look around first are interrupted; the search consumes API quota every time.
→ *Direction:* either (a) delay to 3s with a dismissable "Want me to start searching?" toast, or (b) gate behind a one-time onboarding consent ("Auto-search on new trips: ON / OFF"), or (c) keep but make the auto-prompt cancellable inline.

**P1-4. Planner is not full-width.**
The 2026-03-24 feedback: *"Planner page lost its full-width layout — content area is too narrow."* The tripId page is `max-w-[90rem] mx-auto` (`[tripId]/page.tsx:63`), which caps at 1440px. With the 300px right sidebar, the itinerary main area is squeezed at common laptop widths.
→ *Direction:* drop `max-w-[90rem]` to `max-w-screen-2xl` or remove the cap entirely; verify with `playwright` at 1280, 1440, 1920.

**P1-5. OnboardingModal is auth-only — never shown to guests.**
`OnboardingWrapper.tsx` gates `OnboardingModal` behind `useSession()`. Guests (the primary funnel — `getOrCreateGuest()` is called on first POST /api/trips) **never see onboarding**. The localStorage flag `tpi_onboarding_complete` exists but the modal also checks `home_airport in preferences`, which guests can't have because they have no preferences row until they register.
→ *Direction:* split onboarding into "minimum bootstrap" (home airport + interests, guest-eligible, persisted to localStorage) and "full account onboarding" (auth-only). The first is shown once to guests, the second when they convert.

**P1-6. Empty fallback for `nearby_airports` when origin isn't in the static map.**
`TripForm.tsx:352-354` — `nearby_airports = NEARBY_AIRPORTS[origin].airports` only when origin is in the static `NEARBY_AIRPORTS` map (covers ~18 airports). Origins outside the map (DEN, PHX, BNA, SEA, etc.) silently get `[origin]` (single-element array). FastAPI then searches one airport only. North-american user in any major city outside the 18 mapped → degraded search quality with no UI signal.
→ *Direction:* either ship a fuller `NEARBY_AIRPORTS` table (cover all major US/CA hubs) or query an airport-proximity API on submit.

**P1-7. `PlannerDashboard` swallows fetch errors silently.**
`PlannerDashboard.tsx:28-31` fetches `/api/trips` on mount. On error: `setLoading(false)` but `trips` stays `[]` and no error message renders. User sees an empty dashboard with no explanation.
→ *Direction:* add error state + a Retry button. Match the pattern from `AffiliateRecommendations`.

---

### P2 — polish / tech debt

**P2-1. Quiz schema columns are pure debt.** `trips` table has 11 columns (`quiz_budget`, `quiz_vibes`, `quiz_when`, `quiz_who`, `quiz_group_size`, `group_share`, `group_costsplit`, `group_consensus`, `entry_mode`, `origin_auto`) added for the dead `SurpriseMeQuiz` flow. The live `TripForm.tsx` writes none of them except `entry_mode='direct'` from flight mode (explore mode doesn't set it at all). Schema bloat, migration drag, and a footgun: any future code seeing `quiz_*` columns will assume they mean something.
→ *Direction:* migration to drop them once we confirm no production query references them. Verify with `grep -rn "quiz_\|group_costsplit\|group_consensus" src/`.

**P2-2. Dead component chain — orphans in repo, NOT in production bundle.**

> **✏️ Consensus correction (GPT-5.3-codex):** My v1 claim that `DesignA` ships the EntryTabs chain was **wrong**. Verified directly: `src/components/DesignA.tsx` imports only `LatestGuides` and `CuratedItineraries` — **no `EntryTabs` import** (lines 3–5 are the full import list). The EntryTabs → SurpriseMeQuiz → DestinationSuggestions/TrendingDestinations chain is dead **and** tree-shaken (no live importer anywhere). So the "bundle bloat" framing was incorrect. The decision is now repo-cleanliness vs. preserve-as-history, not a bundle-size question.

Confirmed orphan files (0 live importers):
- `src/components/EntryTabs.tsx` (149 LOC) — only imports SurpriseMeQuiz, no live consumer
- `src/components/SurpriseMeQuiz.tsx` (469 LOC) — only imported by EntryTabs (dead)
- `src/components/DestinationSuggestions.tsx` — only imported by EntryTabs
- `src/components/TrendingDestinations.tsx` — only imported by EntryTabs
- `src/components/InterestsModal.tsx` — **truly orphaned, 0 imports anywhere** (the only file where deletion is unambiguously safe)

**Conflict with memory rule:** `feedback_tpi_planner_section_design.md` says *"`EntryTabs.tsx`, `SurpriseMeQuiz.tsx` remain as components but are NOT used on the planner page currently"* — preserve-not-remove.
→ *Direction (revised):* defer EntryTabs/SurpriseMeQuiz cleanup (no bundle benefit, memory rule says preserve). **Delete `InterestsModal.tsx` now** (proven orphan, zero risk). Defer the rest to a future repo-cleanup pass.

**P2-3. Two parallel route trees: `/src/app/planner/` and `/src/app/[locale]/planner/`.**
The non-locale versions are 4-line stubs returning `null`. They're dead in practice because `middleware.ts` always rewrites to the locale variant. But every `/planner/page.tsx`, `/planner/[tripId]/page.tsx`, `/signin/page.tsx`, `/destinations/page.tsx` etc. is duplicated as a stub. Visual noise + minor maintenance trap (someone could edit the stub thinking it's live).
→ *Direction:* check if Next 16 / next-intl 4.12 actually requires these stubs anymore. If not, delete the non-locale tree.

**P2-4. `budget_override` is settable via API but not clearable in the UI.**
`api/trips/[id]/route.ts` PUT accepts `budget_override: null` to clear. `ItineraryBuilder` consumes `initialBudgetOverride` and `BudgetBar` renders against it, but there's no clear-override button. Once set, it's stuck unless the user goes API/devtools.
→ *Direction:* small "Reset to default" button on BudgetBar.

**P2-5. User memory budget is mixed (50 rows total = facts + summaries combined).**
`api/assistant/chat/route.ts:85` — `LIMIT 50` on `user_memory ORDER BY updated_at DESC`. Summaries (keys `conversation_summary_*`) and facts share the quota. A chatty user with many sessions will see their facts evicted by their own summaries.
→ *Direction:* split into two queries — last N summaries + last M facts.

**P2-6. AirAdvisor CJ link is a TODO placeholder.**
`src/config/affiliates.ts` — `CJ_LINKS.airAdvisor()` has a `// TODO` comment for the real CJ click URL. The card only appears when interests contain flight/delay/compensation keywords, so it's rare — but when it does fire, it likely sends users to a non-functional URL.
→ *Direction:* confirm the CJ link is live in Network panel; if not, either fix or feature-flag off.

---

### P3 — future improvements

- **P3-1.** Add a `pageContext === 'planner-landing'` and a section-aware bubble queue so Atlas can nudge in context ("set a budget" / "pick at least 2 interests").
- **P3-2.** Consider deriving `nearbyAirports` server-side at trip creation so we don't ship a static table to the client.
- **P3-3.** `TripResultsModal.tsx` is 47 KB. It's already lazy-loaded by AssistantChat behavior (only opens on demand) but worth splitting if we add more tabs.
- **P3-4.** `geocoding_cache` table has no expiry; cache will grow unbounded.
- **P3-5.** No e2e Playwright coverage of the planner flow exists (per memory: the Command Post Sprint 1 added Playwright there; TPI does not have parallel coverage of the planner happy paths).

---

## 4. Severity rollup

| Severity | Count | Estimated effort |
|---|---|---|
| P0 | 3 | ~2–3 days combined (most of P0-1 and P0-2) |
| P1 | 7 | ~1 week |
| P2 | 6 | ~3–4 days |
| P3 | 5 | Park for backlog |

**Suggested sprint scope:** all P0 + 3–4 P1s + 1–2 P2 quick wins. Specifically I'd propose:

- P0-1 (GenerationProgress — fix or remove)
- P0-2 (Surprise Me → real destination resolution)
- P0-3 (Surprise Me fallback messaging)
- P1-2 (Atlas idle nudge on planner landing — the "Jose got lost" north-star fix)
- P1-3 (Atlas auto-trigger — soften)
- P1-4 (full-width planner)
- P1-5 (OnboardingModal for guests)
- P2-2 (dead component chain — at minimum move to attic if preserving)

That's ~1.5 weeks of focused work and lines up with what's been on the backlog since March.

---

## 5. Consensus Questions for GPT-5.5

These are the decisions I want a second read on before sprint planning. Please respond inline below each question with your take + alternatives + anything I missed.

### Q1. Affiliate link standardization — which pattern?

I see four behaviors today (1-step direct, 2-step modal-then-newtab, raw card target=_blank, sidebar→modal). The 2026-03-24 feedback says modal+minimize+close everywhere. But that's a non-trivial change because:
- Some partner pages don't allow iframe embedding (X-Frame-Options).
- A modal-iframe pattern would need to detect frame-busting and fall back to a new tab.
- Re-marketing pixels and affiliate cookies may behave differently in iframe vs new-tab.

**My take:** the iframe-modal pattern is correct for content that *embeds well* (Booking.com search widgets, GetYourGuide widgets, partner-provided iframes). For deep-link clicks (specific hotel page, specific flight), `target="_blank"` is more practical because the iframe will get framebusted anyway. So a **two-tier policy**: (a) sidebar "search a partner" recs → embedded widget modal; (b) deep-link CTAs → target=\"_blank\" with a small interstitial "Opening partner site — back here in 2 seconds" toast.

**GPT-5.3-codex take:**
**Agree / Disagree / Partial:** Partial
**Take:** I agree with a two-tier policy, but it should be **capability-driven, not surface-driven**. Right now `_blank` is scattered across many planner surfaces (`TripResultsModal.tsx:587,699`, `ItineraryBuilder.tsx:616`, `atlas/*Card.tsx`, `AffiliateInlineCTA.tsx:16,24,32`), which creates inconsistent behavior. Use a single `openAffiliate()` wrapper that first attempts embedded modal only for allowlisted embeddable partners, then falls back to `_blank` with consistent tracking and UX copy.
**Refinement:** Add partner metadata in `src/config/affiliates.ts` like `embedMode: 'iframe' | 'new_tab' | 'auto'` so behavior is declarative and auditable.

---

### Q2. Surprise Me trip — should "Tell me more" resolve the destination?

P0-2 above. Today, clicking "Tell me more about Cancún" opens Atlas chat with a prompt — but the trip stays at `destination="Surprise Me"`. The user can't progress to a real itinerary on this trip without making a new one.

**My take:** add a primary CTA on each destination card: **"Plan a trip to [Cancún]"** that PATCHes the trip and reloads → Path A. The "Tell me more" stays as a secondary CTA (chat-only exploration without commitment). This preserves the exploration-first feel while giving a clear conversion path.

**Alternative:** keep Path B exploration-only forever; force the user to create a new trip with a specific destination after exploration. Worse UX but simpler.

**GPT-5.3-codex take:**
**Agree / Disagree / Partial:** Agree
**Take:** Strong agree this needs an explicit conversion CTA. Keeping users stuck at `destination === "Surprise Me"` is a funnel break (Path B lock). Add a primary CTA to commit destination and transition to Path A; keep "Tell me more" as exploratory secondary.
**Refinement:** Don't rely on current `PUT /api/trips/[id]` for `entry_mode`; it does not update `entry_mode` today (`src/app/api/trips/[id]/route.ts:44-56`). Either extend PUT schema or add a dedicated "resolve surprise destination" endpoint. *(Captured as ✏️ correction in P0-2 above.)*

---

### Q3. Atlas auto-trigger — keep, soften, or remove?

P1-3. 800ms auto-open + auto-search on new tripId page. Aggressive but it does demonstrate the AI-concierge value prop immediately on the very first interaction.

**My take:** soften to a 3-second toast: "Atlas is ready to search flights, hotels, and activities. [Start searching] [Not yet]" — preserves the demo value without forcing it. The first-time user benefit is the "wow, it just did the work for me" moment, so I don't want to lose that entirely.

**Alternative 1:** add a settings toggle and persist preference.
**Alternative 2:** keep as-is, the metric is engagement and it works.

**GPT-5.3-codex take:**
**Agree / Disagree / Partial:** Partial
**Take:** I agree it should be softened, but a fixed 3s delay still feels arbitrary. Current behavior auto-opens and auto-sends after 800ms (`AssistantChat.tsx:816-866`), which is too aggressive and can consume quota unnecessarily. A consented one-click kickoff is better: show intent, don't start network work until explicit user action.
**Refinement:** First-trip only: non-blocking prompt chip ("Start smart search") with auto-dismiss; persist user preference (`auto_search_enabled`) in localStorage/profile.

---

### Q4. Dead component chain — preserve as attic or delete?

P2-2. `EntryTabs.tsx`, `SurpriseMeQuiz.tsx`, `DestinationSuggestions.tsx`, `TrendingDestinations.tsx`, `CuratedItineraries.tsx`, `InterestsModal.tsx` — all dead from live paths, all currently in the production JS bundle via DesignA's import chain. Memory rule says *don't remove these specific two (EntryTabs + SurpriseMeQuiz)* but reality is they cost bundle size every day they ship.

**My take:** move all 6 to `src/components/_attic/` with a README. Update the imports in DesignA/EntryTabs to point at the attic paths. Add a regex exclude in next.config so they're tree-shaken. Best of both: code history preserved, bundle clean.

**Alternative 1:** just delete — the git history preserves them anyway.
**Alternative 2:** leave as-is — minor bundle cost, low risk.

**GPT-5.3-codex take:**
**Agree / Disagree / Partial:** Disagree (with my framing — the bundle-bloat premise was wrong)
**Take:** `DesignA.tsx` imports `CuratedItineraries` and `LatestGuides` (`DesignA.tsx:3-5`) but does **not** import `EntryTabs`; search shows no importer for `EntryTabs` (`import EntryTabs from` = 0). So this chain is dead-but-**unbundled**, not "live chain in production bundle." There is no JS-bundle benefit to moving them to an attic.
**Refinement:** Keep `EntryTabs`/`SurpriseMeQuiz` preserved per memory rule. Run bundle analyzer before any attic work. **Prioritize deleting truly orphaned `InterestsModal.tsx` (0 imports)** and any dead exports proven by bundle stats. *(Captured as ✏️ correction in P2-2 above — revised direction is now: delete InterestsModal.tsx only, defer the rest.)*

---

### Q5. Quiz schema columns — drop now or wait?

P2-1. 11 `quiz_*` and `group_*` columns in `trips` table never written by live code. Migration to drop them is straightforward (SQLite ALTER TABLE), but downstream readers might exist in:
- `/api/trips/[id]` GET response (currently returns row as-is — clients would see new shape)
- FastAPI backend (any chance it reads these?)
- Analytics queries we don't see

**My take:** safer to keep them for now. Cost of dropping is annoying-to-low (migration + maybe FastAPI change), benefit is also low (schema cleanliness). Park as P3 until we have a real migration sprint.

**Alternative:** drop them now while we're auditing. Less drag later.

**GPT-5.3-codex take:**
**Agree / Disagree / Partial:** Partial
**Take:** I would not drop immediately. Even if UI no longer sends quiz fields, API POST still accepts and inserts them (`src/app/api/trips/route.ts:44-53,108-131`), and GET returns `SELECT *` (`/api/trips/route.ts:12`, `/api/trips/[id]/route.ts:9,29`). Dropping now is a breaking API-shape change unless all consumers are updated together.
**Refinement:** Mark deprecated now, stop writing them first, add compatibility adapter in responses, then remove in a planned migration window. **Add an explicit response DTO** for trips instead of `SELECT *` leak — that's the prerequisite cleanup that enables safe column drops later.

---

### Q6. Planner landing idle nudge — what triggers?

P1-2. Need to add idle detection on planner landing. Specific question: what's the *trigger* + what's the *bubble copy*?

**My take:** Per-section logic.
- 30s idle on chooser screen → "Stuck? Tap whichever feels right — you can change later."
- 30s on flight mode without any field → "Where are you flying from? Just type your city."
- 30s on explore mode with no vibes → "Pick a feeling — chill, adventure, romance. We'll go from there."
- 30s on explore with vibes but no interests → "Tap 2 things you like — Atlas will do the rest."

Stored in i18n `tripForm.idleNudge.*`. Idle resets on any `atlas-interaction` event.

**GPT-5.3-codex take:**
**Agree / Disagree / Partial:** Agree
**Take:** Direction is right; add true idle nudges on planner landing. Current hook has idle timer only for itinerary (`useAtlasBubble.ts:125-142`), while planner bubbles are interaction-threshold-based (`:86-93`), not idle-based. Your section-specific copy approach is good and aligned with where users stall.
**Refinement:** Trigger by **"no meaningful progress"** (no required field transitions) rather than mere inactivity, and throttle to **one nudge per session on landing** to avoid nagging.

---

### Q7. Anything I missed?

I covered: entry flow, itinerary flow, Atlas integration, data model, persistence, API routes, i18n duplication, dead code, north-star deltas, error/empty states. Roughly 1900 LOC across the core files plus the 47KB TripResultsModal.

Things I *didn't* deeply audit (and which may deserve their own pass):
- `ItineraryBuilder.tsx` (~700 LOC) — only mapped at a behavioral level, didn't deeply audit add/edit/delete edge cases or MapDrawer geocoding flow.
- `AssistantChat.tsx` (~1150 LOC) — mapped major paths but the SSE parsing + tool marker handling is complex and bug-prone (`parseToolMarker`, `[TOOL:...]` markers).
- Mobile responsiveness — not assessed at all in this pass.
- Performance — bundle sizes, render counts, hydration cost.
- Accessibility — Modal focus traps look OK, but no axe audit.

**GPT-5.3-codex take:**
**Agree / Disagree / Partial:** Agree
**Take:** Highest-value second pass is **`AssistantChat` streaming/tool marker parsing and "trigger hygiene"** (auto actions, duplicate sends, stale context). Next is conversion-path integrity across Path B→A, including persistence semantics and analytics events. Third is planner API contract hardening (`SELECT *` leakage and nullable semantics).
**Refinement:** Add one focused e2e suite for: create explore trip → resolve destination → first Atlas interaction → batch add results; this catches multiple current failure modes.

---

## 7. Consensus additional findings (GPT-5.3-codex)

These are findings Codex surfaced that I missed in v1:

**P0-CODEX-1. Auto-trigger fires on "Surprise Me" destination too.**
`AssistantChat.tsx:822-823` guard only excludes missing destination / literal `"your destination"`. It does NOT exclude `destination === "Surprise Me"`. So on Path B (Surprise Me trip), auto-trigger still fires, constructs prompt `"I just created a trip to Surprise Me. ... Search flights, hotels, and activities for me."` (`:853`) and auto-sends at 800ms (`:865`). This produces noisy/low-quality Atlas responses on Path B because there's no real destination to search.
→ *Direction:* extend the guard to also exclude `destination === "Surprise Me"`. Combine with P1-3 fix (consent-gated auto-trigger).

**P1-CODEX-1. SurpriseMeSection MIA default compounds wrongness for non-MIA users.**
`SurpriseMeSection.tsx:78` — `const origin = originCode === "???" ? "MIA" : originCode;`. Unknown origin code → silently maps to MIA. Combined with the V1_FALLBACK (3 MIA-area destinations), a non-MIA user with an unrecognized origin code (e.g., a typo or missing config) sees Caribbean destinations from Miami regardless of where they actually live.
→ *Direction:* on `"???"` origin, surface a "We need your home airport — set it now" prompt instead of defaulting silently. Or fallback to user preferences `home_airport` if available.

---

## 7b. Sprint scope pushback (GPT-5.3-codex)

Codex's revised sprint mix (vs. my proposal):

1. ✅ Keep P0-1 / P0-2 / P0-3.
2. ↔ **Replace P2-2 (attic move) with a P1 "auto-trigger + consent + Surprise Me guard" package** (higher UX/compute impact, less speculative). *Note: P2-2 already revised above to delete-InterestsModal-only, which is a smaller scope than attic-move.*
3. 🔄 **Keep P1-2 (planner-landing idle nudge) and P1-3 (auto-trigger softening), but implement together in one trigger-governance pass** with a shared state machine.
4. ⏸️ **Defer full-width (P1-4)** only if quick visual QA confirms it's not materially harming task completion; otherwise keep it.
5. ➕ **Add one API-contract task now:** explicit response DTO for trips instead of `SELECT *` leak, to decouple future schema cleanup (supports eventual quiz-column deletion safely). Connects to P2-1.

**My response to Codex's pushback:** I accept points 1–5. The "trigger governance" framing is sharper than my split P1-2/P1-3. The DTO task is a real prerequisite I missed — without it, P2-1 (drop quiz columns) is unsafe.

**Final revised sprint scope (consensus):**

| # | Item | Effort |
|---|---|---|
| 1 | P0-1 — Fix or remove dead GenerationProgress spinner | M |
| 2 | P0-2 — Surprise Me → destination resolution **including PUT route schema fix** | M |
| 3 | P0-3 — SurpriseMeSection fallback messaging + non-silent retry | S |
| 4 | P0-CODEX-1 — Auto-trigger guard for Surprise Me destination | S |
| 5 | P1-2 + P1-3 — Trigger governance (idle nudges on planner + soften auto-trigger) — single state machine | L |
| 6 | P1-4 — Full-width planner (after quick QA confirms impact) | S |
| 7 | P1-5 — OnboardingModal for guests | M |
| 8 | NEW — Trip response DTO (replace `SELECT *` leak, prerequisite for P2-1) | M |
| 9 | P2-2 (revised) — Delete `InterestsModal.tsx` only (the proven orphan) | XS |

That's ~9 items, ~1.5–2 weeks. Removed from scope: full attic move (no bundle benefit), P2-1 quiz column drop (deferred until #8 lands).

---

## 6. Appendix: file map (essentials)

```
src/app/[locale]/planner/page.tsx           — landing, auth gate
src/app/[locale]/planner/[tripId]/page.tsx  — Path A/B split + Atlas context injection
src/components/TripForm.tsx                 — 3-mode entry (1066 LOC)
src/components/PlannerDashboard.tsx         — trip list + inline create
src/components/ItineraryBuilder.tsx         — day/item editor (~700 LOC, NOT deeply audited)
src/components/SurpriseMeSection.tsx        — Path B with V1_FALLBACK
src/components/AtlasHeroSection.tsx         — destination cards renderer
src/components/AssistantChat.tsx            — global Atlas panel (1150 LOC, deep but not exhaustive)
src/components/atlas/TripResultsModal.tsx   — 5-tab batch-add modal (47KB)
src/hooks/useAtlasBubble.ts                 — bubble + idle timer (itinerary-only today)
src/app/api/trips/route.ts                  — POST creates trip with 32-col insert
src/app/api/trips/[id]/items/batch/route.ts — atomic batch insert, removes placeholders
src/app/api/assistant/chat/route.ts         — SSE proxy to FastAPI + memory loading
src/app/api/surprise-me/route.ts            — 1hr-cached destination suggestions w/ fallback
src/lib/db.ts                               — schema + migrations (208 LOC)
src/lib/guest.ts                            — getUserId, getOrCreateGuest, mergeGuestIntoUser
src/components/GenerationProgress.tsx       — DEAD SPINNER — see P0-1
src/components/AffiliatePreviewModal.tsx    — sidebar-only modal (P1-1)
src/config/affiliates.ts                    — CJ_LINKS + TP_CONFIG (TODO at AirAdvisor — P2-6)
```

Dead from live paths (preserve-vs-delete decision pending — see Q4):
```
src/components/EntryTabs.tsx                — 149 LOC
src/components/SurpriseMeQuiz.tsx           — 469 LOC
src/components/DestinationSuggestions.tsx
src/components/TrendingDestinations.tsx
src/components/CuratedItineraries.tsx
src/components/InterestsModal.tsx           — 0 imports anywhere
```

---

**End of audit.** Awaiting GPT-5.5 inline responses to the Consensus Questions in §5.
