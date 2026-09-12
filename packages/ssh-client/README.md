# @warden/ssh-client

Thin wrapper around [`ssh2`](https://github.com/mscdex/ssh2) for connecting to and executing commands on registered VPS instances. Consumed by `apps/worker` during deploys.

This is arguably the most load-bearing package in Warden — the whole product depends on this layer being reliable. Direct-SSH is the v1 connection strategy (vs. an agent installed on each target server); that trade-off is documented in `docs/BACKEND.md` / the wider project notes.

## Stack

- `ssh2` — core SSH client
- `@types/ssh2` — type definitions
- **Module system**: CommonJS
- Native bindings (`cpu-features`) compile on install — confirmed working on the dev machine

## Responsibilities (planned)

- Connection pooling — avoid re-establishing SSH connections per command
- `exec` — run remote commands, capture stdout/stderr/exit code
- Streaming output — for live build/deploy logs (may pair with `node-pty` if plain exec streaming isn't sufficient)
- `sftp` — file transfer where needed (e.g. pushing compose files, env files)

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
pnpm add @warden/ssh-client --workspace
```

## Status

Scaffolded shell only — builds clean, no actual connection/exec logic implemented yet. This is the next priority once the direct-SSH vs. agent-based decision is fully closed out.
