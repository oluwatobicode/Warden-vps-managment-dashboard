import { Module } from '@nestjs/common';
import { AppControlModule } from '../deploys/app-control.module';
import { SessionModule } from '../auth/session/session.module';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';

@Module({
  imports: [SessionModule, AppControlModule],
  controllers: [ServiceController],
  providers: [ServiceService],
})
export class ServiceModule {}
