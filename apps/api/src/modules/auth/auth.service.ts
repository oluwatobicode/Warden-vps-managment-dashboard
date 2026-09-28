import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { SessionService } from './session/session.service';
import { randomToken, sha256 } from '../../common/utils/token.util';
import {
  REDIS_KEY,
  TTL_SECONDS,
} from '../../common/constants/constants.config';
import { AUTH_MESSAGES } from '../../common/constants/messages.config';

/** What we store under `warden:magic:{hash}` between "send link" and "click link". */
interface MagicLinkRecord {
  email: string;
}

/** What we store under `warden:pending:{id}` between "link clicked" and "onboarding done". */
export interface PendingSignupRecord {
  email: string;
  provider: 'EMAIL' | 'GITHUB' | 'GOOGLE';
}

/**
 * What verifyMagicLink hands back to the controller. Internal to the API —
 * the tokens and pendingId become cookies and never reach the response body.
 * (shared-types' AuthOutcome is the public shape, without them.)
 */
export type VerifyOutcome =
  | {
      status: 'authenticated';
      tokens: { accessToken: string; refreshToken: string };
    }
  | { status: 'onboarding'; provider: 'EMAIL'; pendingId: string };

@Injectable()
export class AuthService {
  private readonly appUrl: string;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly sessions: SessionService,
    config: ConfigService,
  ) {
    this.appUrl = config.getOrThrow<string>('APP_URL');
  }

  /**
   * Route 1: POST /auth/magic-link
   * Always succeeds from the caller's point of view — the controller returns the
   * same message whether or not this email has an account, so nothing leaks.
   */
  async requestMagicLink(email: string): Promise<void> {
    const raw = randomToken(); // goes in the email only
    const record: MagicLinkRecord = { email };

    // Store the HASH, single-use later via GETDEL in verify.
    await this.redis.set(
      REDIS_KEY.magicLink(sha256(raw)),
      JSON.stringify(record),
      'EX',
      TTL_SECONDS.magicLink,
    );

    const url = `${this.appUrl}/auth/verify?token=${raw}`;
    await this.mail.sendMagicLink(email, url);
  }

  /**
   * Route 2: GET /auth/verify?token=...
   * The click. Decides between "log in" (user exists) and "start signup" (new email).
   */
  async verifyMagicLink(token: string): Promise<VerifyOutcome> {
    // 1. Spend the token. GETDEL = read + delete in one step, so a link works once.
    const json = await this.redis.getdel(REDIS_KEY.magicLink(sha256(token)));
    if (!json) {
      // Expired, never existed, or already clicked. Same answer for all three.
      throw new UnauthorizedException(AUTH_MESSAGES.magic_link_invalid);
    }
    const { email } = JSON.parse(json) as MagicLinkRecord;

    // 2. Does this email already have an account?
    const user = await this.prisma.client.user.findUnique({
      where: { email },
      include: { memberships: true }, // Phase 1: exactly one membership per user
    });

    // 3. Existing user → this was a login. Mint a session and we're done.
    if (user) {
      const membership = user.memberships[0];
      const tokens = await this.sessions.create(
        user.id,
        membership.organizationId,
        membership.role,
      );
      return { status: 'authenticated', tokens };
    }

    // 4. New email → park the verified email in Redis until onboarding completes.
    //    No User row yet, so an abandoned signup leaves nothing behind.
    const pendingId = randomToken();
    const pending: PendingSignupRecord = { email, provider: 'EMAIL' };
    await this.redis.set(
      REDIS_KEY.pendingSignup(pendingId),
      JSON.stringify(pending),
      'EX',
      TTL_SECONDS.pendingSignup,
    );
    return { status: 'onboarding', provider: 'EMAIL', pendingId };
  }
}
