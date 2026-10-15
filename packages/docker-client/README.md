# docker-client

Typed wrappers around the **Docker CLI**, run on a remote server over whatever command runner you hand it. In Warden that runner is the `run` from `ssh-client`'s `withSsh`, so one SSH session serves a whole poll. Consumed by `apps/worker` (monitoring, cleanup) and `apps/api` (cleanup preview).

Kept as a separate package from `ssh-client` on purpose: SSH is transport, Docker is orchestration. This package never imports `ssh-client`; it only needs a `run(cmd) → { code, stdout, stderr }`, which is also how the tests fake a server.

## Why the CLI, not dockerode (decided 2026-10-15)

Originally planned around `dockerode`. Monitoring already holds an SSH session (it reads `/proc` for CPU and memory), so asking `docker … --format '{{json .}}'` over that same session costs nothing, while dockerode over SSH would open a **second** connection per poll and relies on `docker system dial-stdio` on the target. If deploys (Phase 2) need streaming the CLI can't give, revisit then.

## What's here

| | |
|---|---|
| `parse.ts` | Pure parsers: sizes (`1.2GB`, `3.9MiB`), `docker ps` / `stats` / `system df` JSON lines, prune output. Tested against sample output. |
| `docker.ts` | `listContainers`, `diskUsage`, `cleanupPreview`, `runCleanup`, `dockerVersion` |
| `run.ts` | The `Run` type and `DockerError` (`not_installed`, `permission_denied`, `failed`) |

Every command is a fixed string; nothing from a user reaches the shell.

**Cleanup never runs `image prune -a` or `volume prune`.** `-a` deletes every image not running right now, including the previous release a rollback needs; volumes hold database data and have no undo.

## Scripts

```bash
pnpm build    # tsc -> dist/
pnpm test     # vitest
```
