import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../redis/redis.service';
import { randomToken, sha256 } from '../../../common/utils/token.util';
import {
  REDIS_KEY,
  TTL_SECONDS,
} from '../../../common/constants/constants.config';

/**
 * What we store under `warden:refresh:{hash}`.
 * Kept tiny on purpose — just enough to find the session. Role, email, etc.
 * live in the session record, never duplicated here.
 */
export interface RefreshRecord {
  sid: string;
  userId: string;
}

/**
 * Owns the REFRESH token (opaque random string, NOT a JWT).
 *
 * One Redis key family: `warden:refresh:{sha256(rawToken)}`.
 * Two jobs: hand a token out (issue), and accept it back exactly once (consume).
 *
 * This service is deliberately "dumb": it doesn't decide what a missing token
 * means. SessionService.refreshToken makes that call.
 */
@Injectable()
export class RefreshTokenService {
  constructor(private readonly redis: RedisService) {}

  /**
   * Create a refresh token for a session.
   * Returns the RAW token (that goes in the cookie). Only its SHA-256 is
   * stored, so a Redis dump cannot be replayed as a login.
   */
  async issue(sid: string, userId: string): Promise<string> {
    const raw = randomToken(); // 32 random bytes, base64url
    const record: RefreshRecord = { sid, userId };
    await this.redis.set(
      REDIS_KEY.refresh(sha256(raw)), // key = hash, never the raw value
      JSON.stringify(record),
      'EX',
      TTL_SECONDS.refresh, // 7 days
    );

    return raw;
  }

  /**
   * Spend a refresh token. GETDEL reads and deletes atomically, so the same
   * token can only ever succeed ONCE — a second presentation (replay, or two
   * racing requests) gets null. This is what makes rotation safe.
   */
  async consume(raw: string): Promise<RefreshRecord | null> {
    const json = await this.redis.getdel(REDIS_KEY.refresh(sha256(raw)));
    return json ? (JSON.parse(json) as RefreshRecord) : null;
  }

  /** Explicit revoke, used by logout. */
  async revoke(raw: string): Promise<void> {
    await this.redis.del(REDIS_KEY.refresh(sha256(raw)));
  }
}
