import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from 'db';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { GENERIC_MESSAGES, AUTH_MESSAGES } from '../constants/messages.config';
import type { AuthenticatedRequest } from '../types/request';

/**
 * Second gate after SessionGuard: "is this logged-in user ALLOWED here?"
 * Reads the role list @Roles() attached to the route and compares it with
 * req.session.role. Must run after SessionGuard — order in @UseGuards matters.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  // Reflector is built into Nest: it reads metadata that decorators attached.
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. What does this route require? Method-level @Roles wins over class-level.
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 2. No @Roles on the route → any logged-in user may pass.
    if (!required || required.length === 0) return true;

    // 3. SessionGuard should have run first. If not, fail closed.
    const { session } = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    if (!session) {
      throw new UnauthorizedException(AUTH_MESSAGES.unauthenticated);
    }

    // 4. Known user, wrong role → 403, not 401.
    if (!required.includes(session.role)) {
      throw new ForbiddenException(GENERIC_MESSAGES.forbidden);
    }

    return true;
  }
}
