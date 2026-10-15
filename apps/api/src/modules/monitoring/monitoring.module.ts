import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { MonitoringService } from './monitoring.service';
import { CleanupService } from './cleanup.service';
import { cleanupQueueProvider } from './cleanup.queue';
import { ServerMetricsController } from './server-metrics.controller';
import { ServerContainersController } from './server-containers.controller';
import { DockerCleanupController } from './docker-cleanup.controller';

/** Server monitoring (1G): reads what the worker collected; hands cleanups to it. */
@Module({
  imports: [SessionModule],
  controllers: [
    ServerMetricsController,
    ServerContainersController,
    DockerCleanupController,
  ],
  providers: [MonitoringService, CleanupService, cleanupQueueProvider],
  exports: [MonitoringService],
})
export class MonitoringModule {}
