# Atlas Brain Relocation (Phase 2) Implementation Plan

> **For agentic workers:** This plan is executed by GPT-5.5 dispatched via the Hermes CLI (`hermes -z "<prompt>" -m gpt-5.5 --cli --yolo`), one task at a time, from a fresh context with no memory of any prior conversation. Read this entire file before starting. Do not skip verification steps. If a verification command fails, stop and report — do not guess a fix that isn't in this plan.

**Goal:** Move Atlas's brain (system prompt, tool loop, Travelpayouts calls, spend tracking) out of the workstation-only FastAPI service (`command-post/routers/assistant.py` + `command-post/tp_client.py`) and into this Next.js app, so Atlas works in production with the workstation off. Preserve the exact client-facing SSE contract (`data: [TOOL:name]{json}\n\n` frames) so `src/components/AssistantChat.tsx` needs zero changes. Enforce the $10/month spend cap in TPI's own SQLite database. Replace fabricated hotel/activity/restaurant inventory (D3) with honest partner-search handoffs.

**Architecture:** `POST /api/assistant/chat` stops proxying to FastAPI and instead calls the Anthropic Messages API directly, using a non-streaming-per-turn tool loop (mirrors the existing Python `_stream_anthropic()` shape) that manually chunks the final text response into SSE frames. Real-data tools (`search_flights`, `get_deals`, `surprise_me`, `get_article`) call Travelpayouts directly or the local article index. There is **no `search_hotels`/`search_activities`/`search_restaurants` tool** — under D3, Atlas is instructed via the system prompt to answer those requests in prose plus a real partner-search link, so the client's existing `TRIP_TOOLS` dead-code path (`AssistantChat.tsx:23`) simply never fires and needs no edit.

**Tech Stack:** `@anthropic-ai/sdk` (already a dependency, `^0.80.0`), `better-sqlite3` (already used via `src/lib/db.ts`), model `claude-sonnet-5`.

## Global Constraints

- Model ID is exactly `claude-sonnet-5` everywhere in this plan. Do not use `claude-sonnet-4-6` or any date-suffixed variant.
- Thinking is explicitly disabled: pass `thinking: { type: "disabled" }` on every `messages.create()` call. This is a tool-calling chat assistant, not a reasoning task — thinking would spend tokens against the $10/mo cap for no product benefit. (Sonnet 5 runs adaptive thinking by default if the field is omitted — it must be set explicitly.)
- Do not pass `temperature`, `top_p`, or `top_k` — Sonnet 5 rejects non-default sampling params with a 400.
- Use **non-streaming** `client.messages.create()` per tool-loop iteration, exactly mirroring the existing Python `_stream_anthropic()` approach in `command-post/routers/assistant.py:~600-750` (read that file directly, it is the source of truth for the loop shape). Do NOT use the SDK's real token-streaming (`client.messages.stream()`) for the model call itself — non-streaming gives one clean `response.usage` object per turn for exact spend accounting; real streaming would require accumulating partial usage across SSE deltas for no benefit here. After getting the final text response, chunk it word-by-word into `data: {token}\n\n` frames with a small delay, exactly like the Python version does.
- Preserve the SSE contract byte-for-byte: `data: [TOOL:name]{json}\n\n` for tool results, `data: {token}\n\n` for text tokens, `data: [DONE]\n\n` to end, `data: {"error": "..."}\n\n` for errors. Do not invent new frame types.
- D3 (no fabrication): `search_hotels`, `search_activities`, `search_restaurants` are **not** tool definitions in this codebase going forward. Never add them back as callable tools. The system prompt must instruct Atlas to answer those requests in prose plus a real link (see Task 4).
- D7 (partner links): use `CJ_LINKS.hotelsCity(city)` from `src/config/affiliates.ts` for hotel links, `TP_KLOOK.url(city)` for activity/tour links. There is no restaurant affiliate program configured — use a plain (non-affiliate) Google Maps search URL for restaurants: `https://www.google.com/maps/search/restaurants+in+${encodeURIComponent(city)}`.
- Spend cap stays $10.00/month — confirmed as `ASSISTANT_SPEND_CAP = 10.0` at `command-post/routers/assistant.py:69`. Use `10.0` directly, no further verification needed.
- Pricing constants for `claude-sonnet-5`: input **$2.00/MTok**, output **$10.00/MTok** (introductory pricing through 2026-08-31; standard pricing after that date is $3.00/$15.00 per MTok). Add a code comment on the pricing constants noting the 2026-08-31 cutoff and that these must be updated to $3.00/$15.00 after that date, or replaced with a dated lookup table if this becomes a recurring maintenance burden.
- **Test command:** this repo's `npm run test` (`package.json`) runs `npm run test:unit && npm run test:e2e` — passing a file path after `npm run test --` forwards it to the *e2e* runner, not vitest, because npm appends args to the end of that compound script. Every unit-test verification step in this plan uses `npm run test:unit -- <path>` (the `test:unit` script is `vitest run`). Do not use `npm run test -- <path>` for a single file.
- **Deliberate deviations from the Python original** (record these, do not "fix" them back to match Python without asking): (1) `max_tokens: 4096` per turn, vs. Python's `1024` (`assistant.py:1178`) — chosen for headroom on Sonnet 5's larger tokenizer; (2) the OpenAI `gpt-4o-mini` rate-limit fallback (`assistant.py:1192-1205`) is intentionally NOT ported in Phase 2 — out of this Claude-API-only scope; a rate-limited request degrades to the honest "taking a nap" error frame instead of silently switching providers. Flag to Jose if provider-fallback parity is wanted later. (`MAX_TOOL_ITERATIONS` exhaustion behavior is NOT a deviation — Task 6 step 7 matches the Python original's graceful forced-final-text-call exactly.)
- What not to touch: Article Factory cadence, trip schema/quiz column cleanup, UI redesign beyond what's strictly needed (there should be none — see architecture note above), locale/SEO changes, the `command-post` Python code itself (leave it in place; it becomes dead code on the VPS side but Jose may still use it locally — do not delete it in this phase).
- Every new source file gets a matching test file. Follow the existing repo convention: plain Vitest unit tests for pure logic (see `src/lib/assistant-health.test.ts` for style — mock external dependencies, don't hit real network/DB in unit tests).

---

## Task 1: Env preflight check

**Files:**
- Create: `src/lib/atlas/env-preflight.ts`
- Test: `src/lib/atlas/env-preflight.test.ts`

**Interfaces:**
- Produces: `checkAtlasEnvPreflight(): { ok: boolean; missing: string[] }` — checked at module load time by later tasks, and callable standalone for a deploy-time preflight script.

Required env vars for the in-app Atlas brain: `ANTHROPIC_API_KEY` (or the legacy credential file fallback already implemented in `getAnthropicApiKey()` in `src/lib/server-config.ts`), `TRAVELPAYOUTS_TOKEN`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/atlas/env-preflight.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/server-config", () => ({
  getAnthropicApiKey: vi.fn(),
}));

import { getAnthropicApiKey } from "@/lib/server-config";
import { checkAtlasEnvPreflight } from "./env-preflight";

describe("checkAtlasEnvPreflight", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(getAnthropicApiKey).mockReturnValue("");
  });

  it("reports ok:true when both anthropic key and travelpayouts token are present", () => {
    vi.mocked(getAnthropicApiKey).mockReturnValue("sk-ant-fake-key");
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "fake-token");
    const result = checkAtlasEnvPreflight();
    expect(result).toEqual({ ok: true, missing: [] });
  });

  it("lists ANTHROPIC_API_KEY as missing when getAnthropicApiKey returns empty", () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "fake-token");
    const result = checkAtlasEnvPreflight();
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("ANTHROPIC_API_KEY");
  });

  it("lists TRAVELPAYOUTS_TOKEN as missing when unset", () => {
    vi.mocked(getAnthropicApiKey).mockReturnValue("sk-ant-fake-key");
    const result = checkAtlasEnvPreflight();
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("TRAVELPAYOUTS_TOKEN");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/atlas/env-preflight.test.ts`
Expected: FAIL — `env-preflight` module does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/atlas/env-preflight.ts
import { getAnthropicApiKey } from "@/lib/server-config";

export function checkAtlasEnvPreflight(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!getAnthropicApiKey()) missing.push("ANTHROPIC_API_KEY");
  if (!process.env.TRAVELPAYOUTS_TOKEN?.trim()) missing.push("TRAVELPAYOUTS_TOKEN");
  return { ok: missing.length === 0, missing };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/atlas/env-preflight.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/env-preflight.ts src/lib/atlas/env-preflight.test.ts
git commit -m "feat(atlas): add env preflight check for in-app brain"
```

---

## Task 2: `assistant_cost` spend tracking table

**Files:**
- Modify: `src/lib/db.ts` (add table + migration, following the exact pattern of the existing `CREATE TABLE IF NOT EXISTS` blocks and `ALTER TABLE ... ADD COLUMN` migration-with-duplicate-column-catch pattern already used in this file — read the whole file first, do not deviate from its style)
- Create: `src/lib/atlas/spend.ts`
- Test: `src/lib/atlas/spend.test.ts`

**Interfaces:**
- Produces:
  - `recordAssistantSpend(model: string, usage: { inputTokens: number; outputTokens: number }): void`
  - `getAssistantMonthlySpendUsd(): number` — sums the current UTC calendar month's `usd` column
  - `ASSISTANT_SPEND_CAP_USD` constant (read the actual value from `command-post/routers/assistant.py` around line 69 first; use that exact number)
  - `SONNET5_PRICE_PER_MTOK = { input: 2.0, output: 10.0 }` (see Global Constraints re: 2026-08-31 cutoff)

**Test isolation warning:** `DB_PATH` in `src/lib/db.ts:6` is hardcoded to `process.cwd()/data/tpi.db` — the real developer/dev-server database. There is no existing precedent in this repo for a test that calls `getDb()` directly (verified: zero current test files touch it). A test that does `DELETE FROM assistant_cost` and inserts fake spend rows against that real file would corrupt local dev data and, after Task 8 ships, could flip the developer's local Atlas to "unhealthy" via the real spend cap. **Do not let the test touch the real `data/tpi.db`.** Instead, mock the `@/lib/db` module in `spend.test.ts` to return an in-memory `better-sqlite3` database (`new Database(":memory:")`) with just the `assistant_cost` table created inline in the test file's `beforeEach` — this follows the existing repo convention of mocking external dependencies in unit tests (see `src/lib/assistant-health.test.ts`'s approach of mocking `@/lib/server-config` rather than touching real files).

Table schema (add to `src/lib/db.ts`'s `_db.exec(...)` migration block, following the existing style exactly):

```sql
CREATE TABLE IF NOT EXISTS assistant_cost (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  date           TEXT NOT NULL,
  model          TEXT NOT NULL,
  usd            REAL NOT NULL DEFAULT 0,
  input_tokens   INTEGER NOT NULL DEFAULT 0,
  output_tokens  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, model)
);
CREATE INDEX IF NOT EXISTS idx_assistant_cost_date ON assistant_cost(date);
```

`date` is `YYYY-MM-DD` (UTC), one row per model per day, upserted (mirrors the Python `_record_assistant_spend()` upsert-by-date+model behavior in `assistant.py`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/atlas/spend.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";

// In-memory DB — never touches the real data/tpi.db. Mirrors the
// assistant_cost schema added to src/lib/db.ts in this task.
let memDb: Database.Database;
vi.mock("@/lib/db", () => ({
  getDb: () => memDb,
}));

import { recordAssistantSpend, getAssistantMonthlySpendUsd, ASSISTANT_SPEND_CAP_USD } from "./spend";

describe("assistant spend tracking", () => {
  beforeEach(() => {
    memDb = new Database(":memory:");
    memDb.exec(`
      CREATE TABLE assistant_cost (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        model TEXT NOT NULL,
        usd REAL NOT NULL DEFAULT 0,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(date, model)
      );
    `);
  });

  it("records spend and computes cost from token usage", () => {
    recordAssistantSpend("claude-sonnet-5", { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    const spend = getAssistantMonthlySpendUsd();
    // 1M input tokens @ $2/MTok + 1M output tokens @ $10/MTok = $12.00
    expect(spend).toBeCloseTo(12.0, 5);
  });

  it("accumulates multiple calls into the same day's row", () => {
    recordAssistantSpend("claude-sonnet-5", { inputTokens: 500_000, outputTokens: 0 });
    recordAssistantSpend("claude-sonnet-5", { inputTokens: 500_000, outputTokens: 0 });
    expect(getAssistantMonthlySpendUsd()).toBeCloseTo(2.0, 5);
  });

  it("exposes the spend cap constant", () => {
    expect(typeof ASSISTANT_SPEND_CAP_USD).toBe("number");
    expect(ASSISTANT_SPEND_CAP_USD).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/atlas/spend.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Add the table to `src/lib/db.ts` and implement `src/lib/atlas/spend.ts`**

Add the `CREATE TABLE`/`CREATE INDEX` block above into the existing migration section of `getDb()` in `src/lib/db.ts`, in the same `_db.exec(...)` call as the other core tables (or its own follow-up `_db.exec(...)` block if you prefer isolating it — match whichever the file already does for tables added after the initial core set, e.g. `geocoding_cache`).

```typescript
// src/lib/atlas/spend.ts
import { getDb } from "@/lib/db";

// Introductory Sonnet 5 pricing through 2026-08-31. After that date, revert
// to standard pricing: input $3.00/MTok, output $15.00/MTok.
export const SONNET5_PRICE_PER_MTOK = { input: 2.0, output: 10.0 };

export const ASSISTANT_SPEND_CAP_USD = 10.0; // must match command-post/routers/assistant.py's ASSISTANT_SPEND_CAP

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function recordAssistantSpend(
  model: string,
  usage: { inputTokens: number; outputTokens: number }
): void {
  const usd =
    (usage.inputTokens / 1_000_000) * SONNET5_PRICE_PER_MTOK.input +
    (usage.outputTokens / 1_000_000) * SONNET5_PRICE_PER_MTOK.output;
  const date = todayUtc();
  const db = getDb();
  db.prepare(
    `INSERT INTO assistant_cost (date, model, usd, input_tokens, output_tokens)
     VALUES (@date, @model, @usd, @inputTokens, @outputTokens)
     ON CONFLICT(date, model) DO UPDATE SET
       usd = usd + excluded.usd,
       input_tokens = input_tokens + excluded.input_tokens,
       output_tokens = output_tokens + excluded.output_tokens`
  ).run({ date, model, usd, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens });
}

export function getAssistantMonthlySpendUsd(): number {
  const monthPrefix = todayUtc().slice(0, 7); // YYYY-MM
  const row = getDb()
    .prepare(`SELECT COALESCE(SUM(usd), 0) AS total FROM assistant_cost WHERE date LIKE @pattern`)
    .get({ pattern: `${monthPrefix}%` }) as { total: number };
  return row.total;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/atlas/spend.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/atlas/spend.ts src/lib/atlas/spend.test.ts
git commit -m "feat(atlas): add assistant_cost table and monthly spend tracking"
```

---

## Task 3: Travelpayouts TypeScript client (real-data tools only)

**Files:**
- Create: `src/lib/atlas/travelpayouts-client.ts`
- Test: `src/lib/atlas/travelpayouts-client.test.ts`

**Interfaces:**
- Produces:
  - `searchFlights(origin: string, destination: string, departDate: string, returnDate?: string): Promise<{ flights: FlightOption[] } | { flights: []; no_data: true; reason: string }>` — this is the **handler-level** port (fan-out + defaulting included, see below), not just the raw `tp_client.py` call.
  - `getDeals(origin: string): Promise<{ deals: DealOption[] } | { deals: []; no_data: true; reason: string }>`
  - `getPopularRoutes(origin: string): Promise<{ routes: PopularRoute[] } | { routes: []; no_data: true; reason: string }>` — powers the `surprise_me` tool in Task 6. Real Travelpayouts data only — do not port the Python's curated-fallback destination list (`assistant.py:999-1089`); an honest empty result is preferable to a hardcoded fallback list under D3's spirit. If this feels like a real product regression, flag it in the PR description for Jose rather than silently adding the fallback back.
  - `buildAviasalesLink(origin: string, destination: string, departDate: string, returnDate?: string): string`
  - `FlightOption`, `DealOption`, `PopularRoute` types

Port the **real-API-only** logic from `command-post/tp_client.py` (read it directly — it is the source of truth for the raw API calls). Specifically port:
- `_tp_get()` — the base GET wrapper with a 10s timeout and 5-minute in-memory cache (a simple `Map<string, {data, expiresAt}>` keyed by URL is sufficient; do not port the 200 req/hour rate limiter unless you confirm Travelpayouts still requires it — if unsure, port it too, it's cheap insurance: a sliding-window counter of timestamps, reject/wait if 200 requests were made in the last hour).
- `search_flights()` (in `tp_client.py`) — real Aviasales `prices_for_dates` v3 call, with the month-granularity fallback retry when the specific-date query is empty. Returns `{ flights: [], no_data: true, reason: "..." }` on failure/empty — **never fabricate a price**.
- `get_deals()` / `get_popular()` (in `tp_client.py`) — real Travelpayouts calls, same honest-empty-result behavior. `get_popular()` backs `getPopularRoutes()` above.
- `_build_aviasales_link()` → `buildAviasalesLink()`: `https://www.aviasales.com/search/{ORIGIN}{DD}{MM}{DEST}{RDD}{RMM}1?marker=164743` (marker `164743`, matches `TP_CONFIG.marker` in `src/config/affiliates.ts` — import and reuse that constant instead of hardcoding it again).

**Also port the handler-level logic that `tp_client.py` does NOT contain** — this lives in the Python `_handle_search_flights` handler at `command-post/routers/assistant.py:231-292`, one layer above `tp_client.py`, and must be folded into this file's `searchFlights()` so the TS tool gets the same result quality as the Python one:
- Nearby-airport fan-out: for both origin and destination, look up nearby alternate airports via the `NEARBY_AIRPORTS_MAP` constant table and query them concurrently (`Promise.all`) alongside the primary airport, then merge and sort all results by price. Copy the `NEARBY_AIRPORTS_MAP` and `IATA_TO_CITY` constant tables **verbatim** from `command-post/routers/assistant.py` (they sit roughly in the 600-750 line region — read the file to find their exact location; do not summarize, reduce, or re-derive these ~130-entry tables by hand, copy them exactly as TypeScript object literals).
- Date defaulting: if no `departDate` is given, default to today+14 days; if `returnDate` is omitted but the trip implies a round trip, default it to `departDate`+7 days. Match the Python handler's exact defaulting rule (read `assistant.py:231-292` for the precise logic before implementing).
- IATA code sanitization: before building any URL or API call, sanitize origin/destination inputs to 3 uppercase letters only (`.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3)`), mirroring the existing `clean()` helper inside `TP_CONFIG.searchUrl` in `src/config/affiliates.ts:33-37`) — do not trust tool-call input as pre-validated.

Do **not** port `search_hotels`, `search_activities`, or `search_restaurants` from `tp_client.py` — those are the D3-forbidden LLM-generation methods (`_llm_generate()` calls). They have no place in this file or anywhere in the TS codebase.

Read the actual token env var name from `assistant-health.ts` (`TRAVELPAYOUTS_TOKEN`) and use it for auth.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/atlas/travelpayouts-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { searchFlights, buildAviasalesLink } from "./travelpayouts-client";

describe("travelpayouts-client", () => {
  beforeEach(() => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "fake-token");
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns real flight data when the API responds with prices", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [{ origin: "MIA", destination: "CUN", price: 210, departure_at: "2026-09-01T10:00:00Z" }],
      }),
    });
    const result = await searchFlights("MIA", "CUN", "2026-09-01");
    expect("no_data" in result).toBe(false);
    if (!("no_data" in result)) {
      expect(result.flights.length).toBeGreaterThan(0);
      expect(result.flights[0].price).toBe(210);
    }
  });

  it("returns honest no_data:true when the API returns nothing, never a fabricated price", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
    const result = await searchFlights("XXX", "YYY", "2026-09-01");
    expect(result).toMatchObject({ flights: [], no_data: true });
    expect((result as { reason: string }).reason).toBeTruthy();
  });

  it("builds an aviasales link with the correct marker", () => {
    const link = buildAviasalesLink("MIA", "CUN", "2026-09-01");
    expect(link).toContain("aviasales.com/search/");
    expect(link).toContain("marker=164743");
  });

  it("sanitizes IATA codes before use, rejecting non-letter characters", () => {
    const link = buildAviasalesLink("mi'a; drop table--", "CUN", "2026-09-01");
    expect(link).toContain("/search/MIA"); // truncated/sanitized to 3 letters
  });
});

describe("getPopularRoutes", () => {
  it("returns honest empty result when no popular routes are available, never a curated fallback list", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
    const { getPopularRoutes } = await import("./travelpayouts-client");
    const result = await getPopularRoutes("MIA");
    expect(result).toMatchObject({ routes: [], no_data: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/atlas/travelpayouts-client.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/lib/atlas/travelpayouts-client.ts`**

Port from `command-post/tp_client.py` per the spec above. Use `TP_CONFIG.marker` from `@/config/affiliates` for the marker constant. Use `fetch` (global, Next.js runtime) not `axios`/`requests`. On any non-2xx response, network error, or empty result set, return `{ flights: [], no_data: true, reason: "<short honest reason>" }` — never throw out of `searchFlights`/`getDeals` for an ordinary empty-result case (only throw for a genuine env-misconfiguration, e.g. missing token).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/atlas/travelpayouts-client.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/travelpayouts-client.ts src/lib/atlas/travelpayouts-client.test.ts
git commit -m "feat(atlas): port Travelpayouts client for real flight/deal data"
```

---

## Task 4: System prompt builder (D3/D7-compliant)

**Files:**
- Create: `src/lib/atlas/system-prompt.ts`
- Test: `src/lib/atlas/system-prompt.test.ts`

**Interfaces:**
- Produces: `buildAtlasSystemPrompt(ctx: { pageContext?: string; preferencesJson?: string; memoryContext?: string }): string`

Port `_build_system_prompt()` from `command-post/routers/assistant.py` (read it directly for the full text — the "You are Atlas, the AI travel concierge..." prompt, nearby-airport hints, budget-tier rules, no-fabrication rule for `no_data: true`). The Python version pastes the whole `page_context`/`preferences_json`/`memory_context` strings into the prompt rather than parsing them into structured fields (`assistant.py:857-897`, `:869`, `:876`) — match that: accept them as opaque strings and interpolate them into the prompt text as-is, same as Python does. Required changes from the Python version:

1. **D3 instruction (new, mandatory):** Add an explicit section instructing Atlas that for hotel, activity/tour, and restaurant requests it must NOT invent specific named properties, ratings, or prices. Instead it must give general prose guidance (neighborhood, price tier, what to look for) plus exactly one real link, chosen from:
   - Hotels → `CJ_LINKS.hotelsCity(city)` (from `@/config/affiliates`)
   - Activities/tours → `TP_KLOOK.url(city)` (from `@/config/affiliates`)
   - Restaurants → `` `https://www.google.com/maps/search/restaurants+in+${encodeURIComponent(city)}` `` (no affiliate program exists for dining; state this plainly in the prompt as a code comment, not to the model)

   **Destination extraction (best-effort, safe-degrade):** `pageContext` is free-text prose built client-side (see `AssistantChat.tsx:640-741`), not a structured field — there is no reliable `ctx.destination` to read (this corrects an earlier draft of this plan that assumed one existed). Write a small internal helper that applies a best-effort regex against `pageContext` (e.g. matching `trip to <place>` / `destination: <place>` / similar phrasing already used when the client builds that string — read `AssistantChat.tsx:640-741` to match the actual phrasing) to extract a city name. If no match is found, **omit the partner link entirely and give prose-only guidance** — no link is the honest, safe default per D3; do not guess a destination.

   **Markdown-link requirement (mandatory — this is a correctness fix, not a style preference):** `AssistantChat.tsx`'s markdown renderer (`renderMarkdownLite`, around `AssistantChat.tsx:396-405`) only linkifies text in the exact form `[label](https://...)` — a bare URL renders as inert text the user can't click. When a destination is identified, do not just interpolate the raw URL and hope the model reproduces it correctly (an LLM reproducing a long, nested-`encodeURIComponent` CJ or Klook URL character-for-character from memory is a real corruption risk — a single mangled character silently kills affiliate attribution with no error). Instead, pre-build the **entire ready-to-paste markdown line** in code (e.g. `` `[Search hotels in ${city} on Hotels.com](${CJ_LINKS.hotelsCity(city)})` ``) and instruct the model explicitly: *"When recommending hotels/activities/restaurants for a known destination, end your response with exactly this line, copied verbatim and unmodified: <the pre-built markdown line>."* This reduces the model's job from "reconstruct a URL" to "paste this exact line," which is far more reliable.

2. **D7 partner set:** Remove any mention of partners outside the locked D7 set (Klook, Tiqets, Kiwi.com, Kiwitaxi, CJ/Hotels.com). Since Tiqets/Kiwi.com/Kiwitaxi configs don't exist yet in `affiliates.ts` (Phase 3 adds them), do not reference them in the prompt text yet — only reference Klook and Hotels.com/CJ, which do exist today.

3. Keep the no-fabrication rule for `no_data: true` flight/deal results unchanged from the Python version — it's already correct.

**Note on scope vs. `docs/product/IMPLEMENTATION_PLAN.md`:** that doc's Phase 2 task 7 says "partner-search handoff **tools**" — this plan implements the handoff as a pre-built markdown line injected into the system prompt rather than as a callable tool, specifically to avoid adding `search_hotels`/`search_activities`/`search_restaurants`-shaped tool names back into `TOOLS` (which would risk re-triggering `AssistantChat.tsx`'s `TRIP_TOOLS` modal/card path — the exact thing D3 forbids). This is a deliberate, reviewed deviation from the doc's literal wording, not an oversight — call it out in the PR description when this phase is done, so Jose can ratify or override it before Phase 3.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/atlas/system-prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildAtlasSystemPrompt } from "./system-prompt";

describe("buildAtlasSystemPrompt", () => {
  it("includes the D3 no-fabrication rule for hotels/activities/restaurants", () => {
    const prompt = buildAtlasSystemPrompt({ pageContext: "Active trip to Miami, Florida" });
    expect(prompt).toMatch(/never invent|do not invent|must not invent/i);
    expect(prompt.toLowerCase()).toContain("hotel");
    expect(prompt.toLowerCase()).toContain("restaurant");
  });

  it("includes a ready-to-paste markdown link to a real Hotels.com URL when a destination is identified", () => {
    const prompt = buildAtlasSystemPrompt({ pageContext: "Active trip to Miami, Florida" });
    expect(prompt).toMatch(/\[[^\]]+\]\(https:\/\/www\.dpbolvw\.net[^)]+\)/); // CJ_LINKS.hotelsCity domain, markdown form
  });

  it("omits the partner link entirely when no destination can be identified (safe degrade)", () => {
    const prompt = buildAtlasSystemPrompt({ pageContext: "General travel questions" });
    expect(prompt).not.toContain("dpbolvw.net");
  });

  it("includes the no-fabrication rule for empty flight data", () => {
    const prompt = buildAtlasSystemPrompt({});
    expect(prompt).toMatch(/no_data/);
  });

  it("does not mention Tiqets, Kiwi.com, or Kiwitaxi (not yet configured)", () => {
    const prompt = buildAtlasSystemPrompt({ pageContext: "Active trip to Miami, Florida" });
    expect(prompt).not.toMatch(/tiqets/i);
    expect(prompt).not.toMatch(/kiwitaxi/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/atlas/system-prompt.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/lib/atlas/system-prompt.ts`**

Port the Python prompt text, add the D3 section described above, interpolate real links via `CJ_LINKS.hotelsCity(destination)` / `TP_KLOOK.url(destination)` when `ctx.destination` is present; fall back to prose-only guidance (no link) when destination is unknown.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/atlas/system-prompt.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/system-prompt.ts src/lib/atlas/system-prompt.test.ts
git commit -m "feat(atlas): port system prompt builder with D3 partner-handoff rules"
```

---

## Task 5: `get_article` tool

**Files:**
- Create: `src/lib/atlas/tools/get-article.ts`
- Test: `src/lib/atlas/tools/get-article.test.ts`

**Interfaces:**
- Produces: `getArticleTool(query: string): { articles: { slug: string; title: string; excerpt: string; url: string }[] }`

Reimplement against TPI's own article index instead of the Python `articles-index.json`. Use `getAllArticles()` from `@/lib/articles` (already read — returns `Article[]` with `title`, `excerpt`, `categories`, `search_location`). Do a simple case-insensitive substring match across `title`, `excerpt`, and `search_location` against the query; return up to 5 matches sorted by relevance (title match first, then excerpt/location match). Build `url` as `/${slug}` — confirmed against `src/app/[locale]/[slug]/page.tsx`, which calls `getArticle(slug)` (`src/lib/articles.ts:43`) directly off the locale-prefixed root, **not** a `/guides/` prefix (there is no such route). Locale prefixing is handled by Next's routing automatically; do not add the locale segment yourself.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/atlas/tools/get-article.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/articles", () => ({
  getAllArticles: () => [
    { slug: "miami-airport-transfers", title: "Miami Airport Transfers Guide", excerpt: "Getting from MIA to downtown", search_location: "Miami" },
    { slug: "cancun-resorts", title: "Best Cancun Resorts", excerpt: "Top all-inclusive picks", search_location: "Cancun" },
  ],
}));

import { getArticleTool } from "./get-article";

describe("getArticleTool", () => {
  it("matches articles by destination", () => {
    const result = getArticleTool("Miami");
    expect(result.articles.length).toBeGreaterThan(0);
    expect(result.articles[0].slug).toBe("miami-airport-transfers");
  });

  it("returns an empty array for no matches, never fabricates an article", () => {
    const result = getArticleTool("Antarctica");
    expect(result.articles).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/atlas/tools/get-article.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/lib/atlas/tools/get-article.ts`**

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/atlas/tools/get-article.test.ts`
Expected: PASS (2/2)

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/tools/get-article.ts src/lib/atlas/tools/get-article.test.ts
git commit -m "feat(atlas): reimplement get_article against TPI's own article index"
```

---

## Task 6: Anthropic tool-use loop module

**Files:**
- Create: `src/lib/atlas/tool-loop.ts`
- Test: `src/lib/atlas/tool-loop.test.ts`

**Interfaces:**
- Consumes: `searchFlights`/`getDeals`/`getPopularRoutes` from Task 3, `getArticleTool` from Task 5, `buildAtlasSystemPrompt` from Task 4, `recordAssistantSpend`/`getAssistantMonthlySpendUsd`/`ASSISTANT_SPEND_CAP_USD` from Task 2.
- Produces: `async function* runAtlasTurn(params: { message: string; history: Anthropic.MessageParam[]; pageContext?: string; preferencesJson?: string; memoryContext?: string }): AsyncGenerator<string>` — yields raw SSE `data: ...\n\n` frame strings (including the trailing `data: [DONE]\n\n` frame at the end). This is the function `chat/route.ts` (Task 7) calls and forwards directly to the client, replacing the current FastAPI-proxy fetch+reader loop. `pageContext`/`preferencesJson`/`memoryContext` are passed straight through to `buildAtlasSystemPrompt()` — do not drop them; the Python original's registered-user memory (H5/D4) and nearby-airport/budget-tier prompt behavior depend on `preferences_json` and `memory_context` reaching the system prompt (`assistant.py:857-897`, `:1149-1151`).

Tool definitions (only these four — no hotel/activity/restaurant tools):

```typescript
const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_flights",
    description: "Search real flight prices for a route and date via Travelpayouts/Aviasales. Call this when the user asks about flight prices, availability, or booking options for a specific trip.",
    input_schema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Origin airport IATA code" },
        destination: { type: "string", description: "Destination airport IATA code" },
        depart_date: { type: "string", description: "YYYY-MM-DD" },
        return_date: { type: "string", description: "YYYY-MM-DD, omit for one-way" },
      },
      required: ["origin", "destination", "depart_date"],
    },
  },
  {
    name: "get_deals",
    description: "Get current cheap flight deals from an origin airport.",
    input_schema: {
      type: "object",
      properties: { origin: { type: "string" } },
      required: ["origin"],
    },
  },
  {
    name: "get_article",
    description: "Find TravelPlanInfo guide articles relevant to a destination or topic. Only recommend TPI's own articles this way.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "surprise_me",
    description: "Get real popular flight routes/destinations from an origin airport, for a user who wants an open-ended destination suggestion rather than a specific one. Call this for 'surprise me' / 'where should I go' style requests.",
    input_schema: {
      type: "object",
      properties: { origin: { type: "string", description: "Origin airport IATA code" } },
      required: ["origin"],
    },
  },
];
```

The Python system prompt this plan ports in Task 4 references a `surprise_me` tool by name (`assistant.py:887,897`) — without this tool definition and its dispatch below, every Surprise Me trip would make Atlas call a nonexistent tool and hit an unhandled-tool-name error on every request. This tool is mandatory, not optional, for Task 4's prompt to work correctly.

Loop shape (mirror `_stream_anthropic()` in `command-post/routers/assistant.py:1162-1268` — read that exact range for the real control flow before writing this; an earlier draft of this plan cited the wrong line range, this one is verified):

1. Before the first API call, check `getAssistantMonthlySpendUsd() >= ASSISTANT_SPEND_CAP_USD`. If over cap, yield a single honest `data: {"error": "Atlas has reached its monthly usage limit. Please try again next month."}\n\n` frame plus `data: [DONE]\n\n`, and return — do not call the API at all. (Note: this is a check-then-act race under concurrent requests — a handful of simultaneous requests can push spend slightly over the cap before any of them observes it. This matches the existing Python behavior and is an acceptable, non-blocking imperfection at this traffic volume; leave a one-line code comment noting it rather than adding synchronization.)
2. `MAX_TOOL_ITERATIONS = 5` (verified: `assistant.py:1128`).
3. Loop: call `client.messages.create({ model: "claude-sonnet-5", max_tokens: 4096, thinking: { type: "disabled" }, system: buildAtlasSystemPrompt(...), tools: TOOLS, messages })`.
4. After every call, call `recordAssistantSpend("claude-sonnet-5", { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens })` — record spend on every iteration, including ones that end in tool_use, matching the Python behavior of accounting for every API call, not just the final one.
5. If `response.stop_reason === "tool_use"`: for each `tool_use` block, dispatch to the matching handler:
   - `search_flights` → `searchFlights(input.origin, input.destination, input.depart_date, input.return_date)`
   - `get_deals` → `getDeals(input.origin)`
   - `get_article` → `getArticleTool(input.query)`
   - `surprise_me` → `getPopularRoutes(input.origin)`

   Yield `data: [TOOL:${name}]${JSON.stringify(result)}\n\n` for each, append the assistant message and a user message with `tool_result` blocks (all results in one user message, per Anthropic's parallel-tool-use contract), and continue the loop.
6. If `response.stop_reason !== "tool_use"`: extract the final text block, split on whitespace preserving spaces (or word-by-word same as Python), yield `data: ${token}\n\n` per token with a small delay (`await new Promise(r => setTimeout(r, 10))`, matching Python's `asyncio.sleep(0.01)`), then yield `data: [DONE]\n\n` and return.
7. **Iteration exhaustion — match the Python behavior, not an error frame.** If the loop reaches `MAX_TOOL_ITERATIONS` without a final text response, do what the Python original does (`assistant.py:1173,1186-1191`): make one **final call with `tools` omitted entirely**, forcing a text-only answer so the user gets a graceful response instead of a bare error. Record spend for this final call too. Only if that final tool-free call itself throws should you fall back to the honest error frame in step 8.
8. Wrap the whole function body in a try/catch; on any Anthropic SDK error (rate limit, 5xx, network), yield `data: {"error": "Atlas is taking a nap. Please try again in a moment."}\n\n` plus `[DONE]` — same user-facing copy as the existing `chat/route.ts` connection-failure branch, so behavior is consistent regardless of which layer fails. (Per the Global Constraints note on deliberate deviations, this plan does not port the Python's OpenAI `gpt-4o-mini` rate-limit fallback — an Anthropic rate limit degrades to this same honest error frame rather than switching providers.)

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/atlas/tool-loop.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));
vi.mock("./spend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./spend")>();
  return { ...actual, getAssistantMonthlySpendUsd: vi.fn(() => 0), recordAssistantSpend: vi.fn() };
});
vi.mock("./travelpayouts-client", () => ({
  searchFlights: vi.fn(async () => ({ flights: [], no_data: true, reason: "test" })),
  getDeals: vi.fn(async () => ({ deals: [], no_data: true, reason: "test" })),
  getPopularRoutes: vi.fn(async () => ({ routes: [], no_data: true, reason: "test" })),
}));
vi.mock("./tools/get-article", () => ({ getArticleTool: vi.fn(() => ({ articles: [] })) }));

import { runAtlasTurn } from "./tool-loop";
import { getAssistantMonthlySpendUsd } from "./spend";

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const frame of gen) out.push(frame);
  return out;
}

describe("runAtlasTurn", () => {
  beforeEach(() => createMock.mockReset());

  it("yields a text response and [DONE] when the model answers directly", async () => {
    createMock.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Hello there" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const frames = await collect(runAtlasTurn({ message: "hi", history: [] }));
    expect(frames.some((f) => f.includes("Hello"))).toBe(true);
    expect(frames.at(-1)).toBe("data: [DONE]\n\n");
  });

  it("short-circuits with an honest cap-exceeded message when over the monthly spend cap", async () => {
    vi.mocked(getAssistantMonthlySpendUsd).mockReturnValueOnce(999);
    const frames = await collect(runAtlasTurn({ message: "hi", history: [] }));
    expect(frames[0]).toMatch(/monthly usage limit/i);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("emits a [TOOL:search_flights] frame with honest no_data when flights are empty", async () => {
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "search_flights", input: { origin: "MIA", destination: "CUN", depart_date: "2026-09-01" } }],
        usage: { input_tokens: 10, output_tokens: 5 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "No flights found for that route." }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    const frames = await collect(runAtlasTurn({ message: "flights to cancun", history: [] }));
    const toolFrame = frames.find((f) => f.startsWith("data: [TOOL:search_flights]"));
    expect(toolFrame).toBeDefined();
    expect(toolFrame).toContain('"no_data":true');
    expect(toolFrame).not.toMatch(/"price":\d/); // never a fabricated price
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/atlas/tool-loop.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/lib/atlas/tool-loop.ts`** per the loop shape above.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/atlas/tool-loop.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/tool-loop.ts src/lib/atlas/tool-loop.test.ts
git commit -m "feat(atlas): implement in-app Anthropic tool-use loop, no fabricated hotel/activity/restaurant tools"
```

---

## Task 7: Rewire `chat/route.ts` to use the in-app brain

**Files:**
- Modify: `src/app/api/assistant/chat/route.ts`
- Test: existing E2E coverage in `tests/e2e/planner-trust.spec.ts` should still pass; add a focused route-level test if the repo has a precedent for testing API routes directly (check for one before adding new test infra — if none exists, rely on the E2E suite plus manual verification, do not invent a new test harness for this task alone).

Read the full current file before editing (299 lines, already summarized above). Preserve **every line of behavior** except the one section that proxies to FastAPI:

- Keep: auth via `getUserId()`, request parsing, rate limiting (`rateLimitMap`), session ownership validation, preferences loading, memory-context loading (last-50 `user_memory` split into facts/summaries), fire-and-forget background summarization call, user-message insert, last-20 history load (`historyWithoutCurrent`).
- Replace: the `backendChatUrl` fetch-and-forward-SSE section with a call to `runAtlasTurn({ message, history: historyWithoutCurrent, pageContext: page_context, preferencesJson: JSON.stringify(preferences), memoryContext })`, using whatever variable names the existing code already has in scope for `page_context` (already a plain string per `AssistantChat.tsx:734-742`, do not treat it as an object), the loaded `preferences` object, and the already-assembled `memoryContext` string (facts + `conversation_summary_*` rows) — these three are already being loaded by the code you're keeping above; this task's only change is to route them into `runAtlasTurn` instead of into the FastAPI request body. Stream `runAtlasTurn`'s yielded frames directly to the client `ReadableStream` in place of the forwarded backend frames.
- Keep: the `fullResponse` accumulation logic (skip `[DONE]`/`[TOOL:`/error frames) and the `finally` block that persists the assistant reply to `chat_messages` — this logic doesn't care whether the frames came from a proxied fetch or a local generator, so it should need minimal adaptation, just re-pointed at the new frame source.
- Remove: the `getFastApiBaseUrl()` import/call and the outer connection-failure catch's `"Atlas is taking a nap"` message — that message now lives inside `runAtlasTurn` itself (Task 6, step 8), so a thrown error from `runAtlasTurn` should be treated the same way (still wrap in try/catch for defense in depth, since a bug in the generator shouldn't crash the whole request handler).

Response headers (`text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`) are unchanged.

- [ ] **Step 1:** Re-read the current `src/app/api/assistant/chat/route.ts` in full immediately before editing (files can drift between plan-writing and execution).
- [ ] **Step 2:** Make the edit described above.
- [ ] **Step 3:** Run `npm run lint` and `npm run build` — both must exit 0.
- [ ] **Step 4:** Start the dev server (`npm run dev`) and manually POST a test message to `/api/assistant/chat` via curl with a valid session, confirm SSE frames stream back and look like `data: {token}\n\n` ... `data: [DONE]\n\n`.
- [ ] **Step 5: Commit**

```bash
git add src/app/api/assistant/chat/route.ts
git commit -m "feat(atlas): wire chat route to in-app tool loop, retire FastAPI proxy"
```

---

## Task 8: Post-D2 health semantics

**Files:**
- Modify: `src/lib/assistant-health.ts`
- Modify: `src/lib/assistant-health.test.ts` (update existing tests, don't just add new ones — several existing cases assert on `backendReachable` via the FastAPI probe, which no longer applies)

**Interfaces:**
- `getAssistantHealth()` return shape changes from `{ anthropic, travelpayouts, backendReachable, healthy }` to `{ anthropic, travelpayouts, spendCapOk, healthy }` where:
  - `anthropic`: unchanged — `getAnthropicApiKey()` truthy.
  - `travelpayouts`: unchanged — `TRAVELPAYOUTS_TOKEN` env truthy.
  - `spendCapOk` (new, replaces `backendReachable`): `getAssistantMonthlySpendUsd() < ASSISTANT_SPEND_CAP_USD` (import from Task 2's `spend.ts`). This is now an in-process DB read, not a network probe — remove the `AbortSignal.timeout(1500)` fetch entirely; there is no more separate backend to probe.
  - `healthy = anthropic && spendCapOk` (travelpayouts absence degrades flight search gracefully via `no_data: true`, same as before — it doesn't gate the whole assistant, matching the existing `healthy = anthropic && backendReachable` pattern where travelpayouts was already excluded from the `healthy` computation).

Keep the 45-second TTL + single-flight in-memory cache and `__resetAssistantHealthCacheForTests()` export — that caching behavior is still correct and desirable (avoids a DB read on every health-check poll).

- [ ] **Step 1:** Update `assistant-health.test.ts`: replace the FastAPI-probe-mocking tests with tests that mock `getAssistantMonthlySpendUsd` from `./atlas/spend` to return under/over the cap, and assert `spendCapOk`/`healthy` accordingly. Keep the TTL/single-flight/travelpayouts-independence tests — they don't need to change, just verify they still target real behavior.
- [ ] **Step 2:** Run the updated tests, confirm they fail against the old implementation (still probing FastAPI).
- [ ] **Step 3:** Implement the change in `src/lib/assistant-health.ts` per the spec above.
- [ ] **Step 4:** Run `npm run test:unit -- src/lib/assistant-health.test.ts`, confirm PASS.
- [ ] **Step 5:** Check `src/hooks/useAssistantHealth.ts` and any UI code that reads `backendReachable` by name (grep for it) — update field references to `spendCapOk`. The gating behavior in `AssistantChat.tsx` and `page.tsx` reads `.healthy` only, per the Phase 0 implementation, so those call sites should need no change — verify this by grepping for `backendReachable` across `src/` and confirming the only hits are inside `assistant-health.ts`/`.test.ts` before considering this task done.
- [ ] **Step 6: Commit**

```bash
git add src/lib/assistant-health.ts src/lib/assistant-health.test.ts
git commit -m "feat(atlas): redefine health check for post-D2 in-app brain (spend cap, not FastAPI reachability)"
```

---

## Task 9: D3 no-fabrication and no-data behavior tests

**Files:**
- Create: `src/lib/atlas/no-fabrication.test.ts` (integration-style test over the tool-loop + system-prompt modules together, still using Vitest — no new test framework)

This task is explicitly called out in `IMPLEMENTATION_PLAN.md`'s Phase 2 acceptance criteria ("Add tests for no-data flight behavior, D3 no-fabrication behavior, and health gating") — health gating is covered by Task 8; this task covers the other two, at a level broader than Task 6's and Task 3's already-covered unit cases, verifying the properties end-to-end:

- [ ] Add a test asserting that `TOOLS` (export it from `tool-loop.ts` for testability) contains exactly four tool names — `search_flights`, `get_deals`, `get_article`, `surprise_me` — and specifically does **not** contain `search_hotels`, `search_activities`, or `search_restaurants`. This is a structural guarantee that D3-forbidden tools can never be reintroduced by accident; it should fail loudly if anyone adds one of those tool names back.
- [ ] Add a test asserting `buildAtlasSystemPrompt()`'s output contains the explicit D3 prohibition text (from Task 4: the "must not invent" language covering hotels/restaurants/activities).
- [ ] Add a test asserting that when a destination is identified, `buildAtlasSystemPrompt()`'s output contains a well-formed markdown link (`/\[[^\]]+\]\(https:\/\/[^)]+\)/`) pointing at the real `CJ_LINKS.hotelsCity` domain (`dpbolvw.net`) — this is the concrete, non-circular version of "verify no fabricated inventory," since it directly checks the mechanism Task 4 relies on (a pre-built real link, not an LLM-reconstructed one) rather than trying to prove a negative about arbitrary text.
- [ ] Run `npm run test:unit -- src/lib/atlas/no-fabrication.test.ts`, confirm PASS.
- [ ] Commit: `git commit -m "test(atlas): structural guarantees against D3-forbidden tools and prompt fabrication"`

---

## Task 10: Deployment runbook + production smoke plan

**Files:**
- Modify: `docs/deployment/local-to-vps.md` (add an "Atlas brain (Phase 2)" section)

Add a section documenting:
1. **Required new VPS env vars** (added to whatever the VPS's env file mechanism is — check `docs/deployment/local-to-vps.md` for how existing env vars like `NEXTAUTH_URL` are provisioned there and follow the same mechanism): `ANTHROPIC_API_KEY`, `TRAVELPAYOUTS_TOKEN`.
   - **These do not exist on the VPS today** (confirmed absent during Phase 0/D9). Provisioning them is a prerequisite for any real production smoke test and is Jose's action, not something this plan can automate — flag this explicitly in the runbook as a manual pre-deploy step.
2. `data/tpi.db` on the VPS gets the new `assistant_cost` table automatically on next app start (via `getDb()`'s migration-on-load pattern) — no manual migration step needed, but note it in the runbook for awareness.
3. Production smoke test steps (copy from `IMPLEMENTATION_PLAN.md`'s Phase 2 verification commands and manual gate, reproduced here for the runbook's self-containedness):
   ```bash
   npm run lint && npm run test && npm run build
   curl -sL https://travelplaninfo.com/api/assistant/health | jq .
   BASE_URL=https://travelplaninfo.com npx playwright test tests/e2e/planner-trust.spec.ts
   ```
   Manual gate: guest session → create a MIA/Cancun (or similar) trip → consent to Atlas → verify a streamed reply, a real flight/deal card with an Aviasales marker link, and a spend row appears in `assistant_cost` (checkable via `sqlite3 data/tpi.db "select * from assistant_cost order by id desc limit 5;"` on the VPS). Additionally: ask Atlas about hotels for the trip's destination and confirm the reply is prose + a real Hotels.com link, with no named hotel/rating/price.
4. Confirm this smoke test with the workstation off/unreachable — the whole point of Phase 2 is that Atlas no longer needs `command-post` running.

- [ ] Commit: `git commit -m "docs(atlas): add Phase 2 deploy runbook section, flag required VPS secrets"`

---

## Final Verification (run after all tasks land on this branch, before opening a PR)

```bash
npm run lint
npm run test
npm run build
```

`npm run test` runs `test:unit && test:e2e` (per `package.json`) — the e2e half requires a running dev/preview server per `playwright.config.ts` (no `webServer` auto-start configured), so start `npm run dev` in the background first, exactly as Phase 0 did. All three commands must exit 0. Then start the dev server and manually verify (Playwright or curl) that:
- A guest chat session gets a streamed text reply from the in-app brain (no FastAPI dependency — kill `command-post` first if it happens to be running locally, to prove independence).
- A flight search for a real route/date returns either a real Aviasales-linked result or an honest `no_data` response — never a fabricated price.
- A hotel/activity/restaurant request returns prose + a real partner link, never a named invented property.
- `/api/assistant/health` returns the new `spendCapOk` field instead of `backendReachable`.

Do not open a PR until all of the above pass with fresh command output as evidence.
