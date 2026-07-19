# PR #8 Post-Audit Guard and Hygiene Remediation Implementation Plan

> **For Hermes:** Use the subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make PR #8’s claimed rendered-DOM guard actually cover `DesignA` and `PackageDealsCarousel`, and permanently stop generated Playwright HTML from entering Git.

**Architecture:** Preserve the original unit guard’s deliberately narrow source scope. Add stable component/deal boundaries for the two omitted affiliate consumers, exercise them through real branch-local Playwright pages, assert exact deal cardinality/identity/program/advertiser/CTA/href contracts, and untrack/ignore the generated report while leaving the HTML reporter enabled.

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

**Test-owned manifest:** Extend the existing expected deal-href data into a literal manifest keyed by all eight stable deal IDs. For each deal, pin the approved literal `program`, rendered `advertiser`, `href`, and CTA text. Do not derive expected values from production code under test.

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
4. For every ID, assert its exact manifest CTA text and advertiser badge are visible and its `href` equals the exact approved manifest href.

These cardinality, ID, program/advertiser, CTA, visibility, and href assertions prevent a passing test when cards disappear, change advertiser/scoring identity, or are remapped to one valid CJ URL. Keep all existing hot-deals, destinations, locale, and article assertions unchanged.

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

### Task 2b: Pin the exact per-ID affiliate program contract

**Objective:** Close the post-review gap where a deal with a URL override can change `program`, keep the same approved href, and silently change its rendered advertiser badge and carousel scoring.

**Files:**
- Modify: `src/test/no-fabricated-claims.test.ts`
- Modify: `tests/e2e/no-fabricated-claims.spec.ts`

**Steps:**
1. Replace Arm D's loose `program`/`cta` truthiness checks with one literal per-ID contract that pins exact `program`, CTA, and href values for all eight deals.
2. Extend the E2E manifest with the same literal program values plus the rendered advertiser labels: `Hotels.com`, `Vrbo`, `EconomyBookings`, or `CruiseDirect`.
3. In the planner-carousel loop, require each deal anchor to show its exact manifest advertiser badge in addition to the existing ID, CTA, visibility, and href assertions.
4. Do not change production affiliate data, display copy, scoring, ordering, controls, or URLs.

**Focused baseline:**
```bash
npx vitest run src/test/no-fabricated-claims.test.ts
BASE_URL=http://localhost:3018 npx playwright test tests/e2e/no-fabricated-claims.spec.ts --grep '/en/planner Explore'
```
Expected: both pass on the authoritative worktree.

**Mandatory mutation check in a disposable snapshot only:** change `cruisedirect-caribbean` from `program: "cruises"` to `program: "hotels"` while retaining its URL override. Require both the focused Arm D unit guard and the focused planner-carousel E2E to fail on exact program/advertiser mismatch. Restore and mechanically compare the snapshot's three affected source/test files with the authoritative worktree.

The independently adjudicated multi-currency and clickability proposals remain nonblocking hardening because the binding Arm A/E contract is dollar/unit-pattern + present/visible/exact-href coverage. Do not broaden this remediation into currency grammar or external-click testing.

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
- `src/test/no-fabricated-claims.test.ts`
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
  'src/test/no-fabricated-claims.test.ts' \
  'tests/e2e/no-fabricated-claims.spec.ts'

printf '%s\n' \
  '.gitignore' \
  'playwright-report/index.html' \
  'src/components/DesignA.tsx' \
  'src/components/PackageDealsCarousel.tsx' \
  'src/test/no-fabricated-claims.test.ts' \
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

**Reviewer sign-off:** PASS — independent focused re-review completed 2026-07-18 for the post-implementation quality amendment. Exact per-ID program/CTA/href and rendered advertiser contracts, disposable program-remapping mutation evidence, production-behavior prohibition, expanded mechanical allowlist, and existing full gates/report cleanup were accepted. Signed off by Hermes Agent / gpt-5.6-sol.
