import type { Buffer } from "node:buffer";

/**
 * The job description every "manager" must fulfil: wrap a per-org data key
 * (DEK) with a master key (KEK), and unwrap it again. WHERE the master key
 * lives is the only thing that differs between implementations:
 *   - EnvKeyProvider   → master key in an env var, wrapping done in-process
 *   - VaultKeyProvider → master key inside Vault, which does the wrapping
 * The rest of Warden only ever talks to this interface.
 *
 * Methods return Promises even when an implementation answers instantly,
 * because a remote KMS genuinely has to wait on the network.
 */
export interface KeyProvider {
  /** New org: mint a fresh 32-byte DEK. `wrapped` goes in Postgres; `dek` is used now. */
  generateWrappedDek(): Promise<{ wrapped: string; dek: Buffer }>;

  /** Later: turn the stored wrapped DEK back into its 32 bytes. */
  unwrapDek(wrapped: string): Promise<Buffer>;
}
