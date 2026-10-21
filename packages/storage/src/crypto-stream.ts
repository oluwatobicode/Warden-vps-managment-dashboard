import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Transform } from "node:stream";

/*
 * Streaming AES-256-GCM, with the org's 32-byte data key (the same key that
 * protects variables and SSH keys). GCM's tag is only known, and only
 * checked, at the very END of the stream: so a restore must decrypt to a
 * temporary file first, and only use it once `final` has passed.
 */

export interface Sealer {
  /** Pipe the plain dump through this; read the encrypted bytes out. */
  stream: Transform;
  /** Base64. Store it with the backup. */
  iv: string;
  /** Base64. Only valid after the stream has ended. */
  authTag: () => string;
}

export function encryptStream(dek: Buffer): Sealer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dek, iv);
  return { stream: cipher, iv: iv.toString("base64"), authTag: () => cipher.getAuthTag().toString("base64") };
}

/**
 * The reverse. If even one byte was changed (or the wrong key/iv/tag is
 * given), the stream errors at the end instead of finishing.
 */
export function decryptStream(dek: Buffer, iv: string, authTag: string): Transform {
  const decipher = createDecipheriv("aes-256-gcm", dek, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return decipher;
}
