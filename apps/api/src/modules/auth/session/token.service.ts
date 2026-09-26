import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify } from 'jose';
import { JWT } from '../../../common/constants/constants.config';
import { randomToken } from '../../../common/utils/token.util';
import type { AccessTokenPayload } from '../../../common/types/jwt-payload';

/**
 * Signs and verifies the short-lived ACCESS token (a JWT).
 *
 * This is the only file that talks to `jose`. The rest of the app says
 * "sign a Warden access token" and never sees JWT details. If the algorithm
 * or library ever changes, this is the one file that changes.
 *
 * What is NOT here: refresh tokens (opaque, see RefreshTokenService) and the
 * session record itself (Redis, see SessionService).
 */
@Injectable()
export class TokenService {
  // jose signs with raw bytes, not a string. Encode the secret once at startup
  // and reuse it for every sign/verify call.
  private readonly secret: Uint8Array;

  // Nest injects ConfigService (ConfigModule is global). getOrThrow so a
  // missing JWT_ACCESS_SECRET crashes at boot, not on the first login.
  constructor(config: ConfigService) {
    this.secret = new TextEncoder().encode(
      config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    );
  }

  /**
   * Build and sign a 15-minute access token.
   * Called by SessionService on login and on refresh.
   *
   * `jti` is generated here, so callers pass everything except it.
   * `role` is deliberately NOT a claim — it is read from the Redis session
   * on every request so a demotion takes effect immediately.
   */
  signAccess(claims: Omit<AccessTokenPayload, 'jti'>): Promise<string> {
    return new SignJWT({ sid: claims.sid, org: claims.org }) // custom claims: session id + org
      .setProtectedHeader({ alg: JWT.algorithm }) // HS256 — symmetric, one shared secret
      .setSubject(claims.sub) // "sub" = userId (standard claim)
      .setJti(randomToken()) // unique id per token
      .setIssuer(JWT.issuer) // who minted it ("warden")
      .setAudience(JWT.audience) // who it is for ("warden-api")
      .setIssuedAt() // "iat" = now
      .setExpirationTime(JWT.accessTtl) // "exp" = now + 15m
      .sign(this.secret); // → compact JWT string
  }

  /**
   * Check a token and return its claims.
   * Verifies, in one call: signature, expiry (exp), not-before (nbf),
   * issuer and audience. Pinning `algorithms` blocks alg-confusion attacks.
   *
   * Throws on ANY failure. SessionGuard catches that and responds 401.
   */
  async verifyAccess(token: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify(token, this.secret, {
      issuer: JWT.issuer,
      audience: JWT.audience,
      algorithms: [JWT.algorithm],
    });

    // jose types custom claims as `unknown`; we control what goes in, so the
    // casts are honest. (Could parse with a Zod schema instead.)
    return {
      sub: payload.sub as string,
      sid: payload.sid as string,
      org: payload.org as string,
      jti: payload.jti as string,
    };
  }
}
