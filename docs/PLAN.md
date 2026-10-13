# rowennkalman.com revamp — plan

## Status (2026-09-30): live and maintained from `master`

Live on rowennkalman.com: public site (Home, About, Portfolio, Research, Contact), the admin at `/admin`
with email sign-in (Rowenn + Luis), content and photos in the Scaleway bucket, email via Resend
(`rowennkalman.com` verified; the first sign-in mail landed in Gmail spam, marked "not spam").
Every push to `master` builds a deploy; publishing it is a separate step (auto-publishing locked since 2026-10-27).
Stack is Next.js 16 (App Router; admin auth gate is `src/proxy.ts`). Checks: `npm test` (unit,
including jest-axe), `npm run a11y:pages` (pa11y-ci on a local production build / FileStore),
`npx playwright test e2e/admin.spec.ts` (e2e, local store only), `npm run sonar` (on demand).
GitHub Actions: Opengrep SAST plus CI (lint/typecheck/test/a11y). Audits and incidents: `docs/AUDIT.md`.
Open for Rowenn: painting titles/details/descriptions, review of the English Research text.
The sections below keep the original plan and decisions for reference.

Grilled and agreed 2026-09-29. Source of design + content: Rowenn's Squarespace draft
(`harpsichord-fiddle-8h7n.squarespace.com`, private, trial ends 2026-10-13).

## MVP (build now)

1. **Stack / hosting** — Next.js on Netlify (same repo, same domain, Netlify DNS unchanged).
   Pages server-rendered from bucket content; admin save calls `revalidatePath()` so changes
   are live in ~1s, no rebuild. SSR because SEO + share previews matter.
2. **Pages** — Home, About, Portfolio, Research, Contact. Fixed layouts, not a page builder.
3. **Design** — faithful re-creation of the Squarespace draft (layout, colours, spacing).
   Squarespace fonts are licensed, so use free Google Fonts substitutes (wide heavy sans for
   headings, typewriter mono for body). Compare side by side in Chrome.
4. **Editable content** — *every* piece of text on the site is editable, organised in the admin
   by page → section (not inline). Artworks are full CRUD + reorder, each with:
   image, title, medium, size, year, description (visible), alt text. Strip EXIF on upload.
5. **Research** — thesis + 2011 informe. EN + ES blurb shown side by side; rest of the site is
   English only. `/tesis/*.pdf` URLs stay exactly as-is (`public/tesis/`); `/tesis/` → 301 →
   `/research`.
6. **Storage** — Scaleway bucket `rowennkalman` (fr-par): `content.json` + `art/`. Reuse
   next-tt's S3 client/upload patterns. Images served via Netlify Image CDN.
7. **Admin** — `/admin`, login = **email magic link** (changed 2026-09-29; supersedes the
   break-glass password, which is dropped). Allowlist in `ROWENNKALMAN_ADMIN_EMAILS` (Rowenn +
   Luis; addresses never in the repo). Link is a signed token, 15 min, not strictly single-use
   in the MVP. Local dev: link printed to the console. Break-glass = direct bucket access
   (Scaleway console / rclone) to repair `content.json`. The cloud agent builds password auth
   behind one module; swap it for magic link at integration. Resend is therefore **in the MVP**.
8. **Contact** — Next route → Resend → `contact@example.com`, from `web@rowennkalman.com`,
   reply-to = sender. Honeypot + rate limit. **Wired last** (needs Luis): add domain to the
   existing Resend account, DNS records in Netlify DNS, new sending-only key scoped to the
   domain, `ROWENNKALMAN_RESEND_API_KEY`. No full-access Resend key (deliberately removed).
9. **Rollout** — branch `revamp` → Netlify branch preview for Rowenn to review → merge to
   `master` + switch Netlify build settings to Next.js. Rollback = revert the merge.
   Delete the Miniport template + placeholder pics. Photos in `assets/` go to the bucket,
   not git (reconcile: 20 originals vs ~26 images in the draft).

## SEO (2026-09-30)

- Google Search Console: domain property verified (TXT record on the apex in Netlify DNS; keep it),
  `sitemap.xml` submitted, home page indexing requested.
- Each page has its own description (admin field "Description in search results", default = start
  of the page's text); JSON-LD WebSite + Person everywhere, VisualArtwork per painting on
  Portfolio, the thesis PDFs on Research; the sitemap lists 20 photos.
- Next, when paintings have titles: a page per painting (`/portfolio/<slug>`). Content and links
  (titles/descriptions in her voice, Instagram bio, galleries, the thesis's university page) matter
  more than any code. Google says llms.txt / AI-specific rewrites aren't needed.

## Debugging

- Every public page carries `<meta name="content-version">`: the save it shows.
- Function logs: `scripts/netlify.sh logs --source functions --function ___netlify-server-handler --since <ISO> --until <ISO> --json`
  (token from the Keychain item `rowennkalman-netlify-token`, created 2026-09-30 with a 90-day expiry; it reaches the whole Netlify account).

## Page caching (2026-09-30)

Public pages render from the latest content, and Netlify's CDN keeps them for `PAGE_CDN_SECONDS`
(next.config.ts; 1 hour since 2026-09-30, after a real save logged "purge":"purged") with tag `rk-pages` and **no** stale-while-revalidate. Every admin save
purges the tag (`src/lib/cdn.ts`) and logs `purge` in the save line. Proven on a branch deploy: a
cached page kept the old version after a content change until the purge, then switched at once, both
with the API and from inside the function. The earlier Next ISR set-up served stale pages after a
save; don't go back to it.

## Code quality (SonarQube, on demand)

`npm run sonar` (scripts/sonar.sh): tests with coverage, scan to sona-z (project `rowennkalman`),
then the quality gate, key numbers and open issues (most severe first). `scripts/sonar.sh --issues`
re-prints the last analysis without scanning. Token: project analysis token in the Keychain item
`rowennkalman-sonar-token` (it can't read security hotspots; review those in the web UI).

## Work split

- **Cloud agent** (`zettai/claude-cloud`, `requests/rowennkalman-admin.md` → `demos/rowennkalman-admin/`):
  content schema + field registry, stores (S3/file/memory), auth, admin UI, upload flow, contact API.
- **Local**: public pages + design match, asset reconciliation, Scaleway/Netlify/Resend setup,
  integrating the cloud output.
- Uploads are resized + EXIF-stripped **in the browser** (Netlify ~6 MB body cap; no sharp).

## Contract changes to apply at integration

The cloud agent builds the schema from `requests/rowennkalman-admin.md`; local review since then changed:
- `research.image: ImageRef | null` added (Rowenn's photo from the old `/tesis/` page).
- Footer mirrors the header nav + Follow, so `site.footer.aboutLabel` / `contactLabel` are unused: drop them.
- Auth: magic link instead of password (see item 7).
- Home: `featured` (artwork ids, up to 3, picked in the admin) and `portfolioLinkLabel`. (A statement
  line above them was tried and dropped: it read as a tagline and repeated About's first sentence.)
- Portfolio photos keep the backdrop (painting shown as an object, with its edge and shadow): tried
  tight crops + true-shape rows on 2026-09-29 and reverted; the draft's airy square grid reads better.
- Image placement: Rowenn moves pictures between spots. Every image slot (home hero, about
  images, contact, research) should offer "choose from my artworks" as well as upload, and
  about images need reordering like the portfolio.

## Deferred (v1+)

- Strictly single-use magic links (needs a used-token store).
- Bucket versioning (undo bad saves / deletes).
- Weekly rclone backup of the bucket to max-z.
- Cloudflare Turnstile on the contact form, only if spam gets through.
- Broader CI/CD quality gate (SonarQube pre-push); unit/a11y gates already run in GitHub Actions.
- New page types beyond the fixed five.
- **Investigate why Netlify's Image CDN never serves from cache** (added 2026-09-30). The same
  `/_next/image?...&w=640` URL fetched 4 times in a row answered `cache-status: "Netlify Edge";
  fwd=miss` (or `stale`) every time, 1.5-2.0 s each, although the response is
  `public,max-age=31536000,immutable` and says `stored`. `netlify-vary` includes
  `header=Netlify-Image-Accept`. Pre-made sizes through Cloudflare now bypass it
  (`docs/IMAGES.md`); still worth knowing for the fallback path.
- Purge Cloudflare's cached copies when a picture is deleted (today: manual runbook in
  `docs/IMAGES.md`, "A deleted picture must not stay reachable"). Needs a purge-only
  Cloudflare token for `rowennkalman.com` in Netlify.
- Faster size-making: `makeSizes` decodes the 2800 px original once per width; on Netlify the
  sizes step took 3.9 s of a 4.7 s upload (2026-09-30). Decode once and resize from that.
- **Done: rowennkalman.com moved to Cloudflare** (DNS 2026-10-21, registrar 2026-10-27, pictures
  on `img.rowennkalman.com` 2026-10-27; runbook and log in the LLNZ repo,
  `docs/domains-cloudflare-migration.md`). Original plan, kept for reference:
  Two separate steps, the first reversible:
  1. DNS: point Gandi's nameservers at Cloudflare and copy the zone from Netlify DNS (site:
     apex, `www`, `tesis` → Netlify, **DNS-only/grey cloud**, apex via CNAME flattening; mail
     sending: `resend._domainkey` TXT, `send`/`rsend` CNAMEs, `_dmarc` TXT; the Google
     verification TXT; no MX). Then pictures can move to `img.rowennkalman.com` (only
     `ROWENNKALMAN_IMAGE_CDN_URL` changes) and Netlify's DNS zone is deleted.
  2. Optional, weeks later: transfer the registration from Gandi (expires 2027-06-17) to
     Cloudflare Registrar (~$10-11/year at cost vs ~€20+; requires Cloudflare DNS; 60-day lock).
  Grill the plan before starting (timing, mail sending during the switch, whether to transfer).
- Scaleway: new bucket + API key (check whether an existing key can be scoped or a new one is needed).
