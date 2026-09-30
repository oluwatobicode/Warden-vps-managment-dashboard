import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUTH_MESSAGES } from '../../common/constants/messages.config';

/** What every OAuth provider hands back to AuthService. Google will return the same shape. */
export interface OauthIdentity {
  providerId: string;
  email: string;
}

/**
 * Talks to GitHub and nothing else. Two jobs: build the URL we send the user
 * to, and turn the `code` GitHub sends back into a verified identity.
 * No Passport — it's two fetch calls.
 */
@Injectable()
export class GithubService {
  private readonly githubClientId: string;
  private readonly githubClientSecret: string;
  private readonly githubCallbackUrl: string;

  constructor(config: ConfigService) {
    this.githubClientId = config.getOrThrow<string>('GITHUB_CLIENT_ID');
    this.githubClientSecret = config.getOrThrow<string>('GITHUB_CLIENT_SECRET');
    this.githubCallbackUrl = config.getOrThrow<string>('GITHUB_CALLBACK_URL');
  }

  /** Where the browser goes when the user clicks "Sign in with GitHub". */
  getAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.githubClientId,
      redirect_uri: this.githubCallbackUrl, // must match the OAuth app's Redirect URI exactly
      scope: 'read:user user:email', // user:email is what unlocks /user/emails
      state, // CSRF token; AuthService checks it on the way back
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  /** Called from the callback route. `code` is single-use and short-lived. */
  async exchangeCode(code: string): Promise<OauthIdentity> {
    // 1. code → access token.
    //    GitHub answers 200 even on failure, with an `error` field — so check
    //    the JSON, not the HTTP status.
    const tokenRes = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.githubClientId,
          client_secret: this.githubClientSecret,
          code,
        }),
      },
    );
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
    };
    if (tokenJson.error || !tokenJson.access_token) {
      throw new UnauthorizedException(AUTH_MESSAGES.oauth_state_invalid);
    }

    // Same two headers for every API call. GitHub rejects requests with no User-Agent.
    const headers = {
      Authorization: `Bearer ${tokenJson.access_token}`,
      'User-Agent': 'warden',
    };

    // 2. token → the user's stable numeric id. This is what we store as
    //    githubAccountId; usernames and emails can change, the id can't.
    const userRes = await fetch('https://api.github.com/user', { headers });
    const user = (await userRes.json()) as { id: number };

    // 3. token → their emails. Prefer primary+verified, accept any verified,
    //    refuse unverified (someone could claim an address they don't own).
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers,
    });
    const emails = (await emailsRes.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;
    const chosen =
      emails.find((e) => e.primary && e.verified) ??
      emails.find((e) => e.verified);
    if (!chosen) {
      throw new UnauthorizedException(AUTH_MESSAGES.oauth_email_missing);
    }

    return { providerId: String(user.id), email: chosen.email.toLowerCase() };
  }
}
