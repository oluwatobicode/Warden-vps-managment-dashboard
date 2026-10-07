import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // GCM's standard nonce size
const KEY_BYTES = 32; // AES-256
const TAG_BYTES = 16; // full GCM tag — never accept a shorter one
export type KeyRing = Record<string, Buffer>; // { v1: <32 bytes>, v2: <32 bytes> }

/**
 * Encrypts a plaintext string into a versioned, dot-separated base64url payload.
 */
export function encrypt(plain: string, key: Buffer, version: string): string {
  // 1. Guard against wrong-sized key
  if (key.length !== KEY_BYTES) {
    throw new Error("key must be 32 bytes");
  }

  // 2. Generate a fresh initialization vector
  const iv = randomBytes(IV_BYTES);

  // 3. Encrypt the plaintext string
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf-8"), cipher.final()]);

  // 4. Extract the integrity proof tag
  const tag = cipher.getAuthTag();

  // 5. Package as a base64url dot-separated string
  // `version` is plain text ("v1"); only the three binary parts get base64url.
  const b64 = (buf: Buffer) => buf.toString("base64url");
  return [version, b64(iv), b64(ct), b64(tag)].join(".");
}

/**
 * Decrypts a dot-separated payload using a collection of rotation keys.
 */
export function decrypt(stored: string, keys: KeyRing): string {
  // 1. Structural check
  // Exactly four parts. The ciphertext part MAY be empty — encrypting "" is
  // legal and yields zero bytes — so check its presence, not its truthiness.
  const parts = stored.split(".");
  if (parts.length !== 4) throw new Error("malformed ciphertext");
  const [version, ivB64, ctB64, tagB64] = parts;
  if (!version || !ivB64 || !tagB64) throw new Error("malformed ciphertext");

  // 2. Find matching key version
  const key = keys[version];
  if (!key) {
    throw new Error("Unknown key version " + version);
  }

  // 3. Decode payload parts back into buffers
  const decodedIv = Buffer.from(ivB64, "base64url");
  const decodedCt = Buffer.from(ctB64, "base64url");
  const decodedTag = Buffer.from(tagB64, "base64url");
  // Node will happily verify a TRUNCATED tag (1 byte = 1-in-256 forgery odds).
  // Demand the full 16 bytes and the full 12-byte IV.
  if (decodedIv.length !== IV_BYTES || decodedTag.length !== TAG_BYTES) {
    throw new Error("malformed ciphertext");
  }

  // 4. Prepare decipher and append auth tag prior to updating data
  const decipher = createDecipheriv(ALGO, key, decodedIv, {
    authTagLength: TAG_BYTES,
  });
  decipher.setAuthTag(decodedTag);

  // 5. Decrypt and flush out data. Uncaught tag failures throw Node's default error.
  return Buffer.concat([decipher.update(decodedCt), decipher.final()]).toString(
    "utf-8",
  );
}

/**
 * Mint a brand new 32-byte key.
 */
export function generateKey(): Buffer {
  return randomBytes(KEY_BYTES);
}

/**
 * Reads a hex string (e.g. from env) into a Buffer with key-size validation.
 */
export function keyFromHex(hex: string): Buffer {
  const key = Buffer.from(hex, "hex");
  if (key.length !== KEY_BYTES) {
    throw new Error("Key extracted from hex must be exactly 32 bytes long");
  }
  return key;
}
