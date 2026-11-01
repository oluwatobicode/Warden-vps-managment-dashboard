import { q } from "docker-client";
import type { ServerLogSource, SourceState } from "shared-types";
import { normalizeTs, untilChannelCloses } from "./lines";

/*
 * The pure parts of collecting a server's own logs: which sources it can
 * read, the follow commands, and parsing journalctl's JSON. Tested.
 */

export type FollowedSource = Exclude<ServerLogSource, "WARDEN">;
export const FOLLOWED_SOURCES: FollowedSource[] = ["TRAEFIK", "DOCKER", "SYSTEM"];

const JOURNAL_GROUPS = `tr ' ' '\\n' | grep -qxE 'systemd-journal|adm|wheel'`;

/**
 * One command, three answers: is there a systemd journal, may this user read
 * the system part of it (root, or in systemd-journal / adm / wheel: anyone
 * else only sees their own messages, silently), and is Warden's Traefik running.
 * `relogin` = the user was added to the group after this SSH login; groups
 * only apply to a new login, so the collector reconnects.
 */
export const PROBE_COMMAND = [
  `if command -v journalctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then`,
  `if [ "$(id -u)" = 0 ] || id -nG | ${JOURNAL_GROUPS}; then echo journal=ok;`,
  `elif id -nG "$(id -un)" | ${JOURNAL_GROUPS}; then echo journal=relogin; else echo journal=denied; fi;`,
  `else echo journal=none; fi;`,
  `if [ "$(docker inspect -f '{{.State.Running}}' warden-traefik 2>/dev/null)" = true ]; then echo traefik=ok; else echo traefik=missing; fi`,
].join(" ");

export function parseProbe(stdout: string): { states: Record<FollowedSource, SourceState>; relogin: boolean } {
  const journal = /journal=(\w+)/.exec(stdout)?.[1];
  const traefik = /traefik=(\w+)/.exec(stdout)?.[1];
  const j: SourceState = journal === "ok" ? "ok" : journal === "denied" || journal === "relogin" ? "no-permission" : journal === "none" ? "no-journal" : "unknown";
  return { states: { TRAEFIK: traefik === "ok" ? "ok" : traefik === "missing" ? "missing" : "unknown", DOCKER: j, SYSTEM: j }, relogin: journal === "relogin" };
}

/** Warden's Traefik, from `since` (a normalized timestamp) or its last 200 lines. Access logs are off, so this is errors and config. */
export function traefikFollowCommand(since: string | null): string {
  if (since !== null && !normalizeTs(since)) throw new Error(`bad timestamp: ${since}`);
  return untilChannelCloses(`exec docker logs -f -t ${since ? `--since ${since}` : "--tail 200"} warden-traefik`);
}

// "s=…;i=…;b=…;m=…;t=…;x=…", hex values.
const JOURNAL_CURSOR = /^[A-Za-z0-9=;_-]{1,512}$/;

/**
 * DOCKER = the Docker daemon's unit; SYSTEM = every unit, warnings and worse
 * (the full journal is mostly noise). Resumes exactly after `cursor` (the
 * journal's own position), or starts from the last 200 entries.
 */
export function journalFollowCommand(source: "DOCKER" | "SYSTEM", cursor: string | null): string {
  if (cursor !== null && !JOURNAL_CURSOR.test(cursor)) throw new Error("bad journal cursor");
  const which = source === "DOCKER" ? "-u docker.service" : "-p warning";
  const from = cursor ? `--after-cursor ${q(cursor)}` : "-n 200";
  // __CURSOR and __REALTIME_TIMESTAMP are always printed, whatever --output-fields says.
  return untilChannelCloses(`exec journalctl ${which} -f -q -o json --output-fields=MESSAGE,SYSLOG_IDENTIFIER,_SYSTEMD_UNIT ${from}`);
}

export interface JournalEntry {
  /** Normalized, like a docker timestamp. */
  ts: string;
  text: string;
  cursor: string;
}

/** One line of `journalctl -o json`. Null when it isn't one, or (SYSTEM) when it's Docker's, which DOCKER already has. */
export function parseJournalLine(line: string, source: "DOCKER" | "SYSTEM"): JournalEntry | null {
  let e: Record<string, unknown>;
  try {
    e = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
  const cursor = e.__CURSOR;
  const us = e.__REALTIME_TIMESTAMP;
  if (typeof cursor !== "string" || typeof us !== "string" || !/^\d{1,20}$/.test(us)) return null;
  if (source === "SYSTEM" && e._SYSTEMD_UNIT === "docker.service") return null;
  const n = BigInt(us);
  const iso = new Date(Number(n / 1000n)).toISOString().slice(0, 19);
  const ts = `${iso}.${String(n % 1_000_000n).padStart(6, "0")}000Z`;
  // A message with binary in it comes as an array of bytes; none at all as null.
  const m = e.MESSAGE;
  const msg = typeof m === "string" ? m : Array.isArray(m) ? Buffer.from(m.filter((b): b is number => typeof b === "number")).toString("utf8") : "";
  const ident = typeof e.SYSLOG_IDENTIFIER === "string" ? e.SYSLOG_IDENTIFIER : null;
  return { ts, text: source === "SYSTEM" && ident ? `${ident}: ${msg}` : msg, cursor };
}
