import { BadRequestException } from '@nestjs/common';
import type { Duplex } from 'node:stream';
import Redis from 'ioredis';
import { DATA_LIMITS, type RedisKey, type RedisValue } from 'shared-types';
import { DATA_MESSAGES } from '../../common/constants/messages.config';
import { redisReply, splitArgs } from './values';

/** Items shown of a hash, list, set, sorted set or stream. */
const ITEMS = 200;
/** Never from the command box: they never return (MONITOR, SUBSCRIBE), or they'd take the server down or away. */
const REFUSED = new Set(['monitor', 'subscribe', 'psubscribe', 'ssubscribe', 'sync', 'psync', 'shutdown', 'debug', 'replicaof', 'slaveof', 'failover', 'quit', 'reset', 'hello', 'auth', 'client']);

/**
 * Redis over the bridge, with ioredis: its Connector option hands it our
 * stream instead of a TCP socket. Keys are listed with SCAN (KEYS * would
 * freeze a big Redis); a value shows its first items only.
 */
export class RedisEngine {
  private constructor(private readonly r: Redis) {}

  static async connect(socket: Duplex, password: string): Promise<RedisEngine> {
    class Over {
      connect() {
        setImmediate(() => socket.emit('connect'));
        return Promise.resolve(socket as never);
      }
      disconnect() {
        socket.destroy();
      }
      check() {
        return true;
      }
    }
    const r = new Redis({
      Connector: Over as never,
      password,
      lazyConnect: true,
      retryStrategy: () => null,
      maxRetriesPerRequest: 0,
      commandTimeout: DATA_LIMITS.timeoutMs,
    });
    r.on('error', () => undefined);
    await r.connect();
    return new RedisEngine(r);
  }

  /** Up to ~100 keys from `cursor` (a few SCAN rounds), each with its type and expiry. */
  async keys(pattern: string, cursor: string): Promise<{ keys: RedisKey[]; cursor: string }> {
    const found: string[] = [];
    let next = cursor;
    for (let i = 0; i < 10; i++) {
      const [c, batch] = await this.r.scan(next, 'MATCH', pattern, 'COUNT', 500);
      found.push(...batch);
      next = c;
      if (next === '0' || found.length >= 100) break;
    }
    const p = this.r.pipeline();
    for (const k of found) p.type(k).pttl(k);
    const out = (await p.exec()) ?? [];
    return {
      keys: found.map((key, i) => ({ key, type: String(out[i * 2]?.[1] ?? 'none'), ttlMs: Number(out[i * 2 + 1]?.[1] ?? -1) })),
      cursor: next,
    };
  }

  async value(key: string): Promise<RedisValue> {
    const [type, ttl] = await Promise.all([this.r.type(key), this.r.pttl(key)]);
    const base = { key, type, ttlMs: ttl };
    const items = (length: number, value: unknown) => ({ ...base, length, value, truncated: length > ITEMS });
    switch (type) {
      case 'none':
        throw new BadRequestException(DATA_MESSAGES.key_not_found);
      case 'string': {
        const [length, text] = await Promise.all([this.r.strlen(key), this.r.getrange(key, 0, DATA_LIMITS.cellChars - 1)]);
        return { ...base, length, value: text, truncated: length > DATA_LIMITS.cellChars };
      }
      case 'hash': {
        const [length, [, flat]] = await Promise.all([this.r.hlen(key), this.r.hscan(key, '0', 'COUNT', String(ITEMS))]);
        return items(length, pairs(flat).slice(0, ITEMS));
      }
      case 'list':
        return items(await this.r.llen(key), await this.r.lrange(key, 0, ITEMS - 1));
      case 'set': {
        const [length, [, members]] = await Promise.all([this.r.scard(key), this.r.sscan(key, '0', 'COUNT', String(ITEMS))]);
        return items(length, members.slice(0, ITEMS));
      }
      case 'zset':
        return items(await this.r.zcard(key), pairs(await this.r.zrange(key, '0', String(ITEMS - 1), 'WITHSCORES')));
      case 'stream':
        return items(await this.r.xlen(key), await this.r.xrevrange(key, '+', '-', 'COUNT', '50'));
      default:
        // e.g. ReJSON-RL (Redis 8's JSON type): show what the command box would.
        return { ...base, length: 0, value: null, truncated: true };
    }
  }

  /** One command line. Writes (and admin commands) come back as needsConfirm unless allowWrites. */
  async command(line: string, allowWrites: boolean): Promise<{ reply: unknown; needsConfirm: string | null }> {
    let args: string[];
    try {
      args = splitArgs(line);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (!args.length) throw new BadRequestException(DATA_MESSAGES.empty_command);
    const [name, ...rest] = args;
    const lower = name!.toLowerCase();
    if (REFUSED.has(lower)) throw new BadRequestException(DATA_MESSAGES.command_refused.replace('{command}', name!.toUpperCase()));
    // A container command (CONFIG, OBJECT…) has its flags on the subcommand.
    const names = rest[0] ? [lower, `${lower}|${rest[0].toLowerCase()}`] : [lower];
    const info = (await this.r.call('COMMAND', 'INFO', ...names)) as Array<[string, number, string[]] | null>;
    if (!info[0]) throw new BadRequestException(DATA_MESSAGES.unknown_command.replace('{command}', name!.toUpperCase()));
    const flags = (info[1] ?? info[0])[2] ?? [];
    if (!allowWrites && (flags.includes('write') || flags.includes('admin'))) {
      return { reply: null, needsConfirm: `${name!.toUpperCase()} ${flags.includes('write') ? 'changes data' : 'is an admin command'}` };
    }
    try {
      return { reply: redisReply(await this.r.call(name!, ...rest)), needsConfirm: null };
    } catch (e) {
      // Redis's own error (wrong type, wrong arguments): the reply, not a failure of Warden.
      return { reply: { error: (e as Error).message }, needsConfirm: null };
    }
  }

  async setString(key: string, value: string, ttlSeconds: number | null): Promise<void> {
    if (ttlSeconds) await this.r.set(key, value, 'EX', ttlSeconds);
    else await this.r.set(key, value, 'KEEPTTL');
  }

  async remove(keys: string[]): Promise<number> {
    return this.r.unlink(...keys);
  }

  async close(): Promise<void> {
    await this.r.quit().catch(() => this.r.disconnect());
  }
}

/** [a, 1, b, 2] → [[a, 1], [b, 2]] */
function pairs(flat: string[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i]!, flat[i + 1]!]);
  return out;
}
