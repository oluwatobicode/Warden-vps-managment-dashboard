import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { utils } from "ssh2";

/**
 * SSH key handling for Warden. Everything here produces or reads the exact
 * text formats OpenSSH uses, so a key made by Warden works with a stock
 * `authorized_keys`, and a key made by `ssh-keygen` works in Warden.
 *
 *   public key   "ssh-ed25519 AAAAC3Nz...base64... comment"   ← one line, goes on the server
 *   private key  "-----BEGIN OPENSSH PRIVATE KEY----- ..."    ← stays in Warden, encrypted
 *   fingerprint  "SHA256:WC5W4y5t..."                         ← what `ssh-keygen -l` prints
 */

export type KeyPair = {
  publicKey: string; // the authorized_keys line
  privateKey: string; // the OpenSSH PEM block
};

export type ParsedPrivateKey = {
  publicKey: string; // derived from the private key — the user never pastes it
  type: string; // e.g. "ssh-ed25519"
};

/**
 * Make a brand-new key pair. Ed25519 because it's the modern default: short,
 * fast, and there's no key size to get wrong (unlike RSA).
 */
export function generateKeyPair(comment: string): KeyPair {
  // ssh2 signals failure by RETURNING an Error, not throwing one.
  const keys = utils.generateKeyPairSync("ed25519", { comment });
  if (keys instanceof Error) throw keys;

  return {
    publicKey: keys.public.trim(),
    privateKey: keys.private,
  };
}

/**
 * Validate a private key the user pasted, and derive its public half from it.
 * Throws a readable Error for anything Warden can't use unattended.
 */
export function parsePrivateKey(text: string): ParsedPrivateKey {
  const parsed = utils.parseKey(text.trim());

  // Garbage text, AND passphrase-protected keys (ssh2 returns
  // "Encrypted private OpenSSH key detected, but no passphrase given").
  // Warden connects with no human present, so it can't type a passphrase.
  if (parsed instanceof Error) {
    throw new Error(`Invalid private key: ${parsed.message}`);
  }

  // A file can hold several keys, in which case ssh2 returns an array.
  // Accept exactly one — guessing which one the user meant is worse than refusing.
  if (Array.isArray(parsed)) {
    if (parsed.length !== 1) throw new Error("Paste exactly one private key");
  }
  const key = Array.isArray(parsed) ? parsed[0] : parsed;

  // parseKey also accepts PUBLIC keys. Someone pasting the .pub file by mistake
  // would otherwise be saved, and only fail later at connect time.
  if (!key.isPrivateKey()) {
    throw new Error("That is a public key — paste the private key instead");
  }

  return {
    // getPublicSSH() is the raw key BYTES (a Buffer), not the text line.
    // The authorized_keys format is "<type> <base64 of those bytes>".
    publicKey: `${key.type} ${key.getPublicSSH().toString("base64")}`,
    type: key.type,
  };
}

/**
 * The SHA-256 fingerprint, identical to `ssh-keygen -lf key.pub`.
 * Lets a user check that the key in Warden is the one on their server.
 */
export function fingerprint(publicKey: string): string {
  // A public key line is always "<type> <base64> [comment]", so the key is part [1].
  // (No special-casing on the type prefix: that misreads sk-ssh-ed25519 and friends.)
  const b64 = publicKey.trim().split(/\s+/)[1];
  if (!b64) throw new Error("Malformed SSH public key");

  const digest = createHash("sha256")
    .update(Buffer.from(b64, "base64")) // hash the decoded BYTES, not the base64 text
    .digest("base64");

  // OpenSSH prints the hash without base64's "=" padding.
  // `$` = end of string. (`\$` would mean a literal dollar sign and never match.)
  return `SHA256:${digest.replace(/=+$/, "")}`;
}
