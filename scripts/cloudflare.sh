#!/usr/bin/env bash
# Wrangler for the image Worker (cloudflare/image-worker), with the Cloudflare API token read
# from the macOS Keychain for this command only (never written to a file or printed).
# Token: Keychain item "rowennkalman-cloudflare-token"; scopes and rotation in docs/IMAGES.md.
#
#   scripts/cloudflare.sh deploy          # deploy the Worker
#   scripts/cloudflare.sh tail            # live Worker log
#   scripts/cloudflare.sh purge <url>...  # drop pictures from Cloudflare's cache
set -euo pipefail
cd "$(dirname "$0")/../cloudflare/image-worker"
CLOUDFLARE_API_TOKEN="$(security find-generic-password -a "$USER" -s rowennkalman-cloudflare-token -w)"
export CLOUDFLARE_API_TOKEN
ZONE_ID="79515047704d48b1ba52f1655741ca91" # tomas-tello.stream
case "${1:-}" in
  deploy) exec npx -y wrangler@4 deploy ;;
  tail) exec npx -y wrangler@4 tail rowennkalman-images ;;
  purge)
    shift
    [ $# -gt 0 ] || { echo "usage: $0 purge <url>..." >&2; exit 2; }
    body=$(python3 -c 'import json,sys; print(json.dumps({"files": sys.argv[1:]}))' "$@")
    curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" --data "$body" |
      python3 -c 'import json,sys; d=json.load(sys.stdin); print("purged" if d["success"] else d["errors"])'
    ;;
  *) echo "usage: $0 deploy | tail | purge <url>..." >&2; exit 2 ;;
esac
