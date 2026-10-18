import { Global, Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { AuditController } from './audit.controller';
import { ProjectActivityController } from './project-activity.controller';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [SessionModule],
  controllers: [AuditController, ProjectActivityController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
