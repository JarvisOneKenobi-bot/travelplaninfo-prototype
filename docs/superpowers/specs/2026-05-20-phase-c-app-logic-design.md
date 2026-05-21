# Phase C — Application Logic Remediation Design Spec

**Date:** 2026-05-20
**Status:** Approved for implementation
**Scope:** Replace host-specific localhost and credential-file assumptions in server routes with environment-driven helpers, without changing feature behavior or the SQLite deployment model.

---

## Problem

Phase A/B cleaned deployment/docs, but the application logic still assumes one very specific runtime:

1. `src/app/api/assistant/chat/route.ts` hardcodes `http://localhost:3000/api/assistant/summarize` for an internal self-call.
2. `src/app/api/assistant/chat/route.ts`, `src/app/api/assistant/summarize/route.ts`, and `src/app/api/surprise-me/route.ts` hardcode `http://localhost:8766` for the FastAPI sidecar.
3. `src/app/api/assistant/summarize/route.ts` reads Anthropic credentials from `~/.openclaw/credentials/anthropic.json` with no env-first path.
4. `src/app/api/assistant/transcribe/route.ts` reads OpenAI credentials from `~/.openclaw/credentials/openai.json`, with env fallback only after filesystem failure.
5. These assumptions make local/VPS parity fragile and couple app behavior to Jose’s workstation layout.

The current SQLite database at `data/tpi.db` is intentionally left in place for this phase. This phase is about transport/config hygiene, not persistence migration.

---

## Goals

1. Make all internal service URLs environment-driven with safe defaults for local development.
2. Make API credential resolution env-first, with optional legacy file fallback for local compatibility.
3. Preserve existing route behavior, response shapes, auth gates, and DB semantics.
4. Keep Phase C small, reviewable, and production-safe.
5. Avoid changing any frontend component logic unless required by route contracts.
6. Keep the canonical deployment runbook truthful after the code change lands.
7. Eliminate request-derived origin trust for authenticated internal self-calls.
8. Add minimal guardrails against obvious abuse/regression in the touched routes when discovered during review.

---

## Non-Goals

- Replace SQLite or move `data/tpi.db`
- Change NextAuth provider behavior beyond required env compatibility
- Redesign Atlas route behavior or prompts
- Remove fallback behavior for local development
- Add a full test framework migration
- Rewrite unrelated env handling in other files unless directly touched by this phase

---

## Approved Approach

### A. Add shared server config helpers

Create a new helper module under `src/lib/server-config.ts` that centralizes:

- `normalizeBaseUrl()`
- `getAppBaseUrl()`
- `getRequestAwareAppBaseUrl()`
- `getFastApiBaseUrl()`
- `getAnthropicApiKey()`
- `getOpenAIApiKey()`

Rules:
- Trusted app base URL should prefer explicit env (`APP_BASE_URL`), then `NEXTAUTH_URL`, then local default `http://localhost:3000`.
- `getRequestAwareAppBaseUrl()` may exist for non-authenticated request-aware composition, but authenticated self-calls must use trusted app-base config instead of request-derived origin.
- FastAPI base URL should prefer `FASTAPI_URL`, then local default `http://localhost:8766`.
- API key helpers should prefer direct env vars first:
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY`
- Legacy credential-file fallback is allowed only if env is missing.
- Treat empty or whitespace env values as unset.
- Use `os.homedir()` for legacy credential-file lookup instead of `process.env.HOME` or hardcoded user paths.
- Use URL-safe joining when composing base URLs with route paths.
- Mark the helper as server-only.
- If no key is available, helper should return empty string rather than throwing; routes keep responsibility for 503/502 behavior.
- Base URL helpers must validate configured values as absolute `http`/`https` URLs before use and fall back safely on invalid values.

### B. Replace hardcoded URLs in routes

Update the following routes to use the helper module:

- `src/app/api/assistant/chat/route.ts`
  - background summarization self-call must use trusted app-base config (`APP_BASE_URL`, then `NEXTAUTH_URL`, then local fallback), not request-derived origin
  - FastAPI chat call must use `getFastApiBaseUrl()`
- `src/app/api/assistant/summarize/route.ts`
  - cost-recording call must use `getFastApiBaseUrl()`
- `src/app/api/surprise-me/route.ts`
  - destination lookup call must use `getFastApiBaseUrl()`

Behavior must remain the same:
- same endpoints
- same payload shapes
- same error handling semantics

### C. Replace ad hoc credential-file readers

Update:
- `src/app/api/assistant/summarize/route.ts`
- `src/app/api/assistant/transcribe/route.ts`

Both routes should import key helpers instead of embedding file path logic.

Credential order:
1. dedicated env var
2. legacy `~/.openclaw/credentials/*.json` file
3. empty string

This preserves local compatibility while making VPS deployment predictable.

If summarization fallback is triggered with empty or malformed model output, the route must still persist a non-empty summary marker so the same session is not re-summarized indefinitely.

### D. Extend env template only as needed

Update `.env.example` to include:
- `APP_BASE_URL=`
- `ANTHROPIC_API_KEY=`

Keep existing keys already present.

### E. Add minimal route guardrails discovered during review

Because Phase C touches public/server routes directly, the implementation may add narrowly scoped abuse/correctness guardrails when they are discovered by review, as long as route purpose stays the same:

- `src/app/api/assistant/transcribe/route.ts`
  - add conservative audio type allowlist validation
  - add conservative upload size cap
- `src/app/api/surprise-me/route.ts`
  - bound cache growth
  - prune expired cache entries
  - normalize/clamp user-controlled query inputs before using them as cache keys

### F. Update the canonical deployment runbook

Update `docs/deployment/local-to-vps.md` so it reflects the new runtime contract after Phase C:

- authenticated app self-calls use trusted app-base config: `APP_BASE_URL`, then `NEXTAUTH_URL`, then local fallback
- FastAPI calls use `FASTAPI_URL` with local fallback
- Anthropic/OpenAI credentials are env-first
- legacy `~/.openclaw/credentials/*.json` lookup remains compatibility fallback only

---

## File-Level Scope

### New
- `src/lib/server-config.ts`

### Modify
- `.env.example`
- `docs/deployment/local-to-vps.md`
- `src/app/api/assistant/chat/route.ts`
- `src/app/api/assistant/summarize/route.ts`
- `src/app/api/assistant/transcribe/route.ts`
- `src/app/api/surprise-me/route.ts`

### Explicitly Do Not Modify In Phase C
- `src/lib/db.ts`
- frontend UI components
- auth/session logic outside env usage

---

## Behavioral Requirements

1. Local dev with no new env vars should still work via localhost defaults and optional credential-file fallback.
2. VPS/runtime environments should be able to work with env vars only.
3. Missing OpenAI key should still produce the existing 503 path in transcribe route.
4. Missing Anthropic key must return `503` with `{ "error": "Summarization service not configured" }`; no uncaught file-read crash.
5. Route response JSON contracts must not change.
6. TypeScript strict mode must remain clean enough for `npm run build` to pass.
7. The deployment runbook must be updated in the same phase so operators are not left with stale localhost guidance.
8. Authenticated self-calls must not trust request-derived origin/host values.
9. Invalid `APP_BASE_URL`, `NEXTAUTH_URL`, or `FASTAPI_URL` values must not cause request-time URL-construction crashes in touched routes.
10. Summarization fallback must still persist a non-empty summary marker.

---

## Verification Requirements

Before calling Phase C complete, run fresh:

1. `npm run lint`
2. `npm run build`
3. `git diff --name-only -- src .env.example docs/deployment/local-to-vps.md | cat`
4. Repo searches confirming these strings are removed from the touched route files and other touched source files, with localhost fallback strings allowed only inside `src/lib/server-config.ts`:
   - `http://localhost:3000/api/assistant/summarize`
   - `http://localhost:8766/api/assistant/chat`
   - `http://localhost:8766/api/assistant/record-spend`
   - `.openclaw/credentials`
   - `process.env.HOME`
   - `/home/jarvis`
   - `localhost:3000`
   - `localhost:8766`
5. Verify authenticated self-calls now use trusted app-base config instead of request-derived origin.

Also verify the new helper file is the single place owning these runtime decisions.

---

## Risks / Watchouts

1. Self-calling Next route with absolute URL must continue forwarding cookies for auth.
2. Authenticated self-calls must not trust request-derived origin/host values.
3. Trailing-slash bugs must be avoided when composing base URL + path.
4. OpenAI legacy credential JSON may use `api_key` or `key`; helper must tolerate both.
5. Do not silently change FastAPI fallback behavior for the user-facing routes.
6. Keep scope tight: Phase C is config hardening, not architectural rewrite.
