# worker

Plain TypeScript + BullMQ job processors for Warden: everything that talks to servers, so `apps/api` never waits on SSH. See [`docs/BACKEND.md`](../../docs/BACKEND.md) for how this fits with `api` and the shared packages.

## Why no framework here

`apps/api` uses NestJS because it's an HTTP/WS surface with a lot of cross-cutting concerns (auth, DI, modules). `worker` is a set of job consumers with a much simpler shape — plain BullMQ processors reading from a queue. Adding Nest here would mean fighting its request-lifecycle assumptions for something that isn't a request lifecycle at all.

## What it does today (1G: server monitoring)

| Queue | Job | When | What |
|---|---|---|---|
| `monitoring` | `metrics-tick` | every `MONITOR_INTERVAL_SECONDS` (60) | one `collect-server` job per server, deduplicated per server |
| `monitoring` | `collect-server` | from the tick | one SSH session: CPU/memory/disk/load from `/proc` + `df`, containers via `docker ps`/`stats`, Docker disk every 10 min; writes it all in one transaction; sets status |
| `monitoring` | `prune-metrics` | hourly | deletes metric rows older than `METRICS_RETENTION_DAYS` (7) |
| `docker-cleanup` | `docker-cleanup` | enqueued by the api (Run cleanup) | prunes stopped containers, dangling images, build cache, unused networks. **Never** `image prune -a` or `volume prune` |

**Status:** a poll that gets in → `CONNECTED` (containers running) or `IDLE` (nothing running, or no Docker). Three failed polls in a row → `OFFLINE`.

**Alerts** (to the org's notification channels that listen for them): `server.offline` (only for a server that was reachable before), `server.recovered` (only after an offline alert went out), `server.disk_high` (once per crossing of `DISK_HIGH_PERCENT`, re-armed 5 points below), `docker.cleanup_failed`. The small "already alerted" flags live in Redis (`monitor:*` keys).

Targets must be **Linux** (CPU and memory come from `/proc`).

## Layout

```
src/
├── index.ts        boot: schedulers, workers, graceful shutdown (SIGTERM lets jobs finish)
├── env.ts          zod-checked env
├── keys.ts         DekCache (warden-crypto) + SSH target for a server
├── host.ts         /proc + df command and parsers (tested)
├── status.ts       status and disk-alert rules (tested)
├── notify.ts       send an event to an org's channels
├── redis.ts        connection + per-server flags
├── queues.ts
└── jobs/           tick, collect, prune, cleanup
```

## Env

Same `DATABASE_URL`, `REDIS_URL` and `MASTER_KEY` as the api. Optional: `APP_URL` (links in alerts), `RESEND_API_KEY` + `MAIL_FROM` (email alerts), `MONITOR_INTERVAL_SECONDS`, `METRICS_RETENTION_DAYS`, `DISK_HIGH_PERCENT`, `MONITOR_CONCURRENCY`, `NOTIFY_DRY_RUN=true` (log alerts instead of sending, for local testing).

## Running

```bash
pnpm dev      # tsx watch src/index.ts
pnpm build    # tsc -> dist/
pnpm start    # node dist/index.js
pnpm test     # vitest
```

Starting it polls **every server in the database** once a minute. In development, that includes any real server you've added.

Next: the deploy processors (Phase 2).
