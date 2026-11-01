import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import Redis from 'ioredis';
import type { Server, Socket } from 'socket.io';
import { LOG_SOCKET, serverLogChannel, serviceLogChannel, WatchLogsSchema } from 'shared-types';
import { SessionService } from '../auth/session/session.service';
import { TokenService } from '../auth/session/token.service';
import { socketSession, type SocketSession } from '../auth/session/socket-session';
import { LogsService } from './logs.service';
import { ServerLogsService } from './server-logs.service';

const ALLOWED = new Set(['ADMIN', 'DEV_OPS', 'DEVELOPER']);

/**
 * Live logs. The worker publishes each saved batch on Redis (service-log:<id>,
 * server-log:<id>); this relays it to the browsers watching that channel (each
 * channel is also the socket room). `watch` REPLACES what a socket watches (one
 * service, an environment's services, or a server), after checking the session
 * is Developer or up and every id is in its org. The role is checked on each
 * watch, from the session.
 */
@WebSocketGateway({ namespace: LOG_SOCKET.namespace })
export class LogsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(LogsGateway.name);
  @WebSocketServer() private readonly server!: Server;
  private readonly sub: Redis;
  /** Sockets per channel, so a channel is dropped when nobody watches it. */
  private readonly watchers = new Map<string, number>();

  constructor(
    config: ConfigService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly logs: LogsService,
    private readonly serverLogs: ServerLogsService,
  ) {
    this.sub = new Redis(config.getOrThrow<string>('REDIS_URL'));
    this.sub.on('message', (channel: string, message: string) => {
      this.server.to(channel).emit(LOG_SOCKET.lines, message.startsWith('[') ? (JSON.parse(message) as unknown) : []);
    });
  }

  /** Checked once per connection; every message waits on it (see DeployGateway). */
  handleConnection(client: Socket): void {
    client.data.watching = new Set<string>();
    client.data.auth = socketSession(client, this.tokens, this.sessions);
  }

  @SubscribeMessage(LOG_SOCKET.watch)
  async watch(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<{ ok: boolean }> {
    const session = await (client.data.auth as Promise<SocketSession | null> | undefined);
    const parsed = WatchLogsSchema.safeParse(body);
    if (!session || !parsed.success) return { ok: false };
    // Re-read: the role is the one in Redis now, so a demotion stops new watches at once.
    const now = await this.sessions.get(session.sid).catch(() => null);
    if (!now || !ALLOWED.has(now.role)) return { ok: false };
    const serviceIds = [...new Set(parsed.data.serviceIds)];
    if (serviceIds.length && !(await this.logs.allInOrg(session.organizationId, serviceIds))) return { ok: false };
    for (const id of parsed.data.serverIds) if (!(await this.serverLogs.inOrg(session.organizationId, id))) return { ok: false };
    const channels = [...serviceIds.map(serviceLogChannel), ...parsed.data.serverIds.map(serverLogChannel)];

    const watching = client.data.watching as Set<string>;
    for (const ch of [...watching]) if (!channels.includes(ch)) await this.drop(client, ch);
    for (const ch of channels) {
      if (watching.has(ch)) continue;
      watching.add(ch);
      await client.join(ch);
      const n = (this.watchers.get(ch) ?? 0) + 1;
      this.watchers.set(ch, n);
      if (n === 1) await this.sub.subscribe(ch);
    }
    return { ok: true };
  }

  async handleDisconnect(client: Socket): Promise<void> {
    for (const ch of [...((client.data.watching as Set<string> | undefined) ?? [])]) await this.drop(client, ch);
  }

  private async drop(client: Socket, channel: string) {
    const watching = client.data.watching as Set<string> | undefined;
    if (!watching?.delete(channel)) return;
    await client.leave(channel);
    const n = (this.watchers.get(channel) ?? 1) - 1;
    if (n > 0) this.watchers.set(channel, n);
    else {
      this.watchers.delete(channel);
      await this.sub.unsubscribe(channel).catch((e: Error) => this.logger.warn(e.message));
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.sub.quit();
  }
}
