# Guest Onboarding → Atlas Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a guest's onboarding home airport (and interests) reach Atlas honestly (greeting states only what is known — never "undefined") and functionally (the LLM context genuinely uses the airport), plus pre-fill origin on TripForm and interests on ItineraryBuilder — behind one typed, runtime-validated guest-prefs contract.

**Architecture:** Approach ① (localStorage-threaded). One canonical IATA validator (`src/lib/iata.ts`), one guest-prefs contract + event helpers (`src/lib/guest-prefs.ts`), a pure `buildOnboardingIntro` total over untrusted input, and a server-side field-independent guest `preferencesJson` in the chat route. Guests stay localStorage-only (the existing deliberate design). The greeting is a client-rendered **user** message, so the text-fix is client-side and forward-only.

**Tech Stack:** Next.js 16 App Router, TypeScript, React, next-auth v5-beta, better-sqlite3, vitest (jsdom + @testing-library/react), Playwright (e2e).

> **Rev2 — Fable 5 plan-review fixes applied (2026-07-21).** Review verdict was REVISE (4 Critical + 2 Important); every state-claim was re-verified against the tree by the orchestrator. Fixes: Task 7 route decision extracted to a pure `resolvePreferencesJson` (unit-testable, no DB mocks); Task 8 TripForm test now mocks router/places/carousel/next-auth, enters flight mode, and adds `data-testid` to both origin inputs, and patches the existing `TripForm.test.tsx` with a next-auth mock (C2/C3); Task 9 uses a separate `[status]` effect to avoid a stale-closure dead feature (C1) with its guard test relabelled honestly (C4); Task 10 adds a CI-safe route-interception body assert (I1) and an explicit dev-server precondition (I2). The `no-price-confirm` Fable clause is correct — Jose authorized unmetered Fable @50% on 2026-07-21 (recorded in CLAUDE.md); the reviewer flagged it only because it couldn't see that message (I3).

## Global Constraints

- **Approach ① only.** Guests remain localStorage-only. Do NOT relax `/api/user/preferences` guest gating (that's rejected Approach ②).
- **Single airport validator:** `parseIata` (`/^[A-Z]{3}$/`, uppercases + trims). Enforced identically in BootstrapModal save-gate, `readGuestPrefs`/`parseGuestPrefs`, and the chat route. Never `[A-Z]{1,4}`.
- **Guest interests allowlist:** validate against `GUEST_INTERESTS = ['beach','mountains','food','culture']`, deduped, capped at 4. Never allowlist against `PREF_ENUMS.interests` (it lacks `'mountains'`).
- **No fabrication:** a missing airport / budget / interests ⇒ its greeting clause is **omitted**, never defaulted. The server never invents a budget. The greeting never claims knowledge Atlas lacks.
- **Forward-only:** already-persisted "undefined" intros are historical; do not migrate them.
- **Model Routing:** Hermes `-m gpt-5.5` implements each fix; SOL XHIGH ⇄ Opus 4.8 consensus per fix; Fable 5 verifies (Fable is on the Max plan again — no price-confirm). Opus 4.8 orchestrates.
- **No deploy to VPS without Jose's visual review + explicit go-ahead.**
- **Test commands:** unit/component `npx vitest run <path>`; e2e `npx playwright test <path>`.

---

### Task 1: Extract canonical `parseIata` to `src/lib/iata.ts`

Single source for the IATA validator so a client-safe file can import it without pulling in the flight-fetch client.

**Files:**
- Create: `src/lib/iata.ts`
- Create: `src/lib/iata.test.ts`
- Modify: `src/lib/atlas/travelpayouts-client.ts` (remove local `parseIata` def near line 258; import + re-export from `@/lib/iata`)

**Interfaces:**
- Produces: `export function parseIata(value: string): string | null` — trims, uppercases, returns the 3-letter code or `null`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test**

Create `src/lib/iata.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseIata } from "./iata";

describe("parseIata", () => {
  it("accepts a 3-letter code, trimming + uppercasing", () => {
    expect(parseIata(" cun ")).toBe("CUN");
    expect(parseIata("MIA")).toBe("MIA");
  });
  it("rejects non-3-letter / non-alpha input", () => {
    expect(parseIata("CANCUN")).toBeNull();
    expect(parseIata("M1A")).toBeNull();
    expect(parseIata("mi'a")).toBeNull();
    expect(parseIata("KMIA")).toBeNull();
    expect(parseIata("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/iata.test.ts`
Expected: FAIL — `Failed to resolve import "./iata"`.

- [ ] **Step 3: Create `src/lib/iata.ts`**

```ts
/** Canonical IATA airport-code validator. Trims + uppercases; returns the 3-letter code or null. */
export function parseIata(value: string): string | null {
  const cleaned = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(cleaned) ? cleaned : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/iata.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Re-point `travelpayouts-client.ts` at the new module**

In `src/lib/atlas/travelpayouts-client.ts`, delete the local `parseIata` definition (the `export function parseIata(value: string): string | null { … }` block near line 258) and add, near the top imports:
```ts
import { parseIata } from "@/lib/iata";
export { parseIata };
```
Leave every internal `parseIata(...)` call site unchanged.

- [ ] **Step 6: Run the existing travelpayouts suite to confirm no breakage**

Run: `npx vitest run src/lib/atlas/travelpayouts-client.test.ts`
Expected: PASS — including the existing `parseIata / invalid-code handling` describe block (importers `surprise.ts`, `tool-loop.ts` still resolve `parseIata` from `travelpayouts-client`).

- [ ] **Step 7: Commit**

```bash
git add src/lib/iata.ts src/lib/iata.test.ts src/lib/atlas/travelpayouts-client.ts
git commit -m "refactor(iata): extract parseIata to lib/iata.ts (single validator source)"
```

---

### Task 2: Guest-prefs contract + validators — `src/lib/guest-prefs.ts`

The one definition of the guest-prefs shape and its validators. No `"use client"` — importable by client components and the route handler.

**Files:**
- Create: `src/lib/guest-prefs.ts`
- Create: `src/lib/guest-prefs.test.ts`

**Interfaces:**
- Consumes: `parseIata` from `@/lib/iata`.
- Produces:
  - `export const GUEST_PREFS_LS_KEY = "tpi_guest_prefs"`
  - `export const GUEST_INTERESTS = ['beach','mountains','food','culture'] as const`
  - `export type GuestInterest = (typeof GUEST_INTERESTS)[number]`
  - `export interface GuestPrefs { homeAirport: string; interests: GuestInterest[] }`
  - `export function parseGuestPrefs(raw: unknown): GuestPrefs | null` — strict: needs BOTH a valid IATA airport and ≥1 allowlisted interest.
  - `export function readGuestPrefs(): GuestPrefs | null` — SSR-safe localStorage read.
  - `export function writeGuestPrefs(p: GuestPrefs): void`
  - `export function sanitizeGuestInterests(raw: unknown): GuestInterest[]` — filter→allowlist→dedupe→cap 4 (reused by the server builder in Task 7).

- [ ] **Step 1: Write the failing test**

Create `src/lib/guest-prefs.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { parseGuestPrefs, readGuestPrefs, writeGuestPrefs, GUEST_PREFS_LS_KEY } from "./guest-prefs";

describe("parseGuestPrefs", () => {
  it("accepts valid airport + allowlisted interests", () => {
    expect(parseGuestPrefs({ homeAirport: "mia", interests: ["beach", "mountains"] }))
      .toEqual({ homeAirport: "MIA", interests: ["beach", "mountains"] });
  });
  it("rejects a non-3-letter airport", () => {
    expect(parseGuestPrefs({ homeAirport: "M1A", interests: ["beach"] })).toBeNull();
    expect(parseGuestPrefs({ homeAirport: "KMIA", interests: ["beach"] })).toBeNull();
  });
  it("drops non-allowlisted interests and dedupes/caps", () => {
    expect(parseGuestPrefs({ homeAirport: "MIA", interests: ["beach", "hacking", "beach", "food", "culture", "mountains"] }))
      .toEqual({ homeAirport: "MIA", interests: ["beach", "food", "culture", "mountains"] });
  });
  it("returns null when no valid interest remains or input malformed", () => {
    expect(parseGuestPrefs({ homeAirport: "MIA", interests: ["hacking"] })).toBeNull();
    expect(parseGuestPrefs({ homeAirport: "MIA" })).toBeNull();
    expect(parseGuestPrefs(null)).toBeNull();
    expect(parseGuestPrefs("nonsense")).toBeNull();
  });
});

describe("readGuestPrefs / writeGuestPrefs", () => {
  beforeEach(() => localStorage.clear());
  it("round-trips valid prefs", () => {
    writeGuestPrefs({ homeAirport: "MIA", interests: ["beach", "food"] });
    expect(readGuestPrefs()).toEqual({ homeAirport: "MIA", interests: ["beach", "food"] });
  });
  it("returns null on missing or malformed storage", () => {
    expect(readGuestPrefs()).toBeNull();
    localStorage.setItem(GUEST_PREFS_LS_KEY, "{not json");
    expect(readGuestPrefs()).toBeNull();
    localStorage.setItem(GUEST_PREFS_LS_KEY, JSON.stringify({ homeAirport: "M1A", interests: ["beach"] }));
    expect(readGuestPrefs()).toBeNull();
  });
});
```

> Note: vitest is configured with a jsdom-like environment for component tests (see `TripForm.test.tsx`); `localStorage` is available. If this test file runs under the node environment, add `// @vitest-environment jsdom` as the first line.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/guest-prefs.test.ts`
Expected: FAIL — `Failed to resolve import "./guest-prefs"`.

- [ ] **Step 3: Create `src/lib/guest-prefs.ts`**

```ts
import { parseIata } from "@/lib/iata";

export const GUEST_PREFS_LS_KEY = "tpi_guest_prefs";
export const GUEST_INTERESTS = ["beach", "mountains", "food", "culture"] as const;
export type GuestInterest = (typeof GUEST_INTERESTS)[number];

export interface GuestPrefs {
  homeAirport: string;
  interests: GuestInterest[];
}

/** Filter untrusted input to the allowlist, deduped, capped at 4. */
export function sanitizeGuestInterests(raw: unknown): GuestInterest[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(GUEST_INTERESTS);
  const seen = new Set<GuestInterest>();
  for (const v of raw) {
    if (typeof v === "string" && allowed.has(v)) seen.add(v as GuestInterest);
    if (seen.size >= 4) break;
  }
  return Array.from(seen);
}

/** Strict parse: requires a valid IATA airport AND ≥1 allowlisted interest. */
export function parseGuestPrefs(raw: unknown): GuestPrefs | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const airport = typeof obj.homeAirport === "string" ? parseIata(obj.homeAirport) : null;
  const interests = sanitizeGuestInterests(obj.interests);
  if (!airport || interests.length === 0) return null;
  return { homeAirport: airport, interests };
}

export function readGuestPrefs(): GuestPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GUEST_PREFS_LS_KEY);
    if (!raw) return null;
    return parseGuestPrefs(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeGuestPrefs(p: GuestPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUEST_PREFS_LS_KEY, JSON.stringify(p));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/guest-prefs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/guest-prefs.ts src/lib/guest-prefs.test.ts
git commit -m "feat(guest-prefs): typed guest-prefs contract + validators"
```

---

### Task 3: `buildOnboardingIntro` + `dispatchOnboardingComplete`; wire the AssistantChat listener

The greeting fix. TDD ordering per spec I5: extract the CURRENT buggy template verbatim first (so the test goes red on an assertion, not an import), then fix.

**Files:**
- Modify: `src/lib/guest-prefs.ts` (add event helpers)
- Modify: `src/components/AssistantChat.tsx` (listener region ~611-628)
- Create: `src/lib/onboarding-intro.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `export interface OnboardingCompleteDetail { homeAirport?: string; interests?: string[]; budget?: string; aiAssisted?: boolean }`
  - `export function dispatchOnboardingComplete(detail: OnboardingCompleteDetail): void`
  - `export function buildOnboardingIntro(detail: unknown): string`

- [ ] **Step 1: Extract the current (buggy) template verbatim + wire the listener**

Append to `src/lib/guest-prefs.ts`:
```ts
export interface OnboardingCompleteDetail {
  homeAirport?: string;
  interests?: string[];
  budget?: string;
  aiAssisted?: boolean;
}

export function dispatchOnboardingComplete(detail: OnboardingCompleteDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("atlas-onboarding-complete", { detail }));
}

// TEMP (fixed in Step 3): verbatim copy of the current inline template — still reads `airport`, still emits "undefined".
export function buildOnboardingIntro(detail: unknown): string {
  const { interests, airport, budget, aiAssisted } = (detail ?? {}) as {
    interests?: string[]; airport?: string; budget?: string; aiAssisted?: boolean;
  };
  return aiAssisted
    ? `Great! I'm Atlas, your AI travel companion. I'll pick the best interests and vibes for you based on your preferences. Let's find your next perfect trip! 🌍 I see you're flying from ${airport} with a ${budget} budget. What destination are you dreaming about?`
    : `Great! I'm Atlas, your AI travel companion. I see you're interested in ${(interests ?? []).join(", ")} and flying from ${airport} with a ${budget} budget. Let's find your next perfect trip! 🌍 What destination are you thinking about?`;
}
```

In `src/components/AssistantChat.tsx`, add to the imports:
```ts
import { buildOnboardingIntro } from "@/lib/guest-prefs";
```
Replace the listener body (the `handleOnboardingComplete` `if (event instanceof CustomEvent)` block, ~613-623) so it delegates to the builder:
```ts
    const handleOnboardingComplete = (event: Event) => {
      if (event instanceof CustomEvent) {
        setIsOpen(true);
        setTimeout(() => {
          sendMessageRef.current(buildOnboardingIntro(event.detail));
        }, 300);
      }
    };
```
(Behavior-preserving refactor — still buggy for guests, since the TEMP builder still reads `airport`. The only difference from the current inline code is the `(interests ?? [])` guard against a `.join` on `undefined`, which no real producer triggers.)

- [ ] **Step 2: Write the failing test**

Create `src/lib/onboarding-intro.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildOnboardingIntro } from "./guest-prefs";

describe("buildOnboardingIntro", () => {
  it("guest (homeAirport + interests, no budget) — never 'undefined'", () => {
    const out = buildOnboardingIntro({ homeAirport: "MIA", interests: ["beach", "mountains"] });
    expect(out).not.toContain("undefined");
    expect(out).toContain("flying from MIA");
    expect(out).toContain("interested in beach, mountains");
  });
  it("legacy `{ airport }` shape must still not emit 'undefined' (mutation guard)", () => {
    const out = buildOnboardingIntro({ airport: "JFK", budget: "mid", interests: ["food"] });
    expect(out).not.toContain("undefined");
  });
  it("authed non-AI (all fields) preserves the original copy verbatim", () => {
    expect(buildOnboardingIntro({ homeAirport: "MIA", budget: "mid", interests: ["beach", "food"], aiAssisted: false }))
      .toBe("Great! I'm Atlas, your AI travel companion. I see you're interested in beach, food and flying from MIA with a mid budget. Let's find your next perfect trip! 🌍 What destination are you thinking about?");
  });
  it("authed AI (airport + budget) preserves the original copy verbatim", () => {
    expect(buildOnboardingIntro({ homeAirport: "MIA", budget: "mid", aiAssisted: true }))
      .toBe("Great! I'm Atlas, your AI travel companion. I'll pick the best interests and vibes for you based on your preferences. Let's find your next perfect trip! 🌍 I see you're flying from MIA with a mid budget. What destination are you dreaming about?");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/onboarding-intro.test.ts`
Expected: FAIL — the guest test's `not.toContain("undefined")` fails (verbatim template reads `airport`, which is absent → "flying from undefined"); the authed-verbatim cases also fail because they use `homeAirport`, not `airport`.

- [ ] **Step 4: Replace `buildOnboardingIntro` with the conditional-clause version**

In `src/lib/guest-prefs.ts`, replace the TEMP function body with:
```ts
export function buildOnboardingIntro(detail: unknown): string {
  const d = (detail ?? {}) as Record<string, unknown>;
  const aiAssisted = d.aiAssisted === true;
  const airport = typeof d.homeAirport === "string" && d.homeAirport.trim() ? d.homeAirport.trim() : "";
  const budget = typeof d.budget === "string" && d.budget.trim() ? d.budget.trim() : "";
  const interests = Array.isArray(d.interests)
    ? d.interests.filter((i): i is string => typeof i === "string" && i.trim().length > 0)
    : [];

  let originClause = "";
  if (airport && budget) originClause = `flying from ${airport} with a ${budget} budget`;
  else if (airport) originClause = `flying from ${airport}`;
  else if (budget) originClause = `with a ${budget} budget`;

  if (aiAssisted) {
    const see = originClause ? `I see you're ${originClause}. ` : "";
    return `Great! I'm Atlas, your AI travel companion. I'll pick the best interests and vibes for you based on your preferences. Let's find your next perfect trip! 🌍 ${see}What destination are you dreaming about?`;
  }

  const parts: string[] = [];
  if (interests.length) parts.push(`interested in ${interests.join(", ")}`);
  if (originClause) parts.push(originClause);
  const see = parts.length ? `I see you're ${parts.join(" and ")}. ` : "";
  return `Great! I'm Atlas, your AI travel companion. ${see}Let's find your next perfect trip! 🌍 What destination are you thinking about?`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/onboarding-intro.test.ts`
Expected: PASS (4 tests). The two verbatim cases confirm the authed copy is unchanged; the guest + legacy cases confirm no "undefined".

- [ ] **Step 6: Commit**

```bash
git add src/lib/guest-prefs.ts src/lib/onboarding-intro.test.ts src/components/AssistantChat.tsx
git commit -m "fix(atlas): honest onboarding greeting via total buildOnboardingIntro"
```

---

### Task 4: BootstrapModal uses the contract; strict IATA save-gate; canonical dispatch

**Files:**
- Modify: `src/components/BootstrapModal.tsx`
- Create: `src/components/BootstrapModal.test.tsx`

**Interfaces:**
- Consumes: `GUEST_PREFS_LS_KEY`, `GUEST_INTERESTS`, `GuestInterest`, `writeGuestPrefs`, `dispatchOnboardingComplete` from `@/lib/guest-prefs`; `parseIata` from `@/lib/iata`.
- Produces: still exports `GUEST_BOOTSTRAP_LS_KEY` (imported by `OnboardingWrapper`); re-exports `GUEST_INTERESTS`, `GUEST_PREFS_LS_KEY` for back-compat.

- [ ] **Step 1: Write the failing test**

Create `src/components/BootstrapModal.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BootstrapModal from "./BootstrapModal";
import { GUEST_PREFS_LS_KEY } from "@/lib/guest-prefs";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("BootstrapModal", () => {
  beforeEach(() => localStorage.clear());

  it("keeps Save disabled until a valid 3-letter IATA + 2 interests", () => {
    render(<BootstrapModal onClose={() => {}} />);
    const airport = screen.getByTestId("bootstrap-home-airport");
    const save = screen.getByTestId("bootstrap-save") as HTMLButtonElement;
    fireEvent.change(airport, { target: { value: "MI" } });
    fireEvent.click(screen.getByRole("button", { name: /beach/i }));
    fireEvent.click(screen.getByRole("button", { name: /food/i }));
    expect(save.disabled).toBe(true); // airport not yet 3 letters
    fireEvent.change(airport, { target: { value: "MIA" } });
    expect(save.disabled).toBe(false);
  });

  it("on save, writes the contract shape + dispatches the canonical event", () => {
    const detail = vi.fn();
    window.addEventListener("atlas-onboarding-complete", (e) => detail((e as CustomEvent).detail));
    render(<BootstrapModal onClose={() => {}} />);
    fireEvent.change(screen.getByTestId("bootstrap-home-airport"), { target: { value: "mia" } });
    fireEvent.click(screen.getByRole("button", { name: /beach/i }));
    fireEvent.click(screen.getByRole("button", { name: /food/i }));
    fireEvent.click(screen.getByTestId("bootstrap-save"));
    expect(JSON.parse(localStorage.getItem(GUEST_PREFS_LS_KEY)!)).toEqual({ homeAirport: "MIA", interests: ["beach", "food"] });
    expect(detail).toHaveBeenCalledWith({ homeAirport: "MIA", interests: ["beach", "food"] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BootstrapModal.test.tsx`
Expected: FAIL on **test 1 only** (the IATA gate — current `canSave` checks only non-empty, so Save is enabled at "MI"). **Test 2 already PASSES on current code** — `save()` already writes `{homeAirport, interests}` and dispatches that exact shape — so it is a non-regression guard, not a red.

- [ ] **Step 3: Rewire BootstrapModal to the contract**

In `src/components/BootstrapModal.tsx`:
- Replace the local `GUEST_PREFS_LS_KEY` and `GUEST_INTERESTS`/`GuestInterest` declarations with imports + back-compat re-exports:
```ts
import { parseIata } from "@/lib/iata";
import {
  GUEST_PREFS_LS_KEY,
  GUEST_INTERESTS,
  writeGuestPrefs,
  dispatchOnboardingComplete,
  type GuestInterest,
} from "@/lib/guest-prefs";

export const GUEST_BOOTSTRAP_LS_KEY = "tpi_onboarding_bootstrap_complete";
export { GUEST_PREFS_LS_KEY, GUEST_INTERESTS };
```
- Change `canSave` and the input gate to require a valid IATA:
```ts
  const airportValid = parseIata(homeAirport) !== null;
  const canSave = airportValid && interests.length >= 2;
```
- Rewrite `save()`:
```ts
  function save() {
    const airport = parseIata(homeAirport);
    if (!airport || interests.length < 2) return;
    const prefs = { homeAirport: airport, interests };
    localStorage.setItem(GUEST_BOOTSTRAP_LS_KEY, "1");
    writeGuestPrefs(prefs);
    dispatchOnboardingComplete(prefs);
    onClose();
  }
```
- Keep the input `maxLength={4}` (allows correction) and placeholder `e.g. MIA`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/BootstrapModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Confirm OnboardingWrapper still resolves its import**

Run: `npx vitest run src/components/BootstrapModal.test.tsx && npx tsc --noEmit`
Expected: PASS + no type errors (`OnboardingWrapper` imports `GUEST_BOOTSTRAP_LS_KEY`, still exported).

- [ ] **Step 6: Commit**

```bash
git add src/components/BootstrapModal.tsx src/components/BootstrapModal.test.tsx
git commit -m "feat(onboarding): BootstrapModal uses guest-prefs contract + strict IATA gate"
```

---

### Task 5: OnboardingModal — canonical `homeAirport` key + guest-prefs prefill (M2)

> **Intermediate-commit note:** between the Task 3 and Task 5 commits, the *authed* greeting silently omits the airport/budget clause (OnboardingModal still dispatches the legacy `{airport}` key until this task renames it, and the fixed builder omits unknown fields — it never emits "undefined" or fabricates). All tasks ship on one branch, so this is not a shippable regression; the note just prevents a mid-branch bisect from mistaking it for one.

**Files:**
- Modify: `src/components/OnboardingModal.tsx`
- Create: `src/components/OnboardingModal.dispatch.test.tsx`

**Interfaces:**
- Consumes: `dispatchOnboardingComplete`, `readGuestPrefs` from `@/lib/guest-prefs`.

- [ ] **Step 1: Write the failing test**

Create `src/components/OnboardingModal.dispatch.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { buildOnboardingIntro } from "@/lib/guest-prefs";

// Guard: the authed producer must emit the `homeAirport` key the listener reads.
describe("OnboardingModal event contract", () => {
  it("a detail using `homeAirport` renders with the airport (not undefined)", () => {
    const out = buildOnboardingIntro({ homeAirport: "MIA", budget: "mid", interests: ["beach"], aiAssisted: false });
    expect(out).toContain("flying from MIA");
    expect(out).not.toContain("undefined");
  });
});
```
> This asserts the contract the OnboardingModal edit must satisfy; the behavioral prefill is covered by manual verification + tsc (component-mount tests for OnboardingModal require next-auth session mocking, out of proportion here).

- [ ] **Step 2: Run test to verify it passes as a contract guard**

Run: `npx vitest run src/components/OnboardingModal.dispatch.test.tsx`
Expected: PASS (guards the key name Task 5 must use).

- [ ] **Step 3: Rename the emitted key + add prefill**

In `src/components/OnboardingModal.tsx`:
- Add imports:
```ts
import { dispatchOnboardingComplete, readGuestPrefs } from "@/lib/guest-prefs";
```
- In `finish()`, replace the **entire existing** `setTimeout(() => { window.dispatchEvent(new CustomEvent("atlas-onboarding-complete", { detail: { interests, airport, budget, aiAssisted } })); }, 500);` block (`OnboardingModal.tsx:118-122`) — do **not** nest a new timer inside the old one — with:
```ts
        setTimeout(() => {
          dispatchOnboardingComplete({ homeAirport: airport, budget, interests, aiAssisted });
        }, 500);
```
- Add a mount effect that seeds empty fields from a completed guest session (M2), after the existing state declarations:
```ts
  useEffect(() => {
    const g = readGuestPrefs();
    if (!g) return;
    setAirport((a) => a || g.homeAirport);
    setInterests((i) => (i.length ? i : [...g.interests]));
  }, []);
```
(`g.interests` are the 4 guest values; `'mountains'` — absent from `PREF_ENUMS.interests` — renders as a custom interest chip, which the modal already supports.)

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/components/OnboardingModal.dispatch.test.tsx && npx tsc --noEmit`
Expected: PASS + no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/OnboardingModal.tsx src/components/OnboardingModal.dispatch.test.tsx
git commit -m "feat(onboarding): OnboardingModal canonical homeAirport key + guest prefill"
```

---

### Task 6: AssistantChat sends `guest_prefs` in the chat POST body

**Files:**
- Modify: `src/components/AssistantChat.tsx` (the `fetch("/api/assistant/chat", …)` body, ~739-746)
- Create: `src/components/AssistantChat.guest.test.tsx`

**Interfaces:**
- Consumes: `readGuestPrefs` from `@/lib/guest-prefs`.
- Produces: POST body gains optional `guest_prefs: { homeAirport, interests }`. Note: this is sent whenever local guest prefs exist (including for an authed user on a shared browser) — harmless, because the **server** gate (`resolvePreferencesJson` + `ctx.isGuest` in Task 7) is the trust boundary and discards it for authed requests.

- [ ] **Step 1: Write the failing test**

Create `src/components/AssistantChat.guest.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readGuestPrefs, writeGuestPrefs } from "@/lib/guest-prefs";

// The body-builder contract: when guest prefs exist, include them; else omit.
function buildBody(message: string, sid: string, pageContext: string) {
  const gp = readGuestPrefs();
  return { message, session_id: sid, page_context: pageContext, ...(gp ? { guest_prefs: gp } : {}) };
}

describe("chat POST body includes guest_prefs when present", () => {
  beforeEach(() => localStorage.clear());
  it("omits guest_prefs when none stored", () => {
    expect(buildBody("hi", "s1", "ctx")).not.toHaveProperty("guest_prefs");
  });
  it("includes validated guest_prefs when stored", () => {
    writeGuestPrefs({ homeAirport: "MIA", interests: ["beach"] });
    expect(buildBody("hi", "s1", "ctx").guest_prefs).toEqual({ homeAirport: "MIA", interests: ["beach"] });
  });
});
```
> The AssistantChat body is assembled inline; this test pins the exact contract the edit must reproduce (spreading `guest_prefs` only when present).

- [ ] **Step 2: Run test to verify it passes as a contract guard**

Run: `npx vitest run src/components/AssistantChat.guest.test.tsx`
Expected: PASS (guards the body shape Step 3 must produce).

> Honest scope: this guards a local mirror of the body assembly, not the component render. The real end-to-end proof that `guest_prefs` ships in the POST is Task 10's route interception.

- [ ] **Step 3: Add `guest_prefs` to the real POST body**

In `src/components/AssistantChat.tsx`, ensure the import from Task 3 also pulls `readGuestPrefs`:
```ts
import { buildOnboardingIntro, readGuestPrefs } from "@/lib/guest-prefs";
```
Immediately before the `fetch("/api/assistant/chat", …)` call, add:
```ts
        const guestPrefs = readGuestPrefs();
```
and change the body to:
```ts
          body: JSON.stringify({
            message: text.trim(),
            session_id: sid,
            page_context: pageContext,
            ...(guestPrefs ? { guest_prefs: guestPrefs } : {}),
          }),
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/components/AssistantChat.guest.test.tsx && npx tsc --noEmit`
Expected: PASS + no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/AssistantChat.tsx src/components/AssistantChat.guest.test.tsx
git commit -m "feat(atlas): send guest_prefs in chat POST body"
```

---

### Task 7: Chat route builds a guest `preferencesJson` (field-independent, server-revalidated)

**Files:**
- Modify: `src/lib/guest-prefs.ts` (add `buildGuestPreferencesJson` + `resolvePreferencesJson`)
- Modify: `src/app/api/assistant/chat/route.ts` (body parse ~46-53; preferencesJson ~79-83)
- Create: `src/lib/guest-preferences-json.test.ts`

**Interfaces:**
- Consumes: `parseIata` from `@/lib/iata`, `sanitizeGuestInterests` from `@/lib/guest-prefs`.
- Produces:
  - `export function buildGuestPreferencesJson(raw: unknown): string` — JSON carrying only the independently-valid fields (`home_airport` and/or `interests`), or `"{}"`.
  - `export function resolvePreferencesJson(opts: { isGuest: boolean; dbPrefs?: string; guestPrefs?: unknown }): string` — the route's whole decision, extracted **pure** so it is unit-testable without DB mocks (addresses the functional-coverage gap the reviewer flagged).

- [ ] **Step 1: Write the failing test**

Create `src/lib/guest-preferences-json.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildGuestPreferencesJson, resolvePreferencesJson } from "./guest-prefs";

describe("buildGuestPreferencesJson", () => {
  it("includes both fields when valid", () => {
    expect(JSON.parse(buildGuestPreferencesJson({ homeAirport: "mia", interests: ["beach", "mountains"] })))
      .toEqual({ home_airport: "MIA", interests: ["beach", "mountains"] });
  });
  it("keeps valid interests even when the airport is invalid (field-independent)", () => {
    expect(JSON.parse(buildGuestPreferencesJson({ homeAirport: "M1A", interests: ["beach"] })))
      .toEqual({ interests: ["beach"] });
  });
  it("keeps the airport when interests are absent", () => {
    expect(JSON.parse(buildGuestPreferencesJson({ homeAirport: "MIA" })))
      .toEqual({ home_airport: "MIA" });
  });
  it("returns '{}' for garbage", () => {
    expect(buildGuestPreferencesJson(null)).toBe("{}");
    expect(buildGuestPreferencesJson({ homeAirport: "KMIA", interests: ["hacking"] })).toBe("{}");
  });
});

describe("resolvePreferencesJson", () => {
  it("authed or guest-with-row: DB prefs win", () => {
    expect(resolvePreferencesJson({ isGuest: false, dbPrefs: '{"home_airport":"LAX"}' })).toBe('{"home_airport":"LAX"}');
    expect(resolvePreferencesJson({ isGuest: true, dbPrefs: '{"home_airport":"LAX"}', guestPrefs: { homeAirport: "MIA", interests: ["beach"] } })).toBe('{"home_airport":"LAX"}');
  });
  it("guest + no row + valid guest_prefs → built profile", () => {
    expect(JSON.parse(resolvePreferencesJson({ isGuest: true, guestPrefs: { homeAirport: "MIA", interests: ["beach"] } })))
      .toEqual({ home_airport: "MIA", interests: ["beach"] });
  });
  it("returns '{}' when nothing usable", () => {
    expect(resolvePreferencesJson({ isGuest: true, guestPrefs: { homeAirport: "KMIA" } })).toBe("{}");
    expect(resolvePreferencesJson({ isGuest: false })).toBe("{}");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/guest-preferences-json.test.ts`
Expected: FAIL — `buildGuestPreferencesJson` is not exported.

- [ ] **Step 3: Add `buildGuestPreferencesJson` to `guest-prefs.ts`**

Append to `src/lib/guest-prefs.ts`:
```ts
/** Server-side: build a preferencesJson (snake_case) from untrusted guest_prefs, field-independent. */
export function buildGuestPreferencesJson(raw: unknown): string {
  const out: { home_airport?: string; interests?: GuestInterest[] } = {};
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const airport = typeof obj.homeAirport === "string" ? parseIata(obj.homeAirport) : null;
    if (airport) out.home_airport = airport;
    const interests = sanitizeGuestInterests(obj.interests);
    if (interests.length) out.interests = interests;
  }
  return JSON.stringify(out);
}

/** The chat route's preferencesJson decision, extracted pure so it needs no DB mocks to test. */
export function resolvePreferencesJson(opts: { isGuest: boolean; dbPrefs?: string; guestPrefs?: unknown }): string {
  if (opts.dbPrefs) return opts.dbPrefs; // authed, or a guest with a stored row → DB wins (matches the old `prefRow?.prefs || "{}"`)
  if (opts.isGuest && opts.guestPrefs !== undefined) {
    const built = buildGuestPreferencesJson(opts.guestPrefs);
    if (built !== "{}") return built;
  }
  return "{}";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/guest-preferences-json.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into the chat route**

In `src/app/api/assistant/chat/route.ts`:
- Add the import:
```ts
import { resolvePreferencesJson } from "@/lib/guest-prefs";
```
- Widen the body type + destructure `guest_prefs` (~46-53):
```ts
  let body: { message: string; session_id: string; page_context?: string; guest_prefs?: unknown };
  …
  const { message, session_id, page_context, guest_prefs } = body;
```
- Replace the `preferencesJson` assignment (~83, currently `const preferencesJson = prefRow?.prefs || "{}";`) with the extracted pure decision:
```ts
  const preferencesJson = resolvePreferencesJson({
    isGuest: ctx.isGuest,
    dbPrefs: prefRow?.prefs,
    guestPrefs: guest_prefs,
  });
```
(Authenticated path unchanged: a present `prefRow` → DB wins. The client value is never trusted — `resolvePreferencesJson` re-validates via `buildGuestPreferencesJson`, which enforces the 3-letter airport + 4-literal interest allowlist. This is the single wiring point, now covered by the `resolvePreferencesJson` unit tests above.)

- [ ] **Step 6: Typecheck + full unit suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS — no type errors; all unit/component tests green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/guest-prefs.ts src/lib/guest-preferences-json.test.ts src/app/api/assistant/chat/route.ts
git commit -m "feat(atlas): guest home airport reaches the LLM via server-built preferencesJson"
```

---

### Task 8: TripForm origin pre-fill from guest prefs (M1)

**Files:**
- Modify: `src/components/TripForm.tsx` (add `data-testid="trip-origin"` to both origin inputs ~636 and ~974; add `useSession` + a guest-fallback effect after the prefs effect ~145-153)
- Modify: `src/components/TripForm.test.tsx` (add a `next-auth/react` mock — required once TripForm calls `useSession`, or the 3 existing tests throw "must be wrapped in `<SessionProvider>`")
- Create: `src/components/TripForm.guest.test.tsx`

**Interfaces:**
- Consumes: `readGuestPrefs` from `@/lib/guest-prefs`; `useSession` from `next-auth/react`.

> **Reviewer C2/C3:** TripForm mounts in `'chooser'` mode (origin inputs live only in the flight/explore branches, at ~636/~974, neither with a `name`/`testid`) and depends on `useRouter`/`usePlacesAutocomplete`/`PackageDealsCarousel`. The test must mock those (mirroring `TripForm.test.tsx:9-11`), enter flight mode, and target a `data-testid`. Adding `useSession` to TripForm also breaks the existing suite unless it too mocks `next-auth/react`.

- [ ] **Step 1: Add the test hook + write the failing test**

First add `data-testid="trip-origin"` to **both** origin `<input>`s — the flight branch (~636) and the explore branch (~974). Each currently begins `<input ref={originRef} type="text" value={origin}`; change both to:
```tsx
                <input ref={originRef} data-testid="trip-origin" type="text" value={origin}
```

Then create `src/components/TripForm.guest.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TripForm from "./TripForm";
import { writeGuestPrefs } from "@/lib/guest-prefs";

// TripForm mounts in 'chooser' mode and depends on router/places/carousel — mirror TripForm.test.tsx's mocks.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/usePlacesAutocomplete", () => ({ usePlacesAutocomplete: () => {} }));
vi.mock("./PackageDealsCarousel", () => ({ default: () => null }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "unauthenticated", data: null }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

beforeEach(() => {
  localStorage.clear();
  // /api/user/preferences returns guest defaults (empty home_airport)
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ home_airport: "", interests: [] }) })) as unknown as typeof fetch);
});

describe("TripForm guest origin pre-fill", () => {
  it("pre-fills origin from guest prefs when unauthenticated + API has none", async () => {
    writeGuestPrefs({ homeAirport: "MIA", interests: ["beach"] });
    render(<TripForm />);
    // Enter flight mode so the origin input renders. With the k=>k next-intl mock, the flight card label
    // is the literal key "pathATitle" (the button's onClick calls selectMode('flight')).
    fireEvent.click(screen.getByText("pathATitle"));
    await waitFor(() => {
      expect((screen.getByTestId("trip-origin") as HTMLInputElement).value).toBe("MIA");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/TripForm.guest.test.tsx`
Expected: FAIL — the origin input renders (testid present) but its value stays `""` (no guest fallback yet), so `.value` is `""`, not `"MIA"`.

- [ ] **Step 3: Add the guarded guest fallback + patch the existing suite**

In `src/components/TripForm.tsx`:
- Add imports:
```ts
import { useSession } from "next-auth/react";
import { readGuestPrefs } from "@/lib/guest-prefs";
```
- Add `const { status } = useSession();` alongside the other hooks (near `const router = useRouter();`, ~94).
- After the existing `/api/user/preferences` pre-fill effect (~145-153), add:
```ts
  // Guest origin pre-fill — only when unauthenticated, so an authed user never inherits a prior guest's airport
  useEffect(() => {
    if (status !== "unauthenticated") return;
    const g = readGuestPrefs();
    if (g) setOrigin((prev) => prev || g.homeAirport);
  }, [status]);
```

In `src/components/TripForm.test.tsx` — TripForm now calls `useSession`, which throws without a provider. Add this beside the existing `vi.mock` lines (~9-11):
```ts
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "unauthenticated", data: null }) }));
```

- [ ] **Step 4: Run BOTH TripForm suites**

Run: `npx vitest run src/components/TripForm.test.tsx src/components/TripForm.guest.test.tsx`
Expected: PASS — the new guest test is green AND the 3 existing TripForm tests still pass (no `SessionProvider` error).

- [ ] **Step 5: Commit**

```bash
git add src/components/TripForm.tsx src/components/TripForm.test.tsx src/components/TripForm.guest.test.tsx
git commit -m "feat(planner): TripForm pre-fills origin from guest prefs (guest-only)"
```

---

### Task 9: ItineraryBuilder interests fallback from guest prefs (M3)

**Files:**
- Modify: `src/components/ItineraryBuilder.tsx` (add `useSession` + a **separate** `[status]` effect; leave the existing `[]`-dep API-merge effect untouched)
- Create: `src/components/ItineraryBuilder.guest.test.tsx`

**Interfaces:**
- Consumes: `readGuestPrefs` from `@/lib/guest-prefs`; `useSession` from `next-auth/react`.

> **Why a separate effect (reviewer C1 — critical):** `SessionProviderWrapper` passes no `session`, so `useSession().status` is `"loading"` on first render. Reading `status` inside the existing `[]`-dep prefs effect's `.then` would capture `"loading"` forever → the fallback would be dead code for every real guest (a green test over a non-functional feature). A dedicated effect keyed on `[status]` re-runs when auth resolves. Guests always get `interests: []` from the API (`DEFAULT_PREFERENCES`, `preferences.ts:51`), so this effect needs no coordination with the fetch.

- [ ] **Step 1: Write the contract-guard test**

Create `src/components/ItineraryBuilder.guest.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { readGuestPrefs, writeGuestPrefs } from "@/lib/guest-prefs";

// Mirror of the effect's merge logic (the effect body is a copy of Task 8's verified [status] pattern).
function guestInterestMerge(prev: string[], unauthenticated: boolean): string[] {
  if (!unauthenticated) return prev;
  const g = readGuestPrefs();
  return g?.interests.length ? Array.from(new Set([...prev, ...g.interests])) : prev;
}

describe("ItineraryBuilder guest interests fallback (contract)", () => {
  beforeEach(() => localStorage.clear());
  it("merges guest interests when unauthenticated", () => {
    writeGuestPrefs({ homeAirport: "MIA", interests: ["beach", "food"] });
    expect(guestInterestMerge(["culture"], true).sort()).toEqual(["beach", "culture", "food"]);
  });
  it("ignores guest prefs for an authenticated user", () => {
    writeGuestPrefs({ homeAirport: "MIA", interests: ["beach"] });
    expect(guestInterestMerge(["culture"], false)).toEqual(["culture"]);
  });
});
```

- [ ] **Step 2: Run the guard**

Run: `npx vitest run src/components/ItineraryBuilder.guest.test.tsx`
Expected: **PASS** — this is a non-regression contract guard over a local mirror (`readGuestPrefs`/`writeGuestPrefs` exist after Task 2), **not** a red for the component. The component behavior is a byte-copy of Task 8's `[status]` effect, which IS behaviorally tested by `TripForm.guest.test.tsx`; here we lean on `tsc` + the guard (a full ItineraryBuilder render needs `initialItems` + Map/Budget mocks — disproportionate for this minor parity feature). Labelled honestly per the reviewer (C4/I1).

- [ ] **Step 3: Add the separate guest-interests effect**

In `src/components/ItineraryBuilder.tsx`:
- Add imports:
```ts
import { useSession } from "next-auth/react";
import { readGuestPrefs } from "@/lib/guest-prefs";
```
- Add `const { status } = useSession();` alongside the other hooks.
- **Leave the existing `[]`-dep `/api/user/preferences` effect (~135-147) unchanged.** Add a new effect immediately after it:
```ts
  // Guest interests fallback — a SEPARATE [status] effect so it re-runs when auth resolves (not captured as "loading")
  useEffect(() => {
    if (status !== "unauthenticated") return;
    const g = readGuestPrefs();
    if (g?.interests.length) {
      setUserInterests(prev => Array.from(new Set([...prev, ...g.interests])));
    }
  }, [status]);
```

- [ ] **Step 4: Guard + typecheck**

Run: `npx vitest run src/components/ItineraryBuilder.guest.test.tsx && npx tsc --noEmit`
Expected: PASS + no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ItineraryBuilder.tsx src/components/ItineraryBuilder.guest.test.tsx
git commit -m "feat(planner): ItineraryBuilder falls back to guest interests (guest-only)"
```

---

### Task 10: E2e — guest greeting shows the airport + POST carries `guest_prefs`, never "undefined"

Extend the existing bootstrap test. Assert (a) the optimistic **user bubble** (renders before the chat POST → robust in CI where the SSE fetch degrades to "Connection lost") and (b) the POST body carries `guest_prefs` — CI-safe because it inspects the request, not the reply. Assertion (b) is the end-to-end proof of the functional half (defect #2).

> **Precondition (reviewer I2 — false-fail hazard):** `playwright.config.ts` sets `baseURL: 'http://localhost:3001'` and has **no `webServer`**; `npm run dev` serves port **3000**. Before running any step below, start the app on 3001 and wait until it responds:
> ```bash
> npx next dev -p 3001 &     # then wait for a 200 on http://localhost:3001
> ```
> (Or export `BASE_URL` to point at an already-running instance.) Without this, Playwright fails with connection-refused on a perfectly correct tree.

**Files:**
- Modify: `tests/e2e/planner-trust.spec.ts` (the `'Guest user sees bootstrap onboarding once'` test, ~246-265)

- [ ] **Step 1: Add POST capture + greeting/body assertions**

In `tests/e2e/planner-trust.spec.ts`, in `test('Guest user sees bootstrap onboarding once', …)`:

(a) Immediately after `await page.goto('/');`, register a capture of the Atlas chat POST (before the greeting can fire):
```ts
  let chatBody: any = null;
  await page.route('**/api/assistant/chat', (route) => {
    chatBody = route.request().postDataJSON();
    route.continue();
  });
```
(b) Immediately after `await page.click('[data-testid="bootstrap-save"]');` and BEFORE the reload, insert:
```ts
  // Optimistic USER-bubble greeting — must name the airport, never say "undefined". `.first()` avoids a
  // strict-mode double match if a local run WITH an Anthropic key has Atlas echo the airport in its reply.
  await expect(page.getByText(/flying from MIA/i).first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/interested in\b.*\bbeach\b/i).first()).toBeVisible();
  await expect(page.getByText("undefined")).toHaveCount(0);
  // Functional wiring: the POST carries the guest prefs (CI-safe — inspects the request, not the SSE reply).
  await expect.poll(() => chatBody?.guest_prefs).toEqual({ homeAirport: 'MIA', interests: ['beach', 'food'] });
```

- [ ] **Step 2: Run the test on the fixed build**

Run: `npx playwright test tests/e2e/planner-trust.spec.ts -g "bootstrap onboarding once"`
Expected: PASS — the user bubble reads "…interested in beach, food and flying from MIA…"; nothing says "undefined"; the captured POST body carries `guest_prefs`.

- [ ] **Step 3: Mutation-proof the guard**

Temporarily revert `buildOnboardingIntro` in `src/lib/guest-prefs.ts` to the TEMP verbatim version (reads `airport`, emits "undefined"); re-run the command above.
Expected: FAIL on `flying from MIA` / `getByText("undefined")`. Restore the fix and confirm PASS again.

- [ ] **Step 4: Full suite (with the dev server running on 3001)**

Run: `npx vitest run && npx tsc --noEmit && npx playwright test tests/e2e/planner-trust.spec.ts`
Expected: all green — unit/component suite (baseline 323 + the new tests), no type errors, e2e passing.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/planner-trust.spec.ts
git commit -m "test(e2e): guest greeting shows airport + POST carries guest_prefs, never 'undefined'"
```

---

## Self-Review

**Spec coverage:** §5.1 guest-prefs contract → T2; §5.2 canonical event + `buildOnboardingIntro` → T3; §5.3 functional context (POST body + route) → T6/T7; §5.4 TripForm → T8; §5.5 OnboardingModal prefill (M2) → T5; §5.6 ItineraryBuilder (M3, *interests*) → T9; §6 single validator → T1 (+ enforced T2/T4/T7); §6 interests allowlist → T2/T7; §7 TDD order + user-bubble e2e → T3/T10; §8 blast radius → all tasks (plus the new `src/lib/iata.ts`, a refinement of the spec's "reuse/re-export parseIata"). No gaps.

**Functional-half coverage (reviewer I1, now closed):** the airport-reaches-the-LLM path is proven by (a) `buildGuestPreferencesJson` + `resolvePreferencesJson` unit tests (T7 — the server transform + the exact route decision, extracted pure), and (b) the T10 e2e route-interception asserting the POST body carries `guest_prefs`. The greeting-honesty half is proven by the `buildOnboardingIntro` units (T3) + the T10 user-bubble assertions. The T5/T6/T9 "contract guard" tests are labelled honestly as non-regression guards over local mirrors, not component behavior.

**Placeholder scan:** every code step carries complete code; no TBD/TODO/"add validation"/"similar to Task N".

**Type consistency:** `GuestPrefs { homeAirport; interests }`, `parseGuestPrefs`, `readGuestPrefs`, `writeGuestPrefs`, `sanitizeGuestInterests`, `buildGuestPreferencesJson`, `resolvePreferencesJson`, `buildOnboardingIntro`, `dispatchOnboardingComplete`, `OnboardingCompleteDetail` are named identically wherever consumed. `parseIata` signature is stable across T1 consumers.

**Deviations from spec to note at handoff:** (1) new `src/lib/iata.ts` (bundle-safety realization of "single validator"); (2) new pure `resolvePreferencesJson` wrapping the route decision (testability); (3) TripForm/ItineraryBuilder guest gate uses `useSession().status === "unauthenticated"`, not the spec's `tpi_guest_hint` cookie (equivalent guard, avoids the httpOnly-readability question — arguably better). M3 label corrected in the spec (interests, not airport).

**Standing rule ([[feedback_update_help_with_features]]):** the guest airport prefill/greeting is internal wiring, not a new user-facing feature surface, so `help-content.ts` likely needs no line — but confirm during implementation and record the decision.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-21-guest-onboarding-atlas-wiring.md`. Per the pipeline, this plan goes to **Step 2 (code review)** before any implementation. After review fixes, implementation runs under Model Routing (Hermes implements, SOL⇄Opus consensus per fix, Fable verifies).
