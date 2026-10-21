import { randomBytes } from "node:crypto";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { describe, expect, it } from "vitest";
import { decryptStream, encryptStream } from "./crypto-stream";

async function collect(src: Readable, ...steps: NodeJS.ReadWriteStream[]): Promise<Buffer> {
  const chunks: Buffer[] = [];
  await pipeline(src, ...(steps as never[]), new Writable({ write(c, _e, cb) { chunks.push(c); cb(); } }));
  return Buffer.concat(chunks);
}

describe("encryptStream / decryptStream", () => {
  const dek = randomBytes(32);
  const plain = Buffer.from("CREATE TABLE kept(x int); INSERT INTO kept VALUES (42);\n".repeat(5000));

  it("round-trips a large stream", async () => {
    const s = encryptStream(dek);
    const sealed = await collect(Readable.from([plain.subarray(0, 100_000), plain.subarray(100_000)]), s.stream);
    expect(sealed.includes(Buffer.from("CREATE TABLE"))).toBe(false);
    const back = await collect(Readable.from([sealed]), decryptStream(dek, s.iv, s.authTag()));
    expect(back.equals(plain)).toBe(true);
  });

  it("refuses a file with one byte changed", async () => {
    const s = encryptStream(dek);
    const sealed = await collect(Readable.from([plain]), s.stream);
    sealed[1234] ^= 0xff;
    await expect(collect(Readable.from([sealed]), decryptStream(dek, s.iv, s.authTag()))).rejects.toThrow();
  });

  it("refuses the wrong key", async () => {
    const s = encryptStream(dek);
    const sealed = await collect(Readable.from([plain]), s.stream);
    await expect(collect(Readable.from([sealed]), decryptStream(randomBytes(32), s.iv, s.authTag()))).rejects.toThrow();
  });
});
