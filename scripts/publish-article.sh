#!/usr/bin/env bash
# publish-article.sh — Copy an assembled article JSON into the content pipeline
#
# Usage:
#   ./scripts/publish-article.sh <path/to/article.json>
#
# Copies article JSON to content/articles/<slug>.json and any sibling images
# to public/images/articles/<slug>/. Input file is never modified.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ARTICLES_DIR="${ROOT}/content/articles"
IMAGES_DIR="${ROOT}/public/images/articles"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path/to/article.json>" >&2
  exit 1
fi

INPUT="$1"

if [[ ! -f "$INPUT" ]]; then
  echo "Error: File not found: $INPUT" >&2
  exit 1
fi

# Validate JSON and extract slug.
# INPUT is passed via environment variable, not interpolated into the script
# string, to prevent shell injection (C2 fix).
SLUG=$(ARTICLE_PATH="$INPUT" node --input-type=module << 'JSEOF'
import fs from "fs";
const a = JSON.parse(fs.readFileSync(process.env.ARTICLE_PATH, "utf8"));
if (!a.slug) { process.stderr.write("Error: JSON missing required field: slug\n"); process.exit(1); }
if (!a.title) { process.stderr.write("Error: JSON missing required field: title\n"); process.exit(1); }
if (!a.content) { process.stderr.write("Error: JSON missing required field: content\n"); process.exit(1); }
process.stdout.write(a.slug);
JSEOF
)

DEST="${ARTICLES_DIR}/${SLUG}.json"
mkdir -p "${ARTICLES_DIR}"

# Write destination file (with affiliateOpportunities guaranteed). Input is untouched.
ARTICLE_PATH="$INPUT" ARTICLE_DEST="$DEST" node --input-type=module << 'JSEOF'
import fs from "fs";
const a = JSON.parse(fs.readFileSync(process.env.ARTICLE_PATH, "utf8"));
if (!a.affiliateOpportunities) a.affiliateOpportunities = [];
fs.writeFileSync(process.env.ARTICLE_DEST, JSON.stringify(a, null, 2) + "\n");
JSEOF

echo "✓ Article written to ${DEST}"

# Copy any sibling image files (input directory only, not recursively)
INPUT_DIR="$(dirname "$INPUT")"
IMAGES_DEST="${IMAGES_DIR}/${SLUG}"
COPIED=0
for img in "${INPUT_DIR}"/*.jpg "${INPUT_DIR}"/*.jpeg "${INPUT_DIR}"/*.png "${INPUT_DIR}"/*.webp "${INPUT_DIR}"/*.gif "${INPUT_DIR}"/*.svg; do
  [[ -f "$img" ]] || continue
  mkdir -p "${IMAGES_DEST}"
  cp "$img" "${IMAGES_DEST}/"
  COPIED=$((COPIED + 1))
done

[[ $COPIED -gt 0 ]] && echo "✓ Copied ${COPIED} image(s) to ${IMAGES_DEST}/"

echo "Done. Run 'npm run build' or wait for the rebuild trigger."
