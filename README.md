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

## Careful

- **`.env.local` on Luis's Mac holds the production bucket settings.** `next dev` / `next start`
  there read and write the live content. For local work, blank the `ROWENNKALMAN_S3_*` variables
  (the local store in `.data/` is then used). Names of all settings: `.env.example`.
- Secrets live in Netlify (production) and the macOS Keychain (`rowennkalman-netlify-token`,
  `rowennkalman-sonar-token`), never in the repo.
- Public pages are cached by Netlify for an hour and purged on every admin save; each page's
  `<meta name="content-version">` shows which save it is showing.

## Docs

- `docs/PLAN.md`: current status, decisions, caching, SEO, debugging, what's deferred.
- `docs/AUDIT.md`: audits, incidents and how each was resolved.
- `docs/admin-REPORT.md`: the original admin/backend report (historical).
