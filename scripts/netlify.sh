#!/usr/bin/env bash
# Netlify CLI / API for this site, with the token read from the macOS Keychain for this
# command only (never written to a file or printed). Token: Keychain item
# "rowennkalman-netlify-token" (a personal access token; it can reach the whole account).
#
#   scripts/netlify.sh api listSiteDeploys --data '{"site_id":"fdee4ce6-92ce-4b16-9948-83aeba4f7c2b"}'
#   scripts/netlify.sh logs:function ___netlify-server-handler     # live function log
#   scripts/netlify.sh status
#   scripts/netlify.sh logs --source functions --function ___netlify-server-handler \
#       --since 2026-09-30T04:12:30Z --until 2026-09-30T04:14:00Z --json
#     The history output is capped (~140 lines), so read narrow windows. The app logs one JSON
#     line per "save" (editor, page, changed fields, from/to version, ms) and per "render".
set -euo pipefail
export NETLIFY_SITE_ID="fdee4ce6-92ce-4b16-9948-83aeba4f7c2b"
NETLIFY_AUTH_TOKEN="$(security find-generic-password -a "$USER" -s rowennkalman-netlify-token -w)" \
  exec npx -y netlify-cli@latest "$@"
