import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import type { S3Like } from "@/lib/store/s3";

type Obj = { body: Uint8Array; etag: string; lastModified: Date };

/** A tiny in-memory stand-in for S3Client.send. No network. */
export class FakeS3 implements S3Like {
  objects = new Map<string, Obj>();
  calls: string[] = [];
  supportsIfMatch = true;
  private n = 0;

  put(key: string, body: string | Uint8Array, lastModified = new Date()) {
    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
    this.objects.set(key, { body: bytes, etag: `"etag-${++this.n}"`, lastModified });
  }

  async send(command: unknown): Promise<unknown> {
    if (command instanceof GetObjectCommand) {
      const key = command.input.Key!;
      this.calls.push(`get ${key}`);
      const obj = this.objects.get(key);
      if (!obj) throw Object.assign(new Error("NoSuchKey"), { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } });
      return { ETag: obj.etag, Body: { transformToString: async () => new TextDecoder().decode(obj.body) } };
    }
    if (command instanceof PutObjectCommand) {
      const { Key, Body, IfMatch } = command.input;
      this.calls.push(`put ${Key}`);
      if (IfMatch !== undefined) {
        if (!this.supportsIfMatch) {
          throw Object.assign(new Error("NotImplemented"), { name: "NotImplemented", $metadata: { httpStatusCode: 501 } });
        }
        if (this.objects.get(Key!)?.etag !== IfMatch) {
          throw Object.assign(new Error("PreconditionFailed"), { name: "PreconditionFailed", $metadata: { httpStatusCode: 412 } });
        }
      }
      this.put(Key!, Body as string | Uint8Array);
      return {};
    }
    if (command instanceof DeleteObjectCommand) {
      this.calls.push(`delete ${command.input.Key}`);
      this.objects.delete(command.input.Key!);
      return {};
    }
    if (command instanceof ListObjectsV2Command) {
      const prefix = command.input.Prefix ?? "";
      const keys = [...this.objects.keys()].filter((k) => k.startsWith(prefix)).sort();
      // Page size 2 to exercise continuation tokens.
      const start = command.input.ContinuationToken ? Number(command.input.ContinuationToken) : 0;
      const slice = keys.slice(start, start + 2);
      const more = start + 2 < keys.length;
      return {
        Contents: slice.map((Key) => ({ Key, LastModified: this.objects.get(Key)!.lastModified })),
        IsTruncated: more,
        NextContinuationToken: more ? String(start + 2) : undefined,
      };
    }
    throw new Error(`FakeS3: unsupported command ${String(command)}`);
  }
}
