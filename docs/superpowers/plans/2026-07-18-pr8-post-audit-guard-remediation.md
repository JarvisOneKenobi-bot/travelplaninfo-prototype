# PR #8 Post-Audit Guard and Hygiene Remediation Implementation Plan

> **For Hermes:** Use the subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make PR #8’s claimed rendered-DOM guard actually cover `DesignA` and `PackageDealsCarousel`, and permanently stop generated Playwright HTML from entering Git.

**Architecture:** Preserve the original unit guard’s deliberately narrow source scope. Add stable component/deal boundaries for the two omitted affiliate consumers, exercise them through real branch-local Playwright pages, assert exact deal cardinality/identity/CTA/href contracts, and untrack/ignore the generated report while leaving the HTML reporter enabled.

**Tech Stack:** Next.js App Router, TypeScript, Playwright, Vitest.

**Authority:**
- `docs/superpowers/specs/2026-07-13-kill-hardcoded-prices-design.md`
- `docs/superpowers/plans/2026-07-13-kill-hardcoded-prices.md`, especially Arm E lines 166–177
- Independent audit verdict, 2026-07-18: High guard blind spot for both consumers; Medium committed report artifact.
- Parent mutation evidence: adding visible `<p>$99</p>` to `DesignA.tsx` still produced `23/23` passing guard tests; the current E2E guard neither visits the homepage nor mounts the planner carousel.
- Independent hygiene verdict: remove the tracked report and add root-anchored `/playwright-report/` to `.gitignore`.

---

### Task 1: Pin stable rendered consumer and deal identities

**Objective:** Give Arm E narrow, stable DOM boundaries and exact deal identities without changing behavior or appearance.

**Files:**
- Modify: `src/components/DesignA.tsx`
- Modify: `src/components/PackageDealsCarousel.tsx`

**Steps:**
1. Add `data-testid="homepage-affiliate-deals"` to the `DesignA` Hot Deals section wrapper.
2. Add `data-testid="package-deals-carousel"` to the root rendered wrapper of `PackageDealsCarousel`.
3. Add `data-deal-id={deal.id}` to each affiliate deal anchor in both components.

Do not change copy, href generation, layout classes, scoring, timers, deal order, or visibility.

Focused static gate:
```bash
npx tsc --noEmit
npm run lint
```
Expected: 0 errors and no warning increase above branch baseline.

---

### Task 2: Extend Arm E with exact rendered coverage

**Objective:** Ensure visible fabricated claims or monetization remapping/disappearance in either omitted consumer fails Playwright.

**Files:**
- Modify: `tests/e2e/no-fabricated-claims.spec.ts`

**Test-owned manifest:** Extend the existing expected deal-href data into a literal manifest keyed by all eight stable deal IDs. For each deal, pin the approved literal `href` and CTA text. Do not derive expected hrefs from production code under test.

**Homepage test:**
1. Open `/en`.
2. Scope to `[data-testid="homepage-affiliate-deals"]` and apply the existing fabricated price/urgency/duration patterns to its `innerText`.
3. Require exactly **3** visible `[data-deal-id]` anchors.
4. Require the IDs to equal the first three approved deals.
5. For each ID, assert the exact manifest CTA text is visible and the anchor `href` equals that deal’s exact approved manifest href.

**Planner carousel test:**
1. In a fresh unauthenticated context, open `/en/planner` and select the Explore/Surprise path so `PackageDealsCarousel` renders.
2. Scope to `[data-testid="package-deals-carousel"]` and apply the same fabricated-claim patterns.
3. Require exactly **8** visible `[data-deal-id]` anchors and the exact eight-ID set.
4. For every ID, assert its exact manifest CTA text is visible and its `href` equals the exact approved manifest href.

These cardinality, ID, CTA, visibility, and href assertions prevent a passing test when cards disappear or every card is remapped to one valid CJ URL. Keep all existing hot-deals, destinations, locale, and article assertions unchanged.

**Start and prove the branch-local server:**

From the PR #8 worktree in a dedicated terminal/process:
```bash
cd /home/jarvis/.openclaw/workspace/jarvis-project/travelplaninfo-prototype/.worktrees/kill-prices
NEXTAUTH_URL=http://localhost:3018 npm run dev -- --port 3018
```
Wait for `Ready`. In the verification terminal:
```bash
SERVER_PID=$(lsof -t -iTCP:3018 -sTCP:LISTEN)
test -n "$SERVER_PID"
test "$(readlink -f "/proc/$SERVER_PID/cwd")" = "/home/jarvis/.openclaw/workspace/jarvis-project/travelplaninfo-prototype/.worktrees/kill-prices"
curl -fsS http://localhost:3018/en >/dev/null
git rev-parse HEAD
```
Record the HEAD and listener PID.

**Focused GREEN before mutation:**
```bash
BASE_URL=http://localhost:3018 npx playwright test tests/e2e/no-fabricated-claims.spec.ts
```
Expected: existing focused tests plus exactly two new consumer tests pass.

**Mandatory mutation checks in a disposable snapshot only:**
1. Inject visible `$99` into `DesignA`’s guarded wrapper; rerun with the same explicit `BASE_URL`; expected homepage test FAIL.
2. Restore, inject visible `$99` into `PackageDealsCarousel`’s guarded wrapper; rerun; expected planner-carousel test FAIL.
3. Restore and prove the snapshot is clean.

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
Expected: `.gitignore` identifies `/playwright-report/`; the local report remains available but the index records its deletion. Keep the HTML reporter in `playwright.config.ts`.

---

### Task 4: Independent gates and exact-scope commit

**Implementation commit allowlist:**
- `.gitignore`
- `playwright-report/index.html` (staged deletion)
- `src/components/DesignA.tsx`
- `src/components/PackageDealsCarousel.tsx`
- `tests/e2e/no-fabricated-claims.spec.ts`

Run with the cwd-verified server on port 3018:
```bash
git diff --check
npx tsc --noEmit
npm run lint
npm run test:unit
npm run build
BASE_URL=http://localhost:3018 npx playwright test
```
Expected browser baseline: current `56/56` plus exactly two new tests = **58/58**.

After E2E, mechanically verify durable cleanup and exact staging:
```bash
git restore -- next-env.d.ts
git check-ignore -q playwright-report/index.html
if git ls-files --error-unmatch playwright-report/index.html >/dev/null 2>&1; then exit 1; fi

git add -- \
  '.gitignore' \
  'src/components/DesignA.tsx' \
  'src/components/PackageDealsCarousel.tsx' \
  'tests/e2e/no-fabricated-claims.spec.ts'

printf '%s\n' \
  '.gitignore' \
  'playwright-report/index.html' \
  'src/components/DesignA.tsx' \
  'src/components/PackageDealsCarousel.tsx' \
  'tests/e2e/no-fabricated-claims.spec.ts' \
  | sort > /tmp/pr8-allowed-paths.txt
git diff --cached --name-only | sort > /tmp/pr8-staged-paths.txt
diff -u /tmp/pr8-allowed-paths.txt /tmp/pr8-staged-paths.txt
git diff --cached --check
```
Expected: exact path-list match and clean cached diff.

Commit without push:
```bash
git commit -m "test: cover remaining affiliate consumers"
```

Stop the recorded listener and verify port release:
```bash
kill -TERM "$SERVER_PID"
test -z "$(lsof -t -iTCP:3018 -sTCP:LISTEN || true)"
```

**Forbidden:** push, merge, deployment, environment files, databases, screenshots, videos, generated reports, or unrelated cleanup.

---

**Reviewer sign-off:** PASS — independent focused re-review completed 2026-07-18 after fixing every REQUEST_CHANGES blocker (exact cardinality/identity/CTA/href contracts, branch-local server provenance, explicit BASE_URL, and durable report untracking). Signed off by Hermes Agent / gpt-5.6-sol.
