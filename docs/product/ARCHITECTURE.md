# TravelPlanInfo Architecture

Status: Runtime truth and target architecture for TPI + Atlas.

Sources: Fable 5 diagnosis, D1-D10 resolved decisions, current repo files, and `docs/deployment/local-to-vps.md`.

## Runtime topology

Current production target topology:

```text
Public HTTPS
  -> Nginx on VPS 104.225.221.138
  -> 127.0.0.1:3001
  -> PM2 process `tpi`
  -> Next.js app (App Router)
  -> repo-local SQLite at data/tpi.db
  -> external APIs: Anthropic, Travelpayouts/Aviasales, OpenAI, Google, affiliate partners
```

Current documented deploy runbook agrees on Nginx -> PM2 -> Next.js -> SQLite (`docs/deployment/local-to-vps.md:20-34`, `:97-115`).

Architecture decision D2 changed Atlas from this historical pre-D2 shape:

```text
HISTORICAL / pre-D2 only:
Next.js /api/assistant/chat
  -> FastAPI at FASTAPI_URL or localhost:8766
  -> command-post credentials/state/cost tracking
```

To this target shape:

```text
Next.js /api/assistant/chat
  -> in-app Atlas brain, tools, prompt, spend cap
  -> TPI SQLite + env-only credentials
```

No production path may depend on Jose's workstation, `command-post`, Tailscale/tunnels, or `~/.openclaw/credentials/` being present on the VPS.

## Atlas brain location decision

Decision: port Atlas's brain into the Next.js app (D2).

Rationale:
- The current brain is in `command-post/routers/assistant.py`, a workstation/internal-ops repo. It reads keys from `~/.openclaw/credentials/` and writes cost to command-post state (`assistant.py:35-43`, `:71-88`).
- The Next app already owns auth, guest/user identity, chat sessions, memory loading, and persistence (`src/app/api/assistant/chat/route.ts:36-181`, `:275-287`).
- The Next app already has a direct Anthropic dependency in `package.json` (`@anthropic-ai/sdk`) and direct key helper (`src/lib/server-config.ts:98-103`).
- A standalone service would add a second deploy pipeline, second credential store, second health story, and permanent drift risk.

Port inventory:
- Tool definitions: `assistant.py:133-222`.
- Flight/deal/popular Travelpayouts methods: `tp_client.py:111-165`, `:221-307`.
- System prompt builder and policies: `assistant.py:857-897`, updated for D3/D7.
- Agentic tool loop and SSE markers: `assistant.py:1131-1326`, preserving `[TOOL:name]` markers.
- Spend-cap table and recording: `assistant.py:69-129`, moved into TPI SQLite.
- Do not port the LLM-generated hotel/activity/restaurant inventory behavior; replace it with D3 partner-search handoffs.

## Phase 0 health gate already shipped

Phase 0 is not future work. It shipped to production on 2026-07-05 in PR #3 and was verified live.

Current code:
- `src/lib/assistant-health.ts`: computes `anthropic`, `travelpayouts`, `backendReachable`, and `healthy`; caches 45 seconds server-side.
- `src/app/api/assistant/health/route.ts`: `GET` returns the health JSON and is dynamic/no-cache.
- `src/hooks/useAssistantHealth.ts`: client fetch with 4-second timeout and 45-second session cache.
- `src/components/AssistantChat.tsx`: proactive bubble and consent chip render only when `assistantHealthy` is true (`:964-965`, `:1605-1613`).

This is the precedent: user-facing Atlas invitations must be backed by a deploy-time or runtime health check.

## Environment contract

This table is the source for the env preflight script that Phase 2/5 must add.

| Variable | Required for | Required in prod? | Failure behavior |
|---|---|---:|---|
| `NEXTAUTH_SECRET` | NextAuth/session security | Yes | Auth/session integrity risk; deploy must fail. |
| `NEXTAUTH_URL` | Canonical auth URL and app base fallback | Yes | Auth callbacks/self-calls can target wrong origin; deploy must fail. |
| `APP_BASE_URL` | Trusted server-side self-calls | Yes | Falls back to `NEXTAUTH_URL` then localhost; prod deploy must fail if absent. |
| `ANTHROPIC_API_KEY` | Atlas brain and summarization | Yes for Atlas | Health false; proactive Atlas hidden; after D2 chat unavailable. |
| `TRAVELPAYOUTS_TOKEN` | Flights, deals, Surprise Me, trending prices | Yes for Atlas/planner | Real flight/deal tools unavailable; health should reflect false. |
| `OPENAI_API_KEY` | Whisper transcription | Optional for MVP, required for voice | Voice/transcribe disabled; chat can still work. |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Client maps/Places autocomplete | Yes for full planner UX | Places/maps degrade; key is baked at build time, so set before build. |
| `GOOGLE_GEOCODING_KEY` | Server geocoding helpers | Yes for full planner UX | Geocoding may fail or fall back where supported. |
| `GOOGLE_CLIENT_ID` | Google OAuth | Optional if credentials auth remains | Google sign-in disabled if pair incomplete. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Optional if credentials auth remains | Google sign-in disabled if pair incomplete. |
| `NODE_ENV` | Runtime mode | Yes | Must be `production` on VPS. |
| `FASTAPI_URL` | Removed on 2026-07-11 | No | No code path reads this variable anymore; it remains documented only as a removed legacy FastAPI proxy setting. |
| `BASE_URL` | Playwright target | Verification only | Defaults to `http://localhost:3001`; set explicitly for production smoke. |

Legacy credential files:
- `src/lib/server-config.ts:14-41` can read `~/.openclaw/credentials/anthropic.json` and `openai.json` as compatibility fallbacks.
- D9 confirmed no such files exist for root or `travelplaninfo` on the VPS.
- Future prod architecture must use env vars, not legacy credential files.

## Failure behavior by dependency

- Anthropic absent: Atlas health false; proactive UI hidden; chat should return a clear unavailable message, not fabricate.
- Travelpayouts absent: flights/deals/surprise/trending unavailable; no prices may be guessed.
- OpenAI absent: transcription/voice input disabled or returns clear error; text chat can continue.
- Google Maps absent: Places autocomplete/maps/geocoding degrade; manual typing must remain possible.
- Google OAuth absent: Google login disabled; credentials/guest flows remain.
- SQLite unwritable: app cannot persist users/trips/chat; deploy must fail preflight.
- PM2/Nginx unhealthy: deploy incomplete.

## Data model

Current SQLite tables initialized in `src/lib/db.ts`:
- `users`: credentials, OAuth provider, guest token.
- `trips`: trip core fields plus flexible/origin/entry-mode migration columns.
- `trip_items`: itinerary rows, affiliate fields, map fields, cost fields.
- `newsletter_subscribers`.
- `user_preferences`.
- `chat_sessions`.
- `chat_messages`.
- `user_memory`.
- `geocoding_cache`.

DTO policy:
- Continue the May sprint discipline of DTO responses for trip/planner APIs.
- Assistant routes still carry raw shapes in several places; D2 should not expand raw-shape leakage.

Deprecated/parked columns:
- Quiz/group columns at `src/lib/db.ts:185-197` are migration debt. Do not opportunistically drop them during Atlas phases.
- Path A/B and EntryTabs history are product decisions, not cleanup invitations; see `docs/DECISIONS.md`.

Target additions for D2/D10:
- `assistant_cost` or equivalent in TPI SQLite for the $10/month cap.
- Affiliate-click event table or lightweight analytics event path for affiliate clicks per trip session.
- GSC verification/analytics setup evidence documented in Phase 1/2 implementation work (D10).

## Article/content runtime

Article JSON contract lives in `src/lib/articles.ts:4-23`.

Rendering:
- `getAllArticles()` reads `content/articles/*.json` and sorts by date (`src/lib/articles.ts:27-40`).
- `getArticle(slug)` sanitizes slug with `path.resolve` and `startsWith` before reading (`src/lib/articles.ts:43-55`).
- Article template splits the HTML blob by H2 and injects `ArticleAffiliateCTA` after every second section except the first (`src/app/[locale]/[slug]/page.tsx:215-223`).
- FAQ schema renders when `faq` exists (`src/app/[locale]/[slug]/page.tsx:136-164`).
- `schemaType` is currently not wired; see `CONTENT_MODEL.md` and `SEO_MIGRATION_STRATEGY.md`.

## Locale and sitemap runtime

- Locales are `en`, `es`, `pt`, `fr`, `de`, `it`; default `en`; locale prefix is `as-needed` (`src/i18n/routing.ts:3-7`).
- Current sitemap emits every static page and every article in every locale (`src/app/sitemap.ts:25-51`).
- D5 changes canonical behavior: non-English article URLs canonicalize to the English original. They stay live/crawlable, but equity consolidates to English until real translations exist.

## Deploy verification contract

A deploy is not complete until production evidence is fresh.

Minimum local before deploy for code changes remains the runbook's app gates, but this documentation package is docs-only and intentionally does not require tests.

Production gates to wire into runbook:
- PM2 process `tpi` online.
- Nginx/public homepage returns 200.
- `/api/assistant/health` returns expected JSON.
- Env preflight passes required keys for the phase being deployed.
- Sitemap/canonical sample matches `SEO_MIGRATION_STRATEGY.md`.
- For Phase 2+: guest production Atlas chat returns streamed response and at least one real tool card with workstation off.

The obsolete FastAPI sidecar health-check step was removed from the runbook on 2026-07-11; assistant dependency checks now target the app-native health endpoint and may not be allowed to pass with an ignored failure.
