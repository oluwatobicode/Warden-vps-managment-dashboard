import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { LogsController } from './logs.controller';
import { LogsGateway } from './logs.gateway';
import { LogsService } from './logs.service';
import { ServerLogsController } from './server-logs.controller';
import { ServerLogsService } from './server-logs.service';

/** App and server logs: search and scroll-back (REST), live lines (Socket.io). The worker writes them. */
@Module({
  imports: [SessionModule],
  controllers: [LogsController, ServerLogsController],
  providers: [LogsService, ServerLogsService, LogsGateway],
})
export class LogsModule {}
