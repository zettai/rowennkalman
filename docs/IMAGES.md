# Pictures: how they are stored and served

This is the guide to the picture pipeline: what happens to a photo from the moment Rowenn picks
it to the moment a visitor sees it, every switch and secret involved, and step-by-step runbooks.
It has more moving parts than anything else on the site, so read the runbook before changing
anything. Built 2026-09-30; the decisions and the numbers behind them are at the end.

## The flow

```
 Rowenn's phone / computer                Netlify (upload function)              Scaleway bucket (Paris)
 ─────────────────────────                ─────────────────────────              ───────────────────────
 1. picks a photo
 2. PREPARE on the device:                3. SAVE + SIZES:                        art/<id>.jpg        (original)
    decode, rotate, shrink to               re-check it is a clean JPEG    ──►   art/<id>-640.webp
    2800 px, re-encode JPEG 0.85,           store the original                   art/<id>-960.webp
    strip camera/GPS data,                  make WebP copies with sharp          art/<id>-1280.webp
    make a 20 px blur preview               (640/960/1280/1920 px, q80,          art/<id>-1920.webp
 ── SEND (progress %) ──────────────►       never wider than the original)       content.json (private)
                                            answer { image: {..., sizes}, id }    logs/upload-failures/ (private)
                                                                                         │
 Visitor's browser                        Cloudflare (img.tomas-tello.stream)            │
 ─────────────────                        ───────────────────────────────────            │
 page lists a srcset:                     Worker "rowennkalman-images":                  │
   …-640.webp 640w, …-960.webp 960w,        serves only art/*.webp|jpg          ◄───────┘
   …-1280.webp 1280w, …-1920.webp 1920w,    MISS: fetch from the bucket, keep a copy
   <id>.jpg 2800w                           HIT: answer from the nearby Cloudflare copy
 and picks the smallest that fits  ──►      (kept a year; files never change)
```

A picture **without** `sizes` in the content (older ones before the backfill, or one whose
sizes failed) is served the old way: the original from the bucket, resized per request by
Netlify's image CDN (`/_next/image`). Nothing breaks; it is just slower.

### What each piece does

| Piece | Where | What it does |
|---|---|---|
| `prepareImage` | `src/lib/upload/client.ts` (browser) | shrink to 2800 px, JPEG, strips EXIF/GPS, blur preview |
| `uploadImage` | same file | sends with `XMLHttpRequest` (for the %), reports steps, gives the attempt an id (`u-xxxxxxxx`) |
| `ImagePicker` | `src/app/admin/_components/ImagePicker.tsx` | the step panel: ✓ Preparing → Sending % → Saving + sizes; on failure: step, message, Reference, Try again |
| `handleUpload` | `src/lib/admin/handlers.ts` (server) | checks the JPEG, stores it, makes + stores the sizes, logs one `upload` line |
| `makeSizes` / `sizeKey` / `srcSetFor` | `src/lib/images/sizes.ts` | the one resize implementation (sharp), used by uploads **and** the backfill |
| `pictureSrc` | `src/components/site/content.ts` | per picture: srcset through the Worker, or the old way |
| `Painting` | `src/components/site/Painting.tsx` | plain `<img srcset>` when there are sizes, `next/image` otherwise; blur preview + fade |
| Worker | `cloudflare/image-worker/` | caches pictures at Cloudflare; 404 for anything outside `art/` |
| Stores | `src/lib/store/*.ts` | `putImageSize`; `deleteImage` also deletes the sizes; `listImages` lists originals only, so the orphan sweep never deletes sizes on their own |

## Switches, secrets and where they live

| Name | Where | What |
|---|---|---|
| `ROWENNKALMAN_IMAGE_CDN_URL` | Netlify env, production context, **not secret** | `https://img.tomas-tello.stream`. **The off switch**: unset it (and redeploy) and every picture goes back to the old way. |
| Cloudflare API token | macOS Keychain, item `rowennkalman-cloudflare-token` | Used by `scripts/cloudflare.sh`. **Expires 2027-09-30.** Scopes (nothing else, so it cannot touch the tunnel, Access or DNS): Account → Workers Scripts → Edit; Zone → Workers Routes → Edit; Zone → Cache Purge → Purge; Zone → Zone → Read. Zone resources: only `tomas-tello.stream`. No IP filter (home IP changes). |
| Netlify token | Keychain, `rowennkalman-netlify-token` | `scripts/netlify.sh` (logs, purge of cached pages). Expires ~2026-12-29. |
| Bucket keys | Netlify env + `.env.local` on Luis's Mac (**production**) | The upload function and the scripts. |
| Worker config | `cloudflare/image-worker/wrangler.toml` | account id, `ORIGIN` (the bucket URL), the custom domain. Not secret. |

Cloudflare side (Luis's account, zone `tomas-tello.stream`): Worker
`rowennkalman-images` with custom domain `img.tomas-tello.stream` (Cloudflare created its DNS
record and certificate). It is **not** a tunnel route; leave it alone when tidying the tunnel.

## Runbooks

### Add sizes to pictures that lack them (backfill / repair)

```
npm run image-sizes                      # dry run: says PRODUCTION bucket, lists what is missing
npm run image-sizes -- --apply           # makes and stores them, records them, purges cached pages
```

- Safe to re-run: pictures that already have their sizes are skipped.
- It fetches each original from the bucket's public URL; originals are never changed.
- Before touching `content.json` it writes a copy to `.data/backups/content-before-image-sizes-*.json`.
- It records the sizes with a versioned save: if Rowenn saved in the meantime it re-reads and
  retries (up to 3 times) instead of overwriting her change.
- Remake everything (e.g. after changing `WEBP_QUALITY` or `SIZE_WIDTHS`):
  `npm run image-sizes -- --apply --force`. Same file names, so it purges them from
  Cloudflare afterwards.
- Changing the **widths** also needs `SIZE_WIDTHS` in `src/lib/images/sizes.ts` and the
  Worker/stores are fine as they are; deploy first, then `--apply` (not `--force`: new widths
  count as missing).

### Diagnose a failed upload

Rowenn sees the step that failed and a **Reference** like `u-7f3k2x9q`.

```
npm run upload-failures                  # everything kept, newest first
npm run upload-failures -- --since 7d    # the last week
npm run upload-failures -- --id u-7f3k2x9q   # one attempt in full + the command for its log lines
```

Where the records come from:
- **Server failures** (refused picture, storage error, sizes failed): the upload function writes
  them. `step`: `receive`, `check`, `store`, `sizes`. A `sizes` failure is not fatal (the
  picture works the old way); run the backfill once the cause is fixed.
- **Browser failures** (couldn't prepare on the device, connection dropped while sending): the
  browser posts them to `/api/admin/client-log` (signed-in only, 20 per 10 min). `source:
  "browser"`, with browser/OS, file type and size, and timing. Never the picture.
- Every upload, success or failure, also writes one JSON line `{"event":"upload", ...}` to the
  Netlify function log (timings per step: `check`, `store`, `sizes`, `total`). That history is
  capped at ~140 lines, which is why failures are also kept in the bucket
  (`logs/upload-failures/`, private: the bucket only makes `art/*` public).

### Roll back to the old way (Netlify resizing)

1. Netlify → Site configuration → Environment variables → delete `ROWENNKALMAN_IMAGE_CDN_URL`
   (or `scripts/netlify.sh env:unset ROWENNKALMAN_IMAGE_CDN_URL`).
2. Redeploy (`scripts/netlify.sh api createSiteBuild --data '{"site_id":"fdee4ce6-92ce-4b16-9948-83aeba4f7c2b"}'`).
Uploads keep making sizes; they are just not used. Turn it back on by setting the variable again.

### Purge pictures from Cloudflare's cache

```
scripts/cloudflare.sh purge https://img.tomas-tello.stream/art/<id>-640.webp [more URLs]
```

Only needed after `--force` (the backfill does it) or if a file was replaced by hand.

### A deleted picture must not stay reachable (e.g. Rowenn withdraws a painting)

**Caveat (known, accepted 2026-09-30):** deleting a picture in the admin removes the original and
its sizes from the bucket, and nothing on the site links to them any more, but **Cloudflare keeps
the copies it already cached for up to a year**. Anyone holding the exact URL could still open
them. Only the sizes someone actually viewed are cached, and only at the Cloudflare locations
that served them. Unlikely to matter; when it does:

1. Find the picture's key **before** deleting it: on the live page, right-click the painting →
   copy image address (`https://img.tomas-tello.stream/art/<id>-640.webp`), or in the page source
   its `srcset`. The `<id>` is the part to keep. (If it is already deleted, the key is in the
   last content backup under `.data/backups/` or in the save log line.)
2. Delete it in the admin and **Save** (nothing is removed until Save).
3. Purge every size from Cloudflare (purging a URL that was never cached is harmless):

   ```
   id=<the id>
   scripts/cloudflare.sh purge https://img.tomas-tello.stream/art/$id.jpg \
     https://img.tomas-tello.stream/art/$id-{640,960,1280,1920}.webp
   ```
4. Check: each of those URLs now answers 404
   (`curl -s -o /dev/null -w '%{http_code}\n' <url>`).

Doing this automatically on delete would need a purge-only Cloudflare token in Netlify; see
`docs/PLAN.md` (deferred).

### Deploy / change the Worker

Edit `cloudflare/image-worker/worker.js`, then `scripts/cloudflare.sh deploy`.
`scripts/cloudflare.sh tail` shows its live log. Check it afterwards:

```
curl -sI https://img.tomas-tello.stream/art/<existing>.jpg | grep -i x-image-cache   # MISS then HIT
curl -s -o /dev/null -w '%{http_code}\n' https://img.tomas-tello.stream/content.json  # 404
```

### Rotate the Cloudflare token (before 2027-09-30)

1. dash.cloudflare.com → profile → API Tokens → Create Custom Token with the scopes in the
   table above (or "Roll" the existing `rowennkalman-images` token).
2. Type (don't press Enter yet)
   `! security add-generic-password -U -a "$USER" -s rowennkalman-cloudflare-token -w "$(pbpaste)"`,
   copy the token on the Cloudflare page, then press Enter. (Copying the command itself would
   overwrite the clipboard.)
3. Check: `scripts/cloudflare.sh deploy` succeeds.

### "A picture is slow or broken" checklist

1. Page source: does the `<img>` have a `srcset` with `img.tomas-tello.stream`? No → the picture
   has no `sizes` (run the backfill dry run) or the switch is off.
2. `curl -sI <that URL>`: `x-image-cache: HIT` is fast; `MISS` means the first visit at that
   Cloudflare location (fetched from Paris, ~1-1.5 s). 404 → the size file is missing (backfill).
3. `npm run upload-failures -- --since 1d` for recent upload trouble.

## Why it is built this way (2026-09-30)

- **Problem:** every picture took ~2 s, even repeat views. Netlify's image CDN answered
  `cache-status: fwd=miss` on every request of the same URL (see the deferred item in
  `docs/PLAN.md`) and resized the full ~890 KB original fetched from Paris each time.
- **Bucket directly was not enough:** the Paris bucket takes 0.65-1.0 s to start sending even a
  40 KB file from the US West coast.
- **Scaleway Edge Services** (their CDN, €0.99/month) caches in Paris only; visitors so far are
  in the US and Canada.
- **Cloudflare Worker** instead of a plain proxied DNS record: rewriting the Host header (which
  the bucket needs) is Enterprise-only; a Worker does it on the free plan. `*.workers.dev`
  cannot cache, hence the custom domain. **R2** (moving storage to Cloudflare) was left for
  later: a migration, where the Worker is additive and reversible.
- **Measured:** through the Worker, first request MISS 1.47 s, then HIT 55-83 ms.
- **`img.tomas-tello.stream`**, not `img.rowennkalman.com`: rowennkalman.com's DNS is on
  Netlify; moving it to Cloudflare is its own project. Then only the variable changes.
- **Sizes on the server (sharp), not in the browser:** one implementation shared with the
  backfill, WebP (Safari cannot encode WebP from a canvas), and a phone uploads one file.
- **Widths 640/960/1280/1920:** most visitors are on phones (360-430 pt wide, 2-3x screens):
  thumbnails need ~640, full width needs ~860 (2x) or ~1290 (3x), the lightbox ~1170. 1920 and
  the 2800 original serve desktops.
