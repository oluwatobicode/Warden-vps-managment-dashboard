import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '../../modules/auth/session/token.service';
import { SessionService } from '../../modules/auth/session/session.service';
import type { AuthenticatedRequest } from '../types/request';
import { AUTH_MESSAGES } from '../constants/messages.config';
import { COOKIE } from '../constants/constants.config';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
  ) {}

  // Nest calls this before the controller method. Return true = let it through.
  // Throw = stop here, Nest sends the exception's status (401 for Unauthorized).
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = req.cookies?.[COOKIE.access];

    if (!token) {
      throw new UnauthorizedException(AUTH_MESSAGES.unauthenticated);
    }

    let claims;

    try {
      claims = await this.tokens.verifyAccess(token);
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException(AUTH_MESSAGES.session_expired);
    }

    const record = await this.sessions.get(claims.sid);

    if (!record) {
      throw new UnauthorizedException(AUTH_MESSAGES.session_expired);
    }

    req.session = record;
    req.sid = claims.sid;

    void this.sessions.touch(claims.sid, record);

    return true;
  }
}
