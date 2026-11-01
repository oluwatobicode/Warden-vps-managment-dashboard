import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { Duplex } from 'node:stream';
import * as mysql from 'mysql2/promise';
import { Client, types as pgTypes } from 'pg';
import { DATA_LIMITS, type DataColumn, type DataTable, type QueryResult } from 'shared-types';
import { DATA_MESSAGES } from '../../common/constants/messages.config';
import { quoteMy, quotePg, toCell } from './values';

export interface SqlCredentials {
  user: string;
  password: string;
  database: string;
}

export interface PageOptions {
  offset: number;
  limit: number;
  sort?: string;
  dir: 'asc' | 'desc';
}

/**
 * Postgres and MySQL behind one shape. The base class owns what's the same
 * (names checked against the catalog, the key WHERE, edits in a transaction
 * that must touch exactly one row each); the two subclasses are the dialect.
 * Table and column names only ever come from the database's own catalog,
 * values only ever go in as parameters.
 */
export abstract class SqlEngine {
  abstract readonly engine: 'POSTGRES' | 'MYSQL';
  constructor(readonly database: string) {}

  abstract tables(): Promise<DataTable[]>;
  protected abstract catalogColumns(schema: string, table: string): Promise<DataColumn[]>;
  protected abstract quote(name: string): string;
  protected abstract ph(i: number): string;
  /** Parameterized statement → rows as arrays, and how many rows it changed. */
  protected abstract exec(sql: string, params: unknown[]): Promise<{ rows: unknown[][]; changed: number }>;
  /** The user's own SQL: read-only unless allowWrites; the database says if it would write. */
  abstract run(sql: string, allowWrites: boolean): Promise<{ results: QueryResult[]; needsConfirm: string | null }>;
  abstract close(): Promise<void>;
  /** How a value from the grid goes in as a parameter for this column. */
  protected param(_c: DataColumn, v: unknown): unknown {
    return v;
  }

  /** The table's columns; 404 if it isn't there (or isn't visible to Warden's user). */
  async columns(schema: string, table: string): Promise<DataColumn[]> {
    const cols = await this.catalogColumns(schema, table);
    if (!cols.length) throw new NotFoundException(DATA_MESSAGES.table_not_found.replace('{table}', table));
    return cols;
  }

  async page(schema: string, table: string, cols: DataColumn[], o: PageOptions) {
    const pk = cols.filter((c) => c.pk);
    let order = '';
    if (o.sort) {
      if (!cols.some((c) => c.name === o.sort)) throw new BadRequestException(DATA_MESSAGES.column_not_found.replace('{column}', o.sort));
      order = ` ORDER BY ${this.quote(o.sort)} ${o.dir === 'desc' ? 'DESC' : 'ASC'}`;
    } else if (pk.length) order = ` ORDER BY ${pk.map((c) => this.quote(c.name)).join(', ')}`;
    const { rows } = await this.exec(`SELECT * FROM ${this.table(schema, table)}${order} LIMIT ${this.ph(1)} OFFSET ${this.ph(2)}`, [o.limit + 1, o.offset]);
    const cut: Array<[number, number]> = [];
    const out = rows.slice(0, o.limit).map((r, ri) =>
      r.map((v, ci) => {
        const cell = toCell(v);
        if (cell.cut) cut.push([ri, ci]);
        return cell.value;
      }),
    );
    return { rows: out, cut, hasMore: rows.length > o.limit };
  }

  async update(schema: string, table: string, key: Record<string, unknown>, values: Record<string, string | null>): Promise<number> {
    const cols = await this.columns(schema, table);
    const set = this.pick(cols, values);
    if (!set.length) throw new BadRequestException(DATA_MESSAGES.nothing_to_change);
    const where = this.keyWhere(cols, key, set.length);
    const sql = `UPDATE ${this.table(schema, table)} SET ${set.map(([c], i) => `${this.quote(c.name)} = ${this.ph(i + 1)}`).join(', ')} WHERE ${where.sql}`;
    return this.inTransaction(async () => this.exactlyOne(await this.exec(sql, [...set.map(([c, v]) => this.param(c, v)), ...where.params])));
  }

  async insert(schema: string, table: string, values: Record<string, string | null>): Promise<number> {
    const cols = await this.columns(schema, table);
    const set = this.pick(cols, values);
    const sql = set.length
      ? `INSERT INTO ${this.table(schema, table)} (${set.map(([c]) => this.quote(c.name)).join(', ')}) VALUES (${set.map((_, i) => this.ph(i + 1)).join(', ')})`
      : this.emptyInsert(this.table(schema, table));
    return (await this.exec(sql, set.map(([c, v]) => this.param(c, v)))).changed;
  }

  async remove(schema: string, table: string, keys: Array<Record<string, unknown>>): Promise<number> {
    const cols = await this.columns(schema, table);
    return this.inTransaction(async () => {
      let n = 0;
      for (const key of keys) {
        const where = this.keyWhere(cols, key, 0);
        n += this.exactlyOne(await this.exec(`DELETE FROM ${this.table(schema, table)} WHERE ${where.sql}`, where.params));
      }
      return n;
    });
  }

  protected table(schema: string, table: string): string {
    return `${this.quote(schema)}.${this.quote(table)}`;
  }

  protected emptyInsert(table: string): string {
    return `INSERT INTO ${table} DEFAULT VALUES`;
  }

  private pick(cols: DataColumn[], values: Record<string, string | null>): Array<[DataColumn, string | null]> {
    return Object.entries(values).map(([name, v]) => {
      const c = cols.find((x) => x.name === name);
      if (!c) throw new BadRequestException(DATA_MESSAGES.column_not_found.replace('{column}', name));
      return [c, v];
    });
  }

  /** WHERE pk1 = $n AND pk2 = $n+1, from the row's key as the grid got it. Every primary key column, nothing else. */
  private keyWhere(cols: DataColumn[], key: Record<string, unknown>, offset: number) {
    const pk = cols.filter((c) => c.pk);
    if (!pk.length) throw new ConflictException(DATA_MESSAGES.no_primary_key);
    if (Object.keys(key).length !== pk.length || pk.some((c) => !(c.name in key))) throw new BadRequestException(DATA_MESSAGES.bad_key);
    return {
      sql: pk.map((c, i) => `${this.quote(c.name)} = ${this.ph(offset + i + 1)}`).join(' AND '),
      params: pk.map((c) => this.param(c, key[c.name])),
    };
  }

  private exactlyOne(r: { changed: number }): number {
    // 0 = someone changed or deleted it meanwhile; >1 can't happen with a full primary key, but never let it through.
    if (r.changed !== 1) throw new ConflictException(DATA_MESSAGES.row_changed);
    return 1;
  }

  private async inTransaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.exec('BEGIN', []);
    try {
      const out = await fn();
      await this.exec('COMMIT', []);
      return out;
    } catch (e) {
      await this.exec('ROLLBACK', []).catch(() => undefined);
      throw e;
    }
  }
}

/** Dates and times stay the database's text: no time zone shifts, no lost precision. */
const AS_TEXT = new Set([1082, 1083, 1114, 1184, 1186, 1266]);

export class PostgresEngine extends SqlEngine {
  readonly engine = 'POSTGRES' as const;

  private constructor(
    private readonly client: Client,
    database: string,
  ) {
    super(database);
  }

  static async connect(socket: Duplex, c: SqlCredentials): Promise<PostgresEngine> {
    const client = new Client({
      stream: () => socket as never,
      user: c.user,
      password: c.password,
      database: c.database,
      types: { getTypeParser: ((oid: number, format?: 'text' | 'binary') => (AS_TEXT.has(oid) ? (v: string) => v : pgTypes.getTypeParser(oid, format))) as never },
    });
    client.on('error', () => undefined);
    await client.connect();
    await client.query(`SET statement_timeout = ${DATA_LIMITS.timeoutMs}; SET lock_timeout = 5000; SET application_name = 'warden data browser'`);
    return new PostgresEngine(client, c.database);
  }

  protected quote = quotePg;
  protected ph = (i: number) => `$${i}`;

  protected async exec(sql: string, params: unknown[]) {
    const r = await this.client.query({ text: sql, values: params, rowMode: 'array' });
    return { rows: r.rows as unknown[][], changed: r.rowCount ?? 0 };
  }

  async tables(): Promise<DataTable[]> {
    const r = await this.client.query<{ schema: string; name: string; kind: string; estimate: string }>(
      `SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind, c.reltuples::bigint AS estimate
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p', 'f', 'v', 'm') AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
        ORDER BY n.nspname = 'public' DESC, n.nspname, c.relname`,
    );
    return r.rows.map((t) => ({
      schema: t.schema,
      name: t.name,
      kind: t.kind === 'v' || t.kind === 'm' ? 'view' : 'table',
      // -1 = never analyzed (Postgres 14+).
      estimate: Number(t.estimate) < 0 ? null : Number(t.estimate),
    }));
  }

  protected async catalogColumns(schema: string, table: string): Promise<DataColumn[]> {
    const r = await this.client.query<DataColumn>(
      `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, NOT a.attnotnull AS nullable,
              (a.atthasdef OR a.attidentity <> '' OR a.attgenerated <> '') AS "hasDefault",
              COALESCE(a.attnum = ANY (i.indkey), false) AS pk
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_index i ON i.indrelid = c.oid AND i.indisprimary
        WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum`,
      [schema, table],
    );
    return r.rows;
  }

  async run(sql: string, allowWrites: boolean) {
    await this.client.query(`SET SESSION CHARACTERISTICS AS TRANSACTION ${allowWrites ? 'READ WRITE' : 'READ ONLY'}`);
    try {
      const r = (await this.client.query({ text: sql, rowMode: 'array' })) as unknown;
      const list = (Array.isArray(r) ? r : [r]) as Array<{ command: string | null; rowCount: number | null; fields?: Array<{ name: string }>; rows?: unknown[][] }>;
      return { results: list.map((x) => result(x.command ?? null, x.rowCount ?? null, (x.fields ?? []).map((f) => f.name), x.rows ?? [])), needsConfirm: null };
    } catch (e) {
      // 25006 = read_only_sql_transaction: it would write. Nothing was changed.
      if (!allowWrites && (e as { code?: string }).code === '25006') return { results: [], needsConfirm: (e as Error).message };
      throw e;
    }
  }

  async close(): Promise<void> {
    await this.client.end().catch(() => undefined);
  }
}

export class MysqlEngine extends SqlEngine {
  readonly engine = 'MYSQL' as const;

  private constructor(
    private readonly conn: mysql.Connection,
    database: string,
  ) {
    super(database);
  }

  static async connect(socket: Duplex, c: SqlCredentials): Promise<MysqlEngine> {
    const conn = await mysql.createConnection({
      stream: socket as never,
      user: c.user,
      password: c.password,
      database: c.database,
      multipleStatements: true,
      // Text, like Postgres above: no time zone shifts, no rounding of big numbers.
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
    });
    conn.on('error', () => undefined);
    // MAX_EXECUTION_TIME only stops SELECTs; writes are bounded by the bridge's timer.
    await conn.query(`SET SESSION MAX_EXECUTION_TIME = ${DATA_LIMITS.timeoutMs}, SESSION innodb_lock_wait_timeout = 5`);
    return new MysqlEngine(conn, c.database);
  }

  protected quote = quoteMy;
  protected ph = () => '?';

  /** MySQL has one schema per database: Warden's user sees only its own. */
  protected table(schema: string, table: string): string {
    if (schema !== this.database) throw new NotFoundException(DATA_MESSAGES.table_not_found.replace('{table}', table));
    return quoteMy(table);
  }

  protected emptyInsert(table: string): string {
    return `INSERT INTO ${table} () VALUES ()`;
  }

  /** Binary columns came back as \x… text (see toCell): turn it back into bytes. */
  protected param(c: DataColumn, v: unknown): unknown {
    if (typeof v === 'string' && /binary|blob/i.test(c.type) && /^\\x([0-9a-f]{2})*$/i.test(v)) return Buffer.from(v.slice(2), 'hex');
    return v;
  }

  protected async exec(sql: string, params: unknown[]) {
    const [r] = await this.conn.query({ sql, values: params, rowsAsArray: true });
    if (Array.isArray(r)) return { rows: r as unknown as unknown[][], changed: 0 };
    return { rows: [], changed: (r as mysql.ResultSetHeader).affectedRows };
  }

  async tables(): Promise<DataTable[]> {
    const [rows] = await this.conn.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME AS name, TABLE_TYPE AS kind, TABLE_ROWS AS estimate FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`,
    );
    return rows.map((t) => ({
      schema: this.database,
      name: String(t.name),
      kind: String(t.kind).includes('VIEW') ? 'view' : 'table',
      estimate: t.estimate === null ? null : Number(t.estimate),
    }));
  }

  protected async catalogColumns(schema: string, table: string): Promise<DataColumn[]> {
    if (schema !== this.database) return [];
    const [rows] = await this.conn.query<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE = 'YES' AS nullable,
              (COLUMN_DEFAULT IS NOT NULL OR EXTRA LIKE '%auto_increment%' OR EXTRA LIKE '%GENERATED%') AS hasDefault,
              COLUMN_KEY = 'PRI' AS pk
         FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
      [table],
    );
    return rows.map((c) => ({ name: String(c.name), type: String(c.type), nullable: !!Number(c.nullable), hasDefault: !!Number(c.hasDefault), pk: !!Number(c.pk) }));
  }

  async run(sql: string, allowWrites: boolean) {
    await this.conn.query(`SET SESSION TRANSACTION ${allowWrites ? 'READ WRITE' : 'READ ONLY'}`);
    try {
      const [r, fields] = (await this.conn.query({ sql, rowsAsArray: true })) as unknown as [unknown, unknown];
      // One SELECT: fields is a list of columns. One other statement: no fields. Several: one entry per statement.
      const single = !Array.isArray(fields) || (fields.length > 0 && !Array.isArray(fields[0]) && fields[0] !== undefined && fields[0] !== null);
      const parts = single ? [[r, fields]] : (r as unknown[]).map((x, i) => [x, (fields as unknown[])[i]]);
      return {
        results: parts.map(([res, f]) =>
          Array.isArray(res)
            ? result('SELECT', res.length, ((f as Array<{ name: string }> | undefined) ?? []).map((x) => x.name), res as unknown[][])
            : result(null, (res as mysql.ResultSetHeader).affectedRows, [], []),
        ),
        needsConfirm: null,
      };
    } catch (e) {
      // 1792 = ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION (DML and DDL alike).
      if (!allowWrites && (e as { errno?: number }).errno === 1792) return { results: [], needsConfirm: (e as Error).message };
      throw e;
    }
  }

  async close(): Promise<void> {
    await this.conn.end().catch(() => undefined);
  }
}

function result(command: string | null, rowCount: number | null, columns: string[], rows: unknown[][]): QueryResult {
  return {
    command,
    rowCount,
    columns,
    rows: rows.slice(0, DATA_LIMITS.resultRows).map((r) => r.map((v) => toCell(v).value)),
    truncated: rows.length > DATA_LIMITS.resultRows,
  };
}
