import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { MailModule } from '../../mail/mail.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

/** Dashboard → Support: a message (and screenshots) emailed to MAIL_SUPPORT. */
@Module({
  imports: [SessionModule, MailModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
