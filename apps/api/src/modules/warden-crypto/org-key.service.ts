import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { type KeyProvider } from 'warden-crypto';
import { API_TOKEN } from '../../common/constants/constants.config';
import { KEY_PROVIDER } from '../../common/constants/warden-crypto.constants';

@Injectable()
export class OrgKeyService {
  private cache = new Map<string, Buffer>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(KEY_PROVIDER) private readonly keys: KeyProvider,
  ) {}

  async getDek(orgId: string): Promise<Buffer> {
    // 1. Check local memory cache
    if (this.cache.has(orgId)) {
      return this.cache.get(orgId)!;
    }

    // 2. Fetch only the required wrapped key from the database
    const row = await this.prisma.client.organization.findUnique({
      where: { id: orgId },
      select: { dataKeyWrapped: true },
    });

    // 3. Handle missing organization
    if (!row) {
      throw new NotFoundException(`Organization with ID "${orgId}" not found.`);
    }

    // 4. Unwrap the DEK using the injected key provider
    const dek = await this.keys.unwrapDek(row.dataKeyWrapped!);

    // 5. Cache and return the unwrapped buffer
    this.cache.set(orgId, dek);
    return dek;
  }
}
