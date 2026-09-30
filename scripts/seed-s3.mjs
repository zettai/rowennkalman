#!/usr/bin/env node
// One-off: put content (as content.json) and its images into the S3 bucket named
// by the ROWENNKALMAN_S3_* env vars. Refuses to overwrite an existing content.json
// unless --force is given.
//
//   node --env-file=.env.local scripts/seed-s3.mjs [--force]            placeholder seed (content/)
//   node --env-file=.env.local scripts/seed-s3.mjs --from .data [--force]   a local store's content.json + art/
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = (name) => {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return v;
};
const Bucket = env("ROWENNKALMAN_S3_BUCKET");
const client = new S3Client({
  endpoint: env("ROWENNKALMAN_S3_ENDPOINT"),
  region: env("ROWENNKALMAN_S3_REGION"),
  credentials: { accessKeyId: env("ROWENNKALMAN_S3_ACCESS_KEY"), secretAccessKey: env("ROWENNKALMAN_S3_SECRET_KEY") },
});

const exists = await client.send(new HeadObjectCommand({ Bucket, Key: "content.json" })).then(
  () => true,
  () => false,
);
if (exists && !process.argv.includes("--force")) {
  console.error("content.json already exists in the bucket. Re-run with --force to overwrite it.");
  process.exit(1);
}

const fromIdx = process.argv.indexOf("--from");
const fromDir = fromIdx > 0 ? path.resolve(process.argv[fromIdx + 1] ?? "") : null;
const contentFile = fromDir ? path.join(fromDir, "content.json") : path.join(root, "content", "seed.json");
const imgDir = fromDir ? path.join(fromDir, "art") : path.join(root, "content", "seed-images");
for (const name of readdirSync(imgDir).filter((n) => n.endsWith(".jpg"))) {
  await client.send(
    new PutObjectCommand({
      Bucket,
      Key: `art/${name}`,
      Body: readFileSync(path.join(imgDir, name)),
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  console.log(`put art/${name}`);
}
await client.send(
  new PutObjectCommand({
    Bucket,
    Key: "content.json",
    Body: readFileSync(contentFile),
    ContentType: "application/json; charset=utf-8",
    CacheControl: "no-store",
  }),
);
console.log("put content.json");
