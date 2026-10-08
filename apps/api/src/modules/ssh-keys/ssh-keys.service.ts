import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgKeyService } from '../warden-crypto/org-key.service';
import { encrypt } from 'warden-crypto';

@Injectable()
export class SshKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organization: OrgKeyService,
  ) {}
}
