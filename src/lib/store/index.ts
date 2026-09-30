import path from "node:path";
import type { ContentStore } from "./types";
import { FileStore } from "./file";
import { S3Store, type S3Config } from "./s3";

export { ConflictError, StoreError, type ContentStore, type StoredImage } from "./types";
export { MemoryStore } from "./memory";
export { FileStore } from "./file";
export { S3Store } from "./s3";

type Env = Record<string, string | undefined>;

const S3_VARS = {
  endpoint: "ROWENNKALMAN_S3_ENDPOINT",
  region: "ROWENNKALMAN_S3_REGION",
  bucket: "ROWENNKALMAN_S3_BUCKET",
  accessKeyId: "ROWENNKALMAN_S3_ACCESS_KEY",
  secretAccessKey: "ROWENNKALMAN_S3_SECRET_KEY",
  publicImageBase: "ROWENNKALMAN_PUBLIC_IMAGE_BASE",
} as const;

/** Returns the S3 config if every S3 variable is set, null if none are, and throws if only some are. */
export function s3ConfigFromEnv(env: Env): S3Config | null {
  const entries = Object.entries(S3_VARS).map(([k, name]) => [k, env[name]?.trim() || undefined] as const);
  const missing = entries.filter(([, v]) => !v).map(([k]) => S3_VARS[k as keyof typeof S3_VARS]);
  if (missing.length === entries.length) return null;
  if (missing.length > 0) throw new Error(`S3 storage is partly configured. Missing: ${missing.join(", ")}`);
  return Object.fromEntries(entries) as S3Config;
}

export function createStoreFromEnv(env: Env = process.env): ContentStore {
  const s3 = s3ConfigFromEnv(env);
  if (s3) return new S3Store(s3);
  return new FileStore(env.ROWENNKALMAN_DATA_DIR?.trim() || path.join(process.cwd(), ".data"));
}

let cached: ContentStore | undefined;

/** The store for this process: S3Store when S3 env is complete, otherwise FileStore. */
export function getStore(): ContentStore {
  cached ??= createStoreFromEnv();
  return cached;
}

/** Tests only: replace the process store. */
export function setStoreForTests(store: ContentStore | undefined): void {
  cached = store;
}
