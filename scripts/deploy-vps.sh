#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f package.json ]]; then
  echo "Error: run this script from the repository root." >&2
  exit 1
fi

required_files=(
  "package.json"
  "package-lock.json"
  ".env"
  "ecosystem.config.cjs"
)

for required_file in "${required_files[@]}"; do
  if [[ ! -f "$required_file" ]]; then
    echo "Error: missing required file: $required_file" >&2
    exit 1
  fi
done

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or not in PATH." >&2
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "Error: pm2 is not installed or not in PATH." >&2
  exit 1
fi

mkdir -p data

echo "==> Installing dependencies"
npm ci

echo "==> Building application"
npm run build

echo "==> Starting or reloading PM2 process"
if pm2 describe tpi >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --only tpi --env production
else
  pm2 start ecosystem.config.cjs --only tpi --env production
fi

pm2 save

echo
echo "Deployment complete. Next verification commands:"
echo "  pm2 status tpi"
echo "  pm2 logs tpi --lines 100"
echo "  curl -I http://127.0.0.1:3001"
echo "  sudo nginx -t"
echo "  sudo systemctl reload nginx"
