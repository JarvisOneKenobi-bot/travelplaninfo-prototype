# TPI/Atlas Implementation Plan

Status: Executable phased plan for the product/architecture program. This replaces the diagnosis roadmap where D1-D10 changed the ordering.

Important deviations from the 2026-07-04 diagnosis:
- Phase 0 has already shipped to production as of 2026-07-05 (PR #3). Do not plan it as future work.
- D10 moves GSC + lightweight analytics setup into the current Phase 0-3 window, not Phase 4.
- D2 selects in-app Next.js Atlas brain, not standalone FastAPI.
- D3 forbids fabricated hotel/activity/restaurant inventory and replaces it with partner-search handoffs.

## Ralph-Loop mapping

Every implementation phase after this docs package uses:
1. Understand: read `NORTH_STAR.md`, `ATLAS_PRODUCT_SPEC.md`, `ARCHITECTURE.md`, and `docs/DECISIONS.md`.
2. Plan: create/patch a phase-specific implementation plan with file paths, task acceptance, and verification.
3. Implement: small scoped diffs only.
4. Verify locally: lint/test/build where code changes require it.
5. Verify production: run `VERIFICATION_CHECKLIST.md` gates for the phase.
6. Review: Fable/product review before deployment or immediately after deployment depending on phase risk.
7. Record: update `docs/DECISIONS.md` only for real new decisions; append verification evidence to audits/runbooks.

## Phase 0 — Production truth and health gate

Status: Done.

Shipped:
- `/api/assistant/health` added.
- Server health computation added in `src/lib/assistant-health.ts`.
- Client health hook added in `src/hooks/useAssistantHealth.ts`.
- Proactive Atlas UI hidden when health is false in `AssistantChat`.
- PR #3 merged, deployed, and verified live on 2026-07-05.

Acceptance evidence:
- Production `/api/assistant/health` returns `healthy:false` while the backend is unreachable, as expected.
- Consent chip, ready hint, and idle nudges no longer invite users into a known-dead Atlas backend.

What not to touch now:
- Do not remove the manual chat surface solely because health is false; it remains a graceful error/entry surface.
- Do not revive proactive UI without a green health signal.

## Phase 1 — Canonical documentation package

Owner: Hermes/Sonnet/GPT documentation agent; Fable review; Jose approval.

Files:
- `docs/product/NORTH_STAR.md`
- `docs/product/ATLAS_PRODUCT_SPEC.md`
- `docs/product/ARCHITECTURE.md`
- `docs/product/SEO_MIGRATION_STRATEGY.md`
- `docs/product/CONTENT_MODEL.md`
- `docs/product/IMPLEMENTATION_PLAN.md`
- `docs/product/VERIFICATION_CHECKLIST.md`
- `docs/DECISIONS.md`

Tasks:
1. Materialize docs from diagnosis Section 11 and D1-D10.
2. Seed `docs/DECISIONS.md` with D1-D10 and historical locked decisions.
3. Cite current code for health gate, chat, triggers, content model, affiliates, sitemap, i18n, and deployment runbook.
4. Call out D10 analytics timing deviation explicitly.
5. Run doc hygiene: no empty fill-in markers, no stale Phase 0 future-tense, no contradiction with D1-D10.

Acceptance:
- All 8 docs exist.
- `docs/DECISIONS.md` has append-only table/log structure.
- `git diff --check` passes.
- Phase 0 is described as done.
- Docs-only commit created.

Verification commands:
```bash
git diff --check
! grep -RIn "FILL_ME_[I]N\|TB[D]\b" docs/product docs/DECISIONS.md
wc -l docs/product/*.md docs/DECISIONS.md
```

## Phase 2 — Atlas brain relocation into Next.js

Owner: implementation agent with Fable plan and diff review.
Effort: about 1-1.5 focused weeks.

Goal:
- Move Atlas brain from workstation FastAPI to TPI Next.js app on the VPS.
- Preserve client SSE/tool-marker contract.
- Enforce spend cap and env contract in production.

Primary files likely touched:
- `src/app/api/assistant/chat/route.ts`
- new `src/lib/atlas/*` modules for prompt, tool loop, Travelpayouts client, spend tracking, partner handoffs
- `src/lib/db.ts` for assistant cost/event tables
- `src/lib/assistant-health.ts` for post-D2 health semantics
- `src/lib/server-config.ts` for env helpers
- tests under `tests/` as appropriate
- deployment preflight script/runbook updates

Tasks:
1. Write a focused Phase 2 implementation plan and review it before code.
2. Add env preflight generated from `ARCHITECTURE.md` table.
3. Add TPI SQLite `assistant_cost` table or equivalent with monthly aggregation.
4. Port system prompt builder into TypeScript and update it for D3/D7.
5. Port `search_flights`, `get_deals`, and `surprise_me` using Travelpayouts env token and Aviasales marker.
6. Reimplement `get_article` against TPI article data/local index.
7. Replace `search_hotels`, `search_activities`, `search_restaurants` with partner-search handoff tools, not inventory generators.
8. Implement Anthropic tool loop in `/api/assistant/chat` and preserve `data: [TOOL:name]{json}` frames.
9. Preserve auth, rate limit, history, memory, and assistant response persistence already in `chat/route.ts`.
10. Update health to check in-app dependencies instead of FastAPI reachability.
11. Add tests for no-data flight behavior, D3 no-fabrication behavior, and health gating.
12. Deploy to VPS with env keys and run production smoke with workstation off.

What not to touch:
- Article Factory cadence.
- Trip schema cleanup/quiz column deletion.
- UI redesign beyond necessary card/handoff rendering.
- Locale SEO changes unless directly needed for env/health smoke.

Acceptance:
- Production guest chat streams text from the in-app brain.
- At least one real flight/deal card appears for a known route/date with an Aviasales marker link.
- Empty flight data returns honest no-data text and no invented price.
- Hotel/activity/restaurant requests return partner-search handoffs and prose, not invented entity cards.
- Spend recorded in TPI SQLite and cap enforced at $10/month.
- Workstation is off or command-post unavailable during production smoke.

Verification commands:
```bash
npm run lint
npm run test
npm run build
curl -sL https://travelplaninfo.com/api/assistant/health | jq .
BASE_URL=https://travelplaninfo.com npx playwright test tests/e2e/planner-trust.spec.ts
```

Manual production gate:
- Guest session -> create MIA/Cancun or similar trip -> consent to Atlas -> verify streamed reply, real flight card, affiliate link, spend row.

## Phase 2A — GSC + lightweight analytics setup

Owner: Hermes/Jose, can run alongside Phase 2.
Effort: small but credential/access dependent.

D10 says this starts now, not in Phase 4.

Tasks:
1. Confirm or create GSC property for `travelplaninfo.com`.
2. Verify ownership with the least invasive method available for the VPS/Next deployment.
3. Submit current sitemap.
4. Choose lightweight analytics implementation that does not block Atlas work. If not already chosen by Jose, use the smallest server-side event table for MVP plus GSC for search visibility.
5. Track events: guide view, planner start, trip created, Atlas health hidden, Atlas consent, tool result rendered, affiliate click.
6. Document setup and access location.

Acceptance:
- GSC property is verified or explicit credential blocker is recorded.
- Sitemap submission status captured.
- Affiliate-click-per-trip-session can be queried.
- Analytics does not add user-visible regressions or heavy client scripts without approval.

## Phase 3 — Truthful planner monetization loop

Owner: implementation agent; Fable diff review; Jose monetization approval.
Effort: about 1 week.

Goal:
- Make the guide -> planner -> Atlas -> itinerary -> affiliate click loop truthful and measurable.

Tasks:
1. Finish D3 UI/data changes: no fabricated hotel/activity/restaurant cards or itinerary items.
2. Add partner-search handoff card shape and renderers if needed.
3. Add Tiqets, Kiwi.com, and Kiwitaxi config to `src/config/affiliates.ts` under D7; these three partner configs do not exist there today.
4. Add partner metadata (`embedMode` or equivalent) and centralized affiliate opener/tracker.
5. Fix `rel="sponsored"` inconsistency on Aviasales and other affiliate anchors.
6. Resolve AirAdvisor TODO: either configure approved CJ URL or flag off until approved.
7. Add server-side affiliate-click counting tied to trip/session where possible.
8. Verify full guest journey in production.

What not to touch:
- Do not change article cadence.
- Do not add generic ad monetization.
- Do not invent data to make the loop look full.

Acceptance:
- Production guest journey recorded: guide -> planner -> trip -> Atlas consent -> real flight/deal -> add/handoff -> affiliate click.
- Zero D3-forbidden fabricated specific names/prices in Atlas output.
- One affiliate partner source of truth governs article, Atlas, and planner surfaces.

## Phase 4 — SEO containment and migration-reference cleanup

Owner: implementation agent; SEO review.
Effort: 2-3 days.

Goal:
- Stop duplicate-locale dilution and make TPI safe as a WP-to-Next reference implementation.

Tasks:
1. Implement D5 canonical behavior for non-English articles.
2. Add x-default where appropriate.
3. Add or correct metadata/canonicals for guides, destinations, hot-deals, planner landing.
4. Add noindex for auth/account/trip detail pages.
5. Wire `schemaType` safely or explicitly constrain it.
6. Backfill and enforce `search_location` for articles.
7. Validate sitemap/crawl against `SEO_MIGRATION_STRATEGY.md` matrix.

Acceptance:
- Crawl matches matrix.
- Non-English articles canonicalize to English original.
- Hub pages are no longer SEO-naked.
- Auth/trip pages are noindex and absent from sitemap.

## Phase 5 — Governance hardening

Owner: Hermes/ops.
Effort: ongoing.

Tasks:
1. Reference `VERIFICATION_CHECKLIST.md` from `docs/deployment/local-to-vps.md`.
2. Remove `|| true` health-check idioms from assistant deploy checks.
3. Add env preflight to deploy path.
4. Add recurring production smoke for Atlas health and guide/planner paths.
5. Add spend alert at 80% of the $10 cap.
6. Archive verification evidence after each deploy.

Acceptance:
- One full deploy passes all gates end-to-end.
- A deliberately missing required env var fails preflight.
- Weekly production smoke catches Atlas health regression.

## Phase 6 — Reference implementation extraction

Status: postponed until Phases 2-4 are done.

Goal:
- Extract migration patterns for other sites after TPI itself is clean.

Tasks:
- Document reusable content model, metadata matrix, deploy verification, and analytics/event patterns.
- Update seo-workspace migration plans/skills.
- Do not export current defects as patterns.

Acceptance:
- TPI's own content/SEO/verification model is already proven in production.
