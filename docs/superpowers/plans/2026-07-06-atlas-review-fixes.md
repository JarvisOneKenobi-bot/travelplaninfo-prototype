# Atlas Post-Review Fixes Implementation Plan

> **For agentic workers:** This plan is executed task-by-task by GPT-5.5 dispatched via the Hermes CLI (`hermes -z "<prompt>" -m gpt-5.5 --cli --yolo`), orchestrated by an Opus 4.8 agent, from a fresh context with no memory of prior conversation. Read the entire task you are assigned before starting. Do not skip verification steps. If a verification command fails, stop and report — do not guess a fix that isn't in this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 15 verified findings from the 2026-07-06 xhigh code review of the Atlas brain (spec: `docs/superpowers/specs/2026-07-06-atlas-review-fixes-design.md`) so the branch can merge to main before the VPS deploy.

**Architecture:** All changes are localized repairs to the Phase-2 Atlas brain: a new shared SSE codec module consumed by the tool loop, the chat route, and the client parser; honest failure-cause plumbing in the Travelpayouts client; per-model pricing and a shared spend-cap guard; stop-reason and tool-containment hardening in the tool loop; a destination guard in the system prompt; and hygiene fixes (test fixtures, help content).

**Tech Stack:** Next.js 15 / TypeScript, `@anthropic-ai/sdk` ^0.80.0, `better-sqlite3`, Vitest.

## Global Constraints

- Work in the worktree `/home/jarvis/.openclaw/workspace/jarvis-project/tpi-fix-atlas-review` on branch `fix/atlas-review-findings`. All paths below are relative to that root.
- **Test command:** `npm run test` runs unit + e2e. For a single file ALWAYS use `npm run test:unit -- <path>` (the `test:unit` script is `vitest run`). NEVER `npm run test -- <path>` — the extra arg is forwarded to the e2e runner.
- **Dependencies:** if `node_modules` is absent in the worktree, run `npm ci` once before any test step.
- **E2E:** the Playwright suite expects a server already running at `http://localhost:3001` — executors never run `npm run test` or `npm run test:e2e`; the branch gate for executors is `npm run lint && npm run test:unit && npm run build` (Task 14). E2E runs in the main session's live-smoke phase.
- Model id stays exactly `claude-sonnet-5`; `thinking: { type: "disabled" }` on every `messages.create`; never pass `temperature`/`top_p`/`top_k`.
- SSE contract: `data: `-prefixed lines, events terminated by a blank line, `data: [TOOL:name]{json}` for tool results, `data: [DONE]` to end, `data: {"error": "..."}` for errors. Task 1 extends the contract to SSE-spec multi-line data events; all other frame types remain single-line and byte-identical.
- TDD: write the failing test first, watch it fail, implement, watch it pass, commit. One commit per task.
- Do not touch: `command-post/` Python code, article content, locale/SEO code, anything not named in a task.

---

### Task 1: SSE codec module

**Files:**
- Create: `src/lib/atlas/sse.ts`
- Test: `src/lib/atlas/sse.test.ts`

**Interfaces:**
- Produces: `encodeSseData(payload: string): string` — encodes any string (including embedded `\n`) as one SSE event: every line of the payload prefixed `data: `, event terminated by a blank line. Single-line payloads produce exactly the legacy `data: <payload>\n\n` bytes.
- Produces: `decodeSseData(frame: string): string | null` — inverse: given one event (with or without its trailing `\n\n`), joins all `data: `-prefixed lines with `\n`; returns `null` if the event has no `data: ` line.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/atlas/sse.test.ts
import { describe, it, expect } from "vitest";
import { encodeSseData, decodeSseData } from "./sse";

describe("SSE codec", () => {
  it("encodes a single-line payload exactly like the legacy frame format", () => {
    expect(encodeSseData("hello")).toBe("data: hello\n\n");
    expect(encodeSseData("[DONE]")).toBe("data: [DONE]\n\n");
  });

  it("encodes embedded newlines as one data: line per payload line", () => {
    expect(encodeSseData("a\n\nb")).toBe("data: a\ndata: \ndata: b\n\n");
  });

  it("round-trips payloads containing newlines", () => {
    for (const payload of ["word", " leading space", "a\nb", "a\n\nb", "trailing\n", "\nleading", ""]) {
      expect(decodeSseData(encodeSseData(payload))).toBe(payload);
    }
  });

  it("decodes an event whether or not the trailing blank line is present", () => {
    expect(decodeSseData("data: a\ndata: b")).toBe("a\nb");
    expect(decodeSseData("data: a\ndata: b\n\n")).toBe("a\nb");
  });

  it("returns null for an event with no data lines", () => {
    expect(decodeSseData(": comment only")).toBeNull();
    expect(decodeSseData("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/atlas/sse.test.ts`
Expected: FAIL — module `./sse` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/atlas/sse.ts
// Shared SSE data-frame codec. Payloads may contain newlines: per the SSE
// spec each payload line gets its own `data: ` prefix and the receiver joins
// them with "\n". Single-line payloads encode byte-identically to the legacy
// `data: <payload>\n\n` format, so [TOOL:]/[DONE]/error frames are unchanged.

export function encodeSseData(payload: string): string {
  return payload.split("\n").map((line) => `data: ${line}`).join("\n") + "\n\n";
}

export function decodeSseData(frame: string): string | null {
  const dataLines = frame.split("\n").filter((line) => line.startsWith("data: "));
  if (dataLines.length === 0) return null;
  return dataLines.map((line) => line.slice(6)).join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/atlas/sse.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/sse.ts src/lib/atlas/sse.test.ts
git commit -m "feat(atlas): add SSE multi-line data codec"
```

---

### Task 2: Wire the codec — tool loop, chat route, client parser (F1)

**Files:**
- Modify: `src/lib/atlas/tool-loop.ts` (the final-text yield loop, currently `const token = i === 0 ? words[i] : \` ${words[i]}\`; yield \`data: ${token}\n\n\`;`)
- Modify: `src/app/api/assistant/chat/route.ts` (the accumulator inside `for await (const frame of atlasFrames)`)
- Modify: `src/components/AssistantChat.tsx` (the frame parser around lines 784-786)
- Test: `src/lib/atlas/tool-loop.test.ts` (add one test)

**Interfaces:**
- Consumes: `encodeSseData`/`decodeSseData` from Task 1 (`@/lib/atlas/sse` — the module has zero dependencies and is safe to import from the client component).
- Produces: token frames that carry embedded newlines losslessly; `[TOOL:]`, `[DONE]`, and error frames unchanged.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/atlas/tool-loop.test.ts` inside the existing `describe("runAtlasTurn", ...)`:

```typescript
  it("carries newlines in model text losslessly via multi-line SSE events", async () => {
    createMock.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "First paragraph.\n\nSecond line" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const frames = await collect(runAtlasTurn({ message: "hi", history: [] }));
    // Every non-empty line of every frame must be `data: `-prefixed (valid SSE).
    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (line !== "") expect(line.startsWith("data: ")).toBe(true);
      }
    }
    // Decoding and concatenating the token frames must reproduce the text exactly.
    const { decodeSseData } = await import("./sse");
    const text = frames
      .slice(0, -1) // drop [DONE]
      .map((f) => decodeSseData(f))
      .filter((d): d is string => d !== null)
      .join("");
    expect(text).toBe("First paragraph.\n\nSecond line");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/atlas/tool-loop.test.ts`
Expected: FAIL — the frame `data: paragraph.\n\nSecond\n\n` contains the raw line `Second` without a `data: ` prefix.

- [ ] **Step 3: Implement**

In `src/lib/atlas/tool-loop.ts`:

1. Add the import at the top: `import { encodeSseData } from "./sse";`
2. In the final-text loop, replace

```typescript
          const token = i === 0 ? words[i] : ` ${words[i]}`;
          yield `data: ${token}\n\n`;
```

with

```typescript
          const token = i === 0 ? words[i] : ` ${words[i]}`;
          yield encodeSseData(token);
```

In `src/app/api/assistant/chat/route.ts`:

1. Add the import: `import { decodeSseData } from "@/lib/atlas/sse";`
2. Replace the accumulator body

```typescript
          if (!frame.startsWith("data: ")) continue;
          const data = frame.slice(6).trimEnd();
```

with

```typescript
          const data = decodeSseData(frame);
          if (data === null) continue;
```

(the `data !== "[DONE]"` / `[TOOL:` / `{"error"` filter below it is unchanged — persisted text now matches the client render exactly, including whitespace).

In `src/components/AssistantChat.tsx`:

1. Add the import: `import { decodeSseData } from "@/lib/atlas/sse";`
2. Replace

```typescript
          for (const frame of frames) {
            if (!frame.startsWith("data: ")) continue;
            const data = frame.slice(6);
```

with

```typescript
          for (const frame of frames) {
            const data = decodeSseData(frame);
            if (data === null) continue;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/lib/atlas/tool-loop.test.ts src/lib/atlas/sse.test.ts`
Expected: PASS (all, including the new test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/tool-loop.ts src/app/api/assistant/chat/route.ts src/components/AssistantChat.tsx src/lib/atlas/tool-loop.test.ts
git commit -m "fix(atlas): carry newlines losslessly through the SSE stream (F1)"
```

---

### Task 3: Honest failure causes in the Travelpayouts client (F2 + limiter attempt-counting)

**Files:**
- Modify: `src/lib/atlas/travelpayouts-client.ts` (`tpGet`, `rawItems`, `rawSearchFlights`, `searchFlights`, `getDeals`, `getPopularRoutes`)
- Modify: `src/lib/atlas/system-prompt.ts` (one added rule line)
- Test: `src/lib/atlas/travelpayouts-client.test.ts`, `src/lib/atlas/system-prompt.test.ts`

**Interfaces:**
- Produces (internal): `type TpFailure = "no_token" | "rate_limited" | "http_error" | "timeout"`; `tpGet(path, params): Promise<{ data: TpResponse } | { failure: TpFailure }>`; `FAILURE_REASONS: Record<TpFailure, string>`.
- Behavior later tasks rely on: `searchFlights`/`getDeals`/`getPopularRoutes` still return the same success / `no_data: true` shapes — only the `reason` string now distinguishes "search could not run" from "genuinely empty".

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/atlas/travelpayouts-client.test.ts` (top-level, alongside the existing describes; the existing `beforeEach` stubs `TRAVELPAYOUTS_TOKEN`):

```typescript
describe("failure-cause reporting", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
  });

  // NOTE: each test below uses a route no other test in this file touches —
  // tpGet's module-level 5-minute cache persists across tests, and reusing a
  // route another test has already cached would mask the failure path.
  it("reports 'not configured' — never 'no flights' — when the token is missing", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", ""); // don't depend on the host env being unset
    const { searchFlights } = await import("./travelpayouts-client");
    const result = await searchFlights("BOS", "SEA", "2026-09-01");
    expect(result).toMatchObject({ flights: [], no_data: true });
    expect((result as { reason: string }).reason).toMatch(/not configured/i);
    expect((result as { reason: string }).reason).not.toMatch(/no flights for this route/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a temporary-unavailability reason on network failure, not an empty-route reason", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "fake-token");
    fetchMock.mockRejectedValue(new Error("network down"));
    const { getDeals } = await import("./travelpayouts-client");
    const result = await getDeals("DEN");
    expect(result).toMatchObject({ deals: [], no_data: true });
    expect((result as { reason: string }).reason).toMatch(/timed out|unavailable/i);
  });

  it("keeps the honest empty-result reason when the API succeeds with no data", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "fake-token");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
    const { searchFlights } = await import("./travelpayouts-client");
    const result = await searchFlights("PHX", "BNA", "2026-09-01");
    expect((result as { reason: string }).reason).toMatch(/no flights for this route/i);
  });
});
```

Add to `src/lib/atlas/system-prompt.test.ts`:

```typescript
  it("instructs Atlas to distinguish 'search could not run' from 'no flights exist'", () => {
    const prompt = buildAtlasSystemPrompt({});
    expect(prompt).toMatch(/temporarily unavailable/i);
    expect(prompt).toMatch(/does not mean there are no flights/i);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/lib/atlas/travelpayouts-client.test.ts src/lib/atlas/system-prompt.test.ts`
Expected: FAIL — reasons don't distinguish causes; prompt line missing. (Pre-existing tests must still pass.)

- [ ] **Step 3: Implement in `src/lib/atlas/travelpayouts-client.ts`**

Add near the other type declarations:

```typescript
type TpFailure = "no_token" | "rate_limited" | "http_error" | "timeout";
type TpResult = { data: TpResponse } | { failure: TpFailure };

const FAILURE_REASONS: Record<TpFailure, string> = {
  no_token:
    "Live flight search is not configured (missing Travelpayouts token). The search could not run — this does NOT mean no flights exist.",
  rate_limited:
    "Live flight search is temporarily rate-limited. The search could not run — this does NOT mean no flights exist. Try again shortly.",
  http_error:
    "The flight data service returned an error. The search could not run — this does NOT mean no flights exist.",
  timeout:
    "The flight data service timed out. The search could not run — this does NOT mean no flights exist.",
};

let warnedNoToken = false;
```

Replace the whole `tpGet` function with:

```typescript
async function tpGet(path: string, params: Record<string, string | number>): Promise<TpResult> {
  const key = cacheKey(path, params);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { data: cached.data };
  if (cached) cache.delete(key);

  const token = process.env.TRAVELPAYOUTS_TOKEN?.trim();
  if (!token) {
    if (!warnedNoToken) {
      warnedNoToken = true;
      console.error("TRAVELPAYOUTS_TOKEN is not set — Atlas flight/deal tools cannot run.");
    }
    return { failure: "no_token" };
  }

  if (!checkRateLimit()) return { failure: "rate_limited" };
  // Count the attempt BEFORE the fetch so concurrent bursts and failed
  // requests both consume the window (the old success-only counting made the
  // limiter inert exactly when TP was rejecting).
  requestTimestamps.push(Date.now());

  const url = new URL(path, BASE_URL);
  url.search = sortedParams(params).toString();

  try {
    const response = await fetch(url, {
      headers: { "X-Access-Token": token },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return { failure: "http_error" };
    const data = (await response.json()) as TpResponse;
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return { data };
  } catch {
    return { failure: "timeout" };
  }
}
```

Replace `rawItems` with a version that takes the raw response (callers now unwrap failures first):

```typescript
function rawItems(data: TpResponse): TpFlightItem[] {
  if (!data?.success || !Array.isArray(data.data)) return [];
  return data.data as TpFlightItem[];
}
```

Replace `rawSearchFlights` so failures propagate:

```typescript
async function rawSearchFlights(
  origin: string,
  destination: string,
  departDate: string,
  returnDate?: string
): Promise<{ flights: FlightOption[]; failure?: TpFailure }> {
  const params: Record<string, string | number> = {
    origin,
    destination,
    departure_at: departDate,
    sorting: "price",
    currency: "usd",
    limit: 10,
  };
  if (returnDate) params.return_at = returnDate;

  const first = await tpGet("/aviasales/v3/prices_for_dates", params);
  if ("failure" in first) return { flights: [], failure: first.failure };
  let items = rawItems(first.data);
  if (items.length > 0)
    return { flights: normalizeFlights(items, origin, destination, departDate, returnDate) };

  if (departDate.length === 10) {
    params.departure_at = departDate.slice(0, 7);
    if (returnDate && returnDate.length === 10) params.return_at = returnDate.slice(0, 7);
    const second = await tpGet("/aviasales/v3/prices_for_dates", params);
    if ("failure" in second) return { flights: [], failure: second.failure };
    items = rawItems(second.data);
    if (items.length > 0)
      return { flights: normalizeFlights(items, origin, destination, departDate, returnDate) };
  }

  return { flights: [] };
}
```

In `searchFlights`, the fan-out block currently maps each pair through `rawSearchFlights` with `catch { return []; }`. Replace that block and the empty-result branch:

```typescript
  const failures: TpFailure[] = [];
  const results = await Promise.all(
    airportsToSearch.flatMap((airport) =>
      destinationsToSearch.map(async (dest) => {
        try {
          const r = await rawSearchFlights(airport, dest, effectiveDepartDate, effectiveReturnDate);
          if (r.failure) failures.push(r.failure);
          return r.flights;
        } catch {
          return [];
        }
      })
    )
  );
```

and in the `if (flights.length === 0)` branch replace the hardcoded reason with:

```typescript
      reason: failures.length > 0
        ? FAILURE_REASONS[
            (["no_token", "rate_limited", "timeout", "http_error"] as TpFailure[]).find((f) =>
              failures.includes(f)
            ) ?? failures[0]
          ]
        : "TP API returned no flights for this route and date range (specific-date + month fallback both empty)",
```

In `getDeals`, replace the fetch + empty check:

```typescript
  const result = await tpGet("/aviasales/v3/prices_for_dates", params);
  if ("failure" in result) {
    return { deals: [], no_data: true, reason: FAILURE_REASONS[result.failure] };
  }
  const items = rawItems(result.data);
  if (items.length === 0) {
    return { deals: [], no_data: true, reason: "TP API returned no deals for this origin" };
  }
```

In `getPopularRoutes`, same pattern:

```typescript
  const result = await tpGet("/aviasales/v3/prices_for_dates", params);
  if ("failure" in result) {
    return { suggestions: [], no_data: true, reason: FAILURE_REASONS[result.failure] };
  }
  const items = rawItems(result.data);
  if (items.length === 0) {
    return { suggestions: [], no_data: true, reason: "TP API returned no popular routes for this origin" };
  }
```

In `src/lib/atlas/system-prompt.ts`, in the `Rules:` block, directly after the existing line that begins `- If a flight or deals tool returns \`no_data: true\``, add:

```
- If the no_data reason says the search could not run (not configured, rate-limited, unavailable, or timed out), tell the user live flight data is temporarily unavailable right now and that this does not mean there are no flights — suggest trying again later. Never present a failed search as "no flights exist".
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/lib/atlas/travelpayouts-client.test.ts src/lib/atlas/system-prompt.test.ts`
Expected: PASS (all new + all pre-existing)

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/travelpayouts-client.ts src/lib/atlas/system-prompt.ts src/lib/atlas/travelpayouts-client.test.ts src/lib/atlas/system-prompt.test.ts
git commit -m "fix(atlas): distinguish TP failure causes from empty results; count limiter attempts pre-fetch (F2/F6)"
```

---

### Task 4: Fan-out reverted to origin-side only (F6)

**Files:**
- Modify: `src/lib/atlas/travelpayouts-client.ts` (`searchFlights`)
- Test: `src/lib/atlas/travelpayouts-client.test.ts`

**Interfaces:**
- Consumes: Task 3's `rawSearchFlights` shape.
- Produces: `searchFlights` result field `destinations_searched` becomes `[<destination>]` only.

- [ ] **Step 1: Write the failing test**

```typescript
describe("fan-out bounds", () => {
  it("fans out over origin-side nearby airports only (Python parity)", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "fake-token");
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
    const { searchFlights } = await import("./travelpayouts-client");
    // MIA has 2 nearby origins (FLL, PBI); LAX has 3 nearby (SNA, BUR, LGB) that must NOT be queried.
    await searchFlights("MIA", "LAX", "2026-09-01");
    // 3 origins x 1 destination x 2 attempts (specific date + month fallback) = 6, not 24.
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/atlas/travelpayouts-client.test.ts`
Expected: FAIL — 24 calls observed.

- [ ] **Step 3: Implement**

In `searchFlights`, replace

```typescript
  const destinationsToSearch = airportsWithNearby(cleanDestination);
```

with

```typescript
  // Origin-side fan-out only (matches the Python original): expanding the
  // destination multiplied TP calls 4x and could exhaust the 200/hr budget.
  const destinationsToSearch = [cleanDestination];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/lib/atlas/travelpayouts-client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/travelpayouts-client.ts src/lib/atlas/travelpayouts-client.test.ts
git commit -m "fix(atlas): fan out flight search over origin-side airports only (F6)"
```

---

### Task 5: Strict IATA validation — no truncation (F7)

**Files:**
- Modify: `src/lib/atlas/travelpayouts-client.ts`
- Test: `src/lib/atlas/travelpayouts-client.test.ts`

**Interfaces:**
- Produces: `parseIata(value: string): string | null` (exported) — trim + uppercase; returns the code only if the WHOLE cleaned value is exactly 3 letters, else `null`. Tasks 6-7 use it for new params. `cleanIata` stays private for formatting TP-returned codes and link building only.

- [ ] **Step 1: Write the failing tests**

```typescript
describe("parseIata / invalid-code handling", () => {
  beforeEach(() => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "fake-token");
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
  });

  it("rejects city names instead of truncating them to a wrong airport", async () => {
    const { searchFlights } = await import("./travelpayouts-client");
    const result = await searchFlights("MIA", "Cancun", "2026-09-01");
    expect(result).toMatchObject({ flights: [], no_data: true });
    expect((result as { reason: string }).reason).toMatch(/3-letter/i);
    expect(fetchMock).not.toHaveBeenCalled(); // never queried Guangzhou (CAN)
  });

  it("accepts valid codes case-insensitively with whitespace", async () => {
    const { parseIata } = await import("./travelpayouts-client");
    expect(parseIata(" cun ")).toBe("CUN");
    expect(parseIata("CANCUN")).toBeNull();
    expect(parseIata("mi'a")).toBeNull();
    expect(parseIata("")).toBeNull();
  });

  it("still defaults an EMPTY origin to MIA but rejects an invalid one", async () => {
    const { getDeals } = await import("./travelpayouts-client");
    const empty = await getDeals("");
    // MIA may be served from the module-level tpGet cache (another test in
    // this file queries getDeals("MIA")), so assert on shape, not fetch
    // count: an empty origin must NOT be rejected as invalid.
    expect(((empty as { reason?: string }).reason ?? "")).not.toMatch(/3-letter/i);
    fetchMock.mockClear();
    const bad = await getDeals("Miami Beach");
    expect(bad).toMatchObject({ deals: [], no_data: true });
    expect((bad as { reason: string }).reason).toMatch(/3-letter/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/lib/atlas/travelpayouts-client.test.ts`
Expected: FAIL — `parseIata` not exported; 'Cancun' currently truncates to CAN and queries.

- [ ] **Step 3: Implement**

Add next to `cleanIata` (keep `cleanIata` — it still formats TP-returned codes in `getDeals`/`getPopularRoutes` mapping and sanitizes link parts in `buildAviasalesLink`):

```typescript
export function parseIata(value: string): string | null {
  const cleaned = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(cleaned) ? cleaned : null;
}

const INVALID_IATA_REASON =
  "origin and destination must be 3-letter IATA airport codes (e.g. CUN for Cancún, MIA for Miami) — pass the airport code, not a city name.";
```

In `searchFlights`, replace

```typescript
  const cleanOrigin = cleanIata(origin || "MIA") || "MIA";
  const cleanDestination = cleanIata(destination);
  if (!cleanDestination) {
```

with

```typescript
  const cleanOrigin = origin?.trim() ? parseIata(origin) : "MIA";
  const cleanDestination = destination?.trim() ? parseIata(destination) : null;
  if (!cleanOrigin || !cleanDestination) {
```

and in that early-return object change `reason: "destination is required"` to `reason: INVALID_IATA_REASON`, `origin: cleanOrigin ?? ""`, `destination: cleanDestination ?? ""`, `airports_searched: cleanOrigin ? [cleanOrigin] : []`.

In `getDeals` and `getPopularRoutes`, replace

```typescript
  const cleanOrigin = cleanIata(origin || "MIA") || "MIA";
```

with (deals version shown; popular-routes version returns `suggestions: []` instead of `deals: []`):

```typescript
  const cleanOrigin = origin?.trim() ? parseIata(origin) : "MIA";
  if (!cleanOrigin) {
    return { deals: [], no_data: true, reason: INVALID_IATA_REASON };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/lib/atlas/travelpayouts-client.test.ts`
Expected: PASS (all — the pre-existing `buildAviasalesLink` sanitization test is untouched).

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/travelpayouts-client.ts src/lib/atlas/travelpayouts-client.test.ts
git commit -m "fix(atlas): reject invalid IATA codes instead of truncating to wrong airports (F7)"
```

---

### Task 6: Restore get_deals destination filter (F8)

**Files:**
- Modify: `src/lib/atlas/travelpayouts-client.ts` (`getDeals` signature)
- Modify: `src/lib/atlas/tool-loop.ts` (tool schema + `executeTool`)
- Test: `src/lib/atlas/travelpayouts-client.test.ts`

**Interfaces:**
- Consumes: `parseIata` from Task 5.
- Produces: `getDeals(origin: string, destination?: string)` — when destination is a valid code, the TP request includes `destination=<CODE>`; invalid destination → `no_data` with the INVALID_IATA_REASON; absent → unfiltered (today's behavior). Tool schema gains optional `destination`.

- [ ] **Step 1: Write the failing test**

```typescript
  it("passes a validated destination filter through to the TP request", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "fake-token");
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
    const { getDeals } = await import("./travelpayouts-client");
    await getDeals("MIA", "cun");
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toContain("destination=CUN");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/atlas/travelpayouts-client.test.ts`
Expected: FAIL — `getDeals` takes one argument; no destination param sent.

- [ ] **Step 3: Implement**

`getDeals` signature and params:

```typescript
export async function getDeals(
  origin: string,
  destination?: string
): Promise<{ deals: DealCardOption[] } | { deals: []; no_data: true; reason: string }> {
```

after the origin validation block from Task 5, add:

```typescript
  let cleanDestination: string | undefined;
  if (destination?.trim()) {
    const parsed = parseIata(destination);
    if (!parsed) return { deals: [], no_data: true, reason: INVALID_IATA_REASON };
    cleanDestination = parsed;
  }
```

and in the `params` object add:

```typescript
    ...(cleanDestination ? { destination: cleanDestination } : {}),
```

In `src/lib/atlas/tool-loop.ts`, the `get_deals` tool schema becomes:

```typescript
  {
    name: "get_deals",
    description: "Get current cheap flight deals from an origin airport, optionally filtered to a destination.",
    input_schema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Origin airport IATA code" },
        destination: { type: "string", description: "Destination airport IATA code — include it when the user asks about deals to a specific place" },
      },
      required: ["origin"],
    },
  },
```

and in `executeTool`:

```typescript
    case "get_deals":
      return getDeals(stringInput(input, "origin"), stringInput(input, "destination") || undefined);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/lib/atlas/travelpayouts-client.test.ts src/lib/atlas/tool-loop.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/travelpayouts-client.ts src/lib/atlas/tool-loop.ts src/lib/atlas/travelpayouts-client.test.ts
git commit -m "fix(atlas): restore destination filter on get_deals (F8)"
```

---

### Task 7: surprise_me month + round-trip pricing defaults (F13)

**Files:**
- Modify: `src/lib/atlas/travelpayouts-client.ts` (`getPopularRoutes`)
- Test: `src/lib/atlas/travelpayouts-client.test.ts`

**Interfaces:**
- Produces: `getPopularRoutes` queries TP with `departure_at=<next calendar month, YYYY-MM UTC>`, `return_at=<same month>`, `limit: 5` (was 100). Return shape unchanged.

- [ ] **Step 1: Write the failing test**

```typescript
  it("queries popular routes for next month, round-trip priced, limit 5", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "fake-token");
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
    const { getPopularRoutes } = await import("./travelpayouts-client");
    await getPopularRoutes("MIA");
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toMatch(/departure_at=\d{4}-\d{2}(?!-)/);
    expect(requestedUrl).toMatch(/return_at=\d{4}-\d{2}(?!-)/);
    expect(requestedUrl).toContain("limit=5");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/atlas/travelpayouts-client.test.ts`
Expected: FAIL — no departure_at/return_at; limit=100.

- [ ] **Step 3: Implement**

Add a helper next to `formatDateOffset`:

```typescript
function nextMonthUtc(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 7);
}
```

In `getPopularRoutes`, replace the `params` object with:

```typescript
  const month = nextMonthUtc();
  const params = {
    origin: cleanOrigin,
    departure_at: month,
    return_at: month, // round-trip pricing, matching the Python original
    sorting: "price",
    currency: "usd",
    limit: 5, // server sorts by price; we only ever used the first 5 of 100
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/lib/atlas/travelpayouts-client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/travelpayouts-client.ts src/lib/atlas/travelpayouts-client.test.ts
git commit -m "fix(atlas): surprise_me prices next-month round trips like the Python original (F13)"
```

---

### Task 8: Per-model pricing + shared spend-cap guard (F9, F10)

**Files:**
- Modify: `src/lib/atlas/spend.ts`
- Modify: `src/lib/atlas/tool-loop.ts` (cap check)
- Modify: `src/app/api/assistant/summarize/route.ts` (cap gate)
- Test: `src/lib/atlas/spend.test.ts`, `src/lib/atlas/tool-loop.test.ts` (mock update)

**Interfaces:**
- Produces: `MODEL_PRICES_PER_MTOK: Record<string, {input: number; output: number}>`; `isSpendCapReached(): boolean` (exported from `spend.ts`). `SONNET5_PRICE_PER_MTOK` is REMOVED — anything importing it must switch to `MODEL_PRICES_PER_MTOK["claude-sonnet-5"]`.
- Consumers: `tool-loop.ts` replaces its `getAssistantMonthlySpendUsd() >= ASSISTANT_SPEND_CAP_USD` check with `isSpendCapReached()`; summarize route gates on it before calling Anthropic.

- [ ] **Step 1: Write the failing tests**

In `src/lib/atlas/spend.test.ts`, add inside the existing describe (the in-memory DB `beforeEach` already exists):

```typescript
  it("prices claude-sonnet-4-6 at its own rate, not Sonnet 5's", () => {
    recordAssistantSpend("claude-sonnet-4-6", { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    // $3/MTok in + $15/MTok out = $18.00
    expect(getAssistantMonthlySpendUsd()).toBeCloseTo(18.0, 5);
  });

  it("prices unknown models at the most expensive known rate and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    recordAssistantSpend("claude-future-9", { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(getAssistantMonthlySpendUsd()).toBeCloseTo(18.0, 5);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("exposes isSpendCapReached against the cap constant", () => {
    expect(isSpendCapReached()).toBe(false);
    recordAssistantSpend("claude-sonnet-5", { inputTokens: 0, outputTokens: 1_100_000 }); // $11 > $10
    expect(isSpendCapReached()).toBe(true);
  });
```

and extend the import line to include `isSpendCapReached`. If an existing test imports/asserts `SONNET5_PRICE_PER_MTOK`, update it to read `MODEL_PRICES_PER_MTOK["claude-sonnet-5"]`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/lib/atlas/spend.test.ts`
Expected: FAIL — `isSpendCapReached` not exported; sonnet-4-6 priced at $12.

- [ ] **Step 3: Implement**

`src/lib/atlas/spend.ts` — replace the pricing constants and `recordAssistantSpend`'s usd computation:

```typescript
// Introductory Sonnet 5 pricing through 2026-08-31. After that date update
// claude-sonnet-5 to { input: 3.0, output: 15.0 }.
export const MODEL_PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2.0, output: 10.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
};

function priceFor(model: string): { input: number; output: number } {
  const known = MODEL_PRICES_PER_MTOK[model];
  if (known) return known;
  console.warn(
    `recordAssistantSpend: unknown model "${model}" — pricing at the most expensive known rate.`
  );
  return Object.values(MODEL_PRICES_PER_MTOK).reduce((max, p) =>
    p.input + p.output > max.input + max.output ? p : max
  );
}
```

in `recordAssistantSpend`:

```typescript
  const price = priceFor(model);
  const usd =
    (usage.inputTokens / 1_000_000) * price.input +
    (usage.outputTokens / 1_000_000) * price.output;
```

and add at the bottom:

```typescript
export function isSpendCapReached(): boolean {
  return getAssistantMonthlySpendUsd() >= ASSISTANT_SPEND_CAP_USD;
}
```

`src/lib/atlas/tool-loop.ts` — change the spend import to `import { isSpendCapReached, recordAssistantSpend } from "./spend";` and replace

```typescript
    if (getAssistantMonthlySpendUsd() >= ASSISTANT_SPEND_CAP_USD) {
```

with

```typescript
    if (isSpendCapReached()) {
```

`src/lib/atlas/tool-loop.test.ts` — the `vi.mock("./spend", ...)` factory must now stub the guard the loop actually calls:

```typescript
vi.mock("./spend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./spend")>();
  return { ...actual, isSpendCapReached: vi.fn(() => false), recordAssistantSpend: vi.fn() };
});
```

update the imports/usages: `import { isSpendCapReached, recordAssistantSpend } from "./spend";`, in `beforeEach` replace `vi.mocked(getAssistantMonthlySpendUsd).mockReturnValue(0)` with `vi.mocked(isSpendCapReached).mockReturnValue(false)`, and in the cap-exceeded test set `vi.mocked(isSpendCapReached).mockReturnValue(true)`.

`src/app/api/assistant/summarize/route.ts` — add `import { isSpendCapReached } from "@/lib/atlas/spend";` (extend the existing `@/lib/atlas/spend` import) and insert immediately after the `if (messages.length < 6) {...}` block:

```typescript
  // Respect the shared monthly assistant spend cap — summarization is a
  // nice-to-have and must not keep spending after chat has been capped.
  if (isSpendCapReached()) {
    return NextResponse.json({
      ok: true,
      memories_saved: 0,
      skipped: "spend_cap",
      message: "Monthly assistant spend cap reached — summarization skipped",
    });
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/lib/atlas/spend.test.ts src/lib/atlas/tool-loop.test.ts`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/spend.ts src/lib/atlas/tool-loop.ts src/lib/atlas/tool-loop.test.ts src/app/api/assistant/summarize/route.ts src/lib/atlas/spend.test.ts
git commit -m "fix(atlas): per-model pricing table and cap gate at every Anthropic call site (F9/F10)"
```

---

### Task 9: History window must start with a user turn (F4)

**Files:**
- Create: `src/lib/atlas/history.ts`
- Modify: `src/app/api/assistant/chat/route.ts`
- Test: `src/lib/atlas/history.test.ts`

**Interfaces:**
- Produces: `trimHistoryToUserStart(history: MessageParam[]): MessageParam[]` — drops leading messages until the first `role === "user"`; empty array if none.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/atlas/history.test.ts
import { describe, it, expect } from "vitest";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { trimHistoryToUserStart } from "./history";

describe("trimHistoryToUserStart", () => {
  it("drops a leading assistant message (LIMIT-20 window artifact)", () => {
    const history: MessageParam[] = [
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2" },
    ];
    expect(trimHistoryToUserStart(history)).toEqual([
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2" },
    ]);
  });

  it("returns user-led history unchanged", () => {
    const history: MessageParam[] = [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
    ];
    expect(trimHistoryToUserStart(history)).toEqual(history);
  });

  it("returns [] when no user message exists", () => {
    expect(trimHistoryToUserStart([{ role: "assistant", content: "a1" }])).toEqual([]);
    expect(trimHistoryToUserStart([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/atlas/history.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```typescript
// src/lib/atlas/history.ts
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

// The Anthropic Messages API requires the first message to be role "user".
// The chat route's ORDER BY id DESC LIMIT 20 window can start on an
// assistant row once a session exceeds ~10 exchanges — trim to the first
// user turn so the request never 400s.
export function trimHistoryToUserStart(history: MessageParam[]): MessageParam[] {
  const firstUser = history.findIndex((m) => m.role === "user");
  return firstUser === -1 ? [] : history.slice(firstUser);
}
```

In `src/app/api/assistant/chat/route.ts`, add `import { trimHistoryToUserStart } from "@/lib/atlas/history";` and replace

```typescript
  const historyWithoutCurrent = conversationHistory.slice(0, -1) as MessageParam[];
```

with

```typescript
  const historyWithoutCurrent = trimHistoryToUserStart(
    conversationHistory.slice(0, -1) as MessageParam[]
  );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/lib/atlas/history.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/history.ts src/lib/atlas/history.test.ts src/app/api/assistant/chat/route.ts
git commit -m "fix(atlas): trim history window to start on a user turn (F4)"
```

---

### Task 10: Handle refusal / max_tokens stop reasons (F5)

**Files:**
- Modify: `src/lib/atlas/tool-loop.ts`
- Test: `src/lib/atlas/tool-loop.test.ts`

**Interfaces:**
- Produces: on `stop_reason === "refusal"` or a final response with no non-empty text blocks → `data: {"error": "Atlas can't help with that request. Try rephrasing or asking something else."}` then `[DONE]`. On `stop_reason === "max_tokens"` with an unexecuted tool_use block → streamed text (if any) followed by `data: {"error": "Atlas's reply was cut short. Please try again."}` then `[DONE]`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/atlas/tool-loop.test.ts`:

```typescript
  it("emits an error frame instead of a blank reply on refusal", async () => {
    createMock.mockResolvedValueOnce({
      stop_reason: "refusal",
      content: [],
      usage: { input_tokens: 10, output_tokens: 0 },
    });
    const frames = await collect(runAtlasTurn({ message: "hi", history: [] }));
    expect(frames.some((f) => f.includes('"error"'))).toBe(true);
    expect(frames.at(-1)).toBe("data: [DONE]\n\n");
  });

  it("surfaces a cut-short error when max_tokens truncates a pending tool call", async () => {
    createMock.mockResolvedValueOnce({
      stop_reason: "max_tokens",
      content: [
        { type: "text", text: "Let me check" },
        { type: "tool_use", id: "t1", name: "search_flights", input: {} },
      ],
      usage: { input_tokens: 10, output_tokens: 4096 },
    });
    const frames = await collect(runAtlasTurn({ message: "hi", history: [] }));
    const joined = frames.join("");
    // Words stream one per frame, so assert a single word — the phrase
    // "Let me check" is never contiguous in the joined frame bytes.
    expect(joined).toContain("check");
    expect(joined).toContain("cut short");
    expect(frames.at(-1)).toBe("data: [DONE]\n\n");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/lib/atlas/tool-loop.test.ts`
Expected: FAIL — refusal case yields only `[DONE]`; max_tokens case has no "cut short" frame.

- [ ] **Step 3: Implement**

In `src/lib/atlas/tool-loop.ts`, add constants next to `ERROR_FRAME`:

```typescript
const REFUSAL_FRAME =
  'data: {"error": "Atlas can\'t help with that request. Try rephrasing or asking something else."}\n\n';
const CUTOFF_FRAME =
  'data: {"error": "Atlas\'s reply was cut short. Please try again."}\n\n';
```

Then replace the final-text section. CAUTION — anchor precisely: there are two `for (const block of response.content) {` loops in `runAtlasTurn`; the one to replace is in the FINAL-TEXT path (its first body line is the unique `if (block.type !== "text" || !block.text) continue;`), NOT the tool_use branch, and NOT the spend-cap branch's `yield DONE_FRAME`. Replace from that `for` line through the `yield DONE_FRAME; return;` that follows it with:

```typescript
      const textBlocks = response.content.filter(
        (block): block is Extract<ContentBlock, { type: "text" }> =>
          block.type === "text" && Boolean(block.text)
      );

      if (
        response.stop_reason === "max_tokens" &&
        response.content.some(isToolUseBlock) &&
        textBlocks.length === 0
      ) {
        // Cut off while assembling a tool call, with nothing streamable —
        // "cut short" is the accurate message, not a refusal.
        yield CUTOFF_FRAME;
        yield DONE_FRAME;
        return;
      }

      if (response.stop_reason === "refusal" || textBlocks.length === 0) {
        yield REFUSAL_FRAME;
        yield DONE_FRAME;
        return;
      }

      for (const block of textBlocks) {
        const words = block.text.split(" ");
        for (let i = 0; i < words.length; i += 1) {
          const token = i === 0 ? words[i] : ` ${words[i]}`;
          yield encodeSseData(token);
          await sleep(10);
        }
      }

      if (response.stop_reason === "max_tokens" && response.content.some(isToolUseBlock)) {
        // The model was cut off while assembling a tool call that will never run.
        yield CUTOFF_FRAME;
      }

      yield DONE_FRAME;
      return;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/lib/atlas/tool-loop.test.ts`
Expected: PASS (all, including pre-existing)

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/tool-loop.ts src/lib/atlas/tool-loop.test.ts
git commit -m "fix(atlas): honest error frames for refusal and max_tokens cutoffs (F5)"
```

---

### Task 11: Stream tool-turn preamble text + tool containment (F11, F12)

**Files:**
- Modify: `src/lib/atlas/tool-loop.ts`
- Test: `src/lib/atlas/tool-loop.test.ts`

**Interfaces:**
- Produces: `streamTextAsTokens(text: string): AsyncGenerator<string>` (private helper — word-chunked, encoded, 10ms cadence) used by both the tool_use branch and the final-text path; `executeToolSafely(name, input)` (private) — 30s timeout + catch → `{ error: string, is_error: true }`.
- Behavior: preamble text in a tool_use response streams as ordinary token frames BEFORE the `[TOOL:]` frames (so the chat route accumulates it into the persisted transcript automatically); a throwing/hung tool no longer kills the turn.

- [ ] **Step 1: Write the failing tests**

```typescript
  it("streams preamble text that accompanies tool calls, before the tool frames", async () => {
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [
          { type: "text", text: "Checking live prices now." },
          { type: "tool_use", id: "t1", name: "surprise_me", input: { origin: "MIA" } },
        ],
        usage: { input_tokens: 10, output_tokens: 20 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Done." }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    const frames = await collect(runAtlasTurn({ message: "hi", history: [] }));
    const preambleIdx = frames.findIndex((f) => f.includes("Checking"));
    const toolIdx = frames.findIndex((f) => f.includes("[TOOL:surprise_me]"));
    expect(preambleIdx).toBeGreaterThanOrEqual(0);
    expect(toolIdx).toBeGreaterThan(preambleIdx);
  });

  it("contains a throwing tool as an is_error tool_result instead of killing the turn", async () => {
    const { getArticleTool } = await import("./tools/get-article");
    vi.mocked(getArticleTool).mockImplementationOnce(() => {
      throw new TypeError("boom");
    });
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "get_article", input: { query: "miami" } }],
        usage: { input_tokens: 10, output_tokens: 20 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Sorry, the guide lookup hiccuped." }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    const frames = await collect(runAtlasTurn({ message: "hi", history: [] }));
    const joined = frames.join("");
    expect(joined).toContain('"is_error":true');
    expect(joined).toContain("hiccuped"); // the turn survived and produced a final reply
    expect(joined).not.toContain("taking a nap"); // tool-loop's generic ERROR_FRAME never fired
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/lib/atlas/tool-loop.test.ts`
Expected: FAIL — preamble text never appears in frames; the thrown TypeError reaches the outer catch and yields the generic error frame.

- [ ] **Step 3: Implement**

In `src/lib/atlas/tool-loop.ts`:

1. Add the shared streaming helper (above `runAtlasTurn`), and a timeout constant:

```typescript
const TOOL_TIMEOUT_MS = 30_000;

async function* streamTextAsTokens(text: string): AsyncGenerator<string> {
  const words = text.split(" ");
  for (let i = 0; i < words.length; i += 1) {
    const token = i === 0 ? words[i] : ` ${words[i]}`;
    yield encodeSseData(token);
    await sleep(10);
  }
}

async function executeToolSafely(name: string, input: ToolInput): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`timed out after ${TOOL_TIMEOUT_MS / 1000}s`)),
        TOOL_TIMEOUT_MS
      );
    });
    return await Promise.race([executeTool(name, input), timeout]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Tool ${name} failed: ${message}`, is_error: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
```

2. In the tool_use branch, before building `toolResults`, stream the text blocks, and switch the executor call:

```typescript
      if (useTools && response.stop_reason === "tool_use") {
        // Stream any preamble text the model wrote alongside its tool calls —
        // it is part of the assistant's visible reply.
        for (const block of response.content) {
          if (block.type !== "text" || !block.text) continue;
          yield* streamTextAsTokens(block.text);
        }

        const toolResults: ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (!isToolUseBlock(block)) continue;
          const result = await executeToolSafely(block.name, block.input as ToolInput);
          yield `data: [TOOL:${block.name}]${JSON.stringify(result)}\n\n`;
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
            is_error: hasErrorFlag(result),
          });
        }
        // ... (currentMessages pushes and `continue` unchanged)
```

3. In the final-text path (Task 10's version), replace the inline word loop with the helper:

```typescript
      for (const block of textBlocks) {
        yield* streamTextAsTokens(block.text);
      }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/lib/atlas/tool-loop.test.ts`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/tool-loop.ts src/lib/atlas/tool-loop.test.ts
git commit -m "fix(atlas): stream tool-turn preamble text and contain tool errors (F11/F12)"
```

---

### Task 12: Surprise Me destination guard (F3)

**Files:**
- Modify: `src/lib/atlas/system-prompt.ts` (`extractDestination`)
- Test: `src/lib/atlas/system-prompt.test.ts`

**Interfaces:**
- Produces: `extractDestination` returns `null` for any candidate that is exactly "Surprise Me" (case-insensitive, trimmed), on every pattern — triggering the existing prose-only, no-partner-link degrade path.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/atlas/system-prompt.test.ts` (uses the exact string `AssistantChat.tsx` builds for surprise trips):

```typescript
  it("never emits partner links for a Surprise Me trip (safe degrade)", () => {
    const prompt = buildAtlasSystemPrompt({
      pageContext: "Trip planner.\n\nActive trip: Surprise Me, flexible to flexible, 2 adults, budget: mid",
    });
    expect(prompt).not.toContain("dpbolvw.net");
    expect(prompt).not.toMatch(/Search hotels in Surprise Me/i);
    expect(prompt).toContain("not identified from the page context");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/atlas/system-prompt.test.ts`
Expected: FAIL — prompt contains `[Search hotels in Surprise Me on Hotels.com](https://www.dpbolvw.net/...)`.

- [ ] **Step 3: Implement**

In `src/lib/atlas/system-prompt.ts`, replace the loop body of `extractDestination`:

```typescript
  for (const pattern of patterns) {
    const match = pageContext.match(pattern);
    const candidate = match?.[1] ? cleanupDestination(match[1]) : "";
    if (candidate && !/^surprise me$/i.test(candidate)) return candidate;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/lib/atlas/system-prompt.test.ts`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/system-prompt.ts src/lib/atlas/system-prompt.test.ts
git commit -m "fix(atlas): no partner links for Surprise Me trips (F3)"
```

---

### Task 13: Test fixtures + help content (F14, F15)

**Files:**
- Modify: `src/lib/atlas/env-preflight.test.ts` (lines 17 and 31), `src/lib/assistant-health.test.ts` (line 22)
- Modify: `src/lib/help-content.ts` (the "Adding items" and "Atlas chat" entries in `planner-itinerary`)

**Interfaces:** none — data-only changes.

- [ ] **Step 1: Replace the redaction artifacts**

In `src/lib/atlas/env-preflight.test.ts` and `src/lib/assistant-health.test.ts`, replace every occurrence of the literal string `«redacted:sk-…»` with `sk-ant-fake-key` (keep the surrounding quote style). Three occurrences total.

Verify none remain:

Run: `grep -rn "redacted:" src/ ; grep -rn "«" src/`
Expected: no output from either.

- [ ] **Step 2: Run the affected tests**

Run: `npm run test:unit -- src/lib/atlas/env-preflight.test.ts src/lib/assistant-health.test.ts`
Expected: PASS (all — the checks are truthiness-based).

- [ ] **Step 3: Update help content**

In `src/lib/help-content.ts`, in the `"planner-itinerary"` section:

Replace the `"Adding items"` entry's `text` with:

```
Click '+ Add Item' on any day to add flights, hotels, activities, dining, restaurants, or transportation. In the chat, Atlas searches live flights and deals for you. For hotels, dining, and activities, Atlas gives practical guidance — neighborhoods, price expectations, what to look for — plus a trusted partner search link, rather than inventing specific listings or prices.
```

Replace the `"Atlas chat"` entry's `text` with:

```
Ask Atlas anything about your trip — live flight searches, current deals, and TPI destination guides. For hotels, restaurants, and activities, Atlas shares honest guidance with a partner search link instead of made-up listings. Atlas knows what's already in your itinerary and suggests complementary ideas. If Atlas reaches its monthly usage limit, it pauses until next month and says so honestly.
```

Do not touch the other entries (the Trip Results Modal / auto-search entries describe a separate flow outside this change set).

- [ ] **Step 4: Lint/build sanity**

Run: `npm run lint`
Expected: clean (help-content is static data; no tests cover it).

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/env-preflight.test.ts src/lib/assistant-health.test.ts src/lib/help-content.ts
git commit -m "chore(atlas): clean redacted test fixtures; update help for D3 + spend cap (F14/F15)"
```

---

### Task 14: Full gate

**Files:** none (verification only)

- [ ] **Step 1: Full executor gate**

Run: `npm run lint && npm run test:unit && npm run build`
Expected: all green. (Do NOT run `npm run test` / `npm run test:e2e` — Playwright needs a live server on :3001 and runs in the main session's smoke phase.) If anything fails, stop and report the exact output — do not patch beyond this plan.

- [ ] **Step 2: Grep guards**

Run: `grep -rn "SONNET5_PRICE_PER_MTOK" src/ ; grep -rn "«" src/ ; grep -c "NEARBY_AIRPORTS_MAP" src/lib/atlas/travelpayouts-client.ts`
Expected: no `SONNET5_PRICE_PER_MTOK` references; no `«`; the airports-map grep prints exactly `2` (declaration + `airportsWithNearby` usage — its dedup is out of scope).

- [ ] **Step 3: Report**

Report the full-suite output verbatim to the orchestrator. Do NOT push or open a PR — branch completion is handled by the main session after Fable verification and the live smoke test.
