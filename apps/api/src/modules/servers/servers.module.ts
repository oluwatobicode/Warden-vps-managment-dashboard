import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { ServerController } from './server.controller';
import { ServerService } from './servers.service';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [SessionModule, MonitoringModule],
  controllers: [ServerController],
  providers: [ServerService],
})
export class ServerModule {}
