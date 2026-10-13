/**
 * Thin CLI forwarder. The blank-prod list lives in blank-prod-env.ts only.
 * Usage: node scripts/blank-prod-env.mjs shell|github
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] ?? "shell";
const result = spawnSync("npx", ["tsx", path.join(here, "blank-prod-env.ts"), mode], {
  encoding: "utf8",
  cwd: path.join(here, ".."),
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
