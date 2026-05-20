# TravelPlanInfo Phase A/B Remediation Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Align the repo with the real local-verify -> VPS-deploy workflow by removing stale Vercel residue and codifying the current VPS deployment contract.

**Architecture:** Treat `docs/MIGRATION_PLAN.md` as a legacy archive document, promote a new deployment runbook as the canonical operational reference, and add repo-local deployment artifacts (`.env.example`, PM2 config, Nginx template, deploy script). Keep application logic untouched in this phase. Cleanup tracked deployment junk (`.vercel`, `tsconfig.tsbuildinfo`) and update ignore rules. The runbook must explicitly document the current localhost caveats (`localhost:3000` and `localhost:8766`) rather than pretending they are already solved.

**Tech Stack:** Next.js 15, TypeScript, Node.js/PM2, Nginx, Bash, Markdown docs

---

## Task 1: Create canonical deployment docs and archive stale Vercel plan

**Objective:** Replace contradictory hosting docs with an explicit local -> VPS workflow and preserve the old migration plan as historical context only.

**Files:**
- Modify: `docs/MIGRATION_PLAN.md`
- Modify: `docs/plans/2026-03-19-tpi-full-launch.md`
- Create: `docs/deployment/local-to-vps.md`
- Modify: `scripts/export-wp.mjs`
- Modify: `REBUILD_SPEC.md`

**Step 1: Rewrite `docs/MIGRATION_PLAN.md` as a legacy archive note**
- Change the title and status so it clearly reads as historical Vercel-era context.
- Add a top-note that Vercel is retired and not used for deployment.
- Keep useful WP/content migration notes, but remove active operational instructions that point DNS/domain flow to Vercel.

**Step 2: Mark the VPS launch plan as directionally canonical**
- Add a brief note near the top of `docs/plans/2026-03-19-tpi-full-launch.md` stating that hosting direction is VPS/self-hosted.
- Link readers to the new deployment runbook for live operations.

**Step 3: Create `docs/deployment/local-to-vps.md`**
Include exact sections for:
- workflow summary: local verify -> VPS deploy
- runtime topology: Next on 3001 behind Nginx, PM2 process name `tpi`
- explicit caveat that current app/server routes still assume `localhost:3000` and `localhost:8766` in some places
- required environment variables that are actually wired today
- note that Anthropic summarization currently reads a credential file under `~/.openclaw/credentials/anthropic.json`, not `ANTHROPIC_API_KEY`
- SQLite storage location and permission expectations (`data/tpi.db` under repo cwd)
- deployment steps
- rollback steps
- post-deploy verification commands

**Step 4: Clean remaining obvious Vercel residue in ancillary docs/scripts**
- Update `scripts/export-wp.mjs` header comment to remove “Vercel” wording.
- Update `REBUILD_SPEC.md` wording if the `vercel-approved.png` reference is presented as active deployment guidance; preserve the image path if needed but label it as historical naming only.

**Step 5: Open the markdown docs in VS Code**
Run:
- `code /home/jarvis/.openclaw/workspace/jarvis-project/travelplaninfo-prototype/docs/plans/2026-05-20-phase-a-b-remediation.md`
- `code /home/jarvis/.openclaw/workspace/jarvis-project/travelplaninfo-prototype/docs/deployment/local-to-vps.md`

---

## Task 2: Add repo-local deployment artifacts

**Objective:** Convert VPS deployment from prose-only guidance into concrete versioned files.

**Files:**
- Create: `.env.example`
- Create: `ecosystem.config.cjs`
- Create: `deploy/nginx/travelplaninfo.com.conf`
- Create: `scripts/deploy-vps.sh`

**Step 1: Add `.env.example`**
Include names only, no secrets. Keep it minimal and accurate to current wiring:
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `FASTAPI_URL`
- `TRAVELPAYOUTS_TOKEN`
- `GOOGLE_GEOCODING_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OPENAI_API_KEY`

Do not list `ANTHROPIC_API_KEY` as a current runtime requirement in this phase because the repo is not wired to use it yet.

**Step 2: Add `ecosystem.config.cjs`**
Define PM2 app `tpi` that:
- runs from repo root
- starts production server on port `3001`
- achieves that explicitly via `env: { PORT: 3001 }` and/or `args: "-p 3001"`
- supports `env`/`env_production`
- uses a stable process name `tpi`

**Step 3: Add `deploy/nginx/travelplaninfo.com.conf`**
Template should:
- proxy to `127.0.0.1:3001`
- include `proxy_http_version 1.1`
- pass standard forwarded headers
- include upgrade/connection headers for streaming compatibility
- allow direct caching for static assets like `/_next/static/`
- include certificate path placeholders/comments instead of host-specific secrets

**Step 4: Add `scripts/deploy-vps.sh`**
Script should:
- run from repo root
- fail fast if required files are missing
- ensure `data/` exists before build/start
- install dependencies via `npm ci`
- build via `npm run build`
- start/reload PM2 using `ecosystem.config.cjs`
- print next verification commands

---

## Task 3: Clean tracked deployment junk and ignore future churn

**Objective:** Remove stale machine-specific artifacts from git-tracked state and prevent recurrence.

**Files:**
- Modify: `.gitignore`
- Remove from git tracking: `.vercel/README.txt`
- Remove from git tracking: `.vercel/project.json`
- Remove from git tracking: `tsconfig.tsbuildinfo`

**Step 1: Update `.gitignore`**
Ensure it contains:
- `/.env*`
- `!.env.example`
- `.vercel/`
- `tsconfig.tsbuildinfo`

**Step 2: Remove tracked artifacts from the index**
Run:
- `git rm --cached .vercel/README.txt .vercel/project.json tsconfig.tsbuildinfo`

**Step 3: Verify only intended files changed**
Run:
- `git status --short`
Expected:
- modified docs/config/scripts created in this plan
- deleted-from-index `.vercel/*` and `tsconfig.tsbuildinfo`
- no unintended source logic changes

---

## Task 4: Verify Phase A/B changes

**Objective:** Prove the repo is cleaner and deployment artifacts are present without claiming application logic changes.

**Files:**
- Verify all changed files above

**Step 1: Run lint**
Run: `npm run lint`
Expected: exit 0, warnings acceptable if pre-existing.

**Step 2: Run build**
Run: `npm run build`
Expected: exit 0.

**Step 3: Verify deployment files exist**
Run:
- `test -f docs/deployment/local-to-vps.md`
- `test -f .env.example`
- `test -f ecosystem.config.cjs`
- `test -f deploy/nginx/travelplaninfo.com.conf`
- `test -f scripts/deploy-vps.sh`

**Step 4: Verify script/config sanity**
Run:
- `bash -n scripts/deploy-vps.sh`
- `node -e "const c=require('./ecosystem.config.cjs'); console.log(c.apps?.[0]?.name, c.apps?.[0]?.env?.PORT || c.apps?.[0]?.args || '')"`
Expected:
- deploy script parses cleanly
- PM2 config clearly sets port 3001

**Step 5: Verify `.env.example` is tracked, not ignored**
Run:
- `git check-ignore -v .env.example || true`
- `git ls-files .env.example | cat`
Expected:
- no ignore rule claims `.env.example`
- `.env.example` appears in tracked files after add

**Step 6: Verify tracked junk is gone from git index**
Run:
- `git ls-files .vercel .vercel/project.json .vercel/README.txt tsconfig.tsbuildinfo | cat`
Expected: no output.

**Step 7: Verify docs mention current caveats and runtime assumptions**
Run searches confirming:
- `docs/deployment/local-to-vps.md` mentions `localhost:3000`
- `docs/deployment/local-to-vps.md` mentions `localhost:8766`
- `docs/deployment/local-to-vps.md` mentions `data/tpi.db`

**Step 8: Open final markdown handoff docs in VS Code**
Run:
- `code /home/jarvis/.openclaw/workspace/jarvis-project/travelplaninfo-prototype/docs/deployment/local-to-vps.md`
- `code /home/jarvis/.openclaw/workspace/jarvis-project/travelplaninfo-prototype/docs/MIGRATION_PLAN.md`

---

## Review checklist
- [ ] `docs/MIGRATION_PLAN.md` no longer presents Vercel as active deployment target
- [ ] canonical deployment runbook exists for local -> VPS workflow
- [ ] runbook explicitly documents current localhost caveats and SQLite path
- [ ] repo contains PM2, Nginx, env, and deploy artifacts
- [ ] `.env.example` is tracked and not swallowed by `.gitignore`
- [ ] `.vercel` and `tsconfig.tsbuildinfo` are no longer tracked
- [ ] lint/build still pass after non-logic changes
