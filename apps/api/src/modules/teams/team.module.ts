import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { SessionModule } from '../auth/session/session.module';
import { TeamService } from './team.service';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [SessionModule, MailModule],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
