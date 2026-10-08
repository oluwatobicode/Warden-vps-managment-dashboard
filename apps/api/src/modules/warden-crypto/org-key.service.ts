import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { KeyProvider } from 'warden-crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ORGANIZATION_MESSAGES } from '../../common/constants/messages.config';
import { KEY_PROVIDER } from '../../common/constants/warden-crypto.constants';

/**
 * The "front desk clerk" for per-org data keys (DEKs).
 *
 * Anything in Warden that needs to encrypt or decrypt an org's secrets — SSH
 * private keys, environment variables — calls `getDek(orgId)` and gets the
 * raw 32 bytes back. Nothing else in the api ever touches wrapping, the master
 * key, or which KeyProvider is behind it.
 *
 * Flow on each call:
 *   1. already unwrapped in this process?  → return it from memory
 *   2. otherwise read the WRAPPED key from Postgres
 *   3. ask the KeyProvider to unwrap it    → with Vault this is a network call
 *   4. remember it, return it
 *
 * Nest builds ONE instance of this service for the whole app, so there is one
 * shared memory of unwrapped keys: one unwrap per org per process start.
 */
@Injectable()
export class OrgKeyService {
  /**
   * orgId → that org's unwrapped DEK, for the lifetime of this process.
   * Lost on restart (the first request after restart just unwraps again).
   * When DEK rotation is built, the rotate method MUST delete the org's entry
   * here, or this process keeps using the old key until it restarts.
   */
  private readonly unwrappedDeks = new Map<string, Buffer>();

  constructor(
    private readonly prisma: PrismaService,
    // KeyProvider is an interface, which doesn't exist at runtime, so Nest
    // can't find it by type. The KEY_PROVIDER symbol is the name it's
    // registered under in WardenCryptoModule's factory.
    @Inject(KEY_PROVIDER) private readonly keys: KeyProvider,
  ) {}

  /**
   * The raw 32-byte DEK for an org. `orgId` must come from the session (the
   * caller's tenancy rule), so a plain lookup by id is correct here.
   */
  async getDek(orgId: string): Promise<Buffer> {
    // 1. Already unwrapped this process → no DB read, no provider call.
    //    `!` is safe: `has` just proved the entry exists, TypeScript can't see that.
    if (this.unwrappedDeks.has(orgId)) {
      return this.unwrappedDeks.get(orgId)!;
    }

    // 2. Read ONLY the wrapped key — not the org's name, email, anything else.
    const row = await this.prisma.client.organization.findUnique({
      where: { id: orgId },
      select: { dataKeyWrapped: true },
    });

    // Only happens if the org was deleted while a session for it still existed.
    if (!row) throw new NotFoundException(ORGANIZATION_MESSAGES.not_found);

    // 3. Unwrap. No `!` on dataKeyWrapped: the column is required, so if it
    //    ever becomes nullable again TypeScript should complain right here.
    const dek = await this.keys.unwrapDek(row.dataKeyWrapped);

    // 4. Remember it for every later call in this process, then hand it back.
    this.unwrappedDeks.set(orgId, dek);
    return dek;
  }
}
