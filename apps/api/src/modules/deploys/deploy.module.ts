import { Module } from '@nestjs/common';
import { AppControlModule } from './app-control.module';
import { SessionModule } from '../auth/session/session.module';
import { DeployController } from './deploy.controller';
import { DeployService } from './deploy.service';
import { DeployGateway } from './deploy.gateway';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';
import { GithubConfig } from './github.config';
import { deployQueueProvider } from './deploy.queue';
import { RepoServicesService } from './repo-services.service';
import { SessionGuard } from '../../common/guards/session.guard';
import { ApiTokenGuard } from '../../common/guards/api-token.guard';
import { SessionOrTokenGuard } from '../../common/guards/session-or-token.guard';

/** Phase 2: app deploys, live logs, the GitHub App. */
@Module({
  imports: [SessionModule, AppControlModule],
  controllers: [DeployController, GithubController],
  providers: [SessionGuard, ApiTokenGuard, SessionOrTokenGuard, DeployService, DeployGateway, GithubService, GithubConfig, RepoServicesService, deployQueueProvider],
})
export class DeployModule {}
