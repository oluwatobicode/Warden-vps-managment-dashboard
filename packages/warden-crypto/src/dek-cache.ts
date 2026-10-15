import type { Buffer } from "node:buffer";
import type { KeyProvider } from "./key-provider";

/**
 * Per-org data keys (DEKs), unwrapped once and then kept in memory.
 *
 * Shared by every process that decrypts org secrets (api and worker), so the
 * unwrap logic lives in one place. It knows nothing about the database:
 * `loadWrapped` fetches an org's wrapped key and throws whatever "not found"
 * error suits the caller (an HTTP 404 in the api, a plain Error in the worker).
 *
 * Flow on each `get`:
 *   1. already unwrapped in this process?  → return it from memory
 *   2. otherwise load the WRAPPED key      → `loadWrapped(orgId)`
 *   3. ask the KeyProvider to unwrap it    → with Vault this is a network call
 *   4. remember it, return it
 *
 * Unwrapped keys live for the lifetime of the process. When DEK rotation is
 * built, the rotate step MUST call `forget(orgId)`, or this process keeps
 * using the old key until it restarts.
 */
export class DekCache {
  private readonly unwrapped = new Map<string, Buffer>();

  constructor(
    private readonly provider: KeyProvider,
    private readonly loadWrapped: (orgId: string) => Promise<string>,
  ) {}

  async get(orgId: string): Promise<Buffer> {
    const hit = this.unwrapped.get(orgId);
    if (hit) return hit;
    const dek = await this.provider.unwrapDek(await this.loadWrapped(orgId));
    this.unwrapped.set(orgId, dek);
    return dek;
  }

  forget(orgId: string): void {
    this.unwrapped.delete(orgId);
  }
}
