import { Redis } from "ioredis";
import { env } from "./env";

// BullMQ workers block on Redis, which needs maxRetriesPerRequest: null.
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

/*
 * Small per-server flags the worker keeps between polls. Temporary state, so
 * Redis rather than new columns. All expire on their own if a server is deleted.
 */
const DAY = 24 * 3600;
export const flags = {
  failures: (id: string) => `monitor:fail:${id}`,
  /** Set once an offline alert went out, so "back online" only follows a real outage. */
  offlineAlerted: (id: string) => `monitor:offline-alerted:${id}`,
  diskAlerted: (id: string) => `monitor:disk-alerted:${id}`,
  /** Set while Docker can't be used there, so the log says so once, not every minute. */
  dockerMissing: (id: string) => `monitor:docker-missing:${id}`,
};

/** Count one more failed poll; returns the count. */
export async function countFailure(id: string): Promise<number> {
  const n = await redis.incr(flags.failures(id));
  await redis.expire(flags.failures(id), DAY);
  return n;
}

export async function setFlag(key: string): Promise<void> {
  await redis.set(key, "1", "EX", 30 * DAY);
}

export async function hasFlag(key: string): Promise<boolean> {
  return (await redis.exists(key)) === 1;
}
