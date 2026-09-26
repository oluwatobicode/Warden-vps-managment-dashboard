import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Role } from 'db';
import { RedisService } from '../../../redis/redis.service';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { randomToken } from '../../../common/utils/token.util';
import {
  REDIS_KEY,
  SESSION_SLIDE_THRESHOLD_SECONDS,
  SESSION_TOUCH_INTERVAL_SECONDS,
  TTL_SECONDS,
} from '../../../common/constants/constants.config';
import { AUTH_MESSAGES } from '../../../common/constants/messages.config';

/**
 * What we store as JSON under `warden:session:{sid}`.
 * This is the SOURCE OF TRUTH for "is this user logged in, and as what".
 * The JWT only carries the sid that points here.
 */
export interface SessionRecord {
  userId: string;
  organizationId: string;
  role: Role; // read from here on every request, never from the JWT
  createdAt: number; // epoch ms
  lastSeenAt: number; // epoch ms — drives the sliding window in touch()
}

/**
 * Owns two Redis key families:
 *   `warden:session:{sid}`          → SessionRecord, 7-day sliding TTL
 *   `warden:user-sessions:{userId}` → SET of sids (for "log out everywhere")
 *
 * Every login path (magic link, password, OAuth) ends in create().
 * SessionGuard calls get() + touch() on every protected request.
 * The /auth/refresh route calls refreshToken().
 * Logout calls destroy() / destroyAll().
 *
 * This service never touches the HTTP response — it returns token strings
 * and the controller turns them into cookies.
 */
@Injectable()
export class SessionService {
  // All three are injected by Nest (see SessionModule.providers).
  constructor(
    private readonly redis: RedisService,
    private readonly tokens: TokenService,
    private readonly refresh: RefreshTokenService,
  ) {}

  /**
   * Log a user in: write the session, index it under the user, mint both tokens.
   */
  async create(
    userId: string,
    organizationId: string,
    role: Role,
  ): Promise<{ sid: string; accessToken: string; refreshToken: string }> {
    const sid = randomToken(); // session id = the Redis key AND the `sid` claim in the JWT

    const date = Date.now(); // one timestamp so createdAt === lastSeenAt exactly

    const record: SessionRecord = {
      userId,
      organizationId,
      role,
      createdAt: date,
      lastSeenAt: date,
    };

    // The session itself, with its 7-day TTL.
    await this.redis.set(
      REDIS_KEY.session(sid),
      JSON.stringify(record),
      'EX',
      TTL_SECONDS.session,
    );

    // Index: which sessions belong to this user. Needed by destroyAll().
    await this.redis.sadd(REDIS_KEY.userSessions(userId), sid);

    // Give the index the same TTL so it can't outlive its members forever.
    await this.redis.expire(
      REDIS_KEY.userSessions(userId),
      TTL_SECONDS.session,
    );

    // Opaque refresh token: hash stored in Redis, raw value returned for the cookie.
    const refreshToken = await this.refresh.issue(sid, userId);

    // Short-lived JWT pointing at this session. No role inside.
    const accessToken = await this.tokens.signAccess({
      sub: userId,
      sid,
      org: organizationId,
    });

    return {
      refreshToken,
      accessToken,
      sid,
    };
  }

  /** Load a session. null = logged out, expired, or never existed → 401 upstream. */
  async get(sid: string): Promise<SessionRecord | null> {
    const json = await this.redis.get(REDIS_KEY.session(sid));
    return json ? (JSON.parse(json) as SessionRecord) : null;
  }

  /**
   * Sliding window, cheaply.
   * Only rewrite the session when BOTH are true:
   *   - it's been > 1h since we last touched it (caps writes at ~1/hour/session)
   *   - the TTL has dropped below 6 days (otherwise there's nothing to extend)
   * SessionGuard calls this without awaiting, so it never slows a request.
   */
  async touch(sid: string, record: SessionRecord): Promise<void> {
    // Touched recently → skip. (*1000: lastSeenAt is ms, the constant is seconds)
    if (Date.now() - record.lastSeenAt < SESSION_TOUCH_INTERVAL_SECONDS * 1000)
      return;

    // Still has plenty of life → skip.
    const key = REDIS_KEY.session(sid);
    if ((await this.redis.ttl(key)) > SESSION_SLIDE_THRESHOLD_SECONDS) return;

    // Otherwise: stamp lastSeenAt and reset the TTL to a full 7 days.
    record.lastSeenAt = Date.now();
    await this.redis.set(
      key,
      JSON.stringify(record),
      'EX',
      TTL_SECONDS.session,
    );
  }

  /**
   * Rotate tokens. Called by POST /auth/refresh when the access token has expired.
   * Returns a NEW access + refresh pair; the presented refresh token is dead after this.
   */
  async refreshToken(
    rawRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // consume() is GETDEL: succeeds at most once per token.
    // null = garbage, expired, or a rotated token being replayed. Can't tell
    // which, so treat all as invalid.
    const rec = await this.refresh.consume(rawRefreshToken);
    if (!rec) {
      throw new UnauthorizedException(AUTH_MESSAGES.refresh_invalid);
    }

    // The session may have been logged out after this refresh token was issued.
    const session = await this.get(rec.sid);

    if (!session) {
      throw new UnauthorizedException(AUTH_MESSAGES.refresh_invalid);
    }

    // Rotate: the old refresh token is already gone (GETDEL in consume).
    const refreshToken = await this.refresh.issue(rec.sid, rec.userId);
    const accessToken = await this.tokens.signAccess({
      sub: session.userId,
      sid: rec.sid,
      org: session.organizationId,
    });

    // A successful refresh counts as activity: extend the session.
    await this.redis.expire(REDIS_KEY.session(rec.sid), TTL_SECONDS.session);

    // TODO(phase 2): replay of a rotated token should revoke the whole session
    // family; needs a refresh-family:{sid} index to find the live token.
    return { accessToken, refreshToken };
  }

  /**
   * Log out ONE session. The access JWT may still be valid for up to 15 min,
   * but SessionGuard's get() will return null, so it's effectively dead now.
   * `rawRefreshToken` is optional because the guard only knows the sid; the
   * logout route also has the cookie and passes it so the refresh key dies too.
   */
  async destroy(
    sid: string,
    userId: string,
    rawRefreshToken?: string,
  ): Promise<void> {
    await this.redis.del(REDIS_KEY.session(sid)); // the session
    await this.redis.srem(REDIS_KEY.userSessions(userId), sid); // its index entry

    if (rawRefreshToken) {
      await this.refresh.revoke(rawRefreshToken); // its refresh token
    }
  }

  /**
   * Log out EVERYWHERE. Refresh tokens for these sessions aren't hunted down:
   * they'll fail refreshToken()'s session check, which is enough.
   */
  async destroyAll(userId: string): Promise<void> {
    const setKey = REDIS_KEY.userSessions(userId);
    const sids = await this.redis.smembers(setKey); // every sid for this user
    await this.redis.del(...sids.map(REDIS_KEY.session), setKey); // all sessions + the index
  }
}
