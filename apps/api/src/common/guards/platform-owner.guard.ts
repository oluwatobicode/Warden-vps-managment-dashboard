import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest } from '../types/request';

/**
 * The platform owner's routes (/platform). Runs after SessionGuard and reads
 * User.platformRole from Postgres on EVERY request, never from the session,
 * so clearing it by hand takes effect on the next call. That value is set by
 * hand in the database only: no code writes it.
 *
 * Anyone else gets a 404, so the routes don't show they exist. API tokens
 * never count: SessionGuard only reads the cookie, and a request that carries
 * an Authorization header at all is refused here too, even beside the
 * owner's cookie, so a token can never be part of a 200.
 */
@Injectable()
export class PlatformOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const notFound = new NotFoundException(`Cannot ${req.method} ${req.originalUrl}`);
    const userId = req.session?.userId;
    if (!userId || req.headers.authorization) throw notFound;

    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { platformRole: true },
    });
    if (user?.platformRole !== 'OWNER') throw notFound;
    return true;
  }
}
