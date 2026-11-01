import { DATA_LIMITS } from 'shared-types';

/*
 * The pure parts of the data browser: database values → JSON the browser can
 * show, quoting names for SQL, and splitting a Redis command line. Tested.
 */

/** A value as the browser gets it, and whether it was cut to DATA_LIMITS.cellChars. */
export function toCell(v: unknown): { value: unknown; cut: boolean } {
  if (v === null || v === undefined) return { value: null, cut: false };
  if (typeof v === 'bigint') return { value: v.toString(), cut: false };
  if (v instanceof Date) return { value: Number.isNaN(v.getTime()) ? String(v) : v.toISOString(), cut: false };
  if (Buffer.isBuffer(v)) {
    // Shown the way Postgres prints bytea.
    const max = DATA_LIMITS.cellChars / 2;
    return { value: `\\x${v.subarray(0, max).toString('hex')}`, cut: v.length > max };
  }
  if (typeof v === 'string') return cutText(v);
  if (typeof v === 'object') {
    const text = JSON.stringify(v);
    return text.length > DATA_LIMITS.cellChars ? { value: `${text.slice(0, DATA_LIMITS.cellChars)}…`, cut: true } : { value: v, cut: false };
  }
  return { value: v, cut: false };
}

function cutText(s: string): { value: string; cut: boolean } {
  return s.length > DATA_LIMITS.cellChars ? { value: `${s.slice(0, DATA_LIMITS.cellChars)}…`, cut: true } : { value: s, cut: false };
}

/** "my""table" (Postgres) and `my``table` (MySQL). Only ever used for names read from the database's own catalog. */
export const quotePg = (name: string) => `"${name.replace(/"/g, '""')}"`;
export const quoteMy = (name: string) => `\`${name.replace(/`/g, '``')}\``;

/**
 * A Redis command line → its arguments, like redis-cli: spaces separate,
 * "double quotes" allow spaces and \n \t \" \\ \xHH escapes, 'single quotes'
 * are literal. Throws on an unclosed quote.
 */
export function splitArgs(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    while (i < line.length && /\s/.test(line[i]!)) i++;
    if (i >= line.length) break;
    let arg = '';
    let quoted = false;
    while (i < line.length && !/\s/.test(line[i]!)) {
      const c = line[i]!;
      if (c === '"') {
        quoted = true;
        i++;
        for (;;) {
          if (i >= line.length) throw new Error('A "quote" is never closed');
          const d = line[i]!;
          if (d === '"') {
            i++;
            break;
          }
          if (d === '\\' && i + 1 < line.length) {
            const e = line[i + 1]!;
            const hex = /^x([0-9a-fA-F]{2})/.exec(line.slice(i + 1));
            if (hex) {
              arg += String.fromCharCode(parseInt(hex[1]!, 16));
              i += 4;
              continue;
            }
            arg += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e;
            i += 2;
            continue;
          }
          arg += d;
          i++;
        }
      } else if (c === "'") {
        quoted = true;
        const end = line.indexOf("'", i + 1);
        if (end < 0) throw new Error("A 'quote' is never closed");
        arg += line.slice(i + 1, end);
        i = end + 1;
      } else {
        arg += c;
        i++;
      }
    }
    if (arg || quoted) out.push(arg);
  }
  return out;
}

/** A Redis reply → JSON: Buffers become text, errors become { error }. */
export function redisReply(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (Buffer.isBuffer(v)) return cutText(v.toString('utf8')).value;
  if (v instanceof Error) return { error: v.message };
  if (Array.isArray(v)) return v.slice(0, DATA_LIMITS.resultRows).map(redisReply);
  if (typeof v === 'string') return cutText(v).value;
  return v;
}
