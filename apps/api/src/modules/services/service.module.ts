import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';

@Module({
  imports: [SessionModule],
  controllers: [ServiceController],
  providers: [ServiceService],
})
export class ServiceModule {}
