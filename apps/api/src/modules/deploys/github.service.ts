import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { getInstallation, inspectRepo, installationToken, listBranches, listRepos, matchesWatchPath, verifyWebhook, type Repo } from 'github-app';
import type { InspectRepoQuery, RepoInspection } from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { REDIS_KEY } from '../../common/constants/constants.config';
import { GITHUB_MESSAGES } from '../../common/constants/messages.config';
import type { Actor } from '../../common/types/actor';
import { DeployService } from './deploy.service';
import { GithubConfig } from './github.config';

interface PushPayload {
  ref?: string;
  after?: string;
  deleted?: boolean;
  repository?: { id: number; default_branch?: string };
  installation?: { id: number };
  pusher?: { name?: string };
  head_commit?: { message?: string } | null;
  commits?: Array<{ added?: string[]; removed?: string[]; modified?: string[] }>;
}

/**
 * Connecting GitHub to an org, the repo/branch pickers, and push webhooks.
 * See docs/PHASE-2-DEPLOY-PLAN.md, "The GitHub App".
 */
@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly github: GithubConfig,
    private readonly deploys: DeployService,
    private readonly config: ConfigService,
  ) {}

  async status(orgId: string) {
    const rows = await this.prisma.client.githubInstallation.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { services: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      configured: !!this.github.app,
      appSlug: this.github.app?.slug || null,
      installations: rows.map((r) => ({
        id: r.id,
        accountLogin: r.accountLogin,
        accountType: r.accountType,
        serviceCount: r._count.services,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /** "Connect GitHub": remember who asked, then send them to GitHub's install page. */
  async startInstall(actor: Actor): Promise<{ url: string }> {
    const app = this.github.require();
    const state = randomBytes(24).toString('hex');
    await this.redis.set(
      REDIS_KEY.githubInstallState(state),
      JSON.stringify({ orgId: actor.organizationId, userId: actor.userId }),
      'EX',
      15 * 60,
    );
    return { url: `https://github.com/apps/${app.slug}/installations/new?state=${state}` };
  }

  /**
   * GitHub sends the browser back here after the install. The state must be
   * one this org started (so nobody can attach their installation to another
   * org), and GitHub must confirm the installation exists.
   */
  async finishInstall(actor: Actor, installationId: number, state: string | undefined): Promise<string> {
    const app = this.github.require();
    const raw = state ? await this.redis.getdel(REDIS_KEY.githubInstallState(state)) : null;
    const started = raw ? (JSON.parse(raw) as { orgId: string; userId: string | null }) : null;
    const known = await this.prisma.client.githubInstallation.findFirst({
      where: { organizationId: actor.organizationId, installationId },
    });
    // No state is fine only when the user changed repos on an installation this org already has.
    if (!known && (!started || started.orgId !== actor.organizationId || started.userId !== actor.userId)) {
      throw new BadRequestException(GITHUB_MESSAGES.bad_state);
    }
    const inst = await getInstallation(app, installationId).catch(() => {
      throw new BadRequestException(GITHUB_MESSAGES.install_failed);
    });
    await this.prisma.client.githubInstallation.upsert({
      where: { organizationId_installationId: { organizationId: actor.organizationId, installationId } },
      create: { organizationId: actor.organizationId, installationId, accountLogin: inst.accountLogin, accountType: inst.accountType },
      update: { accountLogin: inst.accountLogin, accountType: inst.accountType },
    });
    if (!known) {
      await this.audit.record(actor, {
        action: 'github.connected',
        entityType: 'github_installation',
        entityId: String(installationId),
        metadata: { account: inst.accountLogin },
      });
    }
    return inst.accountLogin;
  }

  /**
   * Forget a connection here. Its services keep their repo address, but
   * private repos can't be cloned until it's connected again. To revoke the
   * App's access itself, uninstall it on GitHub.
   */
  async disconnect(actor: Actor, id: string): Promise<void> {
    const row = await this.prisma.client.githubInstallation.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!row) throw new NotFoundException(GITHUB_MESSAGES.not_found);
    await this.prisma.client.githubInstallation.delete({ where: { id: row.id } });
    await this.audit.record(actor, {
      action: 'github.disconnected',
      entityType: 'github_installation',
      entityId: String(row.installationId),
      metadata: { account: row.accountLogin },
    });
  }

  async repos(orgId: string, id: string): Promise<Repo[]> {
    return listRepos(this.github.require(), await this.installationId(orgId, id));
  }

  async branches(orgId: string, id: string, fullName: string): Promise<string[]> {
    return listBranches(this.github.require(), await this.installationId(orgId, id), fullName);
  }

  /**
   * Read a repo and work out its apps, to prefill Add service. Through the
   * org's installation when given (private repos); a public repo uses any of
   * the org's installations (5,000 calls an hour) or, with none, GitHub's
   * public API (60 an hour per IP).
   */
  async inspect(orgId: string, q: InspectRepoQuery): Promise<RepoInspection> {
    let token: string | null = null;
    const app = this.github.app;
    if (q.installationId) {
      token = await installationToken(this.github.require(), await this.installationId(orgId, q.installationId));
    } else if (app) {
      const any = await this.prisma.client.githubInstallation.findFirst({ where: { organizationId: orgId }, select: { installationId: true } });
      if (any) token = await installationToken(app, any.installationId).catch(() => null);
    }
    try {
      return await inspectRepo(token, q.repo, q.branch);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 404) throw new NotFoundException(q.installationId ? GITHUB_MESSAGES.repo_not_found_app : GITHUB_MESSAGES.repo_not_found_public);
      if (status === 403 || status === 429) throw new BadRequestException(GITHUB_MESSAGES.rate_limited);
      throw new BadRequestException((e as Error).message);
    }
  }

  /** The installation row → GitHub's installation id, checked against the org. */
  async installationFor(orgId: string, id: string): Promise<number> {
    return this.installationId(orgId, id);
  }

  /**
   * A webhook from GitHub. Nothing is believed until the signature checks out
   * (HMAC of the exact bytes with the App's webhook secret).
   */
  async webhook(rawBody: Buffer | undefined, event: string | undefined, signature: string | undefined): Promise<{ ok: true; deploys?: number }> {
    const app = this.github.require();
    if (!rawBody || !verifyWebhook(app.webhookSecret, rawBody, signature)) throw new UnauthorizedException(GITHUB_MESSAGES.bad_signature);
    const body = JSON.parse(rawBody.toString('utf8')) as PushPayload & { action?: string };

    if (event === 'installation' && body.action === 'deleted' && body.installation) {
      // Uninstalled on GitHub: forget it everywhere.
      await this.prisma.client.githubInstallation.deleteMany({ where: { installationId: body.installation.id } });
      return { ok: true };
    }
    if (event !== 'push' || body.deleted || !body.ref?.startsWith('refs/heads/') || !body.repository || !body.installation || !body.after) {
      return { ok: true };
    }

    const branch = body.ref.slice('refs/heads/'.length);
    const files = (body.commits ?? []).flatMap((c) => [...(c.added ?? []), ...(c.removed ?? []), ...(c.modified ?? [])]);
    // GitHub lists at most 20 commits per push; with more, the file list is incomplete, so don't filter.
    const filesComplete = (body.commits?.length ?? 0) < 20;
    const services = await this.prisma.client.service.findMany({
      where: {
        githubRepoId: body.repository.id,
        autoDeploy: true,
        githubInstallation: { installationId: body.installation.id },
      },
      include: { environment: { select: { branch: true } } },
    });
    let n = 0;
    for (const s of services) {
      const serviceBranch = s.branch ?? s.environment.branch ?? body.repository.default_branch;
      if (serviceBranch !== branch) continue;
      if (s.watchPaths.length && filesComplete && !files.some((f) => s.watchPaths.some((p) => matchesWatchPath(f, p)))) continue;
      await this.deploys.triggerFromPush(s.id, s.organizationId, {
        sha: body.after,
        message: body.head_commit?.message?.split('\n')[0]?.slice(0, 300) ?? null,
        pusher: body.pusher?.name ?? 'someone',
        branch,
      });
      n++;
    }
    if (n) this.logger.log(`push to ${branch}: ${n} deploy(s) queued`);
    return { ok: true, deploys: n };
  }

  /** Where the browser lands after connecting. */
  settingsUrl(query: string): string {
    const base = (this.config.get<string>('APP_URL') ?? '').replace(/\/$/, '');
    return `${base}/settings/github${query}`;
  }

  private async installationId(orgId: string, id: string): Promise<number> {
    const row = await this.prisma.client.githubInstallation.findFirst({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException(GITHUB_MESSAGES.not_found);
    return row.installationId;
  }
}
