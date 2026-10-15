import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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

/** What we store under the code key. Only the code's hash. */
interface PasswordResetRecord {
  userId: string;
  codeHash: string;
}

/** Where one flow keeps its code, its guess counter and its "codes sent" counter. */
interface CodeKeys {
  code: string;
  attempts: string;
  requests: string;
}

const resetKeys = (email: string): CodeKeys => ({
  code: REDIS_KEY.passwordReset(email),
  attempts: REDIS_KEY.passwordResetAttempts(email),
  requests: REDIS_KEY.passwordResetRequests(email),
});
const setKeys = (userId: string): CodeKeys => ({
  code: REDIS_KEY.passwordSet(userId),
  attempts: REDIS_KEY.passwordSetAttempts(userId),
  requests: REDIS_KEY.passwordSetRequests(userId),
});

/**
 * Emailed 6-digit codes for two flows that share the same rules (10-minute
 * code, capped guesses, capped sends, single use):
 *   - forgot password (logged out): POST /auth/forgot-password + /auth/reset-password
 *   - add a first password (logged in, GitHub/Google users): /account/password/code + /set
 */
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
    const keys = resetKeys(email);
    // Per-email cap. The IP throttle can't stop one inbox being flooded from
    // many IPs. Over the cap: say nothing, send nothing.
    if (!(await this.underSendCap(keys))) return;

    const user = await this.prisma.client.user.findUnique({
      where: { email },
      select: { id: true, passwordHashed: true },
    });
    // No account, or a GitHub-only account with no password. Those add a
    // password from the account page while signed in, not from here.
    if (!user?.passwordHashed) return;

    const code = await this.issueCode(keys, user.id);
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
    const record = await this.consumeCode(resetKeys(email), code);
    await this.prisma.client.user.update({
      where: { id: record.userId },
      data: { passwordHashed: await hashPassword(newPassword) },
    });
    // Anyone who knew the old password is logged out everywhere.
    await this.sessions.destroyAll(record.userId);
  }

  /**
   * POST /account/password/code. A signed-in GitHub/Google user without a
   * password asks for a code at their own email. Being signed in isn't
   * enough on its own: whoever adds a password must also control the inbox.
   */
  async requestSetCode(userId: string): Promise<void> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { email: true, passwordHashed: true },
    });
    if (!user) throw new NotFoundException();
    if (user.passwordHashed) {
      throw new ConflictException(AUTH_MESSAGES.password_already_set);
    }
    const keys = setKeys(userId);
    // Signed in, so it's fine to say the cap was hit (nothing to leak).
    if (!(await this.underSendCap(keys))) {
      throw new HttpException(
        AUTH_MESSAGES.too_many_codes,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = await this.issueCode(keys, userId);
    await this.mail.sendPasswordResetCode({
      email: user.email,
      code,
      expiresMinutes: TTL_SECONDS.passwordReset / 60,
      purpose: 'set',
    });
  }

  /**
   * POST /account/password/set. Checks the code, sets the first password,
   * and signs out every OTHER session (this one stays signed in).
   */
  async setWithCode(
    userId: string,
    code: string,
    newPassword: string,
    keepSid: string,
  ): Promise<void> {
    const record = await this.consumeCode(setKeys(userId), code);
    if (record.userId !== userId) {
      throw new BadRequestException(AUTH_MESSAGES.reset_code_invalid);
    }
    // Only ever a FIRST password: `passwordHashed: null` in the where makes
    // the update a no-op if one was set in the meantime.
    const { count } = await this.prisma.client.user.updateMany({
      where: { id: userId, passwordHashed: null },
      data: { passwordHashed: await hashPassword(newPassword) },
    });
    if (count === 0) {
      throw new ConflictException(AUTH_MESSAGES.password_already_set);
    }
    await this.sessions.destroyOthers(userId, keepSid);
  }

  // ─── shared by both flows ────────────────────────────────────────────────

  /** A new code replaces the old one and gets a fresh set of attempts. */
  private async issueCode(keys: CodeKeys, userId: string): Promise<string> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const record: PasswordResetRecord = { userId, codeHash: sha256(code) };
    await this.redis
      .multi()
      .set(
        keys.code,
        JSON.stringify(record),
        'EX',
        TTL_SECONDS.passwordReset,
      )
      .del(keys.attempts)
      .exec();
    return code;
  }

  /** Check a code and use it up. Any failure is the same 400. */
  private async consumeCode(
    keys: CodeKeys,
    code: string,
  ): Promise<PasswordResetRecord> {
    const invalid = new BadRequestException(AUTH_MESSAGES.reset_code_invalid);
    const json = await this.redis.get(keys.code);
    if (!json) throw invalid;
    const record = JSON.parse(json) as PasswordResetRecord;

    // Count the attempt BEFORE comparing. Twenty parallel guesses each get
    // their own number from INCR, so at most maxAttempts are ever compared.
    const attempts = await this.countInWindow(
      keys.attempts,
      TTL_SECONDS.passwordReset,
    );
    if (attempts > PASSWORD_RESET.maxAttempts) {
      await this.redis.del(keys.code, keys.attempts);
      throw invalid;
    }
    if (!sameHash(sha256(code), record.codeHash)) throw invalid;

    // Single use: whichever request deletes the key wins.
    if ((await this.redis.del(keys.code)) === 0) throw invalid;
    await this.redis.del(keys.attempts);
    return record;
  }

  private async underSendCap(keys: CodeKeys): Promise<boolean> {
    const sent = await this.countInWindow(
      keys.requests,
      TTL_SECONDS.passwordResetRequests,
    );
    return sent <= PASSWORD_RESET.maxRequestsPerWindow;
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
