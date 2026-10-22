import { Module } from '@nestjs/common';
import { AppControlModule } from '../deploys/app-control.module';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { SessionModule } from '../auth/session/session.module';

@Module({
  imports: [SessionModule, AppControlModule],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
