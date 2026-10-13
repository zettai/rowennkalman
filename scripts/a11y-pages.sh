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

# Exact blank-prod list shared with Playwright and CI.
eval "$(npx tsx scripts/blank-prod-env.ts shell)"

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
