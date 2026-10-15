#!/usr/bin/env bash
# Build and scan the main public pages with pa11y-ci on a local FileStore.
# Never touches production: blank overrides come from scripts/blank-prod-env.ts.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT=3300
DATA_DIR=".data-a11y"
export NEXT_TELEMETRY_DISABLED=1
export ROWENNKALMAN_DATA_DIR="$DATA_DIR"
export ROWENNKALMAN_SESSION_SECRET="a11y-session-secret-a11y-session-secret-0000"
export ROWENNKALMAN_ADMIN_EMAILS="editor@example.com"
export ROWENNKALMAN_SITE_URL="http://localhost:${PORT}"

# Exact blank-prod list shared with Playwright and CI (scripts/blank-prod-env.ts).
BLANK_KEYS=(
  ROWENNKALMAN_S3_ENDPOINT
  ROWENNKALMAN_S3_REGION
  ROWENNKALMAN_S3_BUCKET
  ROWENNKALMAN_S3_ACCESS_KEY
  ROWENNKALMAN_S3_SECRET_KEY
  ROWENNKALMAN_PUBLIC_IMAGE_BASE
  ROWENNKALMAN_IMAGE_CDN_URL
  ROWENNKALMAN_GOATCOUNTER_URL
  ROWENNKALMAN_GOATCOUNTER_API_KEY
  ROWENNKALMAN_CF_ACCESS_CLIENT_ID
  ROWENNKALMAN_CF_ACCESS_CLIENT_SECRET
  ROWENNKALMAN_RESEND_API_KEY
  ROWENNKALMAN_CONTACT_TO
  ROWENNKALMAN_CONTACT_FROM
)

BLANK_EXPORTS="$(npx tsx scripts/blank-prod-env.ts shell)" || {
  echo "a11y-pages: blank-prod-env failed (tsx/shell exports)" >&2
  exit 1
}
if [[ -z "$BLANK_EXPORTS" ]]; then
  echo "a11y-pages: blank-prod-env produced empty exports; refusing to build" >&2
  exit 1
fi
eval "$BLANK_EXPORTS"

for key in "${BLANK_KEYS[@]}"; do
  if [[ -z "${!key+x}" ]]; then
    echo "a11y-pages: $key is unset after blank-prod-env; refusing to build" >&2
    exit 1
  fi
  if [[ -n "${!key}" ]]; then
    echo "a11y-pages: $key must be empty; refusing to build" >&2
    exit 1
  fi
done

rm -rf "$DATA_DIR"
npx next build

npx next start -p "$PORT" &
SERVER_PID=$!
cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:${PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS "http://localhost:${PORT}/" >/dev/null

npx pa11y-ci
