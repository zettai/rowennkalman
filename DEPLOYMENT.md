# Deployment

Production (`https://rowennkalman.com`) runs on **Netlify**: pages and API routes as serverless
functions, `src/proxy.ts` on the edge, static files from the CDN. Nothing in this repo deploys
outside Netlify.

## How a release ships

The Netlify site is linked to this repo with **auto-publishing locked**. A push to `master` builds a
production deploy but does not publish it; the owner publishes it with "Publish deploy" in
Netlify after checking the deploy's own URL. Nothing in `.github/workflows` deploys.

This repo is public, so Netlify's sensitive variable policy is set to **Require approval**: a pull
request from a fork does not build with production secrets until it is approved.

Rollback: in the Netlify UI, "Publish deploy" on an earlier deploy. Netlify keeps every deploy.

## Configuration

- Build settings are in `netlify.toml` (Node 22, `@netlify/plugin-nextjs`, publish `.next`).
- Production settings are Netlify environment variables. Names are in
  [Environment variables](#environment-variables) below; local values go in `.env.local`.
- On Netlify, logs go to stdout (function logs); there is no file logger in the app.
- Public pages are cached under the tag `rk-pages` for an hour; every admin save purges that tag
  (`src/lib/cdn.ts`).

## Environment variables

Authoritative list of names the app and scripts read (`process.env` / injected `env` defaults). No
values. When you add a variable, document it here. Local overrides go in `.env.local` (gitignored).
There are no `NEXT_PUBLIC_*` variables today; if you add one, note that Next inlines it at build time.

| Name | Required in production | Used by | Notes |
|---|---|---|---|
| `ROWENNKALMAN_SESSION_SECRET` | yes | `src/lib/auth/session.ts`, `src/proxy.ts` | Secret. At least 32 characters; verify rejects all tokens without it. |
| `ROWENNKALMAN_S3_ENDPOINT` | yes | `src/lib/store/index.ts`, `scripts/seed-s3.mjs`, `scripts/image-sizes.mts`, `scripts/upload-failures.mts` | Secret-related config. All five S3 variables must be set together or none. |
| `ROWENNKALMAN_S3_REGION` | yes | `src/lib/store/index.ts`, `scripts/seed-s3.mjs` | Scaleway region for the bucket. |
| `ROWENNKALMAN_S3_BUCKET` | yes | `src/lib/store/index.ts`, `scripts/seed-s3.mjs` | Content and image object store. |
| `ROWENNKALMAN_S3_ACCESS_KEY` | yes | `src/lib/store/index.ts`, `scripts/seed-s3.mjs` | Secret. S3 client credentials. |
| `ROWENNKALMAN_S3_SECRET_KEY` | yes | `src/lib/store/index.ts`, `scripts/seed-s3.mjs` | Secret. S3 client credentials. |
| `ROWENNKALMAN_PUBLIC_IMAGE_BASE` | yes | `src/lib/store/index.ts`, `next.config.ts` | Public URL base for bucket images; `next/image` remote pattern when set. |
| `ROWENNKALMAN_ADMIN_EMAILS` | yes | `src/lib/auth/magic-link.ts` | Comma-separated allowlist; empty means no one can redeem a sign-in link. |
| `ROWENNKALMAN_RESEND_API_KEY` | yes | `src/lib/contact/mailer.ts`, `src/lib/auth/magic-link.ts` | Secret. Contact form needs it with `ROWENNKALMAN_CONTACT_TO` and `ROWENNKALMAN_CONTACT_FROM`; without it, magic links use the console/outbox mailer. |
| `ROWENNKALMAN_CONTACT_TO` | yes | `src/lib/contact/mailer.ts` | Contact form recipient; required with the Resend key. |
| `ROWENNKALMAN_CONTACT_FROM` | yes | `src/lib/contact/mailer.ts`, `src/lib/auth/magic-link.ts` | From address for contact mail and magic links when Resend is configured. |
| `ROWENNKALMAN_SITE_URL` | optional | `src/components/site/content.ts`, `src/app/api/auth/login/route.ts` | Site origin for metadata and login links; falls back to Netlify `URL` or the request origin. |
| `ROWENNKALMAN_IMAGE_CDN_URL` | optional | `src/components/site/content.ts`, `scripts/image-sizes.mts` | Cloudflare image Worker base; unset serves images from `ROWENNKALMAN_PUBLIC_IMAGE_BASE`. |
| `ROWENNKALMAN_GOATCOUNTER_URL` | optional | `src/lib/stats/goatcounter.ts` | Analytics tracker script URL; omit to disable public tracking. |
| `ROWENNKALMAN_GOATCOUNTER_API_KEY` | optional | `src/lib/stats/goatcounter.ts` | Secret. Needed with the URL for admin stats API reads. |
| `ROWENNKALMAN_CF_ACCESS_CLIENT_ID` | optional | `src/lib/stats/goatcounter.ts` | Cloudflare Access headers when GoatCounter sits behind Access. |
| `ROWENNKALMAN_CF_ACCESS_CLIENT_SECRET` | optional | `src/lib/stats/goatcounter.ts` | Secret. Pair with `ROWENNKALMAN_CF_ACCESS_CLIENT_ID` for Access. |
| `ROWENNKALMAN_DATA_DIR` | no | `src/lib/store/index.ts`, `src/lib/auth/magic-link.ts`, `scripts/image-sizes.mts` | File-store and console magic-link outbox directory; local, CI and e2e. |
| `URL` | no | `src/components/site/content.ts`, `src/app/api/auth/login/route.ts` | Set by Netlify; canonical site URL when `ROWENNKALMAN_SITE_URL` is unset. |
| `NETLIFY` | no | `src/lib/cdn.ts` | Set by Netlify builds/runtime; enables cache purge when purge credentials exist. |
| `NETLIFY_PURGE_API_TOKEN` | optional | `src/lib/cdn.ts` | Used with Netlify cache purge; often provided on Netlify. |
| `SITE_ID` | optional | `src/lib/cdn.ts` | Netlify site id for purge; often provided on Netlify. |
| `SONAR_TOKEN` | no | `scripts/sonar.sh` | Secret. Local/on-demand SonarQube scan only, not the deployed site. |
| `SONAR_HOST_URL` | no | `scripts/sonar.sh` | SonarQube host; script defaults if unset. |

## GitHub Actions

`.github/workflows/ci.yml` runs on pull requests, pushes to `master`, and manual dispatch. After
`npm ci`, it blanks the production service variables (same list as Playwright and
`scripts/blank-prod-env.ts`), then runs lint, typecheck, unit tests, a production build with an
unavailable content store (`scripts/build-store-unavailable.sh`), and page accessibility
(`npm run a11y:pages`). It does not deploy.

`.github/workflows/sast.yml` runs on the same triggers. It downloads a pinned Opengrep binary and
security rules, scans the repository, and fails the job when findings include the `vuln`
subcategory (`FAIL_ON=vuln`).

## Troubleshooting

```bash
curl -s https://rowennkalman.com/api/health   # health check
```
