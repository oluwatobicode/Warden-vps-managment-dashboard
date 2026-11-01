/*
 * How a value from the database is shown and edited. Tested.
 */

/** null → "NULL" (shown differently), objects → JSON, the rest → text. */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** What the edit box starts with: JSON pretty-printed, null empty (NULL is its own switch). */
export function editText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

/** A row's primary key values, as the api wants them back for an edit or delete. */
export function rowKey(columns: Array<{ name: string; pk: boolean }>, row: unknown[]): Record<string, unknown> {
  return Object.fromEntries(columns.flatMap((c, i) => (c.pk ? [[c.name, row[i]]] : [])));
}

/** "2 h 5 min", "45 s", "never" for a Redis expiry in ms (-1 = none, -2 = gone). */
export function ttlText(ms: number): string {
  if (ms < 0) return ms === -1 ? "never" : "gone";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h${m % 60 ? ` ${m % 60} min` : ""}`;
  return `${Math.floor(h / 24)} days`;
}

/** A table's name for a starting query in the SQL box: "schema"."table" (Postgres) or `table` (MySQL). */
export function quoteFor(engine: "POSTGRES" | "MYSQL", t: { schema: string; name: string }): string {
  if (engine === "MYSQL") return `\`${t.name.replace(/`/g, "``")}\``;
  const q = (s: string) => (/^[a-z_][a-z0-9_]*$/.test(s) ? s : `"${s.replace(/"/g, '""')}"`);
  return t.schema === "public" ? q(t.name) : `${q(t.schema)}.${q(t.name)}`;
}
