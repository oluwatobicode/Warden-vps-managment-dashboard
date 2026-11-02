import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { SessionModule } from '../auth/session/session.module';
import { TeamService } from './team.service';
import { MailModule } from '../../mail/mail.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [SessionModule, MailModule, NotificationModule],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
