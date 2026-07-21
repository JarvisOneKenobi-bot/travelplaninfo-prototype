# Design: Wire guest onboarding prefs to Atlas + TripForm

**Date:** 2026-07-21
**Status:** Design — approved approach ①, hardened by Fable 5 review (verdict APPROVE-WITH-EDITS, all state claims verified against the tree). Awaiting spec sign-off before planning.
**Repo:** `travelplaninfo-prototype` (TPI, travelplaninfo.com). Prod = `main` @ `23a3bf7`.

---

## 1. Problem

A guest visitor completes the guest onboarding modal, enters a home airport (e.g. `MIA`) and ≥2 interests, clicks **Save & continue**, and Atlas (the AI chat) greets them with **"flying from undefined with a undefined budget."**

### Root cause — two defects

1. **Event-payload key mismatch.** The guest modal `BootstrapModal.tsx` dispatches
   `CustomEvent("atlas-onboarding-complete", { detail: { homeAirport, interests } })`,
   but the single listener in `AssistantChat.tsx` destructures `{ interests, airport, budget, aiAssisted }`.
   `airport` and `budget` are therefore `undefined`; the guest modal has **no budget field at all**.
   The *other* producer — `OnboardingModal.tsx` (authenticated 3-step flow) — dispatches `{ interests, airport, budget, aiAssisted }`, which matches the listener, so the authenticated flow works. Only the guest flow is broken. The mismatch was introduced when `BootstrapModal` was added (`a415183`) without updating the consumer.

2. **Dead-end guest prefs.** `BootstrapModal` also writes `{ homeAirport, interests }` to `localStorage["tpi_guest_prefs"]` (`GUEST_PREFS_LS_KEY`), but **nothing reads that key** (write-only since birth). So the guest's airport reaches Atlas neither cosmetically (greeting) nor functionally (LLM context). The `OnboardingWrapper` routes authenticated users → `OnboardingModal`, guests-on-homepage → `BootstrapModal`.

This is a *half-wired feature*, not a regression: the guest capture path shipped to `main` but its consumers were never connected. It only surfaced when a guest actually walked the flow ([[feedback_preexisting_code_vs_preexisting_ux]]).

### Key finding — the "greeting" is a **user** message

`AssistantChat` builds `intro` and calls `sendMessageRef.current(intro)`; `sendMessage` pushes it as `role:"user"`, renders it as a right-aligned **user bubble**, POSTs it as `message` to `/api/assistant/chat`, and the route persists it to `chat_messages` as a `'user'` row. Consequences:
- The text-fix belongs in the **client-side builder** (correct).
- Existing broken "undefined" intros are **already persisted** and replay via `loadHistory` — **the fix is forward-only.**
- Tests must assert the **user bubble** text, never Atlas's reply (non-deterministic LLM output; in CI without an Anthropic key the SSE fetch degrades to "Connection lost. Please try again.").

---

## 2. Goal / Non-goals

**Goal:** The guest's home airport (and interests) must reach Atlas both **honestly** (greeting states only what is known — never "undefined", never a fabricated default) and **functionally** (Atlas's LLM context genuinely uses the airport for suggestions), plus pre-fill the origin field on `TripForm`. Introduce a single guest-prefs contract so this class of key-drift bug cannot recur.

**Non-goals:** No change to the authenticated preferences data model; guests remain **localStorage-only** (the existing, deliberate design — `/api/user/preferences` GET returns defaults for guests and PUT rejects them). No i18n of the greeting copy beyond what already exists. No new budget capture for guests (they legitimately have none).

---

## 3. Approach

**Chosen: ① Thread the localStorage guest prefs to all three consumers behind one typed, runtime-validated contract.** Honest, functional, respects the guests-are-localStorage-only architecture, smallest reversible change.

**Rejected:**
- **② Promote guest prefs to the server DB** (relax the `isGuest` short-circuits so guests can PUT/GET `/api/user/preferences`). Fable noted `mergeGuestIntoUser` already re-parents `user_preferences` (dead code today), suggesting ② was once intended and would fix chat + TripForm + ItineraryBuilder in one move and survive guest→user merge. Deferred: it reverses an explicit design decision and enlarges the guest data/privacy surface. Revisit as a separate initiative if guest continuity becomes a priority.
- **③ Fold the airport into `page_context`.** Fragile (recomputed per page), conflates page context with preferences.

---

## 4. Architecture constraints (verified against the tree)

- Guests get a `userId` via the `tpi_guest` cookie → `users` row (`getUserId()` → `{userId, isGuest}`). A client-readable `tpi_guest_hint` cookie also exists.
- `/api/user/preferences`: **GET** returns `DEFAULT_PREFERENCES` for guests; **PUT** hard-requires a NextAuth session (401 for guests). Guests cannot persist prefs server-side.
- Atlas chat route `/api/assistant/chat` loads `preferencesJson` from the `user_preferences` table by `userId` (empty `"{}"` for guests). Request body currently `{ message, session_id, page_context }`.
- `system-prompt.ts` embeds `preferencesJson` **verbatim** (`User profile: ${preferencesJson}`) and `getHomeAirport()` reads `home_airport` (snake_case) to build `NEARBY_AIRPORTS_MAP` context. `page_context` also flows into the prompt verbatim — client→system-prompt is a **pre-existing** channel.
- `parseIata` (`travelpayouts-client.ts`) is the canonical airport validator: strict `/^[A-Z]{3}$/`. Flight tools reject anything else.
- `GUEST_INTERESTS = ['beach','mountains','food','culture']` — note `'mountains'` is **not** in `PREF_ENUMS.interests`; allowlist guest interests against `GUEST_INTERESTS`, never `PREF_ENUMS`.
- `TripForm` mounts only on `/planner` and in `PlannerDashboard` — never the homepage (where `BootstrapModal` appears), so there is no same-page mount race.

---

## 5. Detailed design

### 5.1 New `src/lib/guest-prefs.ts` — the single contract
The one definition of the guest-prefs shape + validators. No `"use client"` — importable by both client components and the route handler.

```ts
import { parseIata } from "@/lib/atlas/travelpayouts-client"; // strict ^[A-Z]{3}$

export const GUEST_PREFS_LS_KEY = "tpi_guest_prefs";
export const GUEST_INTERESTS = ['beach', 'mountains', 'food', 'culture'] as const; // MOVED here from BootstrapModal
export type GuestInterest = (typeof GUEST_INTERESTS)[number];

export interface GuestPrefs {
  homeAirport: string;        // canonical IATA, validated ^[A-Z]{3}$
  interests: GuestInterest[]; // subset of GUEST_INTERESTS, deduped, length 1..4
}

/** Validate an untrusted object into GuestPrefs, or null. Used client (localStorage) and server (request body). */
export function parseGuestPrefs(raw: unknown): GuestPrefs | null;

/** SSR-safe localStorage read → validated GuestPrefs | null. */
export function readGuestPrefs(): GuestPrefs | null;

/** SSR-safe localStorage write (assumes already-valid prefs). */
export function writeGuestPrefs(p: GuestPrefs): void;
```

- `parseGuestPrefs`: `homeAirport` via `parseIata` (null if not exactly 3 A–Z letters); `interests` filtered to `GUEST_INTERESTS`, deduped, capped at 4, must be non-empty. Any failure → `null`. This is the single validator reused everywhere (I1, I2).
- `BootstrapModal` imports `GUEST_PREFS_LS_KEY`, `GUEST_INTERESTS`, `GuestPrefs`, `writeGuestPrefs`, `parseIata` from here. `GUEST_BOOTSTRAP_LS_KEY` stays in `BootstrapModal` (still imported by `OnboardingWrapper`).

### 5.2 Canonical `atlas-onboarding-complete` event + pure intro builder
```ts
export interface OnboardingCompleteDetail {
  homeAirport?: string; interests?: string[]; budget?: string; aiAssisted?: boolean;
}
export function dispatchOnboardingComplete(detail: OnboardingCompleteDetail): void;

/** Total over untrusted input — CustomEvent.detail is `any` at the listener.
 *  Cannot emit "undefined" or an empty join. */
export function buildOnboardingIntro(detail: unknown): string;
```
- `buildOnboardingIntro` runtime-validates every field: `interests` must be a non-empty array of non-empty strings or the interests clause is omitted; `homeAirport` must be a non-empty string or the airport clause is omitted; `budget` must be a non-empty string or the budget clause is omitted (I3, I4). It lives in `guest-prefs.ts` alongside the contract — not in the component — so it is unit-testable in isolation. (`guest-prefs.ts` thus holds both the localStorage contract and the shared onboarding-event helpers; the authed `OnboardingModal` imports `dispatchOnboardingComplete` from it too.)
- **Producers:**
  - `BootstrapModal` (guest): `dispatchOnboardingComplete({ homeAirport, interests })` + `writeGuestPrefs(...)`.
  - `OnboardingModal` (authed): `dispatchOnboardingComplete({ homeAirport: airport, budget, interests, aiAssisted })` — key renamed `airport`→`homeAirport` (event detail only; its `/api/user/preferences` PUT body is untouched).
- **Listener** (`AssistantChat`): `const intro = buildOnboardingIntro(event.detail); sendMessageRef.current(intro);`
- **Copy:** the extracted builder preserves the *current* authed template verbatim (working path unchanged). Guest output, budget omitted: *"Great! I'm Atlas… I see you're interested in beach, mountains and flying from MIA. Let's find your next perfect trip! 🌍 What destination are you thinking about?"*

### 5.3 Functional context — airport reaches the LLM
- `AssistantChat` chat POST body gains `guest_prefs?: GuestPrefs` from `readGuestPrefs()`, sent only when present.
- `/api/assistant/chat` route: parse optional `guest_prefs`; when `ctx.isGuest` **and** no DB `prefRow`, build `preferencesJson` from the **server-revalidated** guest prefs (`parseGuestPrefs` again — never trust the client): include `home_airport` only if the airport validates, `interests` only if they validate (I4 — field-independent, not all-or-nothing). If neither validates, `preferencesJson` stays `"{}"`. Authenticated path unchanged (DB wins). Effect: `getHomeAirport(preferencesJson)` returns the airport for guests → nearby-airport context + suggestions genuinely use it.

### 5.4 `TripForm` origin pre-fill (M1)
After the existing `/api/user/preferences` fetch (returns defaults for guests), if origin is still empty **and** the `tpi_guest_hint` cookie is present, fall back to `readGuestPrefs()?.homeAirport` via `setOrigin(prev => prev || airport)` (no-clobber; guest-gated so an authed user on a shared browser can't inherit a prior guest's airport). Client-only.

### 5.5 `OnboardingModal` prefill (M2)
On mount, seed the authed modal's `airport`/`interests` local state from `readGuestPrefs()` (guest→signup continuity), only where the modal state is otherwise empty. Interests seeding maps guest values that exist in `PREF_ENUMS.interests`; `'mountains'` (absent from `PREF_ENUMS`) is carried as a custom interest chip (the modal already supports custom interests). Does not change the PUT body shape.

### 5.6 `ItineraryBuilder` guest-airport fallback (M3)
Where it merges prefs interests for the activity modal, add the same `readGuestPrefs()` fallback so guests get parity. Client-only, mirrors M1's guard pattern.

---

## 6. Validation, security, no-fabrication

- **Single airport validator** `parseIata` (`^[A-Z]{3}$`) enforced at three points from one source (I1): `BootstrapModal` disables **Save** until the airport validates (input `maxLength` stays 4 to allow correction, but the gate requires exactly 3 A–Z; placeholder `e.g. MIA`); `readGuestPrefs`/`parseGuestPrefs` re-check; the route re-checks. Greeting and functional context can no longer diverge (no "flying from M1A" / "knows KMIA it can't use").
- **Guest interests** allowlisted against `GUEST_INTERESTS`, capped at 4, client and server (I2). `GUEST_INTERESTS` moved out of the `"use client"` component so the route can import it.
- **Security:** client-supplied `guest_prefs` flows into the system prompt, a higher-trust position than the user turn — but `page_context` and authed prefs already do (pre-existing channel), so this is Important, not novel. Mitigation: server revalidates airport (3 letters) and interests (4-value allowlist) — the guest surface is strictly narrower than the already-accepted authed/`page_context` surfaces. No auth boundary is crossed (a guest cannot fabricate an authed `preferencesJson`; the server only builds one for `ctx.isGuest && !prefRow`).
- **No fabrication:** absent budget/airport/interests ⇒ the clause is **omitted**, never defaulted. The greeting never claims knowledge Atlas lacks; the server never invents a budget. Consistent with TPI's no-fabrication guards.

---

## 7. Testing (TDD — failing test first)

Order matters (I5): a greeting builder does not exist on current code, so a test written first would fail on *import*, not assertion.

1. **Extract `buildOnboardingIntro`** preserving the current buggy authed template verbatim (no behavior change yet).
2. **Unit test the builder** → true **red** on the guest case: assert the guest detail (`{ homeAirport:"MIA", interests:["beach","mountains"] }`) produces a string containing `"MIA"` and **not** `"undefined"`. Fails on the buggy verbatim template. Then implement the conditional-clause fix → green. Mutation-proof: dispatch the **legacy `{ airport }` shape** and assert no `"undefined"` — kills current code, survives the fix.
3. **`guest-prefs` units:** `parseGuestPrefs`/`readGuestPrefs`/`writeGuestPrefs` for malformed, missing, valid, bad-airport (`M1A`, `KMIA`), out-of-allowlist interest, >4 interests.
4. **Chat-route unit/integration:** builds `preferencesJson` from `guest_prefs` for guest+no-row; ignores for authed; server-sanitizes a bad airport (dropped, not passed); field-independent (valid interests survive an invalid airport).
5. **E2e** — extend the existing bootstrap test in `tests/e2e/planner-trust.spec.ts` (do not duplicate the flow): guest completes `BootstrapModal` → the chat panel auto-opens → assert the **user bubble** contains `MIA` and no `"undefined"`. **Never await assistant SSE content** (tolerate the chat POST failing in CI).
6. Each fix **mutation-proven** (neuter it, confirm the guard fails), per the verification runbook. No `grep -c` / `set -e` false-fail hazards (tests run under vitest/playwright); the e2e must tolerate a failing chat POST in CI.

---

## 8. Blast radius

| File | Change |
|---|---|
| `src/lib/guest-prefs.ts` | **new** — contract, validators, `GUEST_INTERESTS`, `buildOnboardingIntro`, `dispatchOnboardingComplete` |
| `src/components/BootstrapModal.tsx` | import from `guest-prefs`; `parseIata` save-gate; dispatch via helper; `writeGuestPrefs` |
| `src/components/OnboardingModal.tsx` | emit canonical `homeAirport` key; M2 prefill from `readGuestPrefs()` |
| `src/components/AssistantChat.tsx` | listener uses `buildOnboardingIntro`; POST body adds `guest_prefs` |
| `src/app/api/assistant/chat/route.ts` | build guest `preferencesJson` (field-independent, server-revalidated) |
| `src/components/TripForm.tsx` | M1 origin fallback (no-clobber + `tpi_guest_hint` gate) |
| `src/components/ItineraryBuilder.tsx` | M3 guest-airport fallback |
| tests | builder unit, guest-prefs unit, chat-route unit/integration, `planner-trust.spec.ts` e2e extension |

---

## 9. Rollout

Forward-only (already-persisted "undefined" intros are historical and harmless). No secret/config changes. Multi-file + ships to git → full 7-step pipeline + Model Routing (Hermes `-m gpt-5.5` implements, SOL⇄Opus consensus per fix, Fable verifies — Fable is on the Max plan again, no price-confirm). **No deploy to VPS without Jose's visual review + explicit go-ahead.**

## 10. Deferred (out of scope)

- Approach ② (server-side guest prefs row) — would subsume M2/M3 and survive merge; revisit if guest continuity becomes a priority.
- Greeting i18n / localized interest labels (`"beach"` shown raw; hardcoded English on all locales) — pre-existing; fix opportunistically, not in this change.
