import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionModule } from './session/session.module';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [SessionModule, MailModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
