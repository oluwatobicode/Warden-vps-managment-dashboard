import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { EnvironmentVariableController } from './environment-variable.controller';
import { ServiceVariableController } from './service-variable.controller';
import { VariableService } from './variable.service';

// Two controllers (the ids live in two different tables), one shared service.
// Exported so the deploy worker path can call resolveForService later.
@Module({
  imports: [SessionModule],
  controllers: [EnvironmentVariableController, ServiceVariableController],
  providers: [VariableService],
  exports: [VariableService],
})
export class VariableModule {}
