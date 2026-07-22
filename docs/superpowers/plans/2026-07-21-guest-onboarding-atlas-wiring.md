# Guest Onboarding → Atlas Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a guest's onboarding home airport (and interests) reach Atlas honestly (greeting states only what is known — never "undefined") and functionally (the LLM context genuinely uses the airport), plus pre-fill origin on TripForm and interests on ItineraryBuilder — behind one typed, runtime-validated guest-prefs contract.

**Architecture:** Approach ① (localStorage-threaded). One canonical IATA validator (`src/lib/iata.ts`), one guest-prefs contract + event helpers (`src/lib/guest-prefs.ts`), a pure `buildOnboardingIntro` total over untrusted input, and a server-side field-independent guest `preferencesJson` in the chat route. Guests stay localStorage-only (the existing deliberate design). The greeting is a client-rendered **user** message, so the text-fix is client-side and forward-only.

**Tech Stack:** Next.js 15 App Router, TypeScript, React, next-auth, better-sqlite3, vitest (unit/component via @testing-library/react), Playwright (e2e).

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
Expected: PASS (5 assertions).

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
(Behavior is byte-identical to before — still buggy for guests — this is a pure refactor.)

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
Expected: FAIL — the disabled-until-valid-IATA assertion fails (current gate only checks non-empty), and the dispatched detail assertion may differ.

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
- In `finish()`, replace the raw `window.dispatchEvent(new CustomEvent("atlas-onboarding-complete", { detail: { interests, airport, budget, aiAssisted } }))` with:
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
- Produces: POST body gains optional `guest_prefs: { homeAirport, interests }`.

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
- Modify: `src/lib/guest-prefs.ts` (add `buildGuestPreferencesJson`)
- Modify: `src/app/api/assistant/chat/route.ts` (body parse ~46-53; preferencesJson ~79-83)
- Create: `src/lib/guest-preferences-json.test.ts`

**Interfaces:**
- Consumes: `parseIata` from `@/lib/iata`, `sanitizeGuestInterests` from `@/lib/guest-prefs`.
- Produces: `export function buildGuestPreferencesJson(raw: unknown): string` — JSON string carrying only the fields that independently validate (`home_airport` and/or `interests`), or `"{}"`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/guest-preferences-json.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildGuestPreferencesJson } from "./guest-prefs";

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/guest-preferences-json.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into the chat route**

In `src/app/api/assistant/chat/route.ts`:
- Add the import:
```ts
import { buildGuestPreferencesJson } from "@/lib/guest-prefs";
```
- Widen the body type + destructure `guest_prefs` (~46-53):
```ts
  let body: { message: string; session_id: string; page_context?: string; guest_prefs?: unknown };
  …
  const { message, session_id, page_context, guest_prefs } = body;
```
- Replace the `preferencesJson` assignment (~83) so guests with no DB row get a built profile:
```ts
  let preferencesJson = prefRow?.prefs || "{}";
  if (ctx.isGuest && !prefRow && guest_prefs !== undefined) {
    const built = buildGuestPreferencesJson(guest_prefs);
    if (built !== "{}") preferencesJson = built;
  }
```
(Authenticated path unchanged: `prefRow` present → DB wins. Server re-validates via `buildGuestPreferencesJson` — the client value is never trusted.)

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
- Modify: `src/components/TripForm.tsx` (the prefs `useEffect`, ~145-153)
- Create/Modify: `src/components/TripForm.guest.test.tsx`

**Interfaces:**
- Consumes: `readGuestPrefs` from `@/lib/guest-prefs`; `useSession` from `next-auth/react`.

- [ ] **Step 1: Write the failing test**

Create `src/components/TripForm.guest.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import TripForm from "./TripForm";
import { writeGuestPrefs } from "@/lib/guest-prefs";

vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "unauthenticated", data: null }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
// /api/user/preferences returns defaults for a guest (empty home_airport)
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ home_airport: "", interests: [] }) })) as unknown as typeof fetch);
});

describe("TripForm guest origin pre-fill", () => {
  it("pre-fills origin from guest prefs when unauthenticated and API has none", async () => {
    writeGuestPrefs({ homeAirport: "MIA", interests: ["beach"] });
    const { container } = render(<TripForm />);
    await waitFor(() => {
      const origin = container.querySelector('input[name="origin"], [data-testid="trip-origin"]') as HTMLInputElement | null;
      expect(origin?.value).toBe("MIA");
    });
  });
});
```
> If TripForm's origin input has no `name`/`data-testid`, add `data-testid="trip-origin"` to it in Step 3 (a stable test hook) and target that.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/TripForm.guest.test.tsx`
Expected: FAIL — origin stays empty (no guest fallback yet).

- [ ] **Step 3: Add the guarded guest fallback**

In `src/components/TripForm.tsx`:
- Add imports:
```ts
import { useSession } from "next-auth/react";
import { readGuestPrefs } from "@/lib/guest-prefs";
```
- Add `const { status } = useSession();` with the other hooks.
- After the existing `/api/user/preferences` pre-fill effect, add a guest fallback effect:
```ts
  // Guest origin pre-fill — only when unauthenticated (never inherit a prior guest's airport for an authed user)
  useEffect(() => {
    if (status !== "unauthenticated") return;
    const g = readGuestPrefs();
    if (g) setOrigin((prev) => prev || g.homeAirport);
  }, [status]);
```
- If needed for the test hook, add `data-testid="trip-origin"` to the origin `<input>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/TripForm.guest.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/TripForm.tsx src/components/TripForm.guest.test.tsx
git commit -m "feat(planner): TripForm pre-fills origin from guest prefs (guest-only)"
```

---

### Task 9: ItineraryBuilder interests fallback from guest prefs (M3)

**Files:**
- Modify: `src/components/ItineraryBuilder.tsx` (the prefs `useEffect`, ~134-147)
- Create: `src/components/ItineraryBuilder.guest.test.tsx`

**Interfaces:**
- Consumes: `readGuestPrefs` from `@/lib/guest-prefs`; `useSession` from `next-auth/react`.

- [ ] **Step 1: Write the failing test**

Create `src/components/ItineraryBuilder.guest.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readGuestPrefs, writeGuestPrefs } from "@/lib/guest-prefs";

// Contract: the merge helper prefers API interests, else falls back to guest prefs.
function mergeInterests(prev: string[], apiInterests: string[] | undefined, unauthenticated: boolean): string[] {
  const extra = apiInterests?.length ? apiInterests : unauthenticated ? readGuestPrefs()?.interests ?? [] : [];
  return extra.length ? Array.from(new Set([...prev, ...extra])) : prev;
}

describe("ItineraryBuilder guest interests fallback", () => {
  it("falls back to guest prefs interests when API returns none and unauthenticated", () => {
    localStorage.clear();
    writeGuestPrefs({ homeAirport: "MIA", interests: ["beach", "food"] });
    expect(mergeInterests(["culture"], [], true).sort()).toEqual(["beach", "culture", "food"]);
  });
  it("does not use guest prefs for an authenticated user", () => {
    writeGuestPrefs({ homeAirport: "MIA", interests: ["beach"] });
    expect(mergeInterests(["culture"], [], false)).toEqual(["culture"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ItineraryBuilder.guest.test.tsx`
Expected: FAIL — import resolves but the file/helper contract isn't reflected in the component yet (this test pins the merge contract Step 3 must implement inline).

- [ ] **Step 3: Add the fallback to the prefs effect**

In `src/components/ItineraryBuilder.tsx`:
- Add imports:
```ts
import { useSession } from "next-auth/react";
import { readGuestPrefs } from "@/lib/guest-prefs";
```
- Add `const { status } = useSession();` with the other hooks.
- Replace the prefs `.then(...)` body (~137-145) so it falls back to guest interests when the API returns none and the user is unauthenticated:
```ts
      .then(prefs => {
        const apiInterests: string[] = Array.isArray(prefs?.interests) ? prefs.interests : [];
        const extra = apiInterests.length
          ? apiInterests
          : status === "unauthenticated"
            ? readGuestPrefs()?.interests ?? []
            : [];
        if (extra.length) {
          setUserInterests(prev => Array.from(new Set([...prev, ...extra])));
        }
      })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ItineraryBuilder.guest.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ItineraryBuilder.tsx src/components/ItineraryBuilder.guest.test.tsx
git commit -m "feat(planner): ItineraryBuilder falls back to guest interests (guest-only)"
```

---

### Task 10: E2e — guest greeting shows the airport, never "undefined"

Extend the existing bootstrap test rather than duplicate the flow. Assert the optimistic **user bubble** (renders before the chat POST, so it's robust in CI where the SSE fetch degrades to "Connection lost").

**Files:**
- Modify: `tests/e2e/planner-trust.spec.ts` (the `'Guest user sees bootstrap onboarding once'` test, ~246-265)

- [ ] **Step 1: Extend the test with greeting assertions**

In `tests/e2e/planner-trust.spec.ts`, inside `test('Guest user sees bootstrap onboarding once', …)`, immediately after the `await page.click('[data-testid="bootstrap-save"]');` line and BEFORE the reload, insert:
```ts
  // The onboarding greeting is sent as an optimistic USER message — it must name the airport and never say "undefined".
  await expect(page.getByText(/flying from MIA/i)).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/interested in\b.*\bbeach\b/i)).toBeVisible();
  await expect(page.getByText("undefined")).toHaveCount(0);
```

- [ ] **Step 2: Run the test to verify it passes on the fixed build**

Run: `npx playwright test tests/e2e/planner-trust.spec.ts -g "bootstrap onboarding once"`
Expected: PASS (the user bubble renders "…interested in beach, food and flying from MIA…"; nothing says "undefined").

- [ ] **Step 3: Mutation-proof the guard**

Temporarily revert the `buildOnboardingIntro` fix in `src/lib/guest-prefs.ts` to the TEMP verbatim version (reads `airport`, emits "undefined"); re-run:
Run: `npx playwright test tests/e2e/planner-trust.spec.ts -g "bootstrap onboarding once"`
Expected: FAIL on `getByText("undefined")` / `flying from MIA`. Then restore the fix and confirm PASS again.

- [ ] **Step 4: Full suite**

Run: `npx vitest run && npx playwright test tests/e2e/planner-trust.spec.ts && npx tsc --noEmit`
Expected: all green, no type errors.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/planner-trust.spec.ts
git commit -m "test(e2e): guest greeting shows airport, never 'undefined'"
```

---

## Self-Review

**Spec coverage:** §5.1 guest-prefs contract → T2; §5.2 canonical event + `buildOnboardingIntro` → T3; §5.3 functional context (POST body + route) → T6/T7; §5.4 TripForm → T8; §5.5 OnboardingModal prefill (M2) → T5; §5.6 ItineraryBuilder (M3, corrected to *interests*) → T9; §6 single validator → T1 (+ enforced T2/T4/T7); §6 interests allowlist → T2/T7; §7 TDD order + user-bubble e2e → T3/T10; §8 blast radius → all tasks (plus the new `src/lib/iata.ts`, a refinement of the spec's "reuse/re-export parseIata"). No gaps.

**Placeholder scan:** every code step carries complete code; no TBD/TODO/"add validation"/"similar to Task N".

**Type consistency:** `GuestPrefs { homeAirport; interests }`, `parseGuestPrefs`, `readGuestPrefs`, `writeGuestPrefs`, `sanitizeGuestInterests`, `buildGuestPreferencesJson`, `buildOnboardingIntro`, `dispatchOnboardingComplete`, `OnboardingCompleteDetail` are named identically wherever consumed. `parseIata` signature is stable across T1 consumers.

**Deviations from spec to note at handoff:** (1) new `src/lib/iata.ts` (bundle-safety realization of "single validator"); (2) M3 implemented as guest *interests* parity, not "airport" (the spec label is being corrected).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-21-guest-onboarding-atlas-wiring.md`. Per the pipeline, this plan goes to **Step 2 (code review)** before any implementation. After review fixes, implementation runs under Model Routing (Hermes implements, SOL⇄Opus consensus per fix, Fable verifies).
