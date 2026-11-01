import { Readable } from "node:stream";
import { downloadStream, encryptStream, decryptStream, uploadStream, type StorageTarget } from "storage";

/*
 * Warden's OWN database, backed up to Warden's backup bucket (backup.sh runs
 * it nightly). Encrypted with MASTER_KEY, streamed: the dump never sits whole
 * on disk or in memory. Restoring needs the same MASTER_KEY, which you need
 * anyway (it's what makes every stored SSH key and password readable).
 *
 *   pg_dump … | gzip | node self-backup.js backup          → prints the backup's name
 *   node self-backup.js restore <name> | gunzip | psql …
 *
 * Each backup is two objects: warden-self/<name>.sql.gz.enc and its
 * <name>.json (the IV and GCM tag, known only once the upload ended).
 * Old ones go by the bucket's own lifecycle rule (e.g. delete after 30 days).
 */

const PREFIX = "warden-self";

function target(): StorageTarget {
  const t = {
    endpoint: process.env.BACKUP_S3_ENDPOINT ?? "",
    bucket: process.env.BACKUP_S3_BUCKET ?? "",
    accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY ?? "",
  };
  if (!t.endpoint || !t.bucket || !t.accessKeyId || !t.secretAccessKey) throw new Error("Set the BACKUP_S3_* settings in .env first");
  return t;
}

function key(): Buffer {
  const hex = process.env.MASTER_KEY ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("MASTER_KEY must be 64 hex characters");
  return Buffer.from(hex, "hex");
}

async function backup() {
  const t = target();
  const name = new Date().toISOString().replace(/[:.]/g, "-");
  const sealer = encryptStream(key());
  let bytes = 0;
  process.stdin.on("data", (d: Buffer) => (bytes += d.length));
  await uploadStream(t, `${PREFIX}/${name}.sql.gz.enc`, process.stdin.pipe(sealer.stream));
  if (bytes === 0) throw new Error("Nothing came in on stdin: did pg_dump fail?");
  const meta = JSON.stringify({ iv: sealer.iv, authTag: sealer.authTag(), bytes, createdAt: new Date().toISOString() });
  await uploadStream(t, `${PREFIX}/${name}.json`, Readable.from([meta]));
  process.stdout.write(`${name}\n`);
}

async function restore(name: string) {
  if (!/^[0-9TZ-]+$/.test(name)) throw new Error("Give the backup's name, as backup printed it (e.g. 2026-11-01T02-00-00-000Z)");
  const t = target();
  const meta = JSON.parse(await text(await downloadStream(t, `${PREFIX}/${name}.json`))) as { iv: string; authTag: string };
  const body = await downloadStream(t, `${PREFIX}/${name}.sql.gz.enc`);
  // A tampered or wrong-key file fails at the very end: restore.sh decrypts to a file first, then loads it.
  body.pipe(decryptStream(key(), meta.iv, meta.authTag)).on("error", (e) => {
    process.stderr.write(`Couldn't decrypt: ${e.message}\n`);
    process.exit(1);
  }).pipe(process.stdout);
}

async function text(r: Readable): Promise<string> {
  const parts: Buffer[] = [];
  for await (const c of r) parts.push(c as Buffer);
  return Buffer.concat(parts).toString("utf8");
}

const [cmd, arg] = process.argv.slice(2);
(cmd === "backup" ? backup() : cmd === "restore" && arg ? restore(arg) : Promise.reject(new Error("Usage: self-backup.js backup | restore <name>"))).catch((e: Error) => {
  process.stderr.write(`${e.message}\n`);
  process.exit(1);
});
