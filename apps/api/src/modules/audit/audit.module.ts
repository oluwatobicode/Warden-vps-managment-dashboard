import { Global, Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

// Global: most modules write audit lines; this saves importing it everywhere.
@Global()
@Module({
  imports: [SessionModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
