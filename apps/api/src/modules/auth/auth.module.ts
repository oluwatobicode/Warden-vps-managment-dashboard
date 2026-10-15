import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AuthService } from './auth.service';
import { OnboardingService } from './onboarding.service';
import { GithubService } from './github.service';
import { PasswordResetService } from './password-reset.service';
import { SessionModule } from './session/session.module';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [SessionModule, MailModule],
  controllers: [AuthController, AccountController],
  providers: [
    AuthService,
    OnboardingService,
    GithubService,
    PasswordResetService,
    AccountService,
  ],
})
export class AuthModule {}
