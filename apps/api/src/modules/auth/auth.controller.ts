import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  AcceptInviteSchema,
  type AcceptInviteInput,
  DeclineInviteSchema,
  type DeclineInviteInput,
  EmailOnboardingSchema,
  OAuthOnboardingSchema,
  type OAuthOnboardingInput,
  type LoginInput,
  LoginSchema,
  MagicLinkRequestSchema,
  MagicLinkVerifySchema,
  type AuthOutcome,
  type EmailOnboardingInput,
  type MagicLinkRequest,
  type MagicLinkVerify,
  OAuthCallbackSchema,
  type OAuthCallback,
} from 'shared-types';
import { AuthService } from './auth.service';
import { SessionService } from './session/session.service';
import {
  COOKIE,
  RATE_LIMIT,
  throttle,
} from '../../common/constants/constants.config';
import { OnboardingService } from './onboarding.service';
import { OnboardingGuard } from '../../common/guards/onboarding.guard';
import type { AuthenticatedRequest } from '../../common/types/request';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  AUTH_MESSAGES,
  LOGIN_MESSAGES,
  SIGNUP_MESSAGES,
} from '../../common/constants/messages.config';
import {
  clearAuthCookies,
  clearPendingCookie,
  setAccessCookie,
  setPendingCookie,
  setRefreshCookie,
} from '../../common/utils/cookie.util';
import { SessionGuard } from '../../common/guards/session.guard';

@Controller('auth')
export class AuthController {
  // Cookies need `secure` in prod and not on localhost. Decide once, here.
  private readonly isProd: boolean;
  private readonly appUrl: string;

  constructor(
    private readonly auth: AuthService,
    private readonly onboarding: OnboardingService,
    private readonly sessions: SessionService,
    config: ConfigService,
  ) {
    this.isProd = config.get('NODE_ENV') === 'production';
    this.appUrl = config.getOrThrow<string>('APP_URL');
  }

  // Route 1. The pipe validates + normalises the body (email lowercased/trimmed)
  // before this method runs; on failure Nest already answered 400.
  @Throttle(throttle(RATE_LIMIT.magicLink))
  @Post('magic-link')
  @HttpCode(200) // Nest defaults POST to 201; nothing is created yet
  async requestMagicLink(
    @Body(new ZodValidationPipe(MagicLinkRequestSchema)) body: MagicLinkRequest,
  ) {
    await this.auth.requestMagicLink(body.email);
    return { message: AUTH_MESSAGES.magic_link_sent };
  }

  // Route 2. Token comes from the query string, so @Query instead of @Body —
  // same pipe. @Res({ passthrough: true }) gives us the response object to set
  // cookies on while Nest STILL sends our return value; without `passthrough`
  // Nest would assume we're sending the response ourselves.
  @Get('verify')
  async verifyMagicLink(
    @Query(new ZodValidationPipe(MagicLinkVerifySchema)) query: MagicLinkVerify,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthOutcome> {
    const outcome = await this.auth.verifyMagicLink(query.token);

    if (outcome.status === 'authenticated') {
      // Logged in: both auth cookies. Tokens never appear in the body.
      setAccessCookie(res, outcome.tokens.accessToken, this.isProd);
      setRefreshCookie(res, outcome.tokens.refreshToken, this.isProd);
      return { status: 'authenticated' };
    }

    // New user: the pending cookie is what OnboardingGuard will read on route 3.
    setPendingCookie(res, outcome.pendingId, this.isProd);
    return { status: 'onboarding', provider: outcome.provider };
  }

  // Route 3. OnboardingGuard runs first: no valid pending cookie → 401 before
  // this method is entered. @Req() gives the same request the guard decorated.
  @Post('onboarding')
  @UseGuards(OnboardingGuard)
  async completeOnboarding(
    @Body(new ZodValidationPipe(EmailOnboardingSchema))
    body: EmailOnboardingInput,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    // The `!` is safe: the guard guarantees both are set on this route.
    // OAuth signups have no password step — they must use /onboarding/oauth.
    if (req.pending!.provider !== 'EMAIL') {
      throw new BadRequestException(SIGNUP_MESSAGES.wrong_onboarding_route);
    }
    const { user, tokens } = await this.onboarding.completeEmailSignup(
      req.pending!,
      req.pendingId!,
      body,
    );

    clearPendingCookie(res, this.isProd); // signup state is spent
    setAccessCookie(res, tokens.accessToken, this.isProd); // logged in immediately
    setRefreshCookie(res, tokens.refreshToken, this.isProd);
    return user;
  }

  // Route 3b. Same guard, same cookies, no password — for pending records
  // created by an OAuth callback.
  @Post('onboarding/oauth')
  @UseGuards(OnboardingGuard)
  async completeOAuthOnboarding(
    @Body(new ZodValidationPipe(OAuthOnboardingSchema))
    body: OAuthOnboardingInput,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.pending!.provider === 'EMAIL') {
      throw new BadRequestException(SIGNUP_MESSAGES.wrong_onboarding_route);
    }
    const { user, tokens } = await this.onboarding.completeOAuthSignup(
      req.pending!,
      req.pendingId!,
      body,
    );

    clearPendingCookie(res, this.isProd);
    setAccessCookie(res, tokens.accessToken, this.isProd);
    setRefreshCookie(res, tokens.refreshToken, this.isProd);
    return user;
  }

  // Public: the invitee has no account yet; the token identifies the invite.
  // Same cookie handling as onboarding — they land logged in.
  @Post('invitations/accept')
  async acceptInvitation(
    @Body(new ZodValidationPipe(AcceptInviteSchema)) body: AcceptInviteInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.onboarding.acceptInvite(body);
    setAccessCookie(res, tokens.accessToken, this.isProd);
    setRefreshCookie(res, tokens.refreshToken, this.isProd);
    return user;
  }

  // Public, like accept. 204: nothing to return, no cookies to set.
  @Post('invitations/decline')
  @HttpCode(204)
  async declineInvitation(
    @Body(new ZodValidationPipe(DeclineInviteSchema)) body: DeclineInviteInput,
  ) {
    await this.onboarding.declineInvite(body);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  async getMe(@Req() req: AuthenticatedRequest) {
    return this.auth.me(req.session!);
  }

  @Throttle(throttle(RATE_LIMIT.login))
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(LoginSchema))
    body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.login(body.email, body.password);
    setAccessCookie(res, tokens.accessToken, this.isProd);
    setRefreshCookie(res, tokens.refreshToken, this.isProd);
    return { message: LOGIN_MESSAGES.login_success };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Await it: the response must not go out before Redis has dropped the session.
    await this.sessions.destroy(
      req.sid!,
      req.session!.userId,
      req.cookies[COOKIE.refresh],
    );
    clearAuthCookies(res, this.isProd);
    return { message: AUTH_MESSAGES.logged_out };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies[COOKIE.refresh];

    if (!raw) {
      throw new UnauthorizedException(AUTH_MESSAGES.refresh_invalid);
    }

    const tokens = await this.sessions.refreshToken(raw);
    setAccessCookie(res, tokens.accessToken, this.isProd);
    setRefreshCookie(res, tokens.refreshToken, this.isProd);

    return { message: 'ok' };
  }

  @Get('github')
  @HttpCode(200)
  async github(@Res() res: Response) {
    res.redirect(await this.auth.startOAuth('GITHUB'));
  }

  @Get('github/callback')
  @HttpCode(200)
  async githubCallback(
    @Query(new ZodValidationPipe(OAuthCallbackSchema)) query: OAuthCallback,
    @Res() res: Response,
  ) {
    const outcome = await this.auth.completeOauth(
      'GITHUB',
      query.code,
      query.state,
    );

    if (outcome.status === 'authenticated') {
      setAccessCookie(res, outcome.tokens.accessToken, this.isProd);
      setRefreshCookie(res, outcome.tokens.refreshToken, this.isProd);
      res.redirect(this.appUrl + '?state=authenticated');
    } else {
      setPendingCookie(res, outcome.pendingId, this.isProd);
      res.redirect(this.appUrl + '/onboarding?status=onboarding');
    }
  }
}
