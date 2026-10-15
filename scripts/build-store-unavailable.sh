#!/usr/bin/env bash
# Prove `next build` succeeds when S3Store cannot read content.json.
# Uses dummy (non-production) S3 env so the process selects S3Store, never FileStore
# and never the real bucket. Shared blank list from scripts/blank-prod-env.ts.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export NEXT_TELEMETRY_DISABLED=1

BLANK_EXPORTS="$(npx tsx scripts/blank-prod-env.ts shell)" || {
  echo "build-store-unavailable: blank-prod-env failed" >&2
  exit 1
}
if [[ -z "$BLANK_EXPORTS" ]]; then
  echo "build-store-unavailable: blank-prod-env produced empty exports; refusing to build" >&2
  exit 1
fi
eval "$BLANK_EXPORTS"

# Complete dummy S3 config: selects S3Store; GetObject must fail (invalid host / no object).
export ROWENNKALMAN_S3_ENDPOINT="https://s3.invalid"
export ROWENNKALMAN_S3_REGION="fr-par"
export ROWENNKALMAN_S3_BUCKET="rk-build-probe"
export ROWENNKALMAN_S3_ACCESS_KEY="test"
export ROWENNKALMAN_S3_SECRET_KEY="test"
export ROWENNKALMAN_PUBLIC_IMAGE_BASE="https://img.invalid"

for key in \
  ROWENNKALMAN_S3_ENDPOINT \
  ROWENNKALMAN_S3_REGION \
  ROWENNKALMAN_S3_BUCKET \
  ROWENNKALMAN_S3_ACCESS_KEY \
  ROWENNKALMAN_S3_SECRET_KEY \
  ROWENNKALMAN_PUBLIC_IMAGE_BASE; do
  if [[ -z "${!key}" ]]; then
    echo "build-store-unavailable: $key must be set to a dummy value; refusing to build" >&2
    exit 1
  fi
done

npx next build
