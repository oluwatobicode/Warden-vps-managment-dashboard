import { Buffer } from "node:buffer";
import { decrypt, encrypt, generateKey, keyFromHex } from "./aes";
import type { KeyProvider } from "./key-provider";

/**
 * The manager who keeps the master key "in their pocket": MASTER_KEY from env.
 * Used in development, in tests, and by self-hosters who don't run Vault.
 *
 * No new crypto here — wrapping a DEK is just encrypting it with the master
 * key using the same AES-GCM util, so wrapped DEKs share the v1.iv.ct.tag format.
 *
 * The master key is passed IN, never read from process.env: packages don't
 * read config, apps do. That's also what makes this testable.
 */
export class EnvKeyProvider implements KeyProvider {
  private readonly masterKey: Buffer; // the pocket
  private readonly version: string;

  constructor(opts: { masterKeyHex: string; version?: string }) {
    this.masterKey = keyFromHex(opts.masterKeyHex); // 64 hex chars → 32 bytes, length-checked
    this.version = opts.version ?? "v1";
  }

  async generateWrappedDek(): Promise<{ wrapped: string; dek: Buffer }> {
    const dek = generateKey(); // the per-org safe code: 32 random bytes
    // encrypt() takes text, the DEK is bytes → base64url it first.
    const wrapped = encrypt(dek.toString("base64url"), this.masterKey, this.version);
    return { wrapped, dek };
  }

  async unwrapDek(wrapped: string): Promise<Buffer> {
    // Exact reverse of the above: decrypt to text, then text back to bytes.
    const text = decrypt(wrapped, { [this.version]: this.masterKey });
    return Buffer.from(text, "base64url");
  }
}
