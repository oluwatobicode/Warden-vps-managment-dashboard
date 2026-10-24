import { BadGatewayException, BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from 'db';
import {
  EMPTY_PROXY_FORM,
  ProxyFormSchema,
  shortId,
  type ProxyApplyResult,
  type ProxyCheckResult,
  type ProxyConfigView,
  type ProxyLiveRoute,
  type ProxyProblem,
  type SaveProxyConfigInput,
} from 'shared-types';
import { withSsh, type Run } from 'ssh-client';
import { checkConfig } from 'traefik-config';
import { decrypt } from 'warden-crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { OrgKeyService } from '../warden-crypto/org-key.service';
import { AuditService } from '../audit/audit.service';
import { PROXY_MESSAGES } from '../../common/constants/messages.config';
import type { Actor } from '../../common/types/actor';

/** Must match the worker's PROXY_REVISION / DYNAMIC_DIR (apps/worker/src/deploys/traefik.ts). */
const EDITABLE_REVISION = 2;
const FILE = '/etc/traefik/dynamic/warden.yml';
const PROXY = 'warden-traefik';
/** Traefik reloads a watched file within a few seconds; give it up to this long. */
const LOAD_TIMEOUT_MS = 12_000;

type ServerWithKey = Prisma.ServerGetPayload<{ include: { serverSshKey: { select: { privateKeyEncrypted: true } } } }>;
interface TraefikItem {
  name: string;
  provider: string;
  rule?: string;
  entryPoints?: string[];
  tls?: unknown;
  status?: string;
  error?: string[];
}

/**
 * The Traefik config editor (server page → Proxy). Warden writes one file,
 * warden.yml, which Traefik watches. A change is checked first (packages/
 * traefik-config), written, then confirmed with Traefik's own status page:
 * if Traefik refuses any of it, the previous version goes back by itself.
 */
@Injectable()
export class ProxyConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly orgKeys: OrgKeyService,
    private readonly audit: AuditService,
  ) {}

  async view(orgId: string, serverId: string): Promise<ProxyConfigView> {
    const server = await this.server(orgId, serverId);
    const [current, versions] = await Promise.all([
      this.latestApplied(serverId),
      this.prisma.client.serverTraefik.findMany({ where: { serverId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    const editable = (server.proxyRevision ?? 0) >= EDITABLE_REVISION;
    let routes: ProxyLiveRoute[] | null = null;
    if (editable) {
      routes = await this.ssh(orgId, server, (run) => this.liveRoutes(run, orgId, serverId)).catch(() => null);
    }
    return {
      editable,
      current: current && {
        versionId: current.id,
        form: this.formOf(current.form),
        raw: current.raw,
        yaml: current.traefikConfig,
        createdAt: current.createdAt.toISOString(),
        createdByName: current.createdByName,
      },
      versions: versions.map((v) => ({
        id: v.id,
        status: v.status,
        source: v.source,
        createdByName: v.createdByName,
        note: v.note,
        problems: (v.problems as ProxyProblem[] | null) ?? [],
        createdAt: v.createdAt.toISOString(),
      })),
      routes,
    };
  }

  /** Check without applying (the editor asks while you type). */
  async check(orgId: string, serverId: string, input: Pick<SaveProxyConfigInput, 'form' | 'raw'>): Promise<ProxyCheckResult> {
    await this.server(orgId, serverId);
    const r = checkConfig(input.form, input.raw);
    return { ok: r.ok, problems: r.problems, yaml: r.yaml };
  }

  async apply(actor: Actor, serverId: string, input: SaveProxyConfigInput, source: 'FORM' | 'RAW' | 'REVERT' = 'RAW'): Promise<ProxyApplyResult> {
    const orgId = actor.organizationId;
    const server = await this.server(orgId, serverId);
    if ((server.proxyRevision ?? 0) < EDITABLE_REVISION) throw new BadRequestException(PROXY_MESSAGES.update_first);
    const checked = checkConfig(input.form, input.raw);
    if (!checked.ok) {
      const p = checked.problems[0];
      throw new BadRequestException(`${PROXY_MESSAGES.fix_first}: ${p.line ? `line ${p.line}: ` : ''}${p.message}`);
    }

    // One change at a time per server, and never on top of a version you haven't seen.
    const lock = `proxy-config-lock:${serverId}`;
    if ((await this.redis.set(lock, '1', 'EX', 60, 'NX')) !== 'OK') throw new ConflictException(PROXY_MESSAGES.busy);
    try {
      const previous = await this.latestApplied(serverId);
      if ((previous?.id ?? null) !== input.baseVersionId) throw new ConflictException(PROXY_MESSAGES.stale);
      const createdByName = await this.actorName(actor);

      const problems = await this.ssh(orgId, server, async (run) => {
        await this.write(run, checked.yaml);
        const refused = await this.waitForLoad(run, checked.config);
        // Traefik refused part of it: put the previous version back by itself.
        if (refused.length) await this.write(run, previous?.traefikConfig ?? '{}\n');
        return refused;
      }).catch((e) => {
        if (e instanceof ConflictException) throw e;
        throw new BadGatewayException(PROXY_MESSAGES.unreachable.replace('{server}', server.serverName));
      });

      const row = await this.prisma.client.serverTraefik.create({
        data: {
          serverId,
          traefikConfig: checked.yaml,
          form: input.form as unknown as Prisma.InputJsonValue,
          raw: input.raw,
          status: problems.length ? 'ROLLED_BACK' : 'APPLIED',
          source,
          problems: problems.length ? (problems as unknown as Prisma.InputJsonValue) : undefined,
          note: input.note,
          createdById: actor.userId,
          createdByName,
        },
      });
      await this.audit.record(actor, {
        action: problems.length ? 'proxy_config.rolled_back' : source === 'REVERT' ? 'proxy_config.reverted' : 'proxy_config.applied',
        entityType: 'server',
        entityId: serverId,
        metadata: { server: server.serverName, problems: problems.length },
      });
      return { applied: !problems.length, problems, versionId: row.id };
    } finally {
      await this.redis.del(lock);
    }
  }

  /** Bring an earlier version back: applied (and checked) like any change. */
  async revert(actor: Actor, serverId: string, versionId: string, baseVersionId: string | null): Promise<ProxyApplyResult> {
    await this.server(actor.organizationId, serverId);
    const v = await this.prisma.client.serverTraefik.findFirst({ where: { id: versionId, serverId } });
    if (!v) throw new NotFoundException(PROXY_MESSAGES.version_not_found);
    const when = v.createdAt.toISOString().replace('T', ' ').slice(0, 16);
    return this.apply(actor, serverId, { form: this.formOf(v.form), raw: v.raw, baseVersionId, note: `Back to the version of ${when} UTC` }, 'REVERT');
  }

  // ── on the server ───────────────────────────────────────────────────────

  /** Write warden.yml in one go: a temporary name Traefik ignores, then a rename it sees. */
  private async write(run: Run, yaml: string): Promise<void> {
    const r = await run(`docker exec -i ${PROXY} sh -c 'cat > ${FILE}.tmp && mv ${FILE}.tmp ${FILE}'`, yaml);
    if (r.code !== 0) throw new Error(r.stderr || 'write failed');
  }

  private async api<T>(run: Run, path: string): Promise<T> {
    const r = await run(`docker exec ${PROXY} wget -qO- http://127.0.0.1:8080/api/${path}`);
    if (r.code !== 0) throw new Error(`Traefik's status page didn't answer: ${r.stderr.trim()}`);
    return JSON.parse(r.stdout) as T;
  }

  /**
   * Wait until Traefik lists exactly the routers/middlewares/services the new
   * file has, then report anything it disabled. Never showing up at all (e.g.
   * a setting Traefik's schema allows but Traefik won't build) is a refusal too.
   */
  private async waitForLoad(run: Run, config: Record<string, unknown>): Promise<ProxyProblem[]> {
    const want = (section: string) =>
      Object.keys(((config.http as Record<string, Record<string, unknown>> | undefined)?.[section] ?? {}) as object).map((n) => `${n}@file`).sort();
    const expected = { routers: want('routers'), middlewares: want('middlewares'), services: want('services') };
    const end = Date.now() + LOAD_TIMEOUT_MS;
    let last: Record<string, TraefikItem[]> = {};
    while (Date.now() < end) {
      await new Promise((r) => setTimeout(r, 1000));
      const now: Record<string, TraefikItem[]> = {};
      for (const s of ['routers', 'middlewares', 'services'] as const) {
        now[s] = (await this.api<TraefikItem[]>(run, `http/${s}`)).filter((i) => i.provider === 'file');
      }
      last = now;
      const loaded = (['routers', 'middlewares', 'services'] as const).every((s) => JSON.stringify(now[s].map((i) => i.name).sort()) === JSON.stringify(expected[s]));
      if (!loaded) continue;
      const refused = Object.values(now)
        .flat()
        .filter((i) => i.status && i.status !== 'enabled')
        .map((i) => ({ where: 'traefik' as const, line: null, message: `${i.name.replace('@file', '')}: ${(i.error ?? ['disabled by Traefik']).join('; ')}` }));
      return refused;
    }
    const seen = Object.values(last).flat().length;
    return [{ where: 'traefik', line: null, message: seen ? 'Traefik didn’t load the whole new config (some names never appeared). Check its logs for warden.yml' : 'Traefik didn’t pick up the new config' }];
  }

  private async liveRoutes(run: Run, orgId: string, serverId: string): Promise<ProxyLiveRoute[]> {
    const routers = await this.api<TraefikItem[]>(run, 'http/routers');
    const services = await this.prisma.client.service.findMany({ where: { serverId, organizationId: orgId }, select: { id: true, serviceName: true } });
    const byShort = new Map(services.map((s) => [shortId(s.id), s.serviceName]));
    return routers
      .filter((r) => r.provider !== 'internal')
      .map((r) => ({
        name: r.name,
        provider: r.provider,
        serviceName: r.provider === 'docker' ? (byShort.get(r.name.match(/^svc-([0-9a-f]{8})/)?.[1] ?? '') ?? null) : null,
        rule: r.rule ?? '',
        entryPoints: r.entryPoints ?? [],
        tls: !!r.tls,
        status: r.status ?? 'enabled',
        error: r.error?.join('; ') ?? null,
      }))
      .sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async server(orgId: string, serverId: string): Promise<ServerWithKey> {
    const s = await this.prisma.client.server.findFirst({
      where: { id: serverId, organizationId: orgId },
      include: { serverSshKey: { select: { privateKeyEncrypted: true } } },
    });
    if (!s) throw new NotFoundException(PROXY_MESSAGES.server_not_found);
    return s;
  }

  private latestApplied(serverId: string) {
    return this.prisma.client.serverTraefik.findFirst({ where: { serverId, status: 'APPLIED' }, orderBy: { createdAt: 'desc' } });
  }

  private formOf(json: Prisma.JsonValue | null) {
    const r = ProxyFormSchema.safeParse(json);
    return r.success ? r.data : EMPTY_PROXY_FORM;
  }

  private async ssh<T>(orgId: string, server: ServerWithKey, fn: (run: Run) => Promise<T>): Promise<T> {
    const privateKey = decrypt(server.serverSshKey.privateKeyEncrypted, { v1: await this.orgKeys.getDek(orgId) });
    return withSsh({ host: server.serverIp, port: server.serverPort, username: server.serverSSHUsername, privateKey }, (run) => fn(run));
  }

  private async actorName(actor: Actor): Promise<string | null> {
    if (!actor.userId) return null;
    const u = await this.prisma.client.user.findUnique({ where: { id: actor.userId }, select: { firstName: true, lastName: true } });
    return u ? `${u.firstName} ${u.lastName}`.trim() : null;
  }
}
