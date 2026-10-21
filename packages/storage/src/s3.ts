import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "node:stream";

/**
 * An S3-compatible bucket: Cloudflare R2 (https://<account-id>.r2.cloudflarestorage.com),
 * AWS S3, or the local S3Mock in infra/. The code is the same for all of them.
 */
export interface StorageTarget {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function client(t: StorageTarget): S3Client {
  return new S3Client({
    endpoint: t.endpoint,
    // R2 wants "auto"; others accept any region with a custom endpoint.
    region: "auto",
    credentials: { accessKeyId: t.accessKeyId, secretAccessKey: t.secretAccessKey },
    // bucket in the path (https://host/bucket/key): works on R2, S3 and local stores alike.
    forcePathStyle: true,
    // The SDK's newer default adds CRC32 checksums to every upload part, which
    // S3-compatible stores (R2 included) don't all accept. Only when required.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

/**
 * Upload a stream of unknown size. lib-storage splits it into parts as it
 * arrives, so a multi-gigabyte dump never has to sit in memory.
 */
export async function uploadStream(t: StorageTarget, key: string, body: Readable): Promise<void> {
  const upload = new Upload({
    client: client(t),
    params: { Bucket: t.bucket, Key: key, Body: body, ContentType: "application/octet-stream" },
    queueSize: 2,
    partSize: 8 * 1024 * 1024,
  });
  await upload.done();
}

export async function downloadStream(t: StorageTarget, key: string): Promise<Readable> {
  const r = await client(t).send(new GetObjectCommand({ Bucket: t.bucket, Key: key }));
  if (!r.Body) throw new Error("The backup file is empty");
  return r.Body as Readable;
}

export async function deleteObject(t: StorageTarget, key: string): Promise<void> {
  await client(t).send(new DeleteObjectCommand({ Bucket: t.bucket, Key: key }));
}

/** Write and delete a tiny file: proves the endpoint, bucket and keys all work. */
export async function testConnection(t: StorageTarget): Promise<void> {
  const key = `warden-connection-test/${Date.now()}.txt`;
  const c = client(t);
  await c.send(new PutObjectCommand({ Bucket: t.bucket, Key: key, Body: "ok", ContentType: "text/plain" }));
  await c.send(new DeleteObjectCommand({ Bucket: t.bucket, Key: key }));
}
