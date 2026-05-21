# Handoff — Phase C App Logic Remediation for Sonnet 4.6

**Date:** 2026-05-21
**Prepared by:** Hermes Agent, GPT-5.5
**Intended implementer:** Sonnet 4.6
**Repo:** `/home/jarvis/.openclaw/workspace/jarvis-project/travelplaninfo-prototype`
**Primary spec:** `docs/superpowers/specs/2026-05-20-phase-c-app-logic-design.md`
**Implementation plan:** `docs/plans/2026-05-20-phase-c-app-logic-remediation.md`

---

## Mission

Implement or validate Phase C exactly as specified: remove hardcoded localhost and workstation-specific credential assumptions from server routes while preserving route behavior and leaving SQLite untouched.

Phase C is runtime/config hardening only. Do not turn this into a broader production architecture project.

---

## Current Known State

As of this handoff, the repo already contains an implementation commit:

- `f8ebfb7 refactor: decouple tpi phase c runtime config`

Fresh verification already performed by GPT-5.5 before this handoff:

- `git status --short` returned clean before doc updates.
- `npm run lint` passed with existing warnings only.
- `npm run build` passed.
- Source search showed localhost fallbacks only in `src/lib/server-config.ts`.

However, Sonnet 4.6 should not trust this handoff blindly. Re-run verification after pulling the current worktree and after any edits.

---

## Files To Read First

Read these in order:

1. `docs/superpowers/specs/2026-05-20-phase-c-app-logic-design.md`
2. `docs/plans/2026-05-20-phase-c-app-logic-remediation.md`
3. `src/lib/server-config.ts`
4. `src/app/api/assistant/chat/route.ts`
5. `src/app/api/assistant/summarize/route.ts`
6. `src/app/api/assistant/transcribe/route.ts`
7. `src/app/api/surprise-me/route.ts`
8. `.env.example`
9. `docs/deployment/local-to-vps.md`

Do not start by editing. First confirm the live code matches the improved spec.

---

## Implementation / Validation Tasks

### Task 1 — Confirm helper contract

File:

- `src/lib/server-config.ts`

Confirm the helper provides and correctly implements:

- `normalizeBaseUrl(url: string): string`
- `getAppBaseUrl(): string`
- `getAuthenticatedAppBaseUrl(): string`
- `getRequestAwareAppBaseUrl(origin?: string): string`
- `getFastApiBaseUrl(): string`
- `getAnthropicApiKey(): string`
- `getOpenAIApiKey(): string`

Hard requirements:

- module is server-only
- blank env values are treated as unset
- configured base URLs are validated as absolute `http`/`https`
- invalid base URLs fall back safely
- returned base URLs are normalized without trailing slash
- legacy credential lookup uses `os.homedir()`, not `process.env.HOME`
- helper catches missing/malformed credential files and returns empty string
- OpenAI legacy file accepts both `api_key` and `key`

### Task 2 — Confirm authenticated self-call safety

File:

- `src/app/api/assistant/chat/route.ts`

Confirm:

- background summarization calls `new URL("/api/assistant/summarize", getAuthenticatedAppBaseUrl())`
- cookies are still forwarded exactly as before
- target origin does not come from `req.url`, `Host`, `Origin`, `X-Forwarded-Host`, or `X-Forwarded-Proto`
- FastAPI chat call uses `getFastApiBaseUrl()`
- SSE behavior, DB writes, rate limiting, and error messages are preserved

### Task 3 — Confirm summarize route behavior

File:

- `src/app/api/assistant/summarize/route.ts`

Confirm:

- route imports `getAnthropicApiKey()` and `getFastApiBaseUrl()`
- route no longer contains direct `fs`, `path`, `HOME`, or credential-file path logic
- missing Anthropic key returns exactly:
  - status `503`
  - body `{ "error": "Summarization service not configured" }`
- cost recording uses `getFastApiBaseUrl()`
- malformed/empty model output still persists a non-empty summary marker
- response shape remains compatible

### Task 4 — Confirm transcribe route behavior

File:

- `src/app/api/assistant/transcribe/route.ts`

Confirm:

- route imports `getOpenAIApiKey()`
- route no longer contains direct credential-file path logic
- missing OpenAI key returns 503
- audio MIME allowlist and upload cap are conservative and do not break current `VoiceInput.tsx` behavior
- `VoiceInput.tsx` currently records `audio/webm;codecs=opus` but uploads a `Blob` with type `audio/webm`; route should accept `audio/webm`
- Whisper endpoint and model remain unchanged

### Task 5 — Confirm surprise-me route behavior

File:

- `src/app/api/surprise-me/route.ts`

Confirm:

- route imports `getFastApiBaseUrl()`
- no hardcoded FastAPI base constant remains
- fallback payload remains intact
- cache has a max size
- expired cache entries are pruned
- user-controlled query values are clamped/normalized before becoming cache keys

### Task 6 — Confirm docs and env template

Files:

- `.env.example`
- `docs/deployment/local-to-vps.md`

Confirm:

- `.env.example` includes `APP_BASE_URL=` and `ANTHROPIC_API_KEY=`
- existing keys are preserved
- runbook documents:
  - authenticated self-calls use `APP_BASE_URL`, then `NEXTAUTH_URL`, then local fallback
  - FastAPI calls use `FASTAPI_URL`, then local fallback
  - Anthropic/OpenAI credentials are env-first
  - legacy `~/.openclaw/credentials/*.json` files are compatibility fallback only

---

## Forbidden Changes

Do not modify these unless Jose explicitly opens a new phase:

- `src/lib/db.ts`
- SQLite path or persistence model
- frontend UI components
- NextAuth provider behavior beyond env compatibility
- Atlas prompts or route behavior unrelated to config hygiene
- VPS deployment state
- production services

Do not deploy. Jose must explicitly approve any VPS/live deploy.

---

## Required Verification Commands

Run from repo root:

```bash
npm run lint
npm run build
git diff --name-only -- src .env.example docs/deployment/local-to-vps.md docs/superpowers/specs docs/superpowers/handoffs | cat
```

Run the scoped searches from the improved spec:

```bash
grep -RIn \
  -e 'http://localhost:3000/api/assistant/summarize' \
  -e 'http://localhost:8766/api/assistant/chat' \
  -e 'http://localhost:8766/api/assistant/record-spend' \
  src/app/api src/lib || true
```

```bash
grep -RIn \
  -e 'process.env.HOME' \
  -e '/home/jarvis' \
  src/app/api src/lib || true
```

```bash
grep -RIn -e 'localhost:3000' -e 'localhost:8766' src/app/api src/lib \
  | grep -v 'src/lib/server-config.ts' && exit 1 || true
```

```bash
grep -RIn '\.openclaw.*credentials\|credentials.*anthropic\.json\|credentials.*openai\.json' src/app/api src/lib \
  | grep -v 'src/lib/server-config.ts' && exit 1 || true
```

```bash
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

Expected result:

- lint passes, existing warnings acceptable
- build passes
- exact hardcoded route URLs absent from source
- localhost fallbacks appear only in `src/lib/server-config.ts`
- legacy credential path logic appears only in `src/lib/server-config.ts`
- authenticated self-call does not use request-controlled origin/host values

---

## If You Find A Gap

If the current implementation differs from the improved spec:

1. Fix the smallest possible diff.
2. Do not broaden scope.
3. Re-run all verification commands.
4. Document exactly what changed and why.
5. Do not claim completion without fresh command output.

---

## Final Response Jose Expects

When done, report in this shape:

```text
Phase C validation/implementation complete.

Changed files:
- ...

Verification run:
- npm run lint: passed / warnings only
- npm run build: passed
- scoped grep checks: passed

Important notes:
- SQLite was not touched.
- No deploy was performed.
- Authenticated self-call uses trusted app-base config, not request-derived origin.
```

If anything fails, report the exact failing command and the smallest proposed fix.
