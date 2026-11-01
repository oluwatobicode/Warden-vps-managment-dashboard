import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import toast from "react-hot-toast";
import type { LogLine, LogStream, ServerLogSource } from "shared-types";
import { Select } from "../../../components/ui/Select";
import { Spinner } from "../../../components/ui/Spinner";
import { apiMessage } from "../../../utils/apiMessage";
import { useLiveLogs, useLogHistory, type LogFilters, type LogScope } from "../hooks/useLogs";
import { asText, lineTime, matches, mergeLines, SERVER_SOURCES, splitMatch } from "../lines";
import { LineDrawer } from "./LineDrawer";

/** Every line is one row this tall (long lines are cut; click one to read it whole). */
const ROW = 21;
const RANGES = [
  { value: "0", label: "Last 7 days" },
  { value: "1440", label: "Last 24 hours" },
  { value: "60", label: "Last hour" },
  { value: "15", label: "Last 15 minutes" },
];
const STREAMS: ReadonlyArray<{ id: LogStream | ""; label: string }> = [
  { id: "", label: "All" },
  { id: "STDERR", label: "Errors" },
];

export interface LogViewerProps {
  scope: LogScope;
  /** The services shown (a server: its sources, SERVER_SOURCES in lines.ts). More than one = each line is tagged with its name. */
  services: Array<{ id: string; name: string }>;
  /** A service's versions, for "only this version" (service view only). */
  deployments?: Array<{ id: string; label: string }>;
}

/**
 * App logs: the saved lines (scroll up for older ones) with new ones added
 * live, following the end until the reader scrolls up. A search shows the
 * server's matches instead, newest at the bottom, and pauses live.
 */
export function LogViewer({ scope, services, deployments }: LogViewerProps) {
  const [typed, setTyped] = useState("");
  const [filters, setFilters] = useState<LogFilters>({ q: "", stream: "", deploymentId: "", sinceMinutes: 0, source: "" });
  const server = "serverId" in scope;
  const [picked, setPicked] = useState<LogLine | null>(null);

  // Search on the server 400 ms after typing stops (2+ characters, as the api asks).
  useEffect(() => {
    const q = typed.trim();
    const t = setTimeout(() => setFilters((f) => (f.q === q || q.length === 1 ? f : { ...f, q })), 400);
    return () => clearTimeout(t);
  }, [typed]);

  const history = useLogHistory(scope, filters);
  const searching = !!filters.q;
  const live = useLiveLogs(
    "serverId" in scope ? { serverIds: [scope.serverId] } : { serviceIds: services.map((s) => s.id) },
    !searching,
    () => void history.refetch(),
  );
  const lines = useMemo(
    () => mergeLines(history.data?.pages.map((p) => p.items) ?? [], live.lines.filter((l) => matches(l, filters))),
    [history.data, live.lines, filters],
  );
  const names = useMemo(() => new Map(services.map((s) => [s.id, s.name])), [services]);
  const tagged = services.length > 1;

  const box = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [behind, setBehind] = useState(0);
  const rows = useVirtualizer({ count: lines.length, getScrollElement: () => box.current, estimateSize: () => ROW, overscan: 30 });

  // Older lines were added at the top: keep the reader's place, not their offset.
  const first = useRef<string | null>(null);
  const count = useRef(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const prevFirst = first.current;
    const added = prevFirst ? lines.findIndex((l) => l.id === prevFirst) : -1;
    if (added > 0 && !following.current) el.scrollTop += added * ROW;
    if (following.current) el.scrollTop = el.scrollHeight;
    else if (lines.length > count.current && added <= 0) {
      const more = lines.length - count.current; // read now: the updater runs after count moves on
      setBehind((n) => n + more);
    }
    first.current = lines[0]?.id ?? null;
    count.current = lines.length;
  }, [lines]);

  // A new filter starts at the newest line again.
  useEffect(() => {
    following.current = true;
    setBehind(0);
  }, [filters]);

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    following.current = el.scrollHeight - el.scrollTop - el.clientHeight < ROW * 2;
    if (following.current) setBehind(0);
    if (el.scrollTop < ROW * 10 && history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage();
  };
  const toLive = () => {
    following.current = true;
    setBehind(0);
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const copy = () =>
    navigator.clipboard.writeText(asText(lines, tagged ? (id) => names.get(id) ?? id : undefined)).then(
      () => toast.success(`${lines.length.toLocaleString()} line${lines.length === 1 ? "" : "s"} copied`),
      () => toast.error("Couldn't copy (the browser refused)"),
    );

  const status = searching
    ? `${lines.length.toLocaleString()}${history.hasNextPage ? "+" : ""} match${lines.length === 1 ? "" : "es"} · live paused while searching`
    : live.connected
      ? "Live"
      : "Connecting…";

  return (
    <div className="mt-[18px] flex flex-col gap-3 pb-2">
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex min-w-[220px] flex-1 flex-col gap-2">
          <span className="text-xs text-label">Search</span>
          <input
            type="search"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setTyped("")}
            placeholder="Text in the line, e.g. timeout or 500"
            className="rounded-xl border border-cb bg-field px-4 py-[11px] font-mono text-[12.5px] text-body outline-none placeholder:text-faint focus:border-focus"
          />
        </label>
        <div role="radiogroup" aria-label="Which lines" className="inline-flex rounded-lg border border-cb bg-seg p-[3px]">
          {(server ? [{ id: "", name: "All" }, ...SERVER_SOURCES] : STREAMS.map((s) => ({ id: s.id, name: s.label }))).map((s) => {
            const on = server ? filters.source === s.id : filters.stream === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setFilters((f) => (server ? { ...f, source: s.id as ServerLogSource | "" } : { ...f, stream: s.id as LogStream | "" }))}
                className={`cursor-pointer rounded-md px-3 py-[7px] text-[11.5px] ${on ? "bg-track text-strong" : "text-sand hover:text-strong"}`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
        <div className="w-[170px]">
          <Select label="Time" options={RANGES} value={String(filters.sinceMinutes)} onChange={(v) => setFilters((f) => ({ ...f, sinceMinutes: Number(v) }))} />
        </div>
        {deployments && deployments.length > 0 && (
          <div className="w-[190px]">
            <Select
              label="Version"
              options={[{ value: "", label: "All versions" }, ...deployments.map((d) => ({ value: d.id, label: d.label }))]}
              value={filters.deploymentId}
              onChange={(v) => setFilters((f) => ({ ...f, deploymentId: v }))}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-[11.5px]">
        <span className={`flex items-center gap-2 ${live.connected || searching ? "text-sand" : "text-faint"}`}>
          {!searching && <span className={`size-[7px] rounded-full ${live.connected ? "bg-good" : "bg-faint"}`} />}
          {status}
        </span>
        <span className="flex items-center gap-3">
          {history.isFetchingNextPage && <Spinner />}
          <button type="button" onClick={copy} disabled={!lines.length} className="cursor-pointer text-sand hover:text-strong disabled:cursor-default disabled:opacity-40">
            Copy {lines.length ? lines.length.toLocaleString() : ""} lines
          </button>
        </span>
      </div>

      <div className="relative">
        <div
          ref={box}
          onScroll={onScroll}
          role="log"
          aria-live="off"
          aria-label="Logs"
          className="h-[560px] overflow-auto rounded-xl border border-cb bg-[#0b0c0e] py-2 font-mono text-[11.5px] text-[#c9ccd3]"
        >
          {history.isPending ? (
            <p className="px-4 py-2 text-faint">Loading…</p>
          ) : history.isError ? (
            <p className="px-4 py-2 text-crit">{apiMessage(history.error, "Couldn't load the logs")}</p>
          ) : !lines.length ? (
            <p className="px-4 py-2 text-faint">
              {searching ? "Nothing matches in this time range." : server ? "Nothing yet. Lines show up here as the server's sources write them (kept 7 days)." : "Nothing yet. Lines show up here as the app prints them (kept 7 days)."}
            </p>
          ) : (
            <div style={{ height: rows.getTotalSize(), position: "relative" }}>
              {!history.hasNextPage && rows.getVirtualItems()[0]?.index === 0 && (
                <span className="sr-only">Start of the saved logs</span>
              )}
              {rows.getVirtualItems().map((v) => {
                const l = lines[v.index];
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setPicked(l)}
                    style={{ position: "absolute", top: 0, left: 0, height: ROW, transform: `translateY(${v.start}px)` }}
                    className={`flex w-full cursor-pointer items-center gap-3 border-l-2 pr-4 pl-3.5 text-left whitespace-pre hover:bg-white/[0.04] ${
                      l.stream === "STDERR" ? "border-crit/70" : l.stream === "WARDEN" ? "border-warn/70" : "border-transparent"
                    }`}
                  >
                    {/* Fixed width: a date appears in front for older lines, and the messages should still line up. */}
                    <span className="w-[19ch] shrink-0 text-faint">{lineTime(l.ts)}</span>
                    {tagged && <span className="w-[120px] shrink-0 truncate text-sand">{names.get(l.serviceId) ?? "service"}</span>}
                    <span className={`min-w-0 flex-1 truncate ${l.stream === "STDERR" ? "text-[#f0a8a0]" : l.stream === "WARDEN" ? "text-warn" : ""}`}>
                      {splitMatch(l.message, filters.q).map((p, i) =>
                        p.hit ? (
                          <mark key={i} className="rounded-[3px] bg-[#e5c07b]/25 text-[#f3d9a4]">
                            {p.text}
                          </mark>
                        ) : (
                          <span key={i}>{p.text}</span>
                        ),
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {behind > 0 && !searching && (
          <button
            type="button"
            onClick={toLive}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 cursor-pointer rounded-full border border-cb bg-raised px-3.5 py-1.5 text-[11.5px] text-strong shadow-lg"
          >
            {behind.toLocaleString()} new line{behind === 1 ? "" : "s"} ↓
          </button>
        )}
      </div>
      <p className="text-[11px] text-faint">
        {server
          ? "Kept 7 days. Up to 200 lines a second per source are kept; past that, Warden notes how many it dropped."
          : "Kept 7 days. Secret variable values are hidden as •••••• before a line is saved. Up to 200 lines a second per service are kept; past that, Warden notes how many it dropped."}
      </p>

      {picked && <LineDrawer line={picked} serviceName={names.get(picked.serviceId)} server={server} query={filters.q} onClose={() => setPicked(null)} />}
    </div>
  );
}
