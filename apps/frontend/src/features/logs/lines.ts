import type { LogLine, ServerLogSource } from "shared-types";
import type { LogFilters } from "./hooks/useLogs";

/** Server logs: one radio per source instead of All / Errors. */
export const SERVER_SOURCES: ReadonlyArray<{ id: ServerLogSource; name: string }> = [
  { id: "TRAEFIK", name: "Traefik" },
  { id: "DOCKER", name: "Docker" },
  { id: "SYSTEM", name: "System" },
  { id: "WARDEN", name: "Warden" },
];

/** Saved pages (each newest first) + live lines (arrival order) → one list, oldest first, each line once. */
export function mergeLines(pages: LogLine[][], live: LogLine[]): LogLine[] {
  const byId = new Map<string, LogLine>();
  for (const page of pages) for (const l of page) byId.set(l.id, l);
  for (const l of live) byId.set(l.id, l);
  return [...byId.values()].sort(oldestFirst);
}

/** By time, then id (a bigint, as text: longer is bigger). */
export function oldestFirst(a: LogLine, b: LogLine): number {
  const t = Date.parse(a.ts) - Date.parse(b.ts);
  if (t) return t;
  return a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** The filters the server applied to saved lines, applied to live ones too (a search turns live off instead). */
export function matches(l: LogLine, f: Pick<LogFilters, "stream" | "deploymentId" | "source">): boolean {
  if (f.stream && l.stream !== f.stream) return false;
  // A server line's source is in serviceId (see fromServerLine).
  if (f.source && l.serviceId !== f.source) return false;
  if (f.deploymentId && l.deploymentId !== f.deploymentId) return false;
  return true;
}

/** "21:30:01.123", with the day in front when it isn't today. */
export function lineTime(ts: string, now = new Date()): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + "." + String(d.getMilliseconds()).padStart(3, "0");
  return d.toDateString() === now.toDateString() ? time : `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
}

/** Lines as plain text, for Copy. */
export const asText = (lines: LogLine[], name?: (serviceId: string) => string) =>
  lines.map((l) => `${l.ts} ${l.stream === "STDERR" ? "ERR " : ""}${name ? `[${name(l.serviceId)}] ` : ""}${l.message}`).join("\n");

/** Where a search term appears in a line, for highlighting (case-insensitive, like the server's search). */
export function splitMatch(text: string, q: string): Array<{ text: string; hit: boolean }> {
  if (!q) return [{ text, hit: false }];
  const out: Array<{ text: string; hit: boolean }> = [];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let at = 0;
  for (let i = lower.indexOf(needle); i >= 0; i = lower.indexOf(needle, at)) {
    if (i > at) out.push({ text: text.slice(at, i), hit: false });
    out.push({ text: text.slice(i, i + needle.length), hit: true });
    at = i + needle.length;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out;
}
