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

This runbook documents the runtime contract the repo currently expects.

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
- Next.js server -> local filesystem + SQLite only; no FastAPI sidecar dependency

## 3. Application URL and backend URL behavior

Current server-side URL behavior:

- Authenticated internal Next.js self-calls use trusted app-base config.
  - For assistant chat background summarization, the app builds `/api/assistant/summarize` against `APP_BASE_URL`, then `NEXTAUTH_URL`, then `http://localhost:3000`.
  - Authenticated self-calls do not trust request-derived origin or host values.
- URL composition is path-safe.
  - Base URLs are normalized without trailing slashes before route paths are appended.

Operationally, that means:

- Set `APP_BASE_URL` to the canonical application base URL for server-side self-calls.
- Keep `NEXTAUTH_URL` aligned with the canonical app URL for auth flows.

## 4. Environment variables and credential inputs in use today

These are the runtime inputs actually wired in the current repo:

Required or effectively required for normal operation:

- `NEXTAUTH_SECRET`
  - Used implicitly by NextAuth runtime for session security.
- `NEXTAUTH_URL`
  - Used implicitly by NextAuth runtime for canonical auth URLs.
- `APP_BASE_URL`
  - Used for trusted server-side authenticated self-call fallback.
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
- `ANTHROPIC_API_KEY`
  - Preferred credential source for assistant summarization.
- `OPENAI_API_KEY`
  - Preferred credential source for transcription.

Credential-file compatibility behavior that matters today:

- Anthropic summarization first reads `ANTHROPIC_API_KEY`.
- If `ANTHROPIC_API_KEY` is unset, summarization can still fall back to `~/.openclaw/credentials/anthropic.json` and expects an `api_key` entry there.
- OpenAI transcription first reads `OPENAI_API_KEY`.
- If `OPENAI_API_KEY` is unset, transcription can still fall back to `~/.openclaw/credentials/openai.json` and accepts either `api_key` or `key`.
- The legacy credential files are compatibility fallbacks only. VPS deployments should prefer env-only configuration.

Optional verification-only variable:

- `BASE_URL`
  - Used by Playwright config for test targeting; default is `http://localhost:3001`.
  - This is not the main application runtime contract, but it is useful for post-deploy checks.

## 5. Atlas brain (Phase 2)

Phase 2 moves Atlas's brain into the Next.js app, so production Atlas no longer depends on the workstation-only `command-post` FastAPI service.

Required new VPS env vars:

- `ANTHROPIC_API_KEY`
  - Required by the in-app Atlas brain for Anthropic Messages API calls.
  - **NOT YET PROVISIONED on the VPS today.** Jose must add this manually before any real production smoke test.
- `TRAVELPAYOUTS_TOKEN`
  - Required by the in-app Atlas brain for real Travelpayouts / Aviasales flight and deal data.
  - **NOT YET PROVISIONED on the VPS today.** Jose must add this manually before any real production smoke test.

Provision these through the same VPS env file mechanism used for the existing runtime inputs above (`NEXTAUTH_URL`, `APP_BASE_URL`, API credentials, etc.). This is a manual pre-deploy / pre-smoke-test gate for Jose; do not treat production assistant verification as valid until both values are present in the PM2 runtime environment.

Database note:

- `data/tpi.db` gets the new `assistant_cost` table automatically on the next app start through the existing `getDb()` migration-on-load pattern.
- No manual SQLite migration step is required.

Production smoke test commands:

```bash
npm run lint && npm run test && npm run build
curl -sL https://travelplaninfo.com/api/assistant/health | jq .
BASE_URL=https://travelplaninfo.com npx playwright test tests/e2e/planner-trust.spec.ts
```

Manual gate:

- Guest session -> create a MIA/Cancun (or similar) trip -> consent to Atlas.
- Verify a streamed reply.
- Verify a real flight/deal card with an Aviasales marker link.
- Verify a spend row appears in `assistant_cost` on the VPS:

```bash
sqlite3 data/tpi.db "select * from assistant_cost order by id desc limit 5;"
```

- Ask Atlas about hotels for the trip's destination and confirm the reply is prose + a real Hotels.com link, with no named hotel, rating, or price.

Confirm this production smoke test with the workstation off or unreachable. The point of Phase 2 is that Atlas no longer needs `command-post` running.

## 6. SQLite storage and permissions

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

## 7. Local verification before deploy

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

If testing assistant-related flows locally, remember the current defaults:

- authenticated self-calls fall back to `APP_BASE_URL`, then `NEXTAUTH_URL`, then `http://localhost:3000`
- All assistant and surprise-destination flows are native to the Next.js app as of 2026-07-11, with no FastAPI backend.

## 8. VPS deployment steps

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
3. Ensure runtime inputs exist (`.env` and any required service config). Prefer env vars for API credentials; only rely on legacy credential files for compatibility.
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

## 9. Nginx contract

Nginx should proxy the public site to the local Next.js process:

- upstream target: `127.0.0.1:3001`
- preserve forwarded host / proto headers
- support connection upgrade headers
- allow direct caching for `/_next/static/`

Important: this document assumes Nginx fronts port 3001, not port 3000.

## 10. Rollback steps

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

## 11. Post-deploy verification commands

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

If validating assistant-adjacent behavior, also verify the app-native assistant health endpoint:

```bash
curl -I http://127.0.0.1:3001/api/assistant/health
```

## 12. Related documents

- Active operations runbook: `docs/deployment/local-to-vps.md`
- Historical Vercel-era archive: `docs/MIGRATION_PLAN.md`
- Product / launch implementation plan: `docs/plans/2026-03-19-tpi-full-launch.md`
