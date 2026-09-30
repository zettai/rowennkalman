# REPORT: rowennkalman admin + content backend

Everything behind the public pages of the portfolio site: the content contract, three stores, auth, the admin UI, browser-side uploads and the contact API. It's a Next.js 15 App Router app in this folder. The one public page is the throwaway `src/app/(site)/page.tsx`.

## Status

| Priority | Deliverable | State |
| --- | --- | --- |
| 1 | `ContentSchema` + `Content` type, field registry, seed with 3 placeholder artworks, coverage test | Done |
| 2 | `MemoryStore`, `FileStore`, `S3Store`, `getStore()`, conflict and orphan-cleanup tests (the same suite runs against all three) | Done |
| 3 | Login, session cookie, middleware, logout, rate limit, `scripts/hash-password.mjs` | Done |
| 4 | Admin UI: page text editing, portfolio CRUD + reorder, other image fields | Done |
| 5 | Browser-side resize/re-encode, server-side JPEG checks | Done |
| 6 | Contact API, `Mailer` / `ResendMailer` / `ConsoleMailer`, `ContactForm` | Done |
| 7 | Playwright e2e + screenshots | Done. Playwright 1.56.1 with the sandbox's preinstalled Chromium. |

Checks run before each push: `npm run lint` (0 warnings), `npx tsc --noEmit`, `npm test`, `npm run build`, and `npx playwright test` once the UI existed.

## How to run

```bash
npm install
npm run placeholders          # regenerates content/seed-images (already committed, 44 KB)
cp .env.example .env.local    # set the hash and session secret; leave S3 empty for FileStore
npm run dev                   # http://localhost:3000/admin
npm test                      # Jest, 108 tests
npm run lint
npx playwright test           # e2e: builds, starts on :3100 with .data-e2e/
SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts   # rewrites screenshots/
```

## Verification

### Unit tests (Jest + Testing Library): 9 suites, 108 tests, all passing

- **`tests/schema.test.ts`** (schema and registry):
  - The seed is valid, with text in every field, and its images exist and total under 50 KB.
  - Bad image keys, bad uuids and a wrong `version` are rejected.
  - **Coverage test:** walks every string leaf of `ContentSchema` and fails if one is missing from `fields.ts`. It skips artworks, image `key`s, ids, `version` and `updatedAt`. It also fails if the registry names a path the schema doesn't have, if an artwork field has no label, or if a field has an empty or multi-line hint.
- **`tests/stores.test.ts`** runs the same 10 cases against MemoryStore, FileStore (temp dir) and S3Store (with an in-memory fake `S3Client.send`, so no network):
  - Save with a fresh token.
  - `ConflictError` on a stale token.
  - Two racing saves: exactly one wins.
  - Invalid content refused.
  - Keys outside `art/` refused.
  - **Orphan cleanup:** deleting an artwork deletes its image. Replacing or removing an image deletes the old key. A key still used elsewhere is kept. A conflicting save deletes nothing. The sweep removes unsaved uploads after the grace period and nothing that is referenced.
  - Also tested: FileStore seeding, S3 If-Match conflicts across instances and the fallback when a provider lacks If-Match, and `getStore()` selection, including a loud error when S3 is only partly configured.
- **`tests/auth.test.ts`:**
  - Right and wrong password; no hash configured.
  - Session tokens: round-trip, expired, forged with another secret, tampered payload, `alg=none`, wrong audience, garbage.
  - Cookie flags.
  - Login rate limit per IP; no off-site redirects after login.
  - Middleware: redirects pages, returns 401 on the API, lets the login page through, blocks cross-origin writes.
- **`tests/upload.test.ts`** uses fixture bytes, including a real JPEG with an EXIF segment spliced in:
  - Clean JPEGs pass, and their size is read from the SOF segment.
  - Rejected: PNG, WebP, HEIC and SVG by magic bytes; APP1/EXIF; files over 5 MB; truncated files; files with no dimensions; images over 2800 px.
  - The upload handler stores a file under `art/<uuid>.jpg` and stores nothing when a check fails. Discarding an upload never deletes an image that content uses.
- **`tests/save-handler.test.ts`:** a save changes one page only; 409 on a stale token; 400 on an invalid body.
- **`tests/contact.test.ts`:**
  - A valid message is sent.
  - Honeypot: pretends success and sends nothing.
  - Timing: under 3 s is refused, exactly 3 s is accepted, a future `startedAt` is refused.
  - Length limits, email format, control characters and newlines in the name (header safety), per-IP rate limit.
  - A mailer failure returns 502 without leaking detail.
  - `ResendMailer` request shape (`reply_to` is the sender) and its error handling, checked with an injected fake fetch.
  - `getMailer` selection.
- **`tests/contact-form.test.tsx`:** the form shows the labels from content, posts JSON with an empty honeypot and `startedAt`, and shows the success and error messages. The honeypot stays out of the tab order and the accessibility tree.
- **`tests/admin-ui.test.tsx`:**
  - Every registry field of a page renders with its label, and its hint is the accessible description.
  - Save sends only that page plus `expectedUpdatedAt`.
  - A 409 shows the conflict message and a Reload button, and keeps the edit.
  - A network failure keeps the changes.
  - Research documents: add, reorder, remove, with no `window.confirm`.
  - Portfolio: reorder moves focus to the moved item and announces the new position; inline delete confirm can be cancelled.
- **`tests/upload-client.test.ts`:** accepted and refused file types (HEIC gets iPhone-specific help) and the 2800 px fitting.

`jest.setup.ts` replaces `fetch` with a function that throws, so an accidental network call in any test fails it.

### E2E (Playwright, `e2e/admin.spec.ts`): 9 passing

These run against a production build with FileStore in a fresh `.data-e2e/`.

1. **Sign-in:** `/admin/home` redirects to login with `next`. A wrong password shows an error. The API answers 401 without a session. After login the cookie is `httpOnly`, `Secure`, `SameSite=Lax`.
2. **Edit and publish:** edit `home.heroTitle`, Save, open `/`, and the new title is there (`revalidatePath` works with a static page).
3. **Portfolio round trip:**
   - Upload a JPEG *with EXIF*, fill in the fields, add it, and Move up. Focus stays on the moved item.
   - Save. On `/` the artwork is in the new position.
   - The stored image is a JPEG with no `Exif` bytes: the browser stripped them and the server re-checked.
   - Delete it with the inline confirm and Save. `.data-e2e/art/<key>` is gone, the image URL returns 404, and `/` no longer lists it.
4. **Two tabs:** tab A saves, then tab B's save shows "This page was changed in another tab. Reload to see the latest." Reload loads tab A's text.
5. **HEIC:** picking a `.HEIC` file shows the friendly message and uploads nothing.
6. **Unsaved changes:** clicking "All pages" with unsaved edits shows an in-page prompt. Focus goes to "Stay on this page". "Leave without saving" navigates away.
7. **Home picture:** replace it and change the alt text. After Save the old key returns 404. Remove it, Save, and that key returns 404 too.
8. **Sign out:** the cookie is cleared; `/admin` redirects to login and the API returns 401.
9. **Contact API:** honeypot returns 200, too fast returns 400, a valid message returns `{ ok: true }` (ConsoleMailer).

### Screenshots (`screenshots/`, 30 PNGs)

Every screen at 1280 px and 390 px:
- login and login error
- dashboard
- Home, About, Research, Contact and Whole-site editors
- portfolio grid, add, edit and delete-confirm
- unsaved-changes prompt
- the "Saved" state
- the conflict message

## Deviations from the request (all minimal)

1. **`middleware.ts` is at `src/middleware.ts`.** With a `src/` layout, Next.js only loads middleware from `src/`. At the project root it was silently ignored; the first e2e run caught this. The admin pages and API routes also check the session themselves, so nothing was exposed.
2. **`ContentStore` has one extra method, `listImages(): Promise<{ key; lastModified }[]>`.** Deleting keys on save covers deleted, replaced and removed images. It can't cover a picture that was uploaded and then never saved (a closed tab, for example). `sweepOrphanImages` runs after each save and deletes unreferenced keys older than 6 hours. The UI also discards unsaved uploads straight away when it can.
3. **One extra optional env var, `ROWENNKALMAN_DATA_DIR`.** It overrides FileStore's `./.data`, and e2e uses it for isolation. The default is unchanged.
4. **The dev image route is `/api/dev-images/[...key]`.** It serves files only while FileStore is the store, and returns 404 when S3 is configured. It isn't tied to `NODE_ENV`, because e2e runs a production build on FileStore.
5. **Files outside the ownership lists:**
   - `src/app/layout.tsx`: a minimal root layout. Next needs one; it sets `<html>`, `<body style="margin:0">` and metadata from `site`.
   - `src/lib/rate-limit.ts`, `src/lib/admin/handlers.ts`: all under `src/lib/**`.
   - The login and logout routes are `src/app/api/auth/{login,logout}` (under `src/app/api/**`).
6. **Schema: no fields added.**
   - Added constraints: image keys must match `art/<name>.jpg` (this blocks path traversal and foreign keys); `Artwork.id` is a uuid; strings have generous max lengths.
   - `research.documents[].id` is any non-empty string, not a uuid (the request didn't say uuid).
   - Zod-free helpers (`collectImageKeys`, `PAGE_KEYS`, `paragraphs`) are in `helpers.ts` and re-exported from `schema.ts`. This keeps zod out of the admin client bundle (11 kB instead of 35 kB).
7. **The server also rejects JPEGs over 2800 px on a side.** It matches the browser limit, as a sanity check.
8. **Dependencies:**
   - Runtime: only the listed ones. `jose` is pinned to v5 (it ships CommonJS, so Jest works without transform tweaks); zod is v4.
   - Dev tooling: TypeScript 5, ESLint 9 + `eslint-config-next`, Jest 29 + jsdom + Testing Library, `@playwright/test` 1.56.1, and `jpeg-js` (pure JS, used only by the placeholder script).
   - `npm` installs `sharp` because it is an **optional dependency of `next` itself**. Nothing here imports it, and `images.unoptimized` is on. `--omit=optional` would also drop Next's SWC binary, so it's left as is.
9. **Login uses a plain HTML form POST to `/api/auth/login`,** not a server action, so it works without JavaScript and the cookie code stays in one route.

## Integration notes

### Env vars (all in `.env.example`, names only)

| Var | Needed | Notes |
| --- | --- | --- |
| `ROWENNKALMAN_ADMIN_PASSWORD_HASH` | yes | bcrypt hash from `npm run hash-password`. **In `.env.local`, escape each `$` as `\$`,** because Next expands `$VARS` in env files; the script prints both forms. Paste it unescaped in the Netlify UI. |
| `ROWENNKALMAN_SESSION_SECRET` | yes | 32 characters or more. Changing it signs everyone out. |
| `ROWENNKALMAN_S3_ENDPOINT`, `_S3_REGION`, `_S3_BUCKET`, `_S3_ACCESS_KEY`, `_S3_SECRET_KEY` | prod | Scaleway example: `https://s3.fr-par.scw.cloud`, `fr-par`. |
| `ROWENNKALMAN_PUBLIC_IMAGE_BASE` | prod | Public URL prefix for keys, no trailing slash (bucket website or CDN). |
| `ROWENNKALMAN_DATA_DIR` | no | FileStore directory (default `./.data`). |
| `ROWENNKALMAN_RESEND_API_KEY`, `ROWENNKALMAN_CONTACT_TO`, `ROWENNKALMAN_CONTACT_FROM` | prod | Without the key, ConsoleMailer logs messages. With the key, TO and FROM are required. |

### How `getStore()` chooses

- **All six S3 vars set:** `S3Store`.
- **None set:** `FileStore` (`ROWENNKALMAN_DATA_DIR` or `./.data`). It is seeded from `content/seed.json` and `content/seed-images/` on first read.
- **Some set:** it throws, naming the missing ones.

One instance per process. **On Netlify, set the S3 vars for both build and functions.** Without them it silently falls back to FileStore on an ephemeral disk, and edits would vanish.

Seed the bucket once with `node --env-file=.env.local scripts/seed-s3.mjs`. It refuses to overwrite `content.json` without `--force`.

For the bucket policy: `art/*` must be publicly readable. `content.json` doesn't need to be public.

### Plugging in the public pages

- Read content in server components with `const content = await getStore().getContent()` from `@/lib/store`. Types come from `@/lib/content/schema` (`Content`, `ImageRef`, `Artwork`, `paragraphs()` for `about.body` and the research intros).
- Image URL: `getStore().imageUrl(ref.key)`. Use `ref.width`/`ref.height` for layout and `ref.alt` for alt.
- Keep the pages **static or ISR, not `force-dynamic`**. Every admin write calls `revalidatePath("/", "layout")`, which refreshes all pages under the root layout within a request or two. With S3, the Netlify build needs the S3 env to prerender.
- Replace `src/app/(site)/page.tsx`. The e2e reads `data-testid="hero-title"` and `data-testid="artworks"` (an `<ol>` of titles) from `/`. Keep those hooks or update `e2e/admin.spec.ts` and `e2e/helpers.ts`.
- You may replace `src/app/layout.tsx`. Keep `<html>`/`<body>`, since `/admin` renders inside it, and keep `body` margin 0 or give the admin its own.
- Contact page: `import { ContactForm } from "@/lib/contact"` and render `<ContactForm labels={content.contact.form} className={styles.form} />`. Style it through `data-part="field|label|input|textarea|submit|status"` and `form[data-state="idle|sending|sent|error"]`.
- Site nav and footer strings come from `content.site`. Menu targets are `/`, `/about`, `/portfolio`, `/research`, `/contact`; the admin's "View this page" links assume those paths (`publicPath` in `fields.ts`).
- Adding an editable text: add it to `ContentSchema`, add one entry to `PAGES` in `fields.ts`, and update the seed. The coverage test fails until the registry has it.

### Security notes

- **Session cookie:** `rk_admin_session`, HS256 JWT, 7 days, `httpOnly; Secure; SameSite=Lax; Path=/`. Chromium accepts `Secure` cookies on `http://localhost`, but Safari may not. For local testing in Safari, use Chrome or HTTPS.
- **Where auth is checked:** middleware sends `Cache-Control: no-store` and `X-Robots-Tag: noindex` on admin responses, and rejects cross-origin writes to `/api/admin/**` by comparing `Origin` with `Host`. Every admin route and layout re-verifies the session.
- **Login rate limit and serverless:** 10 attempts per IP per 15 minutes, 5 contact messages per IP per 10 minutes. These are in memory and per instance, so they're best effort on serverless and not a global guarantee. A shared counter (Netlify Blobs, Upstash) can sit behind the same `RateLimiter` interface.
- **Adding a magic-link login later:** add a route that proves identity, then call `issueSession({ method: "magic-link" })` and set the cookie as the password route does. Nothing else changes: `verifySession` already accepts that method.

### Things I would do differently or next

- **Responsive image sizes:** only one image per upload (up to 2800 px) is stored. The public pages will want smaller sizes. Options:
  - Netlify Image CDN (`/.netlify/images?url=…&w=…`) in front of the bucket, which needs no code here.
  - Generate an 800 px variant in the browser alongside the main one.
- **S3 concurrency:** conflicts are detected with If-Match (ETag), with a fallback to read-compare-write if the provider returns 501. I couldn't verify Scaleway's If-Match support from the sandbox. Without it, two saves in the same few milliseconds on different function instances could both pass; the in-process lock covers one instance.
- **Unsaved-changes guard gaps:**
  - The browser Back button isn't intercepted. `beforeunload` covers reload and close, and the in-page prompt covers links.
  - A "New painting" form that's open but not yet added doesn't count as unsaved.
- **Reorder:** drag-to-reorder isn't built; it was optional, and Up/Down buttons are accessible.
- **Deletion model:** deletes and reorders are draft changes published by the page's one Save. That's consistent, but an "Undo last delete" would be kinder than the inline confirm alone.
