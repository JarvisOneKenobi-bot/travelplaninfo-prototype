# TravelPlanInfo deployment runbook — local verify to VPS

Status: Canonical deployment and rollback runbook for the current self-hosted / VPS direction.

This document is the active operational reference for deploying TravelPlanInfo. Historical Vercel planning notes remain in `docs/MIGRATION_PLAN.md` for archive context only.

## 1. Workflow summary

The intended workflow is:

1. Verify changes locally.
2. Push / sync the repo to the VPS.
3. Build on the VPS from the repo root.
4. Run the Next.js app under PM2 as process `tpi`.
5. Put Nginx in front of the app and proxy public traffic to `127.0.0.1:3001`.
6. Run post-deploy verification before considering the deploy complete.

This runbook does not change application logic. It documents the runtime contract the repo currently expects.

## 2. Runtime topology

Production target topology:

- Nginx terminates TLS and serves the public hostname.
- Nginx proxies application traffic to `127.0.0.1:3001`.
- Next.js runs via PM2 with process name `tpi`.
- The app repo is the working directory for runtime file access.
- SQLite is stored at `data/tpi.db` under the repo current working directory (`process.cwd()`).

Expected process layout:

- public HTTPS -> Nginx
- Nginx -> `http://127.0.0.1:3001`
- Next.js server -> local filesystem + SQLite + localhost FastAPI dependency where configured

## 3. Current localhost caveats you must account for

These caveats are real in the current codebase and must be preserved in deployment planning until the code is updated:

- Some server-side code still calls `http://localhost:3000` directly.
  - `src/app/api/assistant/chat/route.ts` triggers background summarization via `http://localhost:3000/api/assistant/summarize`.
  - This means a deployment that only exposes Next.js on port 3001 can still have internal assumptions about `localhost:3000`.
- Some server-side code still calls `http://localhost:8766` directly.
  - `src/app/api/assistant/chat/route.ts` calls the assistant backend at `http://localhost:8766/api/assistant/chat`.
  - `src/app/api/assistant/summarize/route.ts` records spend to `http://localhost:8766/api/assistant/record-spend`.
- The surprise-me route uses `FASTAPI_URL` if set, but otherwise falls back to `http://localhost:8766`.

Operationally, that means:

- Do not assume the repo is fully host/port-agnostic yet.
- If the VPS deploy runs Next.js on 3001, either keep a local compatibility path for `localhost:3000` or treat those internal hard-coded calls as a known limitation until a later remediation task changes them.
- The FastAPI-side assistant services are still expected on `localhost:8766` unless explicitly reconfigured where supported.

## 4. Environment variables and credential inputs in use today

These are the runtime inputs actually wired in the current repo:

Required or effectively required for normal operation:

- `NEXTAUTH_SECRET`
  - Used implicitly by NextAuth runtime for session security.
- `NEXTAUTH_URL`
  - Used implicitly by NextAuth runtime for canonical auth URLs.
- `FASTAPI_URL`
  - Used by `src/app/api/surprise-me/route.ts`; otherwise the route falls back to `http://localhost:8766`.
- `TRAVELPAYOUTS_TOKEN`
  - Used by `src/app/api/trending-prices/route.ts`.
- `GOOGLE_GEOCODING_KEY`
  - Used by geocoding helpers; `NEXT_PUBLIC_GOOGLE_MAPS_KEY` is used as fallback in some geocode flows.
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY`
  - Used client-side for maps / places autocomplete.
- `GOOGLE_CLIENT_ID`
  - Enables Google auth provider when paired with `GOOGLE_CLIENT_SECRET`.
- `GOOGLE_CLIENT_SECRET`
  - Enables Google auth provider when paired with `GOOGLE_CLIENT_ID`.
- `OPENAI_API_KEY`
  - Fallback for transcription if the OpenAI credential file is absent.

Credential-file behavior that matters today:

- Anthropic summarization does not read `ANTHROPIC_API_KEY`.
- Anthropic summarization currently reads `~/.openclaw/credentials/anthropic.json` and expects an `api_key` entry there.
- OpenAI transcription first tries `~/.openclaw/credentials/openai.json` and falls back to `OPENAI_API_KEY` only if that file is not available.

Optional verification-only variable:

- `BASE_URL`
  - Used by Playwright config for test targeting; default is `http://localhost:3001`.
  - This is not the main application runtime contract, but it is useful for post-deploy checks.

## 5. SQLite storage and permissions

The app opens SQLite at:

- `data/tpi.db`

Important implications:

- The path is relative to the repo current working directory because `src/lib/db.ts` uses `path.join(process.cwd(), "data", "tpi.db")`.
- The runtime user must be able to create and write the `data/` directory.
- The runtime user must be able to create WAL sidecar files next to the DB (`tpi.db-wal`, `tpi.db-shm`).
- If you change the PM2 working directory, you change where SQLite is created.

Recommended expectation on the VPS:

- deploy from the repo root
- ensure `data/` exists before first start
- ensure the app user owns or can write the repo-local `data/` directory

## 6. Local verification before deploy

From the repo root:

```bash
npm ci
npm run lint
npm run build
npm run start -- --port 3001
```

Minimum local checks:

```bash
curl -I http://127.0.0.1:3001/
curl -I http://127.0.0.1:3001/hot-deals
```

If testing assistant-related flows locally, remember the current caveats:

- some code paths still assume `localhost:3000`
- FastAPI-backed assistant flows assume `localhost:8766` unless configured otherwise

## 7. VPS deployment steps

Assumptions:

- repo is present on the VPS
- Node.js and npm are installed
- PM2 is installed
- Nginx is installed
- TLS is handled at Nginx
- the deployment runs from the repo root

Deploy procedure:

1. Sync the latest repo state to the VPS.
2. Change into the repo root.
3. Ensure runtime inputs exist (`.env`, credential files, and any required service config).
4. Ensure the SQLite directory exists:

```bash
mkdir -p data
```

5. Install dependencies and build:

```bash
npm ci
npm run build
```

6. Start or reload the app with PM2 under process name `tpi` on port 3001.

Example intent for PM2 config:

- name: `tpi`
- cwd: repo root
- command: Next.js production start
- port: `3001`

7. Confirm the local upstream answers before involving Nginx:

```bash
curl -I http://127.0.0.1:3001/
```

8. Reload Nginx after validating config.
9. Run the post-deploy verification commands below.

## 8. Nginx contract

Nginx should proxy the public site to the local Next.js process:

- upstream target: `127.0.0.1:3001`
- preserve forwarded host / proto headers
- support connection upgrade headers
- allow direct caching for `/_next/static/`

Important: this document assumes Nginx fronts port 3001, not port 3000.

## 9. Rollback steps

If the new deploy is bad but the previous VPS release is still available:

1. Stop routing traffic changes beyond the VPS; keep DNS unchanged unless the entire VPS path is unusable.
2. Restore the previous known-good release on the VPS.
3. Rebuild only if the rollback artifact requires it.
4. Restart or reload PM2 for process `tpi`.
5. Re-check Nginx upstream health.
6. Verify homepage, a content page, and any critical planner/auth paths.

Suggested rollback verification:

```bash
pm2 status tpi
curl -I http://127.0.0.1:3001/
curl -I https://travelplaninfo.com/
```

If rollback involves database risk:

- confirm `data/tpi.db` still exists in the repo cwd
- confirm the runtime user can still write `data/`
- do not delete `data/tpi.db` as part of a routine code rollback

## 10. Post-deploy verification commands

Run these after each VPS deploy:

```bash
pm2 status tpi
pm2 logs tpi --lines 100
curl -I http://127.0.0.1:3001/
curl -I http://127.0.0.1:3001/hot-deals
curl -I https://travelplaninfo.com/
curl -I https://travelplaninfo.com/hot-deals
```

Useful spot checks:

```bash
test -d data && echo "data dir present"
test -f data/tpi.db && echo "sqlite present" || echo "sqlite will be created on first DB write"
```

If validating assistant-adjacent behavior, also verify dependency reachability with the current caveats in mind:

```bash
curl -I http://127.0.0.1:8766/ || true
```

## 11. Related documents

- Active operations runbook: `docs/deployment/local-to-vps.md`
- Historical Vercel-era archive: `docs/MIGRATION_PLAN.md`
- Product / launch implementation plan: `docs/plans/2026-03-19-tpi-full-launch.md`
