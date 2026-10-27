# rowennkalman.com

Rowenn Beth Kalman's site: a painter's portfolio plus her PhD research. Next.js on Netlify;
content and photos in a Scaleway bucket; Rowenn edits everything at `/admin` (email sign-in).

## Day to day

| Task | How |
|---|---|
| Deploy | push to `master` (Netlify builds and publishes; `netlify.toml` holds the build setup) |
| Unit tests | `npm test` |
| Browser tests | `npx playwright test e2e/admin.spec.ts` (runs on a scratch store, never the bucket) |
| Code quality | `npm run sonar` (SonarQube on sona-z; commit first) |
| Netlify from the terminal | `scripts/netlify.sh <netlify-cli args>` (deploys, function logs) |
| Picture sizes (backfill/repair) | `npm run image-sizes` (dry run) / `-- --apply`: see `docs/IMAGES.md` |
| Failed uploads | `npm run upload-failures [-- --since 7d \| --id u-…]` |
| Image Worker (Cloudflare) | `scripts/cloudflare.sh deploy \| tail \| purge <url>` |

## Careful

- **`.env.local` on Luis's Mac holds the production bucket settings.** `next dev` / `next start`
  there read and write the live content. For local work, blank the `ROWENNKALMAN_S3_*` variables
  (the local store in `.data/` is then used). Names of all settings: `.env.example`.
- Secrets live in Netlify (production) and the macOS Keychain (`rowennkalman-netlify-token`,
  `rowennkalman-sonar-token`, `rowennkalman-cloudflare-token`), never in the repo.
- The Netlify account holds only this site (cleaned up 2026-10-02: six old projects and an
  unused OAuth grant removed). Two-factor auth is on; one personal access token
  (`claude-rowennkalman-debug`, expires 2026-12-28) and one DNS zone, `rowennkalman.com`.
- Pictures are served in pre-made sizes through a Cloudflare Worker (`img.rowennkalman.com`);
  `ROWENNKALMAN_IMAGE_CDN_URL` is the off switch. Everything about it: `docs/IMAGES.md`.
- Public pages are cached by Netlify for an hour and purged on every admin save; each page's
  `<meta name="content-version">` shows which save it is showing.

## Docs

- `docs/PLAN.md`: current status, decisions, caching, SEO, debugging, what's deferred.
- `docs/IMAGES.md`: the picture pipeline (upload, sizes, Worker), switches, secrets, runbooks.
- `docs/AUDIT.md`: audits, incidents and how each was resolved.
- `docs/admin-REPORT.md`: the original admin/backend report (historical).
