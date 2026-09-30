/**
 * Lists failed uploads, newest first (docs/IMAGES.md, "Diagnose a failed upload").
 *
 *   npm run upload-failures                    everything kept
 *   npm run upload-failures -- --since 7d      the last 7 days (also 12h, 30m)
 *   npm run upload-failures -- --id u-7f3k2x9q one upload in full (the reference the editor saw)
 *
 * Reads .env.local (the PRODUCTION bucket on this Mac); read-only.
 */
import { createStoreFromEnv, s3ConfigFromEnv } from "@/lib/store";

const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const since = opt("--since");
const id = opt("--id");
const cutoff = since ? Date.now() - parseDuration(since) : 0;

function parseDuration(s: string): number {
  const m = /^(\d+)([mhd])$/.exec(s);
  if (!m) throw new Error(`--since wants e.g. 30m, 12h or 7d, not ${s}`);
  return Number(m[1]) * { m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as "m" | "h" | "d"];
}

const s3 = s3ConfigFromEnv(process.env);
console.log(s3 ? `PRODUCTION bucket: ${s3.bucket}` : "Local store");
const all = await createStoreFromEnv().listUploadFailures();
const shown = all.filter((f) => (!id || f.id === id) && Date.parse(f.at) >= cutoff);
if (!shown.length) console.log(id ? `No failure recorded for ${id}.` : "No failed uploads recorded.");
for (const f of shown) {
  if (id) {
    console.log(JSON.stringify(f, null, 2));
    console.log(`\nFunction log lines for it, if still in Netlify's history:\n  scripts/netlify.sh logs --source functions --function ___netlify-server-handler --since ${new Date(Date.parse(f.at) - 120_000).toISOString()} --json | grep ${f.id}`);
  } else {
    console.log(`${f.at}  ${f.id}  ${String(f.source ?? "").padEnd(7)}  ${f.step.padEnd(7)}  ${f.message}${f.detail ? `  [${String(f.detail).slice(0, 80)}]` : ""}`);
  }
}
