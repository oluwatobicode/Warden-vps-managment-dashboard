import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TOKEN_ALLOWED_KEY } from '../decorators/token-allowed.decorator';
import { API_TOKEN_MESSAGES } from '../constants/messages.config';
import type { AuthenticatedRequest } from '../types/request';
import { ApiTokenGuard } from './api-token.guard';
import { SessionGuard } from './session.guard';

/**
 * A browser cookie OR an API token. A `Bearer` header means a token, and only
 * routes marked @TokenAllowed() take one: a leaked CI token can deploy, but
 * never create tokens, delete servers or change roles. Without the header it
 * is exactly SessionGuard. RolesGuard runs after, either way.
 */
@Injectable()
export class SessionOrTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly session: SessionGuard,
    private readonly token: ApiTokenGuard,
  ) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      return this.session.canActivate(context);
    }
    const allowed = this.reflector.getAllAndOverride<boolean | undefined>(
      TOKEN_ALLOWED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowed) {
      throw new UnauthorizedException(API_TOKEN_MESSAGES.route_not_allowed);
    }
    return this.token.canActivate(context);
  }
}
