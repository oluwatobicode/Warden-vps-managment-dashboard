import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  imports: [SessionModule],
  providers: [NotificationService],
  controllers: [NotificationController],
})
export class NotificationModule {}
