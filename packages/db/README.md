# @warden/db

Prisma schema and client, shared between `apps/api` and `apps/worker`. Single source of truth for all data models — see [`docs/BACKEND.md`](../../docs/BACKEND.md) for why this is a shared package rather than living inside `apps/api`.

## Stack

- **ORM**: Prisma **v7** (stable) — deliberately not v8, which is still an rc rewrite (new "contract" model, no stable matching `@prisma/client` published yet)
- **Database**: PostgreSQL
- **Driver**: `@prisma/adapter-pg` + `pg` (Prisma v7 uses driver adapters rather than the old bundled engine-only approach)
- **Module system**: ESM

## Structure

```
prisma/
  schema.prisma       # not yet written — models TBD
prisma7.config.ts       # Prisma v7 config (datasource URL, migration path)
.env                      # DATABASE_URL
```

## Setup

```bash
pnpm install
```

Set `DATABASE_URL` in `.env`:

```
DATABASE_URL="postgresql://username:password@host:5432/warden?schema=public"
```

## Workflow (once schema is written)

```bash
pnpm exec prisma migrate dev --name <migration-name>   # create + apply a migration
pnpm exec prisma generate                                 # regenerate the client
pnpm exec prisma studio                                     # visual data browser
```

## Consuming this package

`apps/api` and `apps/worker` should add this as a workspace dependency:

```bash
pnpm add @warden/db --workspace
```

Then import the generated client from wherever `schema.prisma`'s `output` points (currently `../generated/prisma`, relative to this package).

## Status

Scaffolded via `prisma init --datasource-provider postgresql --output ../generated/prisma`. Schema is empty — models for Projects, Servers, Services, Deploys, Users, Teams, etc. are not yet defined. Not yet consumed by `api` or `worker`.
