import { z } from "zod";

/*
 * App logs: what a running service prints (docker logs). The worker follows
 * every Warden container over SSH, saves each line for LOG_LIMITS.retentionDays
 * and publishes it live; the api serves search and scroll-back. Developer and
 * up only: logs often contain things that shouldn't be shown to everyone.
 */

export const LOG_LIMITS = {
  retentionDays: 7,
  /** Longer lines are cut, with "…[cut]". */
  lineChars: 16_384,
  /** Per service. Past this, lines are dropped and one "lines dropped" line is saved instead. */
  linesPerSecond: 200,
  /** A page of lines. */
  pageMax: 500,
} as const;

/** WARDEN = a line Warden wrote itself (e.g. "1,240 lines dropped"). */
export const LogStreamSchema = z.enum(["STDOUT", "STDERR", "WARDEN"]);
export type LogStream = z.infer<typeof LogStreamSchema>;

export const LogLineSchema = z.object({
  /** A bigint, sent as text. Orders lines with the same timestamp. */
  id: z.string(),
  serviceId: z.string(),
  /** The version that printed it. Null for databases (they aren't deployed). */
  deploymentId: z.string().nullable(),
  stream: LogStreamSchema,
  /** Docker's timestamp for the line, not when Warden saved it. */
  ts: z.iso.datetime(),
  message: z.string(),
});
export type LogLine = z.infer<typeof LogLineSchema>;

/**
 * GET /logs : newest first. One of serviceId or environmentId (every service
 * in it, merged). `before` is the previous page's nextCursor.
 */
export const ListLogsQuerySchema = z
  .object({
    serviceId: z.uuid().optional(),
    environmentId: z.uuid().optional(),
    q: z.string().trim().min(2, "Search for at least 2 characters").max(200).optional(),
    stream: LogStreamSchema.optional(),
    deploymentId: z.uuid().optional(),
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
    before: z.string().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(LOG_LIMITS.pageMax).default(200),
  })
  .refine((v) => !!v.serviceId !== !!v.environmentId, { message: "Pick a service or an environment", path: ["serviceId"] });
export type ListLogsQuery = z.infer<typeof ListLogsQuerySchema>;

export const LogPageSchema = z.object({
  items: z.array(LogLineSchema),
  nextCursor: z.string().nullable(),
});
export type LogPage = z.infer<typeof LogPageSchema>;

/** GET /logs/:id/context : the lines around one line (a search hit), oldest first. */
export const LogContextSchema = z.object({
  items: z.array(LogLineSchema),
  /** The line asked about. */
  id: z.string(),
});
export type LogContext = z.infer<typeof LogContextSchema>;

/** Redis channel the worker publishes a service's new lines on (a JSON LogLine[]). */
export const serviceLogChannel = (serviceId: string) => `service-log:${serviceId}`;

/**
 * Socket.io (namespace /logs). The browser sends `watch` with up to
 * LOG_SOCKET.maxWatch service ids; the api checks they're all in the
 * session's org and that the role is Developer or up, then streams `lines`.
 */
export const LOG_SOCKET = { namespace: "/logs", watch: "watch", lines: "lines", maxWatch: 100 } as const;
export const WatchLogsSchema = z
  .object({
    serviceIds: z.array(z.uuid()).max(LOG_SOCKET.maxWatch).default([]),
    /** A server's own logs (server page → Logs). One server at a time. */
    serverIds: z.array(z.uuid()).max(1).default([]),
  })
  .refine((v) => v.serviceIds.length + v.serverIds.length > 0, { message: "Watch at least one service or server" });
export type WatchLogsInput = z.infer<typeof WatchLogsSchema>;

/*
 * Server logs (server page → Logs): the server's own logs, collected on the
 * same SSH connection as its apps' logs, kept and limited the same way.
 */

export const ServerLogSourceSchema = z.enum(["TRAEFIK", "DOCKER", "SYSTEM", "WARDEN"]);
export type ServerLogSource = z.infer<typeof ServerLogSourceSchema>;

export const ServerLogLineSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  source: ServerLogSourceSchema,
  ts: z.iso.datetime(),
  message: z.string(),
});
export type ServerLogLine = z.infer<typeof ServerLogLineSchema>;

/** GET /server-logs : newest first, like GET /logs. */
export const ListServerLogsQuerySchema = z.object({
  serverId: z.uuid(),
  q: z.string().trim().min(2, "Search for at least 2 characters").max(200).optional(),
  source: ServerLogSourceSchema.optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  before: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(LOG_LIMITS.pageMax).default(200),
});
export type ListServerLogsQuery = z.infer<typeof ListServerLogsQuerySchema>;

export const ServerLogPageSchema = z.object({ items: z.array(ServerLogLineSchema), nextCursor: z.string().nullable() });
export type ServerLogPage = z.infer<typeof ServerLogPageSchema>;

export const ServerLogContextSchema = z.object({ items: z.array(ServerLogLineSchema), id: z.string() });
export type ServerLogContext = z.infer<typeof ServerLogContextSchema>;

/**
 * Whether the worker can read a source on that server. `missing` = Traefik
 * isn't set up; `no-journal` = no systemd journal (e.g. inside a container);
 * `no-permission` = the SSH user can't read the system journal; `unknown` =
 * not checked yet (the server hasn't been reached since the worker started).
 */
export const SourceStateSchema = z.enum(["ok", "missing", "no-journal", "no-permission", "unknown"]);
export type SourceState = z.infer<typeof SourceStateSchema>;

/** GET /server-logs/sources?serverId= */
export const ServerLogSourcesSchema = z.object({
  sources: z.array(z.object({ source: ServerLogSourceSchema, state: SourceStateSchema })),
  /** For the "add the user to systemd-journal" hint. */
  sshUser: z.string(),
});
export type ServerLogSources = z.infer<typeof ServerLogSourcesSchema>;

/** Redis channel the worker publishes a server's new lines on (a JSON ServerLogLine[]). */
export const serverLogChannel = (serverId: string) => `server-log:${serverId}`;
/** Redis hash the worker keeps each source's SourceState in. */
export const serverSourcesKey = (serverId: string) => `logs:server-sources:${serverId}`;
