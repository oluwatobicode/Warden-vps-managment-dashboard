import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { COOKIE, REDIS_KEY } from '../constants/constants.config';
import { SIGNUP_MESSAGES } from '../constants/messages.config';
import type { AuthenticatedRequest } from '../types/request';
import type { PendingSignupRecord } from '../../modules/auth/auth.service';

/**
 * Protects POST /auth/onboarding. Same shape as SessionGuard, one hop shorter:
 * there's no JWT, just the pending cookie pointing at a Redis record.
 */
@Injectable()
export class OnboardingGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // 1. The cookie set by route 2. Path-scoped to /auth/onboarding, so it only
    //    ever arrives here.
    const pendingId = req.cookies?.[COOKIE.pending];
    if (!pendingId) {
      throw new UnauthorizedException(SIGNUP_MESSAGES.onboarding_required);
    }

    // 2. Plain GET, not GETDEL: the record must survive a failed attempt
    //    (validation error, org email taken) so the user can retry. The service
    //    deletes it only after the transaction commits.
    const json = await this.redis.get(REDIS_KEY.pendingSignup(pendingId));
    if (!json) {
      throw new UnauthorizedException(SIGNUP_MESSAGES.onboarding_expired);
    }

    // 3. Hand both to the controller: the record for the data, the id so the
    //    service can delete the key when done.
    req.pending = JSON.parse(json) as PendingSignupRecord;
    req.pendingId = pendingId;
    return true;
  }
}
