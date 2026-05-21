# Phase C — Application Logic Remediation Design Spec

**Date:** 2026-05-20
**Last updated:** 2026-05-21
**Status:** Approved for implementation
**Scope:** Replace host-specific localhost and credential-file assumptions in server routes with environment-driven helpers, without changing feature behavior or the SQLite deployment model.
**Reviewed / tightened by:** Hermes Agent, GPT-5.5, 2026-05-21

---

## Executive Summary

Phase C is a targeted runtime-configuration hardening pass for TravelPlanInfo. It does **not** migrate persistence, redesign auth, or change Atlas feature behavior.

The approved decision is:

1. Keep SQLite at `data/tpi.db` for this phase.
2. Move internal application URLs and FastAPI URLs behind shared server-only config helpers.
3. Make production/VPS credential resolution env-first.
4. Preserve legacy `~/.openclaw/credentials/*.json` credential files only as local compatibility fallback.
5. Ensure authenticated internal self-calls never derive their target origin from request-controlled headers.
6. Update the canonical deployment runbook in the same phase so operators have the real runtime contract.

The success state is simple: the app behaves the same, but server routes are no longer tied to Jose's workstation layout or local port assumptions except through safe local-development defaults centralized in one helper file.

---

## Problem

Phase A/B cleaned deployment/docs, but the application logic still assumes one very specific runtime:

1. `src/app/api/assistant/chat/route.ts` hardcodes `http://localhost:3000/api/assistant/summarize` for an internal self-call.
2. `src/app/api/assistant/chat/route.ts`, `src/app/api/assistant/summarize/route.ts`, and `src/app/api/surprise-me/route.ts` hardcode `http://localhost:8766` for the FastAPI sidecar.
3. `src/app/api/assistant/summarize/route.ts` reads Anthropic credentials from `~/.openclaw/credentials/anthropic.json` with no env-first path.
4. `src/app/api/assistant/transcribe/route.ts` reads OpenAI credentials from `~/.openclaw/credentials/openai.json`, with env fallback only after filesystem failure.
5. These assumptions make local/VPS parity fragile and couple app behavior to Jose's workstation layout.

The current SQLite database at `data/tpi.db` is intentionally left in place for this phase. This phase is about transport/config hygiene, not persistence migration.

---

## Security Rationale: Do Not Trust Request-Derived Origins

Authenticated internal self-calls must use trusted server configuration, not request-derived origin/host data.

Reason: request `Host`, `Origin`, `X-Forwarded-Host`, and `X-Forwarded-Proto` values can be attacker-controlled or proxy-misconfigured. If an authenticated route uses those values to build a server-side self-call and forwards cookies, the app can leak authenticated cookies to an attacker-controlled origin or create SSRF-like behavior.

Therefore:

- Authenticated self-calls must use `APP_BASE_URL`, then `NEXTAUTH_URL`, then the local development fallback.
- `getRequestAwareAppBaseUrl()` may exist only for non-authenticated request-aware composition.
- Any implementation that forwards cookies to a URL built from request headers fails this spec.

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
9. Make future code review mechanical by documenting forbidden patterns and copy/paste verification commands.

---

## Non-Goals

- Replace SQLite or move `data/tpi.db`
- Change NextAuth provider behavior beyond required env compatibility
- Redesign Atlas route behavior or prompts
- Remove fallback behavior for local development
- Add a full test framework migration
- Rewrite unrelated env handling in other files unless directly touched by this phase
- Deploy to VPS or change production infrastructure as part of this spec

---

## Runtime Environment Contract

| Variable | Used by | VPS expectation | Local fallback | Notes |
| --- | --- | --- | --- | --- |
| `APP_BASE_URL` | Authenticated internal Next.js self-calls | Strongly recommended | `NEXTAUTH_URL`, then `http://localhost:3000` | Preferred trusted origin for cookie-forwarding self-calls. |
| `NEXTAUTH_URL` | NextAuth runtime and fallback trusted app base | Required for auth correctness | `http://localhost:3000` if `APP_BASE_URL` and `NEXTAUTH_URL` are both unset/invalid | Must match canonical app URL in production. |
| `FASTAPI_URL` | Atlas chat backend, summarization cost logging, surprise destinations | Required if FastAPI is not available at local fallback | `http://localhost:8766` | Centralized via `getFastApiBaseUrl()`. |
| `ANTHROPIC_API_KEY` | Assistant summarization | Preferred production source | legacy `~/.openclaw/credentials/anthropic.json` | Helper reads `api_key` from legacy file only if env is unset. |
| `OPENAI_API_KEY` | Assistant transcription | Preferred production source | legacy `~/.openclaw/credentials/openai.json` | Helper accepts `api_key` or `key` from legacy file only if env is unset. |

Blank or whitespace-only env values count as unset.

Invalid configured base URLs must not crash request handling. They must be ignored in favor of the next candidate or local development fallback.

---

## Approved Approach

### A. Add shared server config helpers

Create a new helper module under `src/lib/server-config.ts` that centralizes runtime configuration decisions:

- `normalizeBaseUrl(url: string): string`
- `getAppBaseUrl(): string`
- `getAuthenticatedAppBaseUrl(): string`
- `getRequestAwareAppBaseUrl(origin?: string): string`
- `getFastApiBaseUrl(): string`
- `getAnthropicApiKey(): string`
- `getOpenAIApiKey(): string`

Rules:

- Mark the helper module as server-only.
- Trusted app base URL must prefer explicit env (`APP_BASE_URL`), then `NEXTAUTH_URL`, then local default `http://localhost:3000`.
- `getAuthenticatedAppBaseUrl()` must be the helper used for authenticated internal self-calls that forward cookies.
- `getAuthenticatedAppBaseUrl()` must not inspect `req.url`, `Host`, `Origin`, `X-Forwarded-Host`, or `X-Forwarded-Proto`.
- `getRequestAwareAppBaseUrl()` may exist for non-authenticated request-aware composition, but authenticated self-calls must use trusted app-base config instead of request-derived origin.
- FastAPI base URL should prefer `FASTAPI_URL`, then local default `http://localhost:8766`.
- API key helpers should prefer direct env vars first:
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY`
- Legacy credential-file fallback is allowed only if env is missing.
- Treat empty or whitespace env values as unset.
- Use `os.homedir()` for legacy credential-file lookup instead of `process.env.HOME` or hardcoded user paths.
- Use URL-safe joining when composing base URLs with route paths.
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
- same auth gates
- same streaming behavior
- same DB semantics
- same error handling semantics except explicitly documented missing-key handling

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

## Forbidden Patterns

The following patterns are forbidden in touched route files and should be treated as review blockers:

- `new URL(req.url).origin` for authenticated self-calls
- `req.headers.get("host")` for authenticated self-calls
- `req.headers.get("origin")` for authenticated self-calls
- direct trust of `x-forwarded-host` / `x-forwarded-proto` for authenticated self-calls
- hardcoded `http://localhost:*` in touched routes
- hardcoded `http://localhost:*` anywhere in touched source files except local fallbacks in `src/lib/server-config.ts`
- direct reads from `process.env.HOME`
- direct construction of `~/.openclaw/credentials/*` paths outside `src/lib/server-config.ts`
- hardcoded `/home/jarvis` paths in touched source files
- forwarding cookies to any URL derived from request-controlled headers

---

## Helper Behavior Examples

These examples define expected behavior for helper implementation and review:

| Inputs | Expected result |
| --- | --- |
| `APP_BASE_URL="https://travelplaninfo.com/"` | app base helper returns `https://travelplaninfo.com` |
| `APP_BASE_URL="   "`, `NEXTAUTH_URL="https://travelplaninfo.com"` | app base helper returns `https://travelplaninfo.com` |
| `APP_BASE_URL="notaurl"`, `NEXTAUTH_URL="https://travelplaninfo.com"` | app base helper ignores invalid `APP_BASE_URL` and returns `https://travelplaninfo.com` |
| `APP_BASE_URL="notaurl"`, `NEXTAUTH_URL="also-bad"` | app base helper returns `http://localhost:3000` |
| `FASTAPI_URL="https://api.travelplaninfo.com/"` | FastAPI helper returns `https://api.travelplaninfo.com` |
| `FASTAPI_URL="notaurl"` | FastAPI helper returns `http://localhost:8766` |
| `ANTHROPIC_API_KEY=" sk-ant... "` | Anthropic key helper returns trimmed env key and does not read file |
| `OPENAI_API_KEY=""`, legacy file has `{ "api_key": "sk-..." }` | OpenAI key helper returns legacy `api_key` |
| `OPENAI_API_KEY=""`, legacy file has `{ "key": "sk-..." }` | OpenAI key helper returns legacy `key` |
| env key missing and legacy file missing/malformed | key helper returns empty string |

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
- persistence location or SQLite schema
- unrelated deployment scripts or infrastructure templates unless a direct doc/runbook reference must stay truthful

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
11. The new helper file should be the single source of truth for base URL and legacy credential lookup behavior.

---

## Acceptance Criteria Matrix

| Requirement | File(s) | Verification method |
| --- | --- | --- |
| Trusted authenticated self-call | `src/app/api/assistant/chat/route.ts`, `src/lib/server-config.ts` | Inspect self-call uses `getAuthenticatedAppBaseUrl()`; grep for request-origin/header usage. |
| FastAPI URL env-driven | `chat/route.ts`, `summarize/route.ts`, `surprise-me/route.ts`, `server-config.ts` | Grep hardcoded `localhost:8766` outside `server-config.ts`; inspect `new URL(path, getFastApiBaseUrl())`. |
| Anthropic env-first | `server-config.ts`, `summarize/route.ts` | Inspect `getAnthropicApiKey()` precedence and missing-key 503. |
| OpenAI env-first | `server-config.ts`, `transcribe/route.ts` | Inspect `getOpenAIApiKey()` precedence and missing-key 503. |
| Invalid URL fallback | `server-config.ts` | Inspect absolute `http`/`https` validation with safe fallback. |
| No workstation path coupling | touched source files | Grep for `/home/jarvis`, `process.env.HOME`, and direct `.openclaw/credentials` reads outside helper. |
| Runbook truthfulness | `docs/deployment/local-to-vps.md` | Inspect env contract and fallback descriptions match code. |
| SQLite untouched | `src/lib/db.ts` | `git diff -- src/lib/db.ts` should be empty for Phase C. |
| Frontend untouched | `src/components`, `src/app/[locale]` | No frontend changes unless explicitly justified by route-contract need. |
| Build health | whole repo | `npm run lint` and `npm run build` pass; existing warnings may remain. |

---

## Verification Requirements

Before calling Phase C complete, run fresh from repo root:

```bash
npm run lint
npm run build
git diff --name-only -- src .env.example docs/deployment/local-to-vps.md | cat
```

Run scoped source searches. These commands intentionally search source only so docs/spec mentions do not create false positives.

```bash
# Exact hardcoded route URLs must be gone from touched source.
grep -RIn \
  -e 'http://localhost:3000/api/assistant/summarize' \
  -e 'http://localhost:8766/api/assistant/chat' \
  -e 'http://localhost:8766/api/assistant/record-spend' \
  src/app/api src/lib || true
```

```bash
# Workstation-specific paths and HOME-derived credential lookup must not appear in source.
grep -RIn \
  -e 'process.env.HOME' \
  -e '/home/jarvis' \
  src/app/api src/lib || true
```

```bash
# localhost defaults are allowed only in the central helper.
grep -RIn -e 'localhost:3000' -e 'localhost:8766' src/app/api src/lib \
  | grep -v 'src/lib/server-config.ts' && exit 1 || true
```

```bash
# Legacy credential path construction is allowed only in the central helper.
grep -RIn '\.openclaw.*credentials\|credentials.*anthropic\.json\|credentials.*openai\.json' src/app/api src/lib \
  | grep -v 'src/lib/server-config.ts' && exit 1 || true
```

```bash
# Authenticated self-call must not derive target origin from request-controlled values.
grep -RIn \
  -e 'new URL(req.url).*origin' \
  -e 'headers.get("host")' \
  -e "headers.get('host')" \
  -e 'headers.get("origin")' \
  -e "headers.get('origin')" \
  -e 'x-forwarded-host' \
  -e 'x-forwarded-proto' \
  src/app/api/assistant/chat/route.ts || true
```

Also verify manually:

1. The background summarization self-call forwards cookies only to a URL built from `getAuthenticatedAppBaseUrl()`.
2. `src/lib/server-config.ts` is the single place owning base URL defaults and legacy credential lookup.
3. Missing Anthropic key returns the exact 503 JSON required above.
4. Missing OpenAI key still returns the existing 503 transcription path.
5. Summarization fallback persists a non-empty marker even when model output is empty or malformed.

---

## Future Test Targets (Not Required For Phase C)

This phase does not require a test framework migration. If tests are added later, prioritize:

1. `normalizeBaseUrl()` trailing slash removal.
2. `APP_BASE_URL` / `NEXTAUTH_URL` precedence.
3. invalid app base URL fallback.
4. `FASTAPI_URL` precedence and invalid fallback.
5. env-first credential lookup.
6. legacy OpenAI credential support for both `api_key` and `key`.
7. missing-key route 503 behavior.
8. transcribe unsupported MIME type rejection.
9. transcribe upload size cap.
10. surprise-me cache key normalization and cache bound.

---

## Definition of Done

Phase C is complete only when:

- `src/lib/server-config.ts` exists and owns URL/key lookup decisions.
- touched routes import and use the helper instead of hardcoded localhost or credential-file logic.
- authenticated internal self-calls use trusted app-base config, not request-derived origin/host values.
- `.env.example` documents the required env variables.
- `docs/deployment/local-to-vps.md` documents the new runtime contract.
- scoped source searches pass with no forbidden patterns outside `src/lib/server-config.ts`.
- `npm run lint` passes.
- `npm run build` passes.
- no SQLite migration, frontend rewrite, or unrelated infrastructure change was introduced.

---

## Risks / Watchouts

1. Self-calling Next route with absolute URL must continue forwarding cookies for auth.
2. Authenticated self-calls must not trust request-derived origin/host values.
3. Trailing-slash bugs must be avoided when composing base URL + path.
4. OpenAI legacy credential JSON may use `api_key` or `key`; helper must tolerate both.
5. Do not silently change FastAPI fallback behavior for the user-facing routes.
6. Keep scope tight: Phase C is config hardening, not architectural rewrite.
7. Do not mistake `npm run build` passing for full deployment readiness; this phase does not remove the SQLite/runtime persistence constraint.
