import { z } from "zod";

/*
 * The data browser (database page → Data): tables and rows of a Warden
 * database, a SQL box (a command box for Redis), and editing. Developer and
 * up. The api reaches the database through a byte bridge over SSH (docker
 * exec into its container), so no port is ever opened. Every query first runs
 * read-only; one that would write comes back as `needsConfirm` and runs only
 * when sent again with `allowWrites`.
 */

export const DATA_LIMITS = {
  /** Rows per page in the table view. */
  pageMax: 200,
  /** Rows kept per result in the SQL box. */
  resultRows: 500,
  /** Longer cells are cut (and can't be edited in the grid; use SQL). */
  cellChars: 10_000,
  /** A query (or command) is stopped after this. */
  timeoutMs: 15_000,
  /** A result bigger than this ends the connection: add a LIMIT. */
  resultBytes: 32 * 1024 * 1024,
  sqlChars: 100_000,
} as const;

const id = z.uuid();
/** Schema and table names are checked against the database's own catalog before use. */
const ident = z.string().min(1).max(128);

export const DataTableSchema = z.object({
  schema: z.string(),
  name: z.string(),
  kind: z.enum(["table", "view"]),
  /** The database's own estimate (no COUNT on big tables). Null when it has none yet. */
  estimate: z.number().nullable(),
});
export type DataTable = z.infer<typeof DataTableSchema>;

export const DataColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
  nullable: z.boolean(),
  /** Has a default, is generated or auto-increments: can be left out of an insert. */
  hasDefault: z.boolean(),
  pk: z.boolean(),
});
export type DataColumn = z.infer<typeof DataColumnSchema>;

export const DataTablesQuerySchema = z.object({ serviceId: id });
export const DataTablesSchema = z.object({ engine: z.enum(["POSTGRES", "MYSQL"]), database: z.string(), tables: z.array(DataTableSchema) });
export type DataTables = z.infer<typeof DataTablesSchema>;

export const DataRowsQuerySchema = z.object({
  serviceId: id,
  schema: ident,
  table: ident,
  offset: z.coerce.number().int().min(0).max(10_000_000).default(0),
  limit: z.coerce.number().int().min(1).max(DATA_LIMITS.pageMax).default(50),
  sort: ident.optional(),
  dir: z.enum(["asc", "desc"]).default("asc"),
});
export type DataRowsQuery = z.infer<typeof DataRowsQuerySchema>;

export const DataRowsSchema = z.object({
  columns: z.array(DataColumnSchema),
  /** One array per row, in `columns` order. */
  rows: z.array(z.array(z.unknown())),
  /** [row, column] of each cell that was cut. */
  cut: z.array(z.tuple([z.number(), z.number()])),
  hasMore: z.boolean(),
  /** No primary key: rows can't be edited or deleted from the grid. */
  editable: z.boolean(),
});
export type DataRows = z.infer<typeof DataRowsSchema>;

export const RunQuerySchema = z.object({
  serviceId: id,
  sql: z.string().trim().min(1, "Write a query").max(DATA_LIMITS.sqlChars),
  allowWrites: z.boolean().default(false),
});
export type RunQueryInput = z.infer<typeof RunQuerySchema>;

export const QueryResultSchema = z.object({
  /** e.g. SELECT, UPDATE; null when the driver doesn't say. */
  command: z.string().nullable(),
  /** Rows returned or changed. */
  rowCount: z.number().nullable(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown())),
  /** More rows came back than DATA_LIMITS.resultRows; only the first are here. */
  truncated: z.boolean(),
});
export type QueryResult = z.infer<typeof QueryResultSchema>;

export const RunQueryResultSchema = z.object({
  results: z.array(QueryResultSchema),
  ms: z.number(),
  /** Set when the query would change data and allowWrites was false: nothing was changed. The database's own words. */
  needsConfirm: z.string().nullable(),
});
export type RunQueryResult = z.infer<typeof RunQueryResultSchema>;

/** A cell value as typed in the grid: text the database converts to the column's type, or null. */
const cellInput = z.string().max(1_000_000).nullable();
/** The primary key values of one row, as the rows endpoint returned them. */
const rowKey = z.record(z.string(), z.unknown());

export const UpdateRowSchema = z.object({
  serviceId: id,
  schema: ident,
  table: ident,
  key: rowKey,
  values: z.record(z.string(), cellInput).refine((v) => Object.keys(v).length > 0, "Nothing to change"),
});
export type UpdateRowInput = z.infer<typeof UpdateRowSchema>;

export const InsertRowSchema = z.object({ serviceId: id, schema: ident, table: ident, values: z.record(z.string(), cellInput) });
export type InsertRowInput = z.infer<typeof InsertRowSchema>;

export const DeleteRowsSchema = z.object({
  serviceId: id,
  schema: ident,
  table: ident,
  keys: z.array(rowKey).min(1).max(100),
  /** The table's name, typed by the person deleting. */
  confirm: z.string(),
});
export type DeleteRowsInput = z.infer<typeof DeleteRowsSchema>;

export const RowsChangedSchema = z.object({ changed: z.number() });
export type RowsChanged = z.infer<typeof RowsChangedSchema>;

/* Redis */

export const RedisKeysQuerySchema = z.object({
  serviceId: id,
  /** SCAN's MATCH: * and ? and [..] wildcards. */
  pattern: z.string().min(1).max(500).default("*"),
  cursor: z.string().regex(/^\d{1,20}$/).default("0"),
});
export type RedisKeysQuery = z.infer<typeof RedisKeysQuerySchema>;

export const RedisKeySchema = z.object({
  key: z.string(),
  type: z.string(),
  /** -1 = never expires. */
  ttlMs: z.number(),
});
export type RedisKey = z.infer<typeof RedisKeySchema>;

export const RedisKeysSchema = z.object({
  keys: z.array(RedisKeySchema),
  /** "0" = the scan is finished. */
  cursor: z.string(),
});
export type RedisKeys = z.infer<typeof RedisKeysSchema>;

export const RedisKeyQuerySchema = z.object({ serviceId: id, key: z.string().min(1).max(10_000) });

export const RedisValueSchema = z.object({
  key: z.string(),
  type: z.string(),
  ttlMs: z.number(),
  /** Length of the string, or number of items. */
  length: z.number(),
  /** string: text; hash: [field, value][]; list/set: string[]; zset: [member, score][]; stream: [id, fields][]. */
  value: z.unknown(),
  /** Only the first part is shown (DATA_LIMITS.cellChars, or the first 200 items). */
  truncated: z.boolean(),
});
export type RedisValue = z.infer<typeof RedisValueSchema>;

export const RedisCommandSchema = z.object({
  serviceId: id,
  /** One command as you'd type it in redis-cli; "quotes" for spaces. */
  command: z.string().trim().min(1, "Type a command").max(DATA_LIMITS.sqlChars),
  allowWrites: z.boolean().default(false),
});
export type RedisCommandInput = z.infer<typeof RedisCommandSchema>;

export const RedisCommandResultSchema = z.object({ reply: z.unknown(), ms: z.number(), needsConfirm: z.string().nullable() });
export type RedisCommandResult = z.infer<typeof RedisCommandResultSchema>;

export const SetRedisStringSchema = z.object({
  serviceId: id,
  key: z.string().min(1).max(10_000),
  value: z.string().max(10_000_000),
  /** Seconds; null = keep the current expiry. */
  ttlSeconds: z.number().int().min(1).max(10 * 365 * 24 * 3600).nullable().default(null),
});
export type SetRedisStringInput = z.infer<typeof SetRedisStringSchema>;

export const DeleteRedisKeysSchema = z.object({ serviceId: id, keys: z.array(z.string().min(1).max(10_000)).min(1).max(100) });
export type DeleteRedisKeysInput = z.infer<typeof DeleteRedisKeysSchema>;
