## GPT-5.3-codex Consensus Review — 2026-05-27

### Q1 — Affiliate link standardization
**Agree / Disagree / Partial:** Partial
**My take:** I agree with a two-tier policy, but it should be capability-driven, not surface-driven. Right now `_blank` is scattered across many planner surfaces (`TripResultsModal.tsx:587,699`, `ItineraryBuilder.tsx:616`, `atlas/*Card.tsx`, `AffiliateInlineCTA.tsx:16,24,32`), which creates inconsistent behavior. Use a single `openAffiliate()` wrapper that first attempts embedded modal only for allowlisted embeddable partners, then falls back to `_blank` with consistent tracking and UX copy.
**Alternative or refinement:** Add partner metadata in `src/config/affiliates.ts` like `embedMode: 'iframe' | 'new_tab' | 'auto'` so behavior is declarative and auditable.

### Q2 — Surprise Me destination resolution
**Agree / Disagree / Partial:** Agree
**My take:** Strong agree this needs an explicit conversion CTA. Keeping users stuck at `destination === "Surprise Me"` is a funnel break (Path B lock). Add a primary CTA to commit destination and transition to Path A; keep “Tell me more” as exploratory secondary.
**Alternative or refinement:** Don’t rely on current `PUT /api/trips/[id]` for `entry_mode`; it does not update `entry_mode` today (`src/app/api/trips/[id]/route.ts:44-56`). Either extend PUT schema or add a dedicated “resolve surprise destination” endpoint.

### Q3 — Atlas auto-trigger
**Agree / Disagree / Partial:** Partial
**My take:** I agree it should be softened, but a fixed 3s delay still feels arbitrary. Current behavior auto-opens and auto-sends after 800ms (`AssistantChat.tsx:816-866`), which is too aggressive and can consume quota unnecessarily. A consented one-click kickoff is better: show intent, don’t start network work until explicit user action.
**Alternative or refinement:** First-trip only: non-blocking prompt chip (“Start smart search”) with auto-dismiss; persist user preference (`auto_search_enabled`) in localStorage/profile.

### Q4 — Dead component chain — attic or delete
**Agree / Disagree / Partial:** Disagree
**My take:** I disagree with the claim that `EntryTabs -> SurpriseMeQuiz -> DestinationSuggestions/TrendingDestinations` are currently shipping via `DesignA`. `DesignA.tsx` imports `CuratedItineraries` and `LatestGuides` (`src/components/DesignA.tsx:3-5,80-82`) but does **not** import `EntryTabs`; search shows no importer for `EntryTabs` (`search: import EntryTabs from` = 0). So this chain appears dead-but-unbundled, not “live chain in production bundle.”
**Alternative or refinement:** Keep `EntryTabs`/`SurpriseMeQuiz` preserved per memory rule, but first run bundle analyzer before attic work. Prioritize deleting truly orphaned `InterestsModal.tsx` (0 imports) and any dead exports proven in bundle stats.

### Q5 — Quiz schema columns — drop now or wait
**Agree / Disagree / Partial:** Partial
**My take:** I would not drop immediately. Even if UI no longer sends quiz fields, API POST still accepts and inserts them (`src/app/api/trips/route.ts:44-53,108-131`), and GET returns `SELECT *` (`/api/trips/route.ts:12`, `/api/trips/[id]/route.ts:9,29`). Dropping now is a breaking API-shape change unless all consumers are updated together.
**Alternative or refinement:** Mark deprecated now, stop writing them first, add compatibility adapter in responses, then remove in a planned migration window.

### Q6 — Planner-landing idle nudge — copy + triggers
**Agree / Disagree / Partial:** Agree
**My take:** Direction is right; add true idle nudges on planner landing. Current hook has idle timer only for itinerary (`useAtlasBubble.ts:125-142`), while planner bubbles are interaction-threshold-based (`:86-93`), not idle-based. Your section-specific copy approach is good and aligned with where users stall.
**Alternative or refinement:** Trigger by “no meaningful progress” (no required field transitions) rather than mere inactivity, and throttle to one nudge per session on landing to avoid nagging.

### Q7 — Anything missed (deeper second-pass candidates)
**Agree / Disagree / Partial:** Agree
**My take:** Highest-value second pass is `AssistantChat` streaming/tool marker parsing and “trigger hygiene” (auto actions, duplicate sends, stale context). Next is conversion-path integrity across Path B→A, including persistence semantics and analytics events. Third is planner API contract hardening (`SELECT *` leakage and nullable semantics).
**Alternative or refinement:** Add one focused e2e suite for: create explore trip → resolve destination → first Atlas interaction → batch add results; this catches multiple current failure modes.

### Additional Findings (P0/P1 you'd add that Claude missed)
- P0: Proposed Surprise-Me fix as written will not fully persist mode metadata: `PUT /api/trips/[id]` does not update `entry_mode` (or quiz fields), only core fields (`src/app/api/trips/[id]/route.ts:44-63`). If product depends on `entry_mode='surprise'` for downstream logic/UI, conversion is incomplete.
- P1: Auto-trigger can fire on “Surprise Me” destination too, because guard only excludes missing destination / literal `"your destination"` (`AssistantChat.tsx:822-823`), then constructs prompt `"I just created a trip to Surprise Me"` (`:853`) and auto-sends (`:865`). That’s likely noisy/low-quality behavior on Path B.
- P1: `SurpriseMeSection` defaults unknown origin to MIA (`SurpriseMeSection.tsx:78`), compounding irrelevant suggestions for non-MIA users even before API fallback kicks in.

### Sprint Scope Pushback
I agree with “all P0 + selected P1s,” but I’d adjust the mix:
1) Keep P0-1/P0-2/P0-3.
2) Replace P2-2 (attic move) with a P1 “auto-trigger + consent + SurpriseMe guard” package (higher UX/compute impact, less speculative).
3) Keep P1-2 and P1-3, but implement together in one trigger-governance pass (shared state machine).
4) Defer full-width (P1-4) only if quick visual QA confirms it’s not materially harming task completion; otherwise keep it.
5) Add one API-contract task now: explicit response DTO for trips instead of `SELECT *` leak, to decouple future schema cleanup (supports eventual quiz-column deletion safely).
