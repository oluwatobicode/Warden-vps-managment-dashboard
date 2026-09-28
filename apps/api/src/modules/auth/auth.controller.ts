import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  MagicLinkRequestSchema,
  MagicLinkVerifySchema,
  type AuthOutcome,
  type MagicLinkRequest,
  type MagicLinkVerify,
} from 'shared-types';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AUTH_MESSAGES } from '../../common/constants/messages.config';
import {
  setAccessCookie,
  setPendingCookie,
  setRefreshCookie,
} from '../../common/utils/cookie.util';

@Controller('auth')
export class AuthController {
  // Cookies need `secure` in prod and not on localhost. Decide once, here.
  private readonly isProd: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.isProd = config.get('NODE_ENV') === 'production';
  }

  // Route 1. The pipe validates + normalises the body (email lowercased/trimmed)
  // before this method runs; on failure Nest already answered 400.
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
}
