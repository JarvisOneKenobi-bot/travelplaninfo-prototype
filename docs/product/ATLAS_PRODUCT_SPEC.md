# Atlas Product Spec

Status: Canonical product specification for Atlas in TravelPlanInfo.

Primary sources:
- Fable 5 diagnosis sections 3, 6, 9, 11.
- D1-D10 resolved on 2026-07-05.
- Current TPI code: `src/components/AssistantChat.tsx`, `src/hooks/useAtlasTrigger.ts`, `src/hooks/useAtlasBubble.ts`, `src/lib/atlas-trigger-state.ts`, `src/app/api/assistant/chat/route.ts`, `src/lib/assistant-health.ts`.
- Current command-post tool catalog: `command-post/routers/assistant.py`, `command-post/tp_client.py`.

## Definition

Atlas is TPI's embedded, user-facing travel-planning assistant: one chat surface, one trigger policy, a small set of truthful tools, per-user memory, and a Next.js-hosted brain that runs with the app on the VPS.

D2 is settled: Atlas's brain moves from workstation-only FastAPI (`command-post/routers/assistant.py`) into this Next.js app. No standalone service and no tunnel/workstation dependency.

Phase 0 is already shipped: `/api/assistant/health` returns Atlas capability health and the client hides proactive bubbles/consent UI unless it is healthy (`src/lib/assistant-health.ts:30-45`, `src/app/api/assistant/health/route.ts:7-9`, `src/hooks/useAssistantHealth.ts:31-60`, `src/components/AssistantChat.tsx:964-965` and `:1605-1613`).

## Atlas owns

- Chat UI and chat history through `AssistantChat`.
- Tool-result cards and `TripResultsModal` rendering for flight/deal/article/partner-search outputs (`src/components/AssistantChat.tsx:21-24`, `:293-377`, `:1588-1603`).
- Consent-gated trigger policy for new Path A trips (`src/lib/atlas-trigger-state.ts:27-49`).
- Section-aware planner nudges and itinerary idle bubbles, gated by assistant health in the UI.
- Server API surface under `/api/assistant/*` inside the Next.js app.
- User preferences, registered-user memory, and chat summaries stored in TPI SQLite (`src/lib/db.ts:75-99`, `src/app/api/assistant/chat/route.ts:78-155`).
- Tool orchestration over real data sources and honest handoffs.
- Help entry point, with static help as a permanent fallback when Atlas is unavailable.

## Atlas does not own

- SEO article generation or Article Factory workflow.
- Affiliate partner selection; D7 locks that to `src/config/affiliates.ts`.
- Any runtime dependency on `command-post`, Jose's workstation, or `~/.openclaw/credentials/` on production.
- Fabricated hotels, restaurants, activities, entity names, prices, ratings, or availability.
- Non-planner site-wide engagement beyond the chat/help entry points and health-gated nudges.
- General-purpose travel chatbot behavior unrelated to a TPI guide, trip, destination, deal, or booking handoff.

## Fabrication and honesty policy

Atlas may:
- Summarize general destination guidance in prose.
- Use real Travelpayouts/Aviasales responses for flights, deals, and popular routes.
- Link users to real partner searches for hotels, activities, and restaurants.
- Say that live data is unavailable and ask for different dates/routes.

Atlas must never:
- Invent flight prices when a tool returns `no_data: true`.
- Invent specific hotel, restaurant, or activity names/prices/ratings/availability.
- Present LLM-generated inventory as bookable inventory.
- Attach affiliate links to invented specific inventory.

When a tool returns no usable data, Atlas says what was searched, states that live data was unavailable, and offers a next action. It must not fill gaps with memory or generic web knowledge.

## Tool catalog

| Tool | Current source | Truth label | Future status | User-facing rule |
|---|---|---:|---|---|
| `search_flights` | `command-post/routers/assistant.py:133-147`, `:231-326`; Travelpayouts via `tp_client.py:111-165` | Real API | Port to Next.js | May show prices/links only from API output. If `no_data: true`, say no live flight data and do not quote prices. |
| `get_deals` | `assistant.py:163-172`, `:369-377`; Travelpayouts via `tp_client.py:221-260` | Real API | Port to Next.js | Cheapest-date/deal cards must use Aviasales marker links. Empty means no live deals, not guessed deals. |
| `surprise_me` | `assistant.py:173-184`, `:380-429`; popular routes via `tp_client.py:264-307` plus curated fallback in `assistant.py:999-1089` | Mixed: real routes plus fallback | Port to Next.js with explicit fallback labeling | Prefer real route data; any fallback card with no live price must show absence honestly (for example `—` with fallback banner). |
| `get_article` | `assistant.py:185-195`, `:432-458`; local `articles-index.json` | Local index | Reimplement against TPI article index/content model | Only recommend TPI articles. Do not use as destination-data substitute when user asks for live trip planning. |
| `search_hotels` | `assistant.py:149-160`, `:329-366`; LLM generation in `tp_client.py:167-217` | Forbidden current form | Replace under D3 | Use prose lodging guidance plus Hotels.com/CJ partner-search link. No specific invented hotel names or prices. |
| `search_activities` | `assistant.py:197-208`, `:461-495`; LLM generation in `tp_client.py:323+` | Forbidden current form | Replace under D3 | Use activity-category guidance plus Klook/Tiqets partner-search links. No invented specific activity/prices. |
| `search_restaurants` | `assistant.py:210-221`, `:498+`; LLM generation in `tp_client.py` | Forbidden current form | Replace under D3 | Use dining-neighborhood/cuisine guidance plus real search handoff. No invented restaurants, ratings, or prices. |

## Trigger policy

Normative trigger state machine:

`idle -> awaiting_consent -> consented -> searching -> done`

Alternate terminal path:

`awaiting_consent -> declined`

Rules from `src/lib/atlas-trigger-state.ts:27-49`:
- Prompt only when there is a real trip id, a non-empty destination, no real itinerary items, destination is not `Surprise Me`, and the chat has no prior messages.
- Do not auto-send network work. Consent is required before `searchStarted`.
- A declined prompt stays declined for that trigger context.
- Search completion moves to `done`.

Current Phase 0 health gate adds:
- If `/api/assistant/health` is unhealthy, proactive bubbles and the consent chip are hidden. The manual chat button may remain as an entry point, but it must handle backend failure honestly.

Future cleanup:
- Consolidate `useAtlasBubble` legacy interaction-count bubbles with the trigger/nudge reducer into one documented policy module. The diagnosis calls the current dual system overbuilt (`useAtlasBubble.ts:16-26`, `:151-181`).

## Memory model

Guest users:
- May use Atlas chat (D4).
- Consume the same $10/month global cap budget (D4).
- Get session-local chat history via `chat_sessions` and `chat_messages`.
- Do not get cross-session memory summaries; `chat/route.ts:137` explicitly skips background summarization when `ctx.isGuest` is true.
- Registration is the incentive for persistent memory and trip portability.

Registered users:
- Get persistent chat sessions and `user_memory` facts/summaries.
- Memory context is loaded from the latest 50 `user_memory` rows and split into facts vs `conversation_summary_*` rows (`chat/route.ts:84-110`).
- Background summarization of older sessions runs fire-and-forget via `/api/assistant/summarize` for non-guests (`chat/route.ts:112-155`).

Known limitation:
- The 50-row shared fact/summary budget is a future quality concern, but not a Phase 1-3 blocker.

## UI surfaces and contracts

Client mount:
- Global `AssistantChat` panel is mounted in the locale layout and can render side-panel or modal mode.

Trip context:
- Server-rendered trip pages expose a `<script id="atlas-trip-context">` contract consumed by `readTripContext()` (`AssistantChat.tsx:246-280`).
- TripForm exposes `window.__atlasFormContext`, typed in `src/lib/atlas-trigger-state.ts:117-133` and consumed by `AssistantChat.tsx:716-732` and `useAtlasBubble.ts:155-199`.

SSE contract:
- Chat client posts to `/api/assistant/chat` (`AssistantChat.tsx:734-742`).
- Server streams `text/event-stream` frames (`chat/route.ts:291-298`).
- Tool cards use exact markers: `[TOOL:name]{json}` (`AssistantChat.tsx:84-134`, `:801-810`). Preserve this contract during D2 brain relocation so the client need not be rewritten in Phase 2.

Modal/card contract:
- `TRIP_TOOLS = search_flights, search_hotels, search_activities, search_restaurants` currently triggers multi-tool modal behavior (`AssistantChat.tsx:21-24`, `:149-244`). After D3 replacement, hotel/activity/restaurant outputs should become partner-search handoff data or prose, not fabricated inventory arrays shaped like real inventory.

## Help-system role

Atlas is the contextual help surface when healthy. Static help remains a permanent fallback and should not be deleted. Any static help copy that promises unavailable Atlas automation must be revised when Phase 2/3 behavior changes.

## Cost caps and rate limits

- Guest chat stays allowed (D4).
- Monthly Atlas spend cap stays $10/month until Jose changes it (D4).
- Spend-cap enforcement moves from FastAPI (`assistant.py:69`, `:1131-1139`) into the Next.js app with the brain relocation (D2).
- Current Next proxy has an in-memory 10 requests/minute per `session_id` rate limit (`src/app/api/assistant/chat/route.ts:9-32`, `:60-66`). This resets on PM2 restart and is acceptable for now if documented.
- Health currently reports `anthropic`, `travelpayouts`, `backendReachable`, and `healthy`; after D2, `backendReachable` should be replaced or redefined because the separate backend disappears.

## Exact server API surface

Current routes to preserve or evolve:
- `POST /api/assistant/chat`: owns auth, rate limit, session validation, memory, streaming, and reply persistence. Today it proxies to FastAPI; after D2 it owns the brain.
- `GET /api/assistant/health`: Phase 0 health gate, dynamic/no-cache.
- `POST /api/assistant/sessions`: creates chat session.
- `GET /api/assistant/history/[sessionId]`: loads chat history.
- `POST /api/assistant/summarize`: registered-user summary path, direct Anthropic call.
- `POST /api/assistant/transcribe`: Whisper path, keyed by OpenAI.
- `GET/POST /api/assistant/memory`: registered-user memory management.

Acceptance criteria for any Atlas implementation:
- Every tool result is labeled as real API, local index, partner handoff, or unavailable.
- No D3-forbidden fabricated inventory appears in UI cards, modal, itinerary items, or assistant prose.
- Production health determines proactive Atlas UI.
- A production guest journey can be verified with the workstation off.
