# TPI — Next.js 15.5.12 → 16.2.6 Upgrade Design (Loop #1B)

**Date:** 2026-05-21
**Scope:** Minimal migration, local-verify then VPS/PM2 deploy
**Stack at time of writing:** `next@^15.5.12`, `react@19.0.0`, `next-intl@^4.8.3`, `eslint@9.20.1`, `eslint-config-next@15.1.6`, `typescript@5.7.3`, `tailwindcss@^3.4.19`, `@playwright/test@^1.58.2`, VPS Node 20.20.2
**Latest stable Next:** 16.2.6 (npm `next@latest` as of 2026-05-21)
**Reference:** Mirrors Travelsfy Loop #1A (`docs/superpowers/specs/2026-05-15-next-16-upgrade-design.md`) with VPS/PM2 target differences

---

## 1. Goal & Success Criteria

Land TPI on the latest stable Next.js (16.2.6) with identical user-visible behavior and a clean VPS/PM2 deploy.

### Success criteria

- `npm run build` exits 0 locally (Node 20.20.2-compatible)
- `npm run lint` runs cleanly against the manually-created `eslint.config.mjs` (warnings allowed; crashes are not)
- `npm run test:e2e` (Playwright): pass
- Post-deploy VPS smoke: HTTP 200 on:
  - `/` (English — no prefix, `localePrefix: "as-needed"`)
  - `/es/`, `/pt/`, `/fr/`, `/de/`, `/it/` (all 5 prefixed locales)
  - `/sitemap.xml`
  - `/robots.txt`
  - At least one article page (e.g. `/destinations/mexico/`)
- PM2 process `tpi` shows `online` after deploy
- `tpi-schedule-runner.timer` is `active (waiting)` after resume

### Out of scope — defer to follow-on Ralph Loops

- `middleware.ts` → `proxy.ts` rename: **DEFERRED**. Same reasoning as Travelsfy Loop #1A: `proxy.ts` forces the Node.js runtime (edge not supported), shifting every-request locale negotiation from Edge to Node with latency implications not yet measured.
- Cache Components adoption (`use cache`, `cacheLife`, `cacheTag`) — Next 16 marquee feature, separate behavior-changing project
- React 19.0.0 → 19.2.x bump — no test-stack friction reason; separate loop
- Tailwind 3 → 4 — CSS-first config with visual blast radius; separate loop
- TypeScript 5.7 → 6.0 + ESLint 9 → 10 — compiler/lint pair; separate loop
- Node 20 → 22 LTS on VPS — runtime upgrade; separate loop

---

## 2. Dependency Changes

### Group A — Next 16 core

| Package | From | To | Reason |
| --- | --- | --- | --- |
| `next` | `^15.5.12` | `^16.2.6` | The upgrade |
| `eslint-config-next` | `15.1.6` | `^16.2.6` | Lockstep with `next`; was already mismatched (15.1.6 vs next@15.5.12) — fix together |
| `next-intl` | `^4.8.3` | `^4.12.0` | Explicitly lists `^16.0.0` in `peerDependencies`. Verified via npm registry 2026-05-21. No breaking changes 4.8→4.12 confirmed via changelog scan. |
| `@eslint/eslintrc` | not installed | `latest` | Required for FlatCompat wrapper in `eslint.config.mjs`; new devDep |

### Held back — separate Ralph Loops

`react@19.0.0`, `@types/react@19.0.10`, `@types/react-dom@19.0.4`, `@types/node@20.11.30` (VPS is Node 20 — no bump to 22), `typescript@5.7.3`, `eslint@9.20.1`, `tailwindcss@^3.4.19`, `autoprefixer`, `postcss`, `@playwright/test` — no breaking-change reason to bundle into this loop.

### Already compatible

`react@19.0.0` satisfies Next 16 peer dep. `eslint@9.20.1` satisfies `eslint-config-next@16` peer dep of `>=9.0.0`. VPS Node 20.20.2 satisfies Next 16's `>=20.0.0` runtime requirement.

---

## 3. Known Breakage Surface

| # | Item | Action |
| --- | --- | --- |
| 1 | **`next lint` removed.** Next 16 removes the built-in `next lint` command. Must migrate to ESLint CLI. | Create `eslint.config.mjs` (FlatCompat wrapping `next/core-web-vitals`), delete `.eslintrc.json`, update `scripts.lint` from `"next lint"` to `"eslint ."`. Install `@eslint/eslintrc` as devDep. |
| 2 | **Turbopack is the default build engine.** `next build` now uses Turbopack by default. | Watch: if build fails with "Webpack configuration found but no custom webpack config defined", add `--webpack` flag to the `build` script and re-run. next-intl 4.12 plugin is Turbopack-compatible per peer deps. |
| 3 | **`middleware.ts` deprecation.** Next 16 deprecates `src/middleware.ts` and the codemod renames it to `proxy.ts`. | Codemod is not run (non-TTY hang). Deprecation warning at build time is accepted. Rename is DEFERRED (see §1). |
| 4 | **ESLint flat config migration is manual.** TPI cannot run `npx @next/codemod@canary upgrade latest` due to non-TTY environment hang. | Full manual path: write `eslint.config.mjs`, delete `.eslintrc.json`, update lint script (see item 1). |
| 5 | **`next.config.ts` option renames/removals.** Codemod would normally handle these. | Hand-verify the file after `npm install`. TPI's config is minimal (only `reactStrictMode`, `trailingSlash`, `images.unoptimized`, `remotePatterns`, next-intl plugin wrap) — low risk. |
| 6 | **`images.unoptimized: true`.** All Next image-processing defaults are bypassed. | No action. New image behavior defaults do not apply. |
| 7 | **next-intl 4.8 → 4.12.** 4-minor jump. | No action needed. Changelog scan (2026-05-21) shows zero breaking changes. `createMiddleware`, `defineRouting`, `localePrefix: "as-needed"` API unchanged. |
| 8 | **Async dynamic APIs final removal.** `cookies()`, `headers()`, `params`, `searchParams` synchronous compat removed in Next 16. | No action expected — TPI has been on Next 15 with async-first patterns. Build-time errors here are regression signals. |
| 9 | **VPS build flakiness.** Back-to-back builds on VPS can produce `ENOENT: .next/build-manifest.json`. | Always `rm -rf .next` before `npm run build` on VPS. |

### Risk axes ranked

| Risk | Likelihood | Blast radius | Mitigation |
| --- | --- | --- | --- |
| Turbopack build fails on next-intl plugin config | Medium | High (build fails entirely) | Add `--webpack` to build script if triggered |
| `middleware.ts` deprecation warning | High (expected) | Zero — informational only | Accept; rename deferred |
| ESLint flat config crashes (misconfigured `eslint.config.mjs`) | Low | Low (lint only, not build) | `npm run lint` gate before commit |
| next-intl locale routing regressions | Low | High (6 locales × every page) | Per-locale 200 smoke on VPS post-deploy |
| `next.config.ts` option removed | Low | High (build fails immediately) | Caught by `npm run build` |
| Async dynamic API surprise | Very low | High | Caught by build |
| VPS ENOENT race on `.next/` | High (without guard) | Medium (PM2 start fails) | `rm -rf .next` is mandatory step in deploy |

---

## 4. Migration Steps (High Level — Plan Expands)

```
0. Pre-flight:
   - Confirm VPS SSH access
   - Capture PM2 state: pm2 list
   - Capture current HEAD SHA (rollback anchor)
   - Confirm tpi-schedule-runner.timer state

1. Branch: git checkout -b chore/next-16-upgrade from main

2. Manual package.json edits (no codemod):
   a. next: ^15.5.12 → ^16.2.6
   b. eslint-config-next: 15.1.6 → ^16.2.6
   c. next-intl: ^4.8.3 → ^4.12.0
   d. add @eslint/eslintrc to devDependencies
   e. scripts.lint: "next lint" → "eslint ."

3. npm install — resolve any peer-dep warnings

4. Manual ESLint flat config migration:
   - Create eslint.config.mjs (FlatCompat wrapping "next/core-web-vitals")
   - Delete .eslintrc.json

5. npm run build — iterate. If Turbopack "Webpack configuration found" error:
   → change build script to "next build --webpack" and re-run.

6. npm run lint — confirm eslint.config.mjs doesn't crash (warnings OK)

7. npm run test:e2e (Playwright only — no Vitest in TPI)

8. Commit in logical units:
   - Commit 1: package.json dep bumps + package-lock.json
   - Commit 2: ESLint flat config (eslint.config.mjs, delete .eslintrc.json, lint script)
   - Commit 3: any source fixes required by build/lint

9. git push origin chore/next-16-upgrade

10. ── STOP — open VS Code for Jose review / go-ahead ──

[After Jose's explicit go-ahead:]

11. VPS deploy:
    a. ssh root@104.225.221.138
    b. systemctl stop tpi-schedule-runner.timer
    c. cd /home/travelplaninfo/nextjs
    d. git pull origin chore/next-16-upgrade (or merged main if PR merged first)
    e. npm install
    f. rm -rf .next
    g. npm run build
    h. pm2 restart tpi
    i. Verify: pm2 list → tpi shows "online"
    j. Run VPS smoke (Step 12)
    k. systemctl start tpi-schedule-runner.timer

12. VPS smoke (curl one-liner — 9 URLs):
    / + /es/ /pt/ /fr/ /de/ /it/ + /sitemap.xml + /robots.txt + /destinations/
    → all must return 200

13. Merge branch to main after smoke passes
```

---

## 5. Verification + Rollback

### Verification bar (per `superpowers:verification-before-completion`)

Every success claim requires fresh command output:

- After Step 5 (build): paste `npm run build` output showing 0 errors + route table
- After Step 6 (lint): paste `npm run lint` exit line
- After Step 7 (E2E): paste Playwright summary line
- After Step 11h (PM2 restart): paste `pm2 list` row for `tpi`
- After Step 12 (smoke): paste curl output showing all 200s

### Rollback plan

**Before VPS deploy (Steps 1–9):** discard branch. No user impact.

**After VPS deploy:** SSH in and roll back manually:
```bash
cd /home/travelplaninfo/nextjs
git checkout <prev-HEAD-SHA>
npm install
rm -rf .next
npm run build
pm2 restart tpi
systemctl start tpi-schedule-runner.timer
```
Previous HEAD SHA is captured in pre-flight Step 0.

**Decision rule for rollback:** roll back immediately if within 10 minutes of deploy:
- `/` or any locale route returns non-200
- Locale negotiation fails (English-prefixed URLs served, or `/es/` returns 404)
- PM2 shows `errored` status
- `tpi-schedule-runner.timer` fails to resume

---

## 6. Open Questions

None at design time. All scope decisions made during brainstorming (2026-05-21 session).

---

## 7. Memory References

- `[[feedback_stay_on_latest_stack]]` — drives the decision to upgrade now
- `[[feedback_no_deploy_without_review]]` — gates Step 10 (VPS deploy requires Jose go-ahead)
- `[[feedback_verification_loop_runbook]]` — Section 5 verification bar
- `[[feedback_open_review_files_in_vscode]]` — spec opened in VS Code before plan step
- Backlog "TPI stack-currency upgrades" (in `memory/backlog.md`) — tracks follow-on loops

---

## 8. Next Step

Invoke `superpowers:writing-plans` with Opus to produce the implementation plan at `docs/superpowers/plans/2026-05-21-next-16-upgrade.md`.
