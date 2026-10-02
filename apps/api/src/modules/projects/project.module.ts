import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { SessionModule } from '../auth/session/session.module';

@Module({
  imports: [SessionModule],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
