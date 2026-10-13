/**
 * Empty overrides so Next never uses production services from .env.local.
 * Single source for Playwright, scripts/a11y-pages.sh, and CI.
 * Keep this list identical to the blanked keys historically in playwright.config.ts.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export const blankProdEnv = {
  ROWENNKALMAN_S3_ENDPOINT: "",
  ROWENNKALMAN_S3_REGION: "",
  ROWENNKALMAN_S3_BUCKET: "",
  ROWENNKALMAN_S3_ACCESS_KEY: "",
  ROWENNKALMAN_S3_SECRET_KEY: "",
  ROWENNKALMAN_PUBLIC_IMAGE_BASE: "",
  ROWENNKALMAN_IMAGE_CDN_URL: "",
  ROWENNKALMAN_GOATCOUNTER_URL: "",
  ROWENNKALMAN_GOATCOUNTER_API_KEY: "",
  ROWENNKALMAN_CF_ACCESS_CLIENT_ID: "",
  ROWENNKALMAN_CF_ACCESS_CLIENT_SECRET: "",
  ROWENNKALMAN_RESEND_API_KEY: "",
  ROWENNKALMAN_CONTACT_TO: "",
  ROWENNKALMAN_CONTACT_FROM: "",
} as const;

/** `eval "$(npx tsx scripts/blank-prod-env.ts shell)"` */
export function toShellExports(): string {
  return Object.entries(blankProdEnv)
    .map(([k, v]) => `export ${k}=${JSON.stringify(v)}`)
    .join("\n");
}

/** Append to $GITHUB_ENV so job steps inherit blank overrides. */
export function toGithubEnv(): string {
  return Object.entries(blankProdEnv)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

const invokedAsCli =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]!) === fileURLToPath(import.meta.url);
if (invokedAsCli) {
  const mode = process.argv[2];
  if (mode === "shell") process.stdout.write(`${toShellExports()}\n`);
  else if (mode === "github") process.stdout.write(`${toGithubEnv()}\n`);
}
