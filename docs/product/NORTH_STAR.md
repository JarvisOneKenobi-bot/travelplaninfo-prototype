# TravelPlanInfo North Star

Status: Canonical product direction for TravelPlanInfo (TPI) and Atlas. Supersedes the older memory-doc fragments listed at the end of this file.

Source basis:
- Fable 5 diagnosis: `/home/jarvis/.openclaw/workspace/jarvis-project/docs/superpowers/handoffs/2026-07-04-fable5-tpi-atlas-diagnosis.md`
- Resolved decisions D1-D10: `/home/jarvis/.openclaw/workspace/jarvis-project/docs/superpowers/handoffs/2026-07-05-tpi-atlas-decisions-RESOLVED.md`
- Current TPI code on branch `docs/tpi-atlas-product-package`

## One-sentence north star

TravelPlanInfo is a fast, English-first travel-planning site where SEO guides capture travel intent and a lightweight planner, with Atlas as its embedded assistant, converts that intent into truthful affiliate-booking actions that demonstrably work on `travelplaninfo.com`.

## Product thesis

TPI has three layers, in this order:

1. Content floor: destination guides and affiliate CTAs are the live revenue and traffic source today. They must keep publishing on the normal Article Factory cadence (D8). The current content model is JSON articles rendered by the Next.js app (`src/lib/articles.ts:4-23`) with in-body CTA injection in the article template (`src/app/[locale]/[slug]/page.tsx:215-223`).
2. Planner differentiator: guest-friendly trip CRUD, Path A itinerary planning, and Path B Surprise Me make the site more than a blog. The planner is the retention layer and the future migration pattern for other owned properties (D6).
3. Atlas bridge: Atlas moves a reader into a planning session and a planning session into affiliate action. Atlas is not a separate product and not a content-generation engine.

The diagnosis found that production TPI was effectively a functioning content site plus a manual planner, while Atlas's brain lived only in the workstation-side FastAPI (`command-post/routers/assistant.py`) and was not deployed to the VPS. Phase 0 has already shipped: PR #3 added `/api/assistant/health` and hides Atlas's proactive invitations when the backend is unreachable. That is the foundation and precedent for all future planner work.

## Personas

Primary persona:
- US-origin leisure traveler, often starting from a destination guide, planning a trip 2 weeks to 6 months out.
- Current product evidence: MIA defaults, US destination-guide corpus, Travelpayouts/Aviasales flight links, CJ and activity partners, and guide-to-planner CTA paths.

Secondary personas:
- Returning traveler who wants TPI/Atlas to remember preferences across sessions.
- Jose / operator: needs a deployable, verifiable reference implementation for future WordPress-to-Next.js migrations (D6).
- Article Factory maintainer: needs a stable article JSON contract and validation rules that match what the site actually renders.

## Jobs to be done

1. Tell me what this destination is like and what it costs.
   - Served by guide articles, FAQ schema, affiliate CTAs, and partner search links.
2. Help me turn intent into a dated, priced plan.
   - Served by TripForm, Trip pages, manual itinerary CRUD, and Atlas after the brain moves into the Next app (D2).
3. Find cheap routes/deals from my airport.
   - Served by real Travelpayouts/Aviasales data, not invented prices.
4. Help me evaluate lodging, activities, and restaurants honestly.
   - Served by prose guidance plus partner-search handoffs under D3; Atlas must not invent specific hotel/activity/restaurant inventory or prices.
5. Remember me so I do not restart every trip.
   - Served by registered-user memory (`user_memory`) and guest-to-registered conversion. Guests may chat, but memory remains session-only until registration (D4 plus historical two-tier memory decision).

## Revenue mechanism

TPI earns through affiliate commissions, not ads or subscriptions at this stage.

Canonical affiliate truth is D7: one partner set governs articles, Atlas tool links, and planner sidebar. That set is the June 23 article-surface set: Klook, Tiqets, Kiwi.com, Kiwitaxi plus CJ, anchored in `src/config/affiliates.ts`. The current file also exposes CJ links, Aviasales/Travelpayouts marker `164743`, and Klook via tp.media (`src/config/affiliates.ts:5-49`). Any future planner or Atlas link work must reconcile to that source of truth instead of reintroducing older CJ-first or Travelpayouts-first contradictions.

The MVP success metric is affiliate clicks per trip session, supplemented by GSC and lightweight analytics now (D10), not deferred to Phase 4.

## MVP definition

The planner works when this journey is true on production, on a phone, with Jose's workstation off:

1. Guest lands on a destination guide.
2. Guest opens the planner and creates a trip.
3. Guest sees Atlas only when health permits; proactive UI remains hidden if `/api/assistant/health` is unhealthy.
4. Guest consents to Atlas search.
5. Atlas streams a response from the Next.js-deployed brain and returns at least one real flight/deal card from Travelpayouts/Aviasales.
6. Atlas gives lodging/activity/restaurant guidance through D3 partner-search handoffs, with no invented specific entity names or prices.
7. Guest can add relevant items to the itinerary.
8. Guest clicks a working affiliate link governed by the D7 partner set.
9. The session records spend, health, and outbound affiliate-click evidence.

## Non-goals

- Atlas as a standalone product.
- Atlas as an SEO content generator.
- Atlas depending on `command-post`, Jose's workstation, Tailscale, tunnels, or any machine that sleeps.
- Fabricated hotel/restaurant/activity inventory.
- Multi-locale content expansion before real translations exist. Next-intl UI infrastructure can stay, but non-English article URLs canonicalize to English under D5.
- Collaboration, consensus voting, cost-splitting, Tailwind 4 / TS 6 / ESLint 10 stack loops, and quiz-column cleanup before the production Atlas/planner loop works.
- Changing the Article Factory cadence while Phase 1-3 planner work happens (D8).

## Success metrics

Hard MVP metrics:
- Production Atlas health endpoint returns healthy after the in-app brain migration.
- A guest production chat returns streamed text and at least one real tool-result card.
- Affiliate clicks per trip session are recorded server-side.
- Zero Atlas responses show invented hotels/restaurants/activities or invented prices.
- GSC and lightweight analytics are set up alongside Phase 0-3 work (D10).

Operating metrics:
- Article publishing cadence continues without regression.
- Sitemap/canonical behavior matches `SEO_MIGRATION_STRATEGY.md`.
- Deploy verification includes production gates, not only local lint/build/E2E.
- Spend remains under the $10/month Atlas cap until Jose changes it (D4).

## Supersedes list

This doc is the product authority over older memory/spec fragments when they conflict. Historical context remains useful, but future agents should cite this file plus `ATLAS_PRODUCT_SPEC.md` and `docs/DECISIONS.md`.

Superseded as canonical authority:
- `tpi-mission.md` fragments that describe the planner as the product without acknowledging the content floor dependency.
- `tpi-atlas-product-flow.md` where it conflicts with the permanent static help fallback.
- `tpi-atlas-memory-system.md` where it is incomplete without D4 and the current SQLite implementation.
- `tpi-auto-results-on-trip-create.md` where it implies automatic Atlas network work without consent.
- Older affiliate-priority notes from Mar 19 / Mar 21 that conflict with D7.
- Older i18n/SEO assumptions that conflict with D5.

## Mission filter for future work

Reject or defer any task that fails one of these checks:
- Does it improve guide-to-planner-to-affiliate conversion?
- Does it preserve the working article revenue floor?
- Does it make Atlas more truthful, more deployable, or more measurable on production?
- Does it avoid workstation runtime dependency?
- Does it align with D1-D10 in `docs/DECISIONS.md`?
