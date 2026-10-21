import type { DatabaseEngine } from "shared-types";

/*
 * How each engine is started, beyond what the shared catalog says. These
 * strings run INSIDE the container, so "$VARS" are filled in from the
 * container's own environment: passwords never appear in a command.
 */

export interface EngineSecrets {
  password: string;
  rootPassword: string | null;
  databaseName: string | null;
  username: string | null;
}

/** KEY=value lines for --env-file. Passwords are letters and digits only, so nothing needs escaping. */
export function envFileFor(engine: DatabaseEngine, s: EngineSecrets): string {
  const lines: Record<DatabaseEngine, string[]> = {
    POSTGRES: [`POSTGRES_USER=${s.username}`, `POSTGRES_PASSWORD=${s.password}`, `POSTGRES_DB=${s.databaseName}`],
    MYSQL: [`MYSQL_ROOT_PASSWORD=${s.rootPassword}`, `MYSQL_DATABASE=${s.databaseName}`, `MYSQL_USER=${s.username}`, `MYSQL_PASSWORD=${s.password}`],
    REDIS: [`REDIS_PASSWORD=${s.password}`],
  };
  return lines[engine].join("\n") + "\n";
}

/**
 * The health check. Over 127.0.0.1 on purpose: during first boot Postgres
 * and MySQL run a temporary server with no networking, and a socket check
 * would call that "ready" before the real server is up.
 */
export const HEALTH_CMD: Record<DatabaseEngine, string> = {
  POSTGRES: 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
  MYSQL: 'mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent',
  REDIS: 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping | grep -q PONG',
};

/**
 * Redis has no password variable, so its command passes one in. Going back
 * through the image's entrypoint keeps it dropping root before starting.
 * --appendonly yes: writes go to disk, so a restart doesn't lose data.
 */
export const COMMAND: Partial<Record<DatabaseEngine, string[]>> = {
  REDIS: ["sh", "-c", 'exec docker-entrypoint.sh redis-server --appendonly yes --requirepass "$REDIS_PASSWORD"'],
};

/**
 * Backups. Each dump runs inside the container (`docker exec <c> sh -c …`)
 * and writes to stdout, which streams back over SSH. `gzip`: the worker
 * compresses it (Postgres's custom format is already compressed).
 */
export const BACKUP: Record<DatabaseEngine, { dump: string; gzip: boolean; ext: string; restore?: string }> = {
  POSTGRES: {
    dump: 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom',
    gzip: false,
    ext: "dump",
    restore: 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction',
  },
  MYSQL: {
    dump: 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --no-tablespaces --set-gtid-purged=OFF "$MYSQL_DATABASE"',
    gzip: true,
    ext: "sql.gz",
    restore: 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"',
  },
  // Redis is restored by swapping its snapshot file (see jobs/backup.ts).
  REDIS: { dump: 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli --rdb -', gzip: true, ext: "rdb.gz" },
};
