import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { io } from "socket.io-client";
import {
  LOG_SOCKET,
  type LogContext,
  type LogLine,
  type LogPage,
  type LogStream,
  type ServerLogContext,
  type ServerLogLine,
  type ServerLogPage,
  type ServerLogSource,
  type ServerLogSources,
} from "shared-types";
import { api, axiosInstance } from "../../../api/axiosinstance";

/** What a log view reads: one service, every service in an environment, or a server's own logs. */
export type LogScope = { serviceId: string } | { environmentId: string } | { serverId: string };

export interface LogFilters {
  q: string;
  stream: LogStream | "";
  deploymentId: string;
  /** Minutes back; 0 = everything kept (7 days). */
  sinceMinutes: number;
  /** Server logs only. */
  source: ServerLogSource | "";
}

/**
 * A server's line, shown by the same viewer as an app's: its "service" is its
 * source (the viewer tags each line with that name), and Warden's own lines
 * keep their colour.
 */
export const fromServerLine = (l: ServerLogLine): LogLine => ({
  id: l.id,
  serviceId: l.source,
  deploymentId: null,
  stream: l.source === "WARDEN" ? "WARDEN" : "STDOUT",
  ts: l.ts,
  message: l.message,
});

export const logKeys = {
  all: ["logs"] as const,
  page: (scope: LogScope, f: LogFilters) => ["logs", scope, f] as const,
  context: (id: string, server: boolean) => ["logs", "context", server ? "server" : "service", id] as const,
  sources: (serverId: string) => ["logs", "sources", serverId] as const,
};

/**
 * Saved lines, newest page first; `fetchNextPage` reads older ones. Fetched
 * once per filter: new lines come over the socket (useLiveLogs), not by
 * refetching, so the list never jumps under the reader.
 */
export function useLogHistory(scope: LogScope, f: LogFilters) {
  return useInfiniteQuery({
    queryKey: logKeys.page(scope, f),
    queryFn: async ({ pageParam }): Promise<LogPage> => {
      const common = {
        limit: "200",
        ...(f.q && { q: f.q }),
        ...(f.sinceMinutes && { from: new Date(Date.now() - f.sinceMinutes * 60_000).toISOString() }),
        ...(pageParam && { before: pageParam }),
      };
      if ("serverId" in scope) {
        const page = await api.get<ServerLogPage>("/server-logs", { serverId: scope.serverId, ...common, ...(f.source && { source: f.source }) });
        return { items: page.items.map(fromServerLine), nextCursor: page.nextCursor };
      }
      return api.get<LogPage>("/logs", {
        ...scope,
        ...common,
        ...(f.stream && { stream: f.stream }),
        ...(f.deploymentId && { deploymentId: f.deploymentId }),
      });
    },
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** Live lines kept in memory at most; older ones are still a scroll away (saved). */
const LIVE_MAX = 20_000;

/** What a live view watches: services, or one server's own logs. */
export type LiveWatch = { serviceIds: string[] } | { serverIds: string[] };

/**
 * New lines as they're saved, for what's watched. `enabled` false (a
 * search is showing) disconnects. Lines come back in arrival order.
 */
export function useLiveLogs(watch: LiveWatch, enabled: boolean, onConnect: () => void) {
  const key = JSON.stringify(watch);
  const session = enabled ? key : "";
  // Lines belong to one (services, enabled) session: a new one starts empty.
  const [got, setGot] = useState<{ session: string; lines: LogLine[] }>({ session: "", lines: [] });
  const [connected, setConnected] = useState<string | null>(null);
  const connectCb = useRef(onConnect);
  useEffect(() => {
    connectCb.current = onConnect;
  });

  useEffect(() => {
    if (!session) return;
    let stopped = false;
    // The socket lives under the api's address (/api/socket.io), so the access cookie goes with it.
    const base = new URL(import.meta.env.VITE_API_URL, window.location.origin);
    const socket = io(`${base.origin}${LOG_SOCKET.namespace}`, { path: `${base.pathname.replace(/\/$/, "")}/socket.io`, withCredentials: true, transports: ["websocket"] });
    socket.on("connect", () => {
      setConnected(session);
      // Then re-read the saved lines: anything saved before the watch started
      // would otherwise be missing (the two are merged by id, so no duplicates).
      socket.emit(LOG_SOCKET.watch, JSON.parse(session), () => !stopped && connectCb.current());
    });
    socket.on("disconnect", () => setConnected(null));
    // The 15-minute access cookie ran out: refresh it with a normal call, then try again.
    socket.on("unauthorized", () => void axiosInstance.get("/auth/me").finally(() => !stopped && socket.connect()));
    socket.on(LOG_SOCKET.lines, (batch: Array<LogLine | ServerLogLine>) => {
      if (!Array.isArray(batch) || !batch.length) return;
      const lines = batch.map((l) => ("source" in l ? fromServerLine(l) : l));
      setGot((prev) => {
        const next = (prev.session === session ? prev.lines : []).concat(lines);
        return { session, lines: next.length > LIVE_MAX ? next.slice(next.length - LIVE_MAX) : next };
      });
    });
    return () => {
      stopped = true;
      socket.close();
    };
  }, [session]);

  return { lines: got.session === session && session ? got.lines : EMPTY, connected: !!session && connected === session };
}

const EMPTY: LogLine[] = [];

/** The 50 lines before and after one line (a search hit), oldest first. */
export function useLogContext(id: string | null, server = false) {
  return useQuery({
    queryKey: logKeys.context(id ?? "", server),
    queryFn: async (): Promise<LogContext> => {
      if (!server) return api.get<LogContext>(`/logs/${id}/context`);
      const c = await api.get<ServerLogContext>(`/server-logs/${id}/context`);
      return { id: c.id, items: c.items.map(fromServerLine) };
    },
    enabled: !!id,
    staleTime: Infinity,
  });
}

/** Which of a server's log sources the worker can read; it re-checks every 30 s. */
export function useServerLogSources(serverId: string, enabled: boolean) {
  return useQuery({
    queryKey: logKeys.sources(serverId),
    queryFn: () => api.get<ServerLogSources>("/server-logs/sources", { serverId }),
    enabled,
    refetchInterval: 30_000,
  });
}
