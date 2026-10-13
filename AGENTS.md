# AGENTS.md

Guidance for AI coding agents working in this repo. Human-facing overview: `README.md`.

## Project

`rowennkalman.com`: Rowenn Beth Kalman's painter's portfolio plus her PhD research. Next.js 15
(App Router) on Netlify; content (`content.json`) and photos in a Scaleway bucket; Rowenn edits
everything at `/admin` (email magic-link sign-in, allowlist in `ROWENNKALMAN_ADMIN_EMAILS`).
Contact form and sign-in mail go through Resend. Jest 29 + Playwright. Private GitHub repo
(`zettai/rowennkalman`), branch `master`.

## Read first: three things that have already bitten

1. **`.env.local` on Luis's Mac is PRODUCTION.** It holds the live Scaleway bucket and mail keys.
   **Never read, print or grep it** (a hook blocks this too). Next loads it for `next dev`,
   `next start` and the Playwright test server, so any of them can read and **write the live
   content**. Incident 2026-09-30: the e2e suite ran against the real bucket, renamed the home
   title and deleted the home picture (restored from `.data/`; see `docs/AUDIT.md`).
   - Before running anything that mutates content (tests, scripts, dev-server clicks), point it
     at a scratch store. Set every real-service variable to an **empty string** (empty beats the
     file): `ROWENNKALMAN_S3_ENDPOINT`, `_S3_REGION`, `_S3_BUCKET`, `_S3_ACCESS_KEY`,
     `_S3_SECRET_KEY`, `_PUBLIC_IMAGE_BASE`, `_IMAGE_CDN_URL`, `_GOATCOUNTER_URL`,
     `_GOATCOUNTER_API_KEY`, `_CF_ACCESS_CLIENT_ID`, `_CF_ACCESS_CLIENT_SECRET`,
     `_RESEND_API_KEY`, `_CONTACT_TO`, `_CONTACT_FROM`. `playwright.config.ts` already does this
     and uses `ROWENNKALMAN_DATA_DIR=.data-e2e`; copy that list for any new test setup.
   - For plain local work, blank the `ROWENNKALMAN_S3_*` variables and the app uses the local
     file store in `.data/`. Keep `.data/` as the last-known-good content backup.
   - `npm run image-sizes` and `npm run upload-failures` read `.env.local` on purpose and so hit
     production. Run `image-sizes` as a dry run first; only `-- --apply` writes.
   - Never assume "local" means "safe" here. Names of all settings: `.env.example`.
2. **A push to `master` deploys to production.** Netlify builds and publishes every push
   (`netlify.toml` holds the build setup; the repo has no deploy script or CI of its own). There
   is no pre-push hook. So: **commit freely, but never `git push` without Luis's explicit
   approval.** Rollback = revert the commit (or "Publish deploy" on an older deploy in Netlify).
   Deploys occasionally fail on Netlify's side with no code cause: retry once
   (`scripts/netlify.sh api createSiteBuild ...`) before debugging.
3. **The Netlify token reaches the whole Netlify account**, not just this site (it is shared with
   the tomastello site). Keychain `rowennkalman-netlify-token`, expires **2026-12-28**.

## Commands

```bash
npm run dev                     # dev server (reads .env.local: see above)
npm test                        # Jest unit tests (tests/)
npm run lint                    # ESLint, zero warnings allowed
npm run typecheck               # tsc --noEmit
npx playwright test e2e/admin.spec.ts   # browser tests on a scratch store, never the bucket
npm run sonar                   # SonarQube scan on sona-z, on demand (commit first)
npm run image-sizes             # backfill/repair picture sizes (dry run; touches PRODUCTION with --apply)
npm run upload-failures         # failed-upload log (reads PRODUCTION)
```

## Ops from the terminal (tokens come from the macOS Keychain, never from files)

- `scripts/netlify.sh <netlify-cli args>`: Netlify CLI/API for this site (site id is in the
  script). For `api` calls with a request body, nest it: `--data '{"body":{...}}'` (plain
  `--data` turns into query params and returns 400). Function logs:
  `scripts/netlify.sh logs --source functions --function ___netlify-server-handler --since <ISO> --until <ISO> --json`.
  History is capped (about 140 lines) and lags about a minute, so read narrow windows. The app
  logs one JSON line per `save`, `render` and `upload`.
- `scripts/cloudflare.sh deploy | tail | purge <url>...`: the image Worker `rowennkalman-images`
  at `img.tomas-tello.stream` (Keychain `rowennkalman-cloudflare-token`, expires 2027-09-30,
  scoped to Workers, cache purge and zone read on `tomas-tello.stream` only).
- `scripts/sonar.sh` (via `npm run sonar`): Keychain `rowennkalman-sonar-token`. Sonar is on
  demand, not in CI; `--issues` re-prints the last analysis. SonarQube Community has no taint
  analysis, so review code that sends user input into a URL fetch, HTML or a shell by hand.
- Every public page has `<meta name="content-version">`: the content save it is showing.
- To save a token into the Keychain, have Luis type the `security add-generic-password ... -w`
  command himself; never paste a token into a command you run.

## Pictures

Upload, sizes, the Cloudflare Worker, switches, secrets and runbooks are all in
`docs/IMAGES.md`. Read its runbook before changing anything there. Off switch:
`ROWENNKALMAN_IMAGE_CDN_URL` in Netlify env (unset and redeploy).

## Architecture notes

- Public pages render from the latest content and are cached by Netlify's CDN for an hour under
  the tag `rk-pages`; every admin save purges the tag (`src/lib/cdn.ts`). Do not go back to
  Next ISR (it served stale pages after a save).
- Netlify function bodies are capped at about 6 MB: uploads are resized and EXIF-stripped in the
  browser first.
- Stores (`src/lib/store/*.ts`): S3, file (`.data/`) and memory (tests).
- `/tesis/*.pdf` URLs must stay exactly as they are (old links); `/tesis` redirects to `/research`.

## Docs

- `docs/PLAN.md`: status, decisions, caching, SEO, debugging, deferred work.
- `docs/IMAGES.md`: the picture pipeline.
- `docs/AUDIT.md`: audits, incidents and how each was resolved.
- `docs/admin-REPORT.md`: original admin/backend report (historical).

## Rules

- No secret values in git. Reference secrets by variable name only.
- The repo is the source of truth: anything an agent learns that matters goes in this file or
  `docs/`, not only into an agent's own memory.
- Visibility: this repo is **private**, so commits may keep the usual agent co-author trailer. If
  it is ever made public, switch to no AI attribution (author Luis alone).
