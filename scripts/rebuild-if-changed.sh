#!/usr/bin/env bash
# rebuild-if-changed.sh — Rebuild and restart the app if content/articles/ has changed.
#
# Intended to run on a cron schedule, e.g. every 5 minutes:
#   */5 * * * * /path/to/rebuild-if-changed.sh >> /var/log/tpi-rebuild.log 2>&1
#
# On first run it records a baseline hash. Subsequent runs compare against it.
# If the hash has changed: runs `npm run build` then `pm2 restart tpi`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ARTICLES_DIR="${ROOT}/content/articles"
HASH_FILE="${ROOT}/.articles-hash"

if [[ ! -d "${ARTICLES_DIR}" ]]; then
  echo "[$(date -Iseconds)] content/articles/ not found — nothing to do."
  exit 0
fi

# Compute a stable hash of all article files (names + content)
CURRENT_HASH=$(find "${ARTICLES_DIR}" -name "*.json" -type f | sort | xargs md5sum 2>/dev/null | md5sum | awk '{print $1}')

if [[ ! -f "${HASH_FILE}" ]]; then
  echo "${CURRENT_HASH}" > "${HASH_FILE}"
  echo "[$(date -Iseconds)] Baseline hash recorded (${CURRENT_HASH}). No rebuild needed."
  exit 0
fi

PREV_HASH=$(cat "${HASH_FILE}")

if [[ "${CURRENT_HASH}" == "${PREV_HASH}" ]]; then
  echo "[$(date -Iseconds)] No changes detected (${CURRENT_HASH})."
  exit 0
fi

echo "[$(date -Iseconds)] Change detected (${PREV_HASH} → ${CURRENT_HASH}). Rebuilding..."

cd "${ROOT}"
npm run build

# Restart pm2 process if running
if command -v pm2 &>/dev/null && pm2 describe tpi &>/dev/null; then
  pm2 restart tpi
  echo "[$(date -Iseconds)] pm2 process 'tpi' restarted."
else
  echo "[$(date -Iseconds)] pm2 not found or 'tpi' not running — skipping restart."
fi

echo "${CURRENT_HASH}" > "${HASH_FILE}"
echo "[$(date -Iseconds)] Rebuild complete."
