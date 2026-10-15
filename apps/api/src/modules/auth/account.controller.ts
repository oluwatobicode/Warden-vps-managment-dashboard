import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ChangePasswordSchema,
  SetPasswordSchema,
  UpdateProfileSchema,
  type ChangePasswordInput,
  type SetPasswordInput,
  type UpdateProfileInput,
} from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedRequest } from '../../common/types/request';
import {
  ACCOUNT_MESSAGES,
  AUTH_MESSAGES,
} from '../../common/constants/messages.config';
import { RATE_LIMIT, throttle } from '../../common/constants/constants.config';
import { AccountService } from './account.service';
import { PasswordResetService } from './password-reset.service';

@Controller('account')
@UseGuards(SessionGuard)
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly codes: PasswordResetService,
  ) {}

  /** Name and/or avatar. Returns the updated session user (same shape as /auth/me). */
  @Patch('profile')
  updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) body: UpdateProfileInput,
  ) {
    return this.account.updateProfile(req.session!, body);
  }

  @Throttle(throttle(RATE_LIMIT.login))
  @Post('password')
  @HttpCode(200)
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(ChangePasswordSchema))
    body: ChangePasswordInput,
  ) {
    await this.account.changePassword(
      req.session!,
      req.sid!,
      body.currentPassword,
      body.newPassword,
    );
    return { message: AUTH_MESSAGES.password_changed };
  }

  /** GitHub/Google users without a password: email a code to their own address. */
  @Throttle(throttle(RATE_LIMIT.magicLink))
  @Post('password/code')
  @HttpCode(200)
  async requestSetCode(@Req() req: AuthenticatedRequest) {
    await this.codes.requestSetCode(req.session!.userId);
    return { message: AUTH_MESSAGES.password_set_code_sent };
  }

  @Throttle(throttle(RATE_LIMIT.login))
  @Post('password/set')
  @HttpCode(200)
  async setPassword(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(SetPasswordSchema)) body: SetPasswordInput,
  ) {
    await this.codes.setWithCode(
      req.session!.userId,
      body.code,
      body.newPassword,
      req.sid!,
    );
    return { message: AUTH_MESSAGES.password_added };
  }

  @Get('sessions')
  sessions(@Req() req: AuthenticatedRequest) {
    return this.account.sessionsSummary(req.session!, req.sid!);
  }

  @Delete('sessions/others')
  @HttpCode(200)
  async signOutOthers(@Req() req: AuthenticatedRequest) {
    await this.account.signOutOthers(req.session!, req.sid!);
    return { message: ACCOUNT_MESSAGES.signed_out_others };
  }
}
