import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { API_TOKEN_MESSAGES } from '../constants/messages.config';
import { API_TOKEN } from '../constants/constants.config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedRequest } from '../types/request';
import { sha256 } from '../utils/token.util';

const SCOPE_TO_ROLE = {
  READ: 'VIEWER',
  DEPLOY: 'DEVELOPER',
  ADMIN: 'ADMIN',
} as const;

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const header = req.headers.authorization ?? '';
    const [kind, raw] = header.split(' ');
    if (kind !== 'Bearer' || !raw?.startsWith(API_TOKEN.prefix)) {
      throw new UnauthorizedException(API_TOKEN_MESSAGES.invalid);
    }

    const token = await this.prisma.client.apiToken.findUnique({
      where: { tokenHash: sha256(raw) },
    });
    if (!token) throw new UnauthorizedException(API_TOKEN_MESSAGES.invalid);

    if (token.expiresAt && token.expiresAt < new Date()) {
      throw new UnauthorizedException(API_TOKEN_MESSAGES.expired);
    }

    req.session = {
      userId: `token:${token.id}`,
      organizationId: token.organizationId,
      role: SCOPE_TO_ROLE[token.apiTokenScope],
      createdAt: token.createdAt.getTime(),
      lastSeenAt: Date.now(),
    };

    req.apiTokenId = token.id;

    void this.prisma.client.apiToken
      .update({
        where: { id: token.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    return true;
  }
}
