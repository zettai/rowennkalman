import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import type { Content } from "@/lib/content/schema";
import { ConflictError, StoreError, type ContentStore, type StoredImage } from "./types";
import { assertImageKey, createMutex, parseContent, prepareWrite } from "./common";

export type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicImageBase: string;
};

/** The subset of S3Client the store uses; tests pass a fake. */
export type S3Like = { send(command: unknown): Promise<unknown> };

const CONTENT_KEY = "content.json";

function errorName(err: unknown): string {
  const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name ?? e?.Code ?? "";
}
function httpStatus(err: unknown): number | undefined {
  return (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
}

/**
 * Production store on an S3-compatible bucket (Scaleway).
 * content.json at the bucket root, images under art/.
 */
export class S3Store implements ContentStore {
  private readonly client: S3Like;
  private readonly bucket: string;
  private readonly base: string;
  private readonly lock = createMutex();
  /** Conditional writes (If-Match) are used when the provider supports them. */
  private conditionalWrites = true;

  constructor(config: S3Config, client?: S3Like) {
    this.bucket = config.bucket;
    this.base = config.publicImageBase.replace(/\/+$/, "");
    this.client =
      client ??
      new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: false,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      });
  }

  private async read(): Promise<{ content: Content; etag?: string }> {
    let out: { Body?: { transformToString(): Promise<string> }; ETag?: string };
    try {
      out = (await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: CONTENT_KEY }))) as typeof out;
    } catch (err) {
      if (errorName(err) === "NoSuchKey" || httpStatus(err) === 404) {
        throw new StoreError(`${CONTENT_KEY} is missing from bucket ${this.bucket}. Seed it with scripts/seed-s3.mjs.`, { cause: err });
      }
      throw err;
    }
    if (!out.Body) throw new StoreError(`${CONTENT_KEY} has no body`);
    const text = await out.Body.transformToString();
    return { content: parseContent(JSON.parse(text), `in s3://${this.bucket}/${CONTENT_KEY}`), etag: out.ETag };
  }

  async getContent(): Promise<Content> {
    return (await this.read()).content;
  }

  putContent(next: Content, expectedUpdatedAt: string): Promise<Content> {
    return this.lock(async () => {
      const { content: current, etag } = await this.read();
      const saved = prepareWrite(current, next, expectedUpdatedAt);
      const put = (ifMatch?: string) =>
        this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: CONTENT_KEY,
            Body: JSON.stringify(saved, null, 2),
            ContentType: "application/json; charset=utf-8",
            CacheControl: "no-store",
            ...(ifMatch ? { IfMatch: ifMatch } : {}),
          }),
        );
      try {
        await put(this.conditionalWrites ? etag : undefined);
      } catch (err) {
        // Another instance wrote between our read and write.
        if (errorName(err) === "PreconditionFailed" || httpStatus(err) === 412) {
          throw new ConflictError((await this.read()).content.updatedAt);
        }
        // Provider without conditional writes: fall back to read-compare-write.
        if (etag && (errorName(err) === "NotImplemented" || httpStatus(err) === 501)) {
          this.conditionalWrites = false;
          await put();
        } else {
          throw err;
        }
      }
      return saved;
    });
  }

  async putImage(key: string, bytes: Uint8Array, contentType: "image/jpeg"): Promise<void> {
    assertImageKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        // Keys are never reused (a new uuid per upload), so images can be cached forever.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  async deleteImage(key: string): Promise<void> {
    assertImageKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  imageUrl(key: string): string {
    return `${this.base}/${key}`;
  }

  async listImages(): Promise<StoredImage[]> {
    const out: StoredImage[] = [];
    let token: string | undefined;
    do {
      const page = (await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: "art/", ContinuationToken: token }),
      )) as ListObjectsV2CommandOutput;
      for (const obj of page.Contents ?? []) {
        if (obj.Key) out.push({ key: obj.Key, lastModified: obj.LastModified?.getTime() ?? 0 });
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return out;
  }
}
