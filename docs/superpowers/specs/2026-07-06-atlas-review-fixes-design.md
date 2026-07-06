# Atlas Post-Review Fixes — Design Spec

**Date:** 2026-07-06
**Branch:** `fix/atlas-review-findings` (worktree `../tpi-fix-atlas-review`)
**Source:** xhigh multi-agent code review of PR #5 (`e50a868`, Atlas brain relocation, merged to main, **not yet deployed**). 10 finder angles → 65 candidates → 27 independently verified (24 CONFIRMED, 1 PLAUSIBLE, 2 REFUTED). The 15 findings below are the report; all are in scope (Jose, 2026-07-06).
**Goal:** all 15 fixed, reviewed, and merged to main before the VPS deploy this session.

---

## Workflow roles (NON-NEGOTIABLE — Jose, 2026-07-06)

- **Fable 5** (main session): review, brainstorm, plan, and **post-consensus verification** of each fix. Never writes implementation code.
- **Opus 4.8**: implementation **orchestrator** — drives the task list, dispatches the implementer, runs the consensus bridge.
- **Hermes GPT-5.5**: **implementer** — all code/file edits, via `hermes -z "<prompt>" -m gpt-5.5 --cli --yolo` (activate `~/.hermes/hermes-agent/venv` first).
- **Consensus bridge**: after GPT-5.5 implements a fix, Opus 4.8 reviews the diff and iterates with GPT-5.5 (objections fed back through Hermes) until both explicitly agree the fix is correct. **Only then** does Fable 5 verify with fresh commands.

Per-fix sequence: `GPT-5.5 implements → Opus 4.8 ⇄ GPT-5.5 consensus → Fable 5 verifies`.

Standing rules still apply: 7-step pipeline, TDD per repo convention, `npm run test:unit -- <path>` for single files (never `npm run test -- <path>`), verification-before-completion with fresh evidence, no deploy without Jose's visual review.

---

## Fixes

### F1. SSE multi-line encoding (BLOCKER)
**Finding:** `tool-loop.ts:171` — tokens containing `\n`/`\n\n` corrupt SSE framing; `AssistantChat.tsx:781-785` drops un-prefixed fragments; every multi-paragraph reply loses text (can eat the D3/D7 affiliate markdown line); persisted transcript diverges from displayed text (route accumulates whole frames; `trimEnd` also strips trailing whitespace).
**Fix (approved):** SSE-spec multi-line data frames.
- `tool-loop.ts`: new `encodeSseData(text): string` — each line of the payload gets its own `data: ` prefix, event terminated by blank line (`"a\n\nb"` → `data: a\ndata: \ndata: b\n\n`). Use for token frames (tool/error/DONE frames are single-line; encoder handles them identically).
- `AssistantChat.tsx`: per event (split on `\n\n`), collect **all** lines starting with `data: `, strip the prefix, join with `\n`. Events with no `data: ` line are ignored as before.
- `chat/route.ts`: decode frames with a shared `decodeSseData(frame): string | null` helper (exported from a small `src/lib/atlas/sse.ts` module alongside the encoder) instead of `slice(6).trimEnd()` — persisted `fullResponse` must equal exactly what the client renders.
- Round-trip unit tests: plain word, `\n`, `\n\n`, leading/trailing newlines, empty string.

### F2. Honest failure reasons in the Travelpayouts client (BLOCKER)
**Finding:** `travelpayouts-client.ts:447` — missing token / rate-limit / timeout / HTTP error all collapse into "TP API returned no flights for this route and date range", so Atlas asserts flights don't exist when the system is misconfigured (the VPS has no `TRAVELPAYOUTS_TOKEN` today). Plan for PR #5 required a throw on missing token.
**Fix:** `tpGet` returns `{ data } | { failure: "no_token" | "rate_limited" | "http_error" | "timeout" }` instead of bare `null`. Handlers map failures to distinct `no_data` reasons that say *the search could not run* ("flight search is temporarily unavailable — this does not mean no flights exist" / "flight search is not configured"). Genuine empty results keep the existing reason. `console.error` once on first `no_token` occurrence per process. System prompt: one added line instructing Atlas to distinguish "couldn't check" from "no flights exist" based on the reason text.

### F3. Surprise Me partner-link guard (BLOCKER)
**Finding:** `system-prompt.ts:48` — `extractDestination` captures `Surprise Me` from `Active trip: Surprise Me, …` (exclusion exists only on the never-reached `Destination:` pattern) → model ordered to paste `[Search hotels in Surprise Me on Hotels.com](…)` verbatim.
**Fix:** after any pattern captures a candidate, reject it centrally if it matches `/^surprise me$/i` (and empty/whitespace) → safe prose-only degrade. Unit test with the real client string `Active trip: Surprise Me, flexible to flexible, 2 adults`.

### F4. History window must start with a user turn
**Finding:** `chat/route.ts:180` — `ORDER BY id DESC LIMIT 20` window can start with an assistant row → Anthropic 400 (`first message must use the user role`); intermittent dead turns from the 11th user message onward.
**Fix:** after `slice(0, -1)`, drop leading rows while `role !== "user"`. Unit-testable helper (extract `trimHistoryForAnthropic(rows)` or test via route-level unit if pattern exists).

### F5. Handle `refusal` / `max_tokens` stop reasons
**Finding:** `tool-loop.ts:146` — only `tool_use` branched; a refusal (HTTP 200, empty content) yields a bare `[DONE]` → permanently blank bubble, no assistant row (consecutive user rows); `max_tokens` mid-tool-call silently drops the tool call.
**Fix:** after the tool_use branch: if `stop_reason === "refusal"` or the response has no non-empty text blocks → yield a friendly error frame ("Atlas can't help with that request.") then `[DONE]`. If `stop_reason === "max_tokens"` and a tool_use block is present → yield error frame ("Atlas's reply was cut short. Please try again.") then `[DONE]`. Text that did stream before a max_tokens cutoff still streams.

### F6. Fan-out reverted to Python parity + attempt-counting rate limiter
**Finding:** `travelpayouts-client.ts:416/319` — origin×destination×2 fan-out = up to 24-32 TP calls per search (Python: origins only, ≤8); limiter checks before any timestamp lands (concurrent burst bypass) and counts only successes (inert during TP throttling). ~8 worst-case searches exhaust the 200/hr budget → every user gets no_data.
**Fix:** fan out **origin-side nearby airports only**; destination stays as given (Python parity, ≤4×2=8 calls). Rate limiter: record the attempt timestamp **before** the fetch (inside `tpGet`, after the limit check passes), so bursts and failures both count.

### F7. Strict IATA validation — no truncation
**Finding:** `travelpayouts-client.ts:233` — `cleanIata` truncates to first 3 letters: `Cancun`→`CAN` (Guangzhou), `Tulum`→`TUL` (Tulsa) → confidently wrong flight data.
**Fix:** `parseIata(value): string | null` — trim, uppercase; return the code only if the result is exactly 3 letters (`/^[A-Z]{3}$/` on the whole cleaned input, no slicing); else null. `searchFlights`/`getDeals`/`getPopularRoutes` return `no_data` with reason "origin/destination must be a 3-letter airport code (e.g. CUN for Cancún)" on null — a reason the model can self-correct from. Origin defaults (`MIA`) only apply to empty input, never invalid input.

### F8. `get_deals` destination restored
**Finding:** `tool-loop.ts:32` — Python accepted + filtered by optional `destination` (tp_client.py:237-238); TS schema/handler dropped it while the prompt still says "proactively call … get_deals for that destination".
**Fix:** add optional `destination` to the tool schema; `executeTool` passes it through; `getDeals(origin, destination?)` adds `params.destination` (validated via F7's `parseIata`).

### F9. Per-model pricing table
**Finding:** `spend.ts:17` — `recordAssistantSpend` ignores `model`; claude-sonnet-4-6 ($3/$15) recorded at Sonnet-5 intro rates ($2/$10); after 2026-08-31 all traffic under-records.
**Fix:** `MODEL_PRICES_PER_MTOK: Record<string, {input: number; output: number}>` with `claude-sonnet-5: {2, 10}` (comment: intro pricing through 2026-08-31 → then $3/$15) and `claude-sonnet-4-6: {3, 15}`. Unknown model → price at the most expensive entry + `console.warn` (never silently cheap). Existing tests updated; new test for the 4-6 rate and the unknown-model fallback.

### F10. Spend cap enforced at every Anthropic call site
**Finding:** `summarize/route.ts:101` — no cap check; chat fire-and-forgets summarize before the tool-loop's cap refusal → capped users keep spending (~1 call/session, indefinitely).
**Fix:** `isSpendCapReached(): boolean` exported from `spend.ts` (single source: `getAssistantMonthlySpendUsd() >= ASSISTANT_SPEND_CAP_USD`). `runAtlasTurn` uses it; summarize route checks it before `messages.create` and returns `{skipped: "spend_cap"}` (200) without calling the API.

### F11. Stream text blocks that accompany tool_use
**Finding:** `tool-loop.ts:150` — preamble text in a tool_use response is never streamed or persisted (but is pushed into `currentMessages`, so the model thinks it said it).
**Fix:** in the tool_use branch, first yield text blocks as token frames (through F1's encoder, same word-chunk cadence) and append them to what the route accumulates, then yield `[TOOL:]` frames and continue the loop.

### F12. Tool execution containment
**Finding:** `tool-loop.ts:151` — no per-tool try/catch or timeout (Python: `asyncio.wait_for` 30s + except → recoverable `is_error` tool_result). Latent crash path via `get_article`/malformed article JSON kills the whole turn.
**Fix:** wrap `executeTool` in try/catch plus a 30s `Promise.race` timeout → on error/timeout return `{error: "Tool <name> failed: <msg>", is_error: true}` as the tool_result (existing `is_error` plumbing finally earns its keep). The turn continues; the model can recover. Unit test with a throwing tool handler.

### F13. `surprise_me` restores month + round-trip pricing defaults
**Finding:** `tool-loop.ts:103` / `travelpayouts-client.ts:505` — Python filtered popular routes by next-month departure and priced round trips; TS sends neither → suggestion prices are any-month one-way, systematically understated.
**Fix:** `getPopularRoutes` adds `departure_at` = next calendar month (`YYYY-MM`, UTC) and `return_at` = same month (round-trip pricing), matching Python's defaults, server-side (schema unchanged). Also drop `limit: 100` → `limit: 5` (server sorts by price; only 5 used).

### F14. Replace redacted test fixtures
**Finding:** `env-preflight.test.ts:17/:31`, `assistant-health.test.ts:22` — committed literal `«redacted:sk-…»` terminal-redaction artifacts.
**Fix:** replace all three with `"sk-ant-fake-key"` (the plan's original fixture). Repo-wide grep for `«` / `redacted:` must come back clean afterward.

### F15. Update help content for D3 + spend cap
**Finding:** `help-content.ts:37-44` — help still says Atlas "automatically searches for flights, hotels, and activities" and can "search and add items via the chat"; D3 forbids named hotel/restaurant/activity results, and the monthly-cap refusal is undocumented. Binding rule: `feedback_update_help_with_features`.
**Fix:** revise the Atlas help entries: flights/deals/articles are searched live; hotels/activities/restaurants get guidance plus a partner search link (no named properties/prices); note that Atlas can pause for the month when its usage limit is reached. Keep tone/format consistent with surrounding entries.

---

## Task grouping (for the plan)

Ordered so blockers land first; each task = TDD + commit + consensus + Fable verification.

1. F1 (sse.ts helper + tool-loop + client parser + route accumulator)
2. F2 (+ prompt line)
3. F3
4. F4, F5 (route/tool-loop correctness pair)
5. F6, F7, F8, F13 (travelpayouts-client cluster — one task each, F7 before F8/F13 since they use `parseIata`)
6. F9, F10 (spend cluster)
7. F11, F12 (tool-loop cluster)
8. F14, F15 (hygiene — may run as one task)

## Acceptance gates

- Per fix: new/updated unit test passes (`npm run test:unit -- <file>`); Opus⇄GPT-5.5 consensus recorded; Fable verification with fresh command output.
- Branch: `npm run lint && npm run test && npm run build` green.
- Live smoke (local dev, Fable-verified): a multi-paragraph Atlas reply renders with paragraphs intact and persisted text identical to displayed; a Surprise Me trip hotel question yields prose with **no** partner link; with `TRAVELPAYOUTS_TOKEN` unset, a flight ask yields the "temporarily unavailable" phrasing, not "no flights".
- Steps 5-6 of the pipeline (post-review on all delivered code, verification-before-completion) before merge; PR to main; **no VPS deploy without Jose's visual review**.

## Out of scope (verified in review, deferred to backlog)

Also deferred (recorded 2026-07-06 during plan review): the `help-content.ts` **Auto-search** and **Trip Results Modal** entries describe the modal auto-search flow, which rides on the deferred `/api/surprise-me`/FastAPI migration — those entries get rewritten together with that migration. F15 covers the two chat-behavior entries only ("Adding items", "Atlas chat").

`/api/surprise-me` still proxies FastAPI (workstation-independence gap); health endpoint 500s instead of degrading on DB errors; prompt caching (`cache_control`) for the tool loop; one-way/round-trip `search_flights` schema contradiction (inherited from Python); `NEARBY_AIRPORTS_MAP`/`todayUtc`/aviasales-link/IATA-cleaner duplication; env-preflight module unwired; dead exported types + `DestinationSuggestion` name collision; TP cache unbounded growth + empty-success caching; `LIKE`-based month query; runbook FASTAPI_URL contradictions in `docs/deployment/local-to-vps.md`; `get_article` multi-word recall (PLAUSIBLE only).
