# PR #7 Post-Audit G4 Remediation Implementation Plan

> **For Hermes:** Use the subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Close the two remaining rendered-UI leaks that violate Jose’s binding “Name everything on-screen” rule and permanently stop generated Playwright HTML from entering Git, without changing Surprise Me search, pricing, persistence, or API contracts.

**Architecture:** Keep canonical IATA codes and parked legacy quiz fields unchanged in storage and APIs. Decode curated nearby-airport choices at the client render boundary, remove the rejected legacy quiz-chip render path, and untrack/ignore the generated Playwright report while leaving the HTML reporter enabled. Pin both user-facing behaviors with a component regression and a positive-path browser/API regression.

**Tech Stack:** Next.js App Router, TypeScript, next-intl, Vitest + React Testing Library, Playwright.

**Authority:**
- `docs/superpowers/specs/2026-07-12-vibe-vocabulary-and-atlas-preflight-design.md`
- `docs/superpowers/plans/2026-07-12-vibe-vocabulary-and-atlas-preflight.md`, especially G4 Scope lines 44–62
- Independent audit verdict, 2026-07-18: both UI leaks are High/merge-blocking; commit `413ca5f` is semantically safe.
- Independent hygiene verdict, 2026-07-18: remove the tracked report and add root-anchored `/playwright-report/` to `.gitignore`.
- Parent reproductions:
  - `TripForm` rendered `También buscar aeropuertos cercanos: FLL, PBI`; the proposed no-bare-code contract failed.
  - A guest legacy Surprise Me row followed by resolve-surprise returned 201/200 and rendered `Based on:`, `big_city`, `low`, and `couple` on Path A.

---

### Task 1: Render named nearby-airport choices

**Objective:** Keep the same submitted IATA codes while ensuring every nearby-airport code shown in `TripForm` is accompanied by a human-readable proper name.

**Files:**
- Modify: `src/components/TripForm.tsx:34-53,382-387`
- Test: `src/components/TripForm.test.tsx`

**Step 1: Write the failing component regression**

Add a test that enters `MIA`, locates the nearby-airport prompt, and requires readable labels such as `Fort Lauderdale, Florida (FLL)` and `West Palm Beach, Florida (PBI)`. It must reject the old bare list `FLL, PBI`.

**Step 2: Verify RED**

```bash
npx vitest run src/components/TripForm.test.tsx
```
Expected: FAIL with the old rendered text containing only `FLL, PBI`.

**Step 3: Implement the smallest display-only fix**

Add a client-safe curated display-name map for every code present in `NEARBY_AIRPORTS`. Format each non-origin code as `Human Name (IATA)`; the binding plan explicitly permits a code alongside a name. Never fall back to a bare code: if a curated code lacks a name, omit it from rendered copy while preserving the submitted search-code array.

Do not import the server-only generated city-name table into this client component. Do not change `nearby_airports` POST payloads or grouping behavior.

**Step 4: Verify GREEN**

Rerun the focused component test; expected: all pass.

---

### Task 2: Remove the rejected legacy quiz-chip render path

**Objective:** Park legacy quiz columns without rendering their raw internal values on resolved trip pages.

**Files:**
- Modify: `src/app/[locale]/planner/[tripId]/page.tsx:123-143`
- Test: `tests/e2e/planner-trust.spec.ts`
- Test: `src/lib/atlas/no-fabrication.test.ts`

**Step 1: Add failing regressions**

1. Add an E2E test titled exactly `resolved legacy surprise trip hides parked quiz enums`.
2. Use `context.request.post` to create a guest trip with `destination: "Surprise Me"`, `entry_mode: "surprise"`, `quiz_vibes: ["big_city"]`, `quiz_budget: "low"`, and `quiz_who: "couple"`.
3. Assert create status is **201** and the returned trip has an ID.
4. Resolve it through `/api/trips/{id}/resolve-surprise`; assert status **200**, `destination` equals the requested real destination, and `entryMode` equals `surprise`.
5. Open `/planner/{id}` and positively assert `[data-testid="itinerary-builder"]` is visible so redirect/404/create failures cannot make the negative assertions pass.
6. Only then assert that `Based on:`, `big_city`/`Big_city`, `low`, and `couple` are absent from rendered page text.
7. Extend the rejected-entry-system source guard so this planner page cannot resume rendering `trip.quiz_budget`, `trip.quiz_vibes`, or `trip.quiz_who`. Database migrations and API parking remain allowed; scope this guard to the planner page source only.

**Step 2: Start and prove the branch-local server**

From the PR #7 worktree in a dedicated terminal/process:
```bash
cd /home/jarvis/.openclaw/workspace/jarvis-project/travelplaninfo-prototype/.worktrees/surprise-me
NEXTAUTH_URL=http://localhost:3017 npm run dev -- --port 3017
```
Wait for `Ready`. In the verification terminal:
```bash
SERVER_PID=$(lsof -t -iTCP:3017 -sTCP:LISTEN)
test -n "$SERVER_PID"
test "$(readlink -f "/proc/$SERVER_PID/cwd")" = "/home/jarvis/.openclaw/workspace/jarvis-project/travelplaninfo-prototype/.worktrees/surprise-me"
curl -fsS http://localhost:3017/en >/dev/null
git rev-parse HEAD
```
Record the HEAD and listener PID with the test evidence.

**Step 3: Verify RED**

```bash
npx vitest run src/lib/atlas/no-fabrication.test.ts
BASE_URL=http://localhost:3017 npx playwright test tests/e2e/planner-trust.spec.ts --grep "resolved legacy surprise trip hides parked quiz enums"
```
Expected: the source guard and exact selected browser test fail against current behavior. The Playwright command must report exactly one selected test, never zero.

**Step 4: Implement the smallest fix**

Delete the legacy `Quiz context chips for surprise-mode trips` render block from the planner page. Do not drop columns, alter DTOs, or change API persistence; those are parked compatibility fields.

**Step 5: Verify GREEN**

Rerun both focused regressions with the same explicit `BASE_URL`; expected: pass.

---

### Task 3: Permanently untrack generated Playwright HTML

**Objective:** Preserve useful local HTML reports while preventing them from dirtying or entering Git again.

**Files:**
- Modify: `.gitignore`
- Remove from Git index: `playwright-report/index.html`

**Steps:**
```bash
printf '\n/playwright-report/\n' >> .gitignore
git rm --cached -- playwright-report/index.html
git check-ignore -v playwright-report/index.html
if git ls-files --error-unmatch playwright-report/index.html >/dev/null 2>&1; then exit 1; fi
```
Expected: `.gitignore` identifies `/playwright-report/`; the local report remains available but the index records its deletion. Do not remove the HTML reporter from `playwright.config.ts`.

---

### Task 4: Independent gates and exact-scope commit

**Objective:** Prove the remediation is narrow, clean, and does not regress PR #7.

**Implementation commit allowlist:**
- `.gitignore`
- `playwright-report/index.html` (staged deletion)
- `src/components/TripForm.tsx`
- `src/components/TripForm.test.tsx`
- `src/app/[locale]/planner/[tripId]/page.tsx`
- `src/lib/atlas/no-fabrication.test.ts`
- `tests/e2e/planner-trust.spec.ts`

Run with the cwd-verified server on port 3017:
```bash
git diff --check
npx tsc --noEmit
npm run lint
npm run test:unit
npm run build
BASE_URL=http://localhost:3017 npx playwright test
```
Expected browser baseline: current `43/43` plus exactly one new test = **44/44**.

After the E2E run, mechanically verify durable cleanup and stage only the allowlist:
```bash
git restore -- next-env.d.ts
git check-ignore -q playwright-report/index.html
if git ls-files --error-unmatch playwright-report/index.html >/dev/null 2>&1; then exit 1; fi

git add -- \
  '.gitignore' \
  'src/components/TripForm.tsx' \
  'src/components/TripForm.test.tsx' \
  'src/app/[locale]/planner/[tripId]/page.tsx' \
  'src/lib/atlas/no-fabrication.test.ts' \
  'tests/e2e/planner-trust.spec.ts'

printf '%s\n' \
  '.gitignore' \
  'playwright-report/index.html' \
  'src/app/[locale]/planner/[tripId]/page.tsx' \
  'src/components/TripForm.test.tsx' \
  'src/components/TripForm.tsx' \
  'src/lib/atlas/no-fabrication.test.ts' \
  'tests/e2e/planner-trust.spec.ts' \
  | sort > /tmp/pr7-allowed-paths.txt
git diff --cached --name-only | sort > /tmp/pr7-staged-paths.txt
diff -u /tmp/pr7-allowed-paths.txt /tmp/pr7-staged-paths.txt
git diff --cached --check
```
Expected: exact path-list match and clean cached diff.

Commit without push:
```bash
git commit -m "fix: close remaining G4 UI leaks"
```

Stop the recorded listener and verify port release:
```bash
kill -TERM "$SERVER_PID"
test -z "$(lsof -t -iTCP:3017 -sTCP:LISTEN || true)"
```

**Forbidden:** push, merge, deployment, environment files, databases, screenshots, videos, generated reports, the pre-existing untracked verification document, or unrelated cleanup.

---

**Reviewer sign-off:** PASS — independent focused re-review completed 2026-07-18 after fixing every REQUEST_CHANGES blocker (positive-path E2E setup, exact title selection, branch-local server provenance, durable report untracking, and mechanical staged-scope gates). Signed off by Hermes Agent / gpt-5.6-sol.
