# @warden/docker-client

Wrapper around [`dockerode`](https://github.com/apocas/dockerode) for talking to a remote Docker daemon — used for container lifecycle management during deploys (build, swap, health check, rollback). Consumed by `apps/worker`.

Kept as a separate package from `@warden/ssh-client` on purpose: SSH is transport, Docker is orchestration. Keeping them independent means either can be tested/mocked separately, and `docker-client` could later be swapped out if the direct-SSH vs. agent-based decision changes.

## Stack

- `dockerode` — Docker Engine API client
- `@types/dockerode` — type definitions
- **Module system**: CommonJS

## Responsibilities (planned)

- Talk to the remote Docker daemon (over the SSH tunnel/socket) rather than shelling raw `docker` commands
- Container build/swap for zero-downtime deploys
- Health check gating before promoting a new container
- Rollback to the previous container on failed health check

## Setup

```bash
pnpm install
```

## Build

```bash
pnpm run build     # tsc -> dist/
pnpm run dev         # tsc --watch
```

## Consuming this package

```bash
pnpm add @warden/docker-client --workspace
```

## Status

Scaffolded shell only — builds clean, no actual Docker orchestration logic implemented yet. Reference: Coolify and Dokploy's docker-compose generation approach, and their reverse-proxy pairing (Traefik/Caddy) for zero-downtime swaps.
