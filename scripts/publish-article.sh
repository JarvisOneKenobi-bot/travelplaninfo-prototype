#!/usr/bin/env bash
# publish-article.sh — Copy an assembled article JSON into the content pipeline
#
# Usage:
#   ./scripts/publish-article.sh <path/to/article.json>
#
# The JSON must include at minimum: slug, title, content, date, modified, seo.
# Images referenced in the JSON should already reside alongside it or be
# absolute URLs; this script copies any sibling image files to
# public/images/articles/<slug>/ for you.

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

# Validate JSON and extract slug
SLUG=$(node -e "
  const a = JSON.parse(require('fs').readFileSync('${INPUT}', 'utf8'));
  if (!a.slug) { process.stderr.write('Error: JSON missing required field: slug\n'); process.exit(1); }
  if (!a.title) { process.stderr.write('Error: JSON missing required field: title\n'); process.exit(1); }
  if (!a.content) { process.stderr.write('Error: JSON missing required field: content\n'); process.exit(1); }
  // Ensure affiliateOpportunities exists
  if (!a.affiliateOpportunities) a.affiliateOpportunities = [];
  require('fs').writeFileSync('${INPUT}', JSON.stringify(a, null, 2) + '\n');
  process.stdout.write(a.slug);
")

DEST="${ARTICLES_DIR}/${SLUG}.json"
mkdir -p "${ARTICLES_DIR}"
cp "${INPUT}" "${DEST}"
echo "✓ Article copied to ${DEST}"

# Copy any sibling image files
INPUT_DIR="$(dirname "$INPUT")"
IMAGES_DEST="${IMAGES_DIR}/${SLUG}"
COPIED=0
for img in "${INPUT_DIR}"/*.{jpg,jpeg,png,webp,gif,svg} 2>/dev/null; do
  [[ -f "$img" ]] || continue
  mkdir -p "${IMAGES_DEST}"
  cp "$img" "${IMAGES_DEST}/"
  COPIED=$((COPIED + 1))
done

if [[ $COPIED -gt 0 ]]; then
  echo "✓ Copied ${COPIED} image(s) to ${IMAGES_DEST}/"
fi

echo "Done. Run 'npm run build' or wait for the rebuild trigger."
