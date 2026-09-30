import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OnboardingService } from './onboarding.service';
import { GithubService } from './github.service';
import { SessionModule } from './session/session.module';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [SessionModule, MailModule],
  controllers: [AuthController],
  providers: [AuthService, OnboardingService, GithubService],
})
export class AuthModule {}
