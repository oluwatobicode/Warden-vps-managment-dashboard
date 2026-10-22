import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { DeployController } from './deploy.controller';
import { DeployService } from './deploy.service';
import { DeployGateway } from './deploy.gateway';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';
import { GithubConfig } from './github.config';
import { deployQueueProvider } from './deploy.queue';
import { RepoServicesService } from './repo-services.service';

/** Phase 2: app deploys, live logs, the GitHub App. */
@Module({
  imports: [SessionModule],
  controllers: [DeployController, GithubController],
  providers: [DeployService, DeployGateway, GithubService, GithubConfig, RepoServicesService, deployQueueProvider],
})
export class DeployModule {}
