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
case "${1:-}" in
  deploy) exec npx -y wrangler@4 deploy ;;
  tail) exec npx -y wrangler@4 tail rowennkalman-images ;;
  purge)
    shift
    [ $# -gt 0 ] || { echo "usage: $0 purge <url>..." >&2; exit 2; }
    # The cache is per hostname and each host lives in its own zone, so purge each URL in the
    # zone of its host. img.tomas-tello.stream stays until it is retired (docs/IMAGES.md).
    for url in "$@"; do
      case "$url" in
        https://img.rowennkalman.com/*) zone="a29576aeacdb46c6bbd98af185bc5ff7" ;;   # rowennkalman.com
        https://img.tomas-tello.stream/*) zone="79515047704d48b1ba52f1655741ca91" ;; # tomas-tello.stream
        *) echo "not an image-CDN URL: $url" >&2; exit 2 ;;
      esac
      body=$(python3 -c 'import json,sys; print(json.dumps({"files": [sys.argv[1]]}))' "$url")
      curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$zone/purge_cache" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" --data "$body" |
        python3 -c 'import json,sys; d=json.load(sys.stdin); print("purged" if d["success"] else d["errors"])'
    done
    ;;
  *) echo "usage: $0 deploy | tail | purge <url>..." >&2; exit 2 ;;
esac
