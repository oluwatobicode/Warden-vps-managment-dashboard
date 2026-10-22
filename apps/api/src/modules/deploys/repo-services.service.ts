import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { listRepos } from 'github-app';
import type { CreateFromRepoInput, CreateFromRepoResult } from 'shared-types';
import { encrypt } from 'warden-crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgKeyService } from '../warden-crypto/org-key.service';
import { pickServer } from '../environments/pick-server';
import { DEPLOY_MESSAGES, ENVIRONMENT_MESSAGES } from '../../common/constants/messages.config';
import type { Actor } from '../../common/types/actor';
import { DeployService } from './deploy.service';
import { GithubConfig } from './github.config';
import { GithubService } from './github.service';

/**
 * "Add service → From GitHub": create one service per app picked (a
 * monorepo can give several), with their build settings and variables, in
 * one transaction, then start their first deploys.
 */
@Injectable()
export class RepoServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgKeys: OrgKeyService,
    private readonly githubConfig: GithubConfig,
    private readonly github: GithubService,
    private readonly deploys: DeployService,
  ) {}

  async create(actor: Actor, input: CreateFromRepoInput): Promise<CreateFromRepoResult> {
    const orgId = actor.organizationId;
    const env = await this.prisma.client.environment.findFirst({
      where: { id: input.environmentId, organizationId: orgId },
      select: { id: true },
    });
    if (!env) throw new NotFoundException(ENVIRONMENT_MESSAGES.not_found);

    // Through the App, the repo must be one it can really see; the address comes from GitHub.
    let source: { githubInstallationId: string | null; githubRepoId: number | null; githubRepoUrl: string };
    if (input.installationId) {
      const installationId = await this.github.installationFor(orgId, input.installationId);
      const repo = (await listRepos(this.githubConfig.require(), installationId)).find(
        (r) => r.fullName.toLowerCase() === input.repo.toLowerCase(),
      );
      if (!repo) throw new BadRequestException(DEPLOY_MESSAGES.repo_not_visible);
      source = { githubInstallationId: input.installationId, githubRepoId: repo.id, githubRepoUrl: repo.htmlUrl };
    } else {
      source = { githubInstallationId: null, githubRepoId: null, githubRepoUrl: `https://github.com/${input.repo}` };
    }

    for (const s of input.services) await pickServer(this.prisma, orgId, env.id, s.serverId);
    const taken = await this.prisma.client.service.findFirst({
      where: { environmentId: env.id, serviceName: { in: input.services.map((s) => s.serviceName) } },
      select: { serviceName: true },
    });
    if (taken) throw new ConflictException(DEPLOY_MESSAGES.name_taken_in_env.replace('{name}', taken.serviceName));

    const dek = await this.orgKeys.getDek(orgId);
    const created = await this.prisma.client.$transaction(async (tx) => {
      const out: Array<{ id: string; serviceName: string }> = [];
      for (const s of input.services) {
        const svc = await tx.service.create({
          data: {
            serviceName: s.serviceName,
            type: s.type,
            ...source,
            branch: input.branch,
            port: s.port,
            serverId: s.serverId,
            rootDirectory: s.rootDirectory,
            dockerfilePath: s.dockerfilePath,
            buildCommand: s.buildCommand || null,
            startCommand: s.startCommand || null,
            staticOutputDir: s.staticOutputDir || null,
            healthCheckPath: s.healthCheckPath,
            watchPaths: s.watchPaths,
            environmentId: env.id,
            organizationId: orgId,
          },
          select: { id: true, serviceName: true },
        });
        for (const v of s.variables) {
          await tx.serviceVariable.create({
            data: { key: v.key, valueEncrypted: encrypt(v.value, dek, 'v1'), isSecret: true, serviceId: svc.id, organizationId: orgId },
          });
        }
        out.push(svc);
      }
      return out;
    });

    // Deploys start after the services exist. One that can't start (no proxy yet…) says why.
    const services: CreateFromRepoResult['services'] = [];
    for (const svc of created) {
      let deploymentId: string | null = null;
      let deployNote: string | null = null;
      if (input.deploy) {
        try {
          deploymentId = (await this.deploys.trigger(actor, { serviceId: svc.id })).id;
        } catch (e) {
          deployNote = e instanceof HttpException ? e.message : 'Could not start the deploy';
        }
      }
      services.push({ ...svc, deploymentId, deployNote });
    }
    return { services };
  }
}
