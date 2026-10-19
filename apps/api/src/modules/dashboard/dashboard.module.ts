import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [SessionModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
