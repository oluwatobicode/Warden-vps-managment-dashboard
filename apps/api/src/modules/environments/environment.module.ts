import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { EnvironmentController } from './environment.controller';
import { EnvironmentService } from './environment.service';

@Module({
  imports: [SessionModule],
  controllers: [EnvironmentController],
  providers: [EnvironmentService],
})
export class EnvironmentModule {}
