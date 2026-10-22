import { Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Server, Socket } from 'socket.io';
import { DEPLOY_SOCKET, deployLogChannel } from 'shared-types';
import { COOKIE } from '../../common/constants/constants.config';
import { TokenService } from '../auth/session/token.service';
import { SessionService } from '../auth/session/session.service';
import { DeployService } from './deploy.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "a=1; warden_access=xyz" → "xyz". */
function cookie(header: string | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/**
 * Live deploy logs. The worker publishes each chunk on Redis
 * (deploy-log:<id>); this relays it to the browsers watching that deploy.
 *
 * Who may watch: the connection is checked like any request (the access
 * cookie's JWT AND its session in Redis, so a revoked session can't listen),
 * and each `watch` checks the deployment belongs to that session's org.
 */
@WebSocketGateway({ namespace: DEPLOY_SOCKET.namespace })
export class DeployGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(DeployGateway.name);
  @WebSocketServer() private readonly server!: Server;
  /** One Redis connection in subscribe mode, shared by every viewer. */
  private readonly sub: Redis;
  /** How many sockets watch each deployment, so its channel is dropped when nobody does. */
  private readonly watchers = new Map<string, number>();

  constructor(
    config: ConfigService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly deploys: DeployService,
  ) {
    this.sub = new Redis(config.getOrThrow<string>('REDIS_URL'));
    this.sub.on('message', (channel: string, message: string) => {
      const id = channel.slice('deploy-log:'.length);
      try {
        const chunk = JSON.parse(message) as { seq: number; text: string };
        this.server.to(id).emit(DEPLOY_SOCKET.log, { deploymentId: id, ...chunk });
      } catch {
        // a malformed message is dropped
      }
    });
  }

  /**
   * The cookie check is async, and a browser sends `watch` the moment it's
   * connected, so the check is kept as a promise every message waits on
   * (otherwise an early `watch` sees "not logged in" and is dropped).
   */
  handleConnection(client: Socket): void {
    client.data.watching = new Set<string>();
    client.data.auth = this.authenticate(client);
  }

  private async authenticate(client: Socket): Promise<string | null> {
    try {
      const token = cookie(client.handshake.headers.cookie, COOKIE.access);
      if (!token) throw new Error('no cookie');
      const claims = await this.tokens.verifyAccess(token);
      const session = await this.sessions.get(claims.sid);
      if (!session) throw new Error('no session');
      return session.organizationId;
    } catch {
      // The browser refreshes its cookie and reconnects (see useDeployLog).
      client.emit('unauthorized');
      client.disconnect(true);
      return null;
    }
  }

  @SubscribeMessage(DEPLOY_SOCKET.watch)
  async watch(@ConnectedSocket() client: Socket, @MessageBody() deploymentId: unknown): Promise<{ ok: boolean }> {
    const orgId = await (client.data.auth as Promise<string | null> | undefined);
    if (!orgId || typeof deploymentId !== 'string' || !UUID.test(deploymentId)) return { ok: false };
    try {
      await this.deploys.assertDeployment(orgId, deploymentId);
    } catch {
      return { ok: false };
    }
    const watching = client.data.watching as Set<string>;
    if (watching.has(deploymentId)) return { ok: true };
    watching.add(deploymentId);
    await client.join(deploymentId);
    const n = (this.watchers.get(deploymentId) ?? 0) + 1;
    this.watchers.set(deploymentId, n);
    if (n === 1) await this.sub.subscribe(deployLogChannel(deploymentId));
    return { ok: true };
  }

  @SubscribeMessage(DEPLOY_SOCKET.unwatch)
  async unwatch(@ConnectedSocket() client: Socket, @MessageBody() deploymentId: unknown): Promise<void> {
    if (typeof deploymentId === 'string') await this.drop(client, deploymentId);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    for (const id of [...((client.data.watching as Set<string> | undefined) ?? [])]) await this.drop(client, id);
  }

  private async drop(client: Socket, deploymentId: string) {
    const watching = client.data.watching as Set<string> | undefined;
    if (!watching?.delete(deploymentId)) return;
    await client.leave(deploymentId);
    const n = (this.watchers.get(deploymentId) ?? 1) - 1;
    if (n > 0) this.watchers.set(deploymentId, n);
    else {
      this.watchers.delete(deploymentId);
      await this.sub.unsubscribe(deployLogChannel(deploymentId)).catch((e: Error) => this.logger.warn(e.message));
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.sub.quit();
  }
}
