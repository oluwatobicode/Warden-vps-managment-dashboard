import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DekCache, type KeyProvider } from 'warden-crypto';
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
 * The caching and unwrapping is `DekCache` from warden-crypto, the same code
 * the worker uses. This service only adds where the wrapped key comes from
 * (Postgres) and what a missing org means here (404).
 *
 * Nest builds ONE instance of this service for the whole app, so there is one
 * shared memory of unwrapped keys: one unwrap per org per process start.
 */
@Injectable()
export class OrgKeyService {
  private readonly deks: DekCache;

  constructor(
    private readonly prisma: PrismaService,
    // KeyProvider is an interface, which doesn't exist at runtime, so Nest
    // can't find it by type. The KEY_PROVIDER symbol is the name it's
    // registered under in WardenCryptoModule's factory.
    @Inject(KEY_PROVIDER) keys: KeyProvider,
  ) {
    this.deks = new DekCache(keys, (orgId) => this.loadWrapped(orgId));
  }

  /**
   * The raw 32-byte DEK for an org. `orgId` must come from the session (the
   * caller's tenancy rule), so a plain lookup by id is correct here.
   */
  getDek(orgId: string): Promise<Buffer> {
    return this.deks.get(orgId);
  }

  // Read ONLY the wrapped key — not the org's name, email, anything else.
  private async loadWrapped(orgId: string): Promise<string> {
    const row = await this.prisma.client.organization.findUnique({
      where: { id: orgId },
      select: { dataKeyWrapped: true },
    });
    // Only happens if the org was deleted while a session for it still existed.
    if (!row) throw new NotFoundException(ORGANIZATION_MESSAGES.not_found);
    return row.dataKeyWrapped;
  }
}
