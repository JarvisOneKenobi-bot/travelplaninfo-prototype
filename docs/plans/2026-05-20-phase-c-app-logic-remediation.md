# Phase C — Application Logic Remediation Implementation Plan

> For agentic workers: required skill is `software-development/subagent-driven-development`.

**Goal:** Remove hardcoded localhost and workstation-specific credential assumptions from TPI server routes while preserving current behavior and leaving SQLite untouched.

**Architecture:** Introduce a small shared server config helper, migrate affected routes to it, keep env-first with legacy file fallback, update the canonical runbook, and verify with lint/build plus targeted searches.

**Tech Stack:** Next.js 15 App Router, TypeScript strict mode, Node runtime route handlers, better-sqlite3, Anthropic SDK, OpenAI HTTP API.

---

### Task 1: Create shared server config helper

Files:
- Create: `src/lib/server-config.ts`

- [ ] Add helper functions:
  - `normalizeBaseUrl(url: string): string`
  - `getAppBaseUrl(): string`
  - `getRequestAwareAppBaseUrl(origin?: string): string`
  - `getFastApiBaseUrl(): string`
  - `getAnthropicApiKey(): string`
  - `getOpenAIApiKey(): string`

- [ ] Implementation requirements:
  - mark the module server-only
  - `getAppBaseUrl()` precedence:
    1. `process.env.APP_BASE_URL`
    2. `process.env.NEXTAUTH_URL`
    3. `http://localhost:3000`
  - add `getAuthenticatedAppBaseUrl()` for authenticated self-calls with precedence:
    1. `process.env.APP_BASE_URL`
    2. `process.env.NEXTAUTH_URL`
    3. `http://localhost:3000`
  - `getRequestAwareAppBaseUrl(origin?: string)` may exist for non-authenticated request-aware composition, but authenticated self-calls must use trusted app-base config instead of request-derived origin
  - `getFastApiBaseUrl()` precedence:
    1. `process.env.FASTAPI_URL`
    2. `http://localhost:8766`
  - trim env values and treat blank strings as unset
  - normalize trailing slash off returned base URLs
  - use URL-safe composition when routes append paths
  - validate configured base URLs as absolute `http`/`https` URLs and fall back safely on invalid values
  - `getAnthropicApiKey()` precedence:
    1. `process.env.ANTHROPIC_API_KEY`
    2. legacy file at `~/.openclaw/credentials/anthropic.json` via `os.homedir()` reading `api_key`
    3. empty string
  - `getOpenAIApiKey()` precedence:
    1. `process.env.OPENAI_API_KEY`
    2. legacy file at `~/.openclaw/credentials/openai.json` via `os.homedir()` reading `api_key` or `key`
    3. empty string
  - helper must catch file/JSON errors and return empty string rather than throw

- [ ] Use Node-safe imports only (`fs`, `path`, `os`)
- [ ] No behavior beyond config lookup belongs in this file

---

### Task 2: Migrate assistant chat route to shared helpers

Files:
- Modify: `src/app/api/assistant/chat/route.ts`

- [ ] Import trusted app-base helper and FastAPI helper
- [ ] Replace background summarization self-call:
  - from hardcoded `http://localhost:3000/api/assistant/summarize`
  - to trusted app-base helper behavior plus `/api/assistant/summarize`
- [ ] Replace backend chat call:
  - from hardcoded `http://localhost:8766/api/assistant/chat`
  - to `${getFastApiBaseUrl()}/api/assistant/chat`
- [ ] Preserve cookie forwarding exactly as-is
- [ ] Preserve SSE behavior, rate limiting, DB writes, and error messages exactly as-is
- [ ] Do not trust request-derived origin/host values for authenticated self-calls

---

### Task 3: Migrate summarize route to shared helpers

Files:
- Modify: `src/app/api/assistant/summarize/route.ts`

- [ ] Remove direct `fs`/`path` credential-file code from the route
- [ ] Import `getAnthropicApiKey` and `getFastApiBaseUrl`
- [ ] Rework Anthropic client creation to use helper-derived key
- [ ] If key is missing, return exactly:
  - status `503`
  - body `{ "error": "Summarization service not configured" }`
- [ ] Replace cost-recording call:
  - from hardcoded `http://localhost:8766/api/assistant/record-spend`
  - to `${getFastApiBaseUrl()}/api/assistant/record-spend`
- [ ] Preserve route response shape and existing non-fatal handling for spend recording failures
- [ ] Ensure malformed/empty model output still produces a non-empty persisted summary marker

---

### Task 4: Migrate transcribe route to shared helper

Files:
- Modify: `src/app/api/assistant/transcribe/route.ts`

- [ ] Remove direct `fs`/`path` credential-file code from the route
- [ ] Import and use `getOpenAIApiKey()`
- [ ] Preserve existing behavior:
  - 401 for unauthenticated
  - 400 when audio missing
  - 400 when audio type is unsupported
  - 413 when audio exceeds the conservative upload cap
  - 503 when no key configured
  - 502 when Whisper upstream fails
  - 500 for route error
- [ ] Do not change Whisper upstream endpoint or model selection
- [ ] Preserve the multipart request shape while allowing the uploaded filename/extension to match the accepted audio type
- [ ] Add conservative audio size/type guardrails to reduce abuse and runaway spend

---

### Task 5: Migrate surprise-me route to shared helper

Files:
- Modify: `src/app/api/surprise-me/route.ts`

- [ ] Import `getFastApiBaseUrl()`
- [ ] Replace module-level hardcoded `FASTAPI_BASE` constant with helper usage
- [ ] Preserve existing fallback payload and fetch behavior
- [ ] Bound cache growth and purge expired entries
- [ ] Clamp user-controlled query inputs before using them in cache keys

---

### Task 6: Update env template and runbook

Files:
- Modify: `.env.example`
- Modify: `docs/deployment/local-to-vps.md`

- [ ] Add to `.env.example`:
  - `APP_BASE_URL=`
  - `ANTHROPIC_API_KEY=`
- [ ] Keep existing keys intact
- [ ] Do not add workstation-specific paths
- [ ] Update `docs/deployment/local-to-vps.md` so it reflects:
  - trusted app-base behavior for authenticated self-calls
  - `FASTAPI_URL` behavior for backend calls
  - env-first Anthropic/OpenAI keys
  - legacy credential-file fallback as compatibility only

---

### Task 7: Spec review gate

- [ ] Review changed files against the design spec
- [ ] Confirm no changes outside intended scope:
  - no `src/lib/db.ts` changes
  - no frontend component changes
  - no route contract changes except the now-explicit 503 missing-Anthropic-key path
- [ ] If gaps exist, fix before quality review

---

### Task 8: Quality + verification gate

- [ ] Run:
  - `npm run lint`
  - `npm run build`
- [ ] Inspect `git diff --name-only -- src .env.example docs/deployment/local-to-vps.md | cat`
- [ ] Run targeted searches proving machine-specific strings are removed from touched route files and other touched source files, with localhost fallback strings allowed only inside `src/lib/server-config.ts`:
  - `http://localhost:3000/api/assistant/summarize`
  - `http://localhost:8766/api/assistant/chat`
  - `http://localhost:8766/api/assistant/record-spend`
  - `.openclaw/credentials`
  - `process.env.HOME`
  - `/home/jarvis`
  - `localhost:3000`
  - `localhost:8766`
- [ ] Verify helper file now owns the runtime base-URL and credential lookup logic
- [ ] Verify authenticated self-calls now use trusted app-base config instead of request-derived origin
- [ ] Verify invalid env base URLs safely fall back instead of crashing touched routes
- [ ] Only after evidence passes, summarize results and prepare commit

---

## Notes for implementer

- Keep the diff minimal and server-side only
- Do not “improve” unrelated code while touching these files
- Prefer tiny pure helper functions over inline branching in routes
- Preserve the existing local-dev experience
- This phase is successful if the app behaves the same but is no longer tied to Jose’s machine layout
- The deployment runbook update is part of the definition of done, not optional follow-up
- Security beats prior plan wording if review uncovers unsafe origin or credential handling
