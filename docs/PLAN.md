# rowennkalman.com revamp — plan

## Status (2026-09-29)

MVP built and integrated on branch `revamp`: public pages + the cloud agent's admin/content backend
(`docs/admin-REPORT.md`), magic-link sign-in, "use a painting from your portfolio" on every
picture field, chosen paintings on Home. Real content lives in the local store `.data/` (gitignored).
110 unit + 9 e2e tests pass (`npm test`, `npx playwright test e2e/admin.spec.ts`).

To go live (needs Luis): ~~Scaleway bucket + key → seed~~ done 2026-09-29 (see docs/AUDIT.md, "Go-live checks");
Resend domain + sending key; Netlify env vars (names in `.env.example`) for build and functions;
Netlify build settings to Next.js; merge `revamp` → `master`.

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
- Quality gate: CI/CD, probably reusing next-tt's SonarQube setup as a pre-push hook.
- New page types beyond the fixed five.

## Open facts

- Scaleway: new bucket + API key (check whether an existing key can be scoped or a new one is needed).
