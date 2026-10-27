/**
 * Adds the pre-made WebP sizes to pictures that lack them (docs/IMAGES.md). Re-runnable.
 *
 *   npm run image-sizes                 dry run: lists what is missing, changes nothing
 *   npm run image-sizes -- --apply      makes and stores the missing sizes, records them in content
 *   npm run image-sizes -- --apply --force   remakes every size (e.g. after changing quality),
 *                                             then purges them from Cloudflare's cache
 *
 * Reads .env.local, which on this Mac is the PRODUCTION bucket. Originals are never changed.
 * Before changing content.json it writes a copy to .data/backups/.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createStoreFromEnv, s3ConfigFromEnv } from "@/lib/store";
import { backfillSizes } from "@/lib/images/backfill";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const force = args.has("--force");

const s3 = s3ConfigFromEnv(process.env);
console.log(s3 ? `PRODUCTION bucket: ${s3.bucket} (${s3.endpoint})` : `Local store: ${process.env.ROWENNKALMAN_DATA_DIR || ".data"}`);
console.log(apply ? (force ? "Mode: APPLY, remaking every size" : "Mode: APPLY") : "Mode: dry run (add --apply to change anything)");

const store = createStoreFromEnv();
const report = await backfillSizes(store, {
  apply,
  force,
  log: (l) => console.log(l),
  fetchOriginal: async (key) => {
    const url = store.imageUrl(key);
    const res = await fetch(url.startsWith("http") ? url : new URL(url, "http://localhost:3000"));
    if (!res.ok) throw new Error(`Could not read ${key}: HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  },
  beforeSave: async (current) => {
    const dir = path.join(process.cwd(), ".data", "backups");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `content-before-image-sizes-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(file, JSON.stringify(current, null, 2));
    console.log(`Content backed up to ${path.relative(process.cwd(), file)}`);
  },
});

console.log(`\n${report.skipped} picture(s) already complete; ${report.planned.length} need sizes:`);
for (const p of report.planned) console.log(`  ${p.key} (${p.width}px): has [${p.have.join(", ")}], wants [${p.want.join(", ")}]`);
if (apply && report.planned.length) {
  console.log(`\nStored ${report.made.length} size file(s). Content saved as version ${report.savedUpdatedAt}.`);
  const cdn = process.env.ROWENNKALMAN_IMAGE_CDN_URL?.trim().replace(/\/$/, "") || "https://img.rowennkalman.com";
  if (force && report.made.length) {
    const urls = report.made.map((k) => `${cdn}/${k}`);
    for (let i = 0; i < urls.length; i += 30) {
      execFileSync(path.join(process.cwd(), "scripts", "cloudflare.sh"), ["purge", ...urls.slice(i, i + 30)], { stdio: "inherit" });
    }
  }
  if (s3) {
    // Netlify keeps page copies for up to an hour; drop them so pages use the sizes now.
    execFileSync(
      path.join(process.cwd(), "scripts", "netlify.sh"),
      // netlify-cli sends only what is under "body" as the request body.
      ["api", "purgeCache", "--data", JSON.stringify({ body: { site_id: "fdee4ce6-92ce-4b16-9948-83aeba4f7c2b", cache_tags: ["rk-pages"] } })],
      { stdio: "ignore" },
    );
    console.log("Netlify's cached pages purged: the site uses the sizes on the next visit.");
  }
}
