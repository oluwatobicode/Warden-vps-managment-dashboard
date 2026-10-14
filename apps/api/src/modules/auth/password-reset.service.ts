import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { SessionService } from './session/session.service';
import { sha256 } from '../../common/utils/token.util';
import { hashPassword } from '../../common/utils/password.util';
import {
  PASSWORD_RESET,
  REDIS_KEY,
  TTL_SECONDS,
} from '../../common/constants/constants.config';
import { AUTH_MESSAGES } from '../../common/constants/messages.config';

/** What we store under `warden:pwreset:{email}`. Only the code's hash. */
interface PasswordResetRecord {
  userId: string;
  codeHash: string;
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * POST /auth/forgot-password. Returns the same way whatever happens, so the
   * response never reveals whether the email has an account.
   */
  async request(email: string): Promise<void> {
    // Per-email cap. The IP throttle can't stop one inbox being flooded from
    // many IPs. Over the cap: say nothing, send nothing.
    const sent = await this.countInWindow(
      REDIS_KEY.passwordResetRequests(email),
      TTL_SECONDS.passwordResetRequests,
    );
    if (sent > PASSWORD_RESET.maxRequestsPerWindow) return;

    const user = await this.prisma.client.user.findUnique({
      where: { email },
      select: { id: true, passwordHashed: true },
    });
    // No account, or a GitHub-only account with no password. Giving OAuth
    // users a password is still an open decision (CLAUDE.md), and a reset
    // here would quietly make it, so they get no code.
    if (!user?.passwordHashed) return;

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const record: PasswordResetRecord = {
      userId: user.id,
      codeHash: sha256(code),
    };
    // A new code replaces the old one and gets a fresh set of attempts.
    await this.redis
      .multi()
      .set(
        REDIS_KEY.passwordReset(email),
        JSON.stringify(record),
        'EX',
        TTL_SECONDS.passwordReset,
      )
      .del(REDIS_KEY.passwordResetAttempts(email))
      .exec();

    // Not awaited on purpose: sending takes ~200ms, and only happens when the
    // account exists, so waiting would leak that through response time.
    void this.mail
      .sendPasswordResetCode({
        email,
        code,
        expiresMinutes: TTL_SECONDS.passwordReset / 60,
      })
      .catch((e: Error) =>
        this.logger.warn(`reset code email failed: ${e.message}`),
      );
  }

  /**
   * POST /auth/reset-password. One error message for every failure (no code,
   * wrong code, expired, used up), so nothing can be learned from it.
   */
  async reset(email: string, code: string, newPassword: string): Promise<void> {
    const key = REDIS_KEY.passwordReset(email);
    const attemptsKey = REDIS_KEY.passwordResetAttempts(email);
    const invalid = new BadRequestException(AUTH_MESSAGES.reset_code_invalid);

    const json = await this.redis.get(key);
    if (!json) throw invalid;
    const record = JSON.parse(json) as PasswordResetRecord;

    // Count the attempt BEFORE comparing. Twenty parallel guesses each get
    // their own number from INCR, so at most maxAttempts are ever compared.
    const attempts = await this.countInWindow(
      attemptsKey,
      TTL_SECONDS.passwordReset,
    );
    if (attempts > PASSWORD_RESET.maxAttempts) {
      await this.redis.del(key, attemptsKey);
      throw invalid;
    }
    if (!sameHash(sha256(code), record.codeHash)) throw invalid;

    // Single use: whichever request deletes the key wins.
    if ((await this.redis.del(key)) === 0) throw invalid;
    await this.redis.del(attemptsKey);

    await this.prisma.client.user.update({
      where: { id: record.userId },
      data: { passwordHashed: await hashPassword(newPassword) },
    });
    // Anyone who knew the old password is logged out everywhere.
    await this.sessions.destroyAll(record.userId);
  }

  private async countInWindow(
    key: string,
    ttlSeconds: number,
  ): Promise<number> {
    const results = await this.redis
      .multi()
      .set(key, '0', 'EX', ttlSeconds, 'NX')
      .incr(key)
      .exec();
    return Number(results?.[1]?.[1] ?? 0);
  }
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}
