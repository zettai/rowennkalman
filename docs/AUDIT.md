# Sanity audit — 2026-09-29

Branch `revamp` at `4b30f71`, production build (`next build && next start`) with the real content in `.data/`.
Audit scripts live outside the repo (session scratchpad); this file is the record.

Severity: **S1** wrong content a visitor would act on · **S2** misleading or inconsistent · **S3** broken behaviour · **T** not verifiable yet · **S4** minor.

**Result: 0 S1, 1 S2, 0 S3, 3 T, 15 S4.**

## Findings

| # | Sev | Finding | Where | Evidence | Suggestion |
|---|---|---|---|---|---|
| 1 | S2 | Text written by me, presented in her voice, not yet approved by her | research.introEn, site.metaDescription | introEn is my English translation of her Spanish /tesis text (first person); metaDescription is my wording | Rowenn reviews both before launch (she can edit them in the admin) |
| 2 | T | S3Store against Scaleway not verified | src/lib/store/s3.ts | tests use an in-memory fake; whether Scaleway honours If-Match (the save-conflict check) is unknown | after creating the bucket: seed, then run a two-tab conflict by hand, and a save that deletes an image |
| 3 | T | Production email not verified | Resend | sign-in links and contact messages only ran through the console mailer | after the Resend domain is verified: request a real link to both addresses, send one contact message, check spam folders |
| 4 | T | Netlify runtime not verified | Netlify | middleware, revalidatePath and next/image via Netlify Image CDN only ran on next start locally | check on the branch preview before merging: sign in, save, see the change, images resized |
| 5 | S4 | 11/11 artworks have no title | portfolio.artworks | admin lists them as "Painting N"; public grid shows no captions; lightbox dialog is labelled "Artwork" | Rowenn fills titles before launch |
| 6 | S4 | 11/11 artworks have no medium/size/year | portfolio.artworks | these were requested as visible fields | Rowenn fills them |
| 7 | S4 | 11/11 artworks: visible description equals alt text | portfolio.artworks | screen readers hear the same sentence twice in the lightbox; left as-is by decision 2026-09-29 | Rowenn rewrites descriptions |
| 8 | S4 | orange mushrooms alt: "purple- blue" in the draft was silently corrected to "purple-blue" | portfolio alt (draft order) | her typo, my edit during transcription | keep the correction (it is an obvious typo) |
| 9 | S4 | contact.intro: straight apostrophe where the draft has a curly one (I’d) | contact.intro | transcription; the rest of the site also uses straight quotes (2 in content.json) | use ’ in content for typographic consistency, or leave |
| 10 | S4 | portfolio.title is editable but only read by screen readers (visually hidden, as in the draft) | portfolio.title | editing it changes nothing visible | say so in the admin hint, or show it |
| 11 | S4 | /tesis/ takes 2 redirect hops | next.config.ts redirects | [308, 308, 200] | fine for users; one hop is cleaner for search engines |
| 12 | S4 | no og:image (link previews show no picture) | / |  |  |
| 13 | S4 | no canonical URL | / | rowennkalman.com and www. both resolve | set metadataBase + alternates.canonical |
| 14 | S4 | no /robots.txt | app | 404 | SEO matters to the brief: add app/robots.ts + app/sitemap.ts, disallow /admin |
| 15 | S4 | no /sitemap.xml | app | 404 | SEO matters to the brief: add app/robots.ts + app/sitemap.ts, disallow /admin |
| 16 | S4 | 404 page is the bare Next.js default | /no-such-page | no site header/footer or way back | add app/not-found.tsx in the site style |
| 17 | S4 | no x-content-type-options header on public pages | / | Netlify adds HSTS on its domain; the others are not set | add headers() in next.config (nosniff, referrer-policy, a simple CSP) |
| 18 | S4 | no referrer-policy header on public pages | / | Netlify adds HSTS on its domain; the others are not set | add headers() in next.config (nosniff, referrer-policy, a simple CSP) |
| 19 | S4 | no content-security-policy header on public pages | / | Netlify adds HSTS on its domain; the others are not set | add headers() in next.config (nosniff, referrer-policy, a simple CSP) |

## Clean (what came back with nothing)

- 17/17 image references resolve to clean JPEGs with matching dimensions
- about.body paragraphs: 5/5 match the Squarespace draft verbatim
- about.images alt: 3/3 match the Squarespace draft verbatim
- portfolio alt (draft order): 10/11 match the Squarespace draft verbatim
- contact.intro: 0/1 match the Squarespace draft verbatim
- research.introEs carries the 5 sentences of the old /tesis page (Ancash spelled with accent: Áncash; PHD written PhD)
- 56/56 editable texts appear on their public pages (success/error messages only show after sending, checked by the contact tests)
- 28 HTTP checks passed (PDFs byte-identical to live, redirects, pages, internal links, admin 401/redirect, neutral login answer, contact API)
- allowlist address appears only as the git commit author (your git config), never in file contents — 32 commits incl. the 2019 ones; repo is private
- git: 103 tracked files and full history (file contents) scanned for API keys, JWTs, private keys, Scaleway keys: none found
- (harness) the 404 on /no-such-page is the deliberate not-found probe
- (harness) the 404 on /no-such-page is the deliberate not-found probe
- crawl: 6 public pages + 7 admin screens at 1200 and 390, lightbox, contact submit, magic-link sign-in — {"errors":1,"failed":1,"hscroll":0,"nondet":0,"axe":0,"flow":0}
- Save → revalidate and image cleanup are covered by the e2e suite (placeholder content): 9/9 pass — edit→public, add/move/delete artwork with file removal, replace/remove picture with 404 on the old key

## Checks that ran

1. **Data** (Python, independent of app code): every image reference resolves to a JPEG with matching dimensions, ≤ 2800 px, no EXIF; ids, featured picks, research PDFs, unreferenced files, empty fields, stray whitespace.
2. **Provenance**: About paragraphs, all alt texts and the contact intro hashed against the live Squarespace draft; Research Spanish text against the old `/tesis/` page in git.
3. **Admin ↔ public**: every non-empty editable text found on its public page (HTML text + alt/meta attributes).
4. **HTTP & security**: `/tesis` PDFs byte-compared with the live site, redirects, internal links, 404, robots/sitemap, admin redirect and 401s, neutral sign-in answer for unknown addresses, contact API, response headers; git file contents and full history scanned for keys/tokens.
5. **Browser crawl** (Playwright): 6 public pages + 7 admin screens at 1200 and 390 px — JS errors, failed requests, every image loads, horizontal scroll, reload determinism, axe (WCAG 2.2 AA; harness proven by a planted violation), lightbox keyboard/focus, a real contact submit, magic-link sign-in.

**Not run:** fault injection (a corrupted `content.json`), performance on real network, Safari. Saves are validated before writing, so a corrupted store needs a manual bucket edit to happen.

## Resolution (2026-09-29, same day)

Fixed, then all five audits re-run twice on fresh findings files:

| Finding | Fix |
|---|---|
| no robots.txt / sitemap.xml | `src/app/robots.ts` (disallows `/admin`, `/api/`) and `src/app/sitemap.ts` (5 pages + the 2 thesis PDFs) |
| no canonical URL | `metadataBase` from `siteUrl()` + `alternates.canonical` on every page |
| no og:image | link previews use the home painting (`openGraph.images`, large card). Locally it points at the dev image route; in production at the bucket |
| bare 404 | `src/app/not-found.tsx` with the site header, footer and styles, `noindex` |
| missing headers | `nosniff`, `Referrer-Policy`, a CSP without `script-src` (`frame-ancestors`, `base-uri`, `form-action`, `object-src`), `Permissions-Policy` |
| `/tesis/` two hops | `netlify.toml` redirects `/tesis` and `/tesis/index.html` in one 301 at Netlify's edge. **Locally still two hops** (Next strips the slash first); verify on the branch preview |
| portfolio.title hidden | admin hint now says it isn't shown on the page and who reads it |
| straight apostrophe | `contact.intro` now has "I’d", matching the draft (content change in the store) |

**Found by the re-run:** the new 404 page had no `<title>` (axe `document-title`). Fixed.

**Harness bugs found:** the git scan read commit headers, so the author address looked like a leak (it isn't in any file); its "none found" line was unconditional. Both fixed.

**Left open deliberately:** the artwork titles, details and descriptions, and the review of the English Research text and search description: Rowenn's, in the admin. The three T items are checked during go-live.

Final state: 0 S1, 0 S2 (the text-review item is Rowenn's first task), 0 S3 (the only S3 hits are the deliberate 404 probe), 3 T, content-only S4s. axe 0 violations. 110 unit + 9 e2e tests pass.

### Go-live checks (2026-09-29)

- **T: S3Store against Scaleway: verified.** With the real bucket and two separate server instances: both read the content through S3; two simultaneous saves with the same token gave exactly one 200 and one 409; a stale token afterwards gave 409; a fresh token saved. Scaleway honours the conflict check.
- Bucket `rowennkalman` (fr-par) in its own Scaleway project `rowennkalman`, with an application key limited to that project. `art/*` is public-read; `content.json` and the bucket listing return 403. Seeded with the real content and 17 photos (`scripts/seed-s3.mjs --from .data`).
- Still open: real email (Resend) and the Netlify runtime, including the one-hop `/tesis/` redirect.
