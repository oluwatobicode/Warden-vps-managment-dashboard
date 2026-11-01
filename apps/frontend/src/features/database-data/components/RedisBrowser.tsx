import { useState } from "react";
import toast from "react-hot-toast";
import type { RedisCommandResult, RedisValue } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Spinner } from "../../../components/ui/Spinner";
import { apiMessage } from "../../../utils/apiMessage";
import { ttlText } from "../cells";
import { useDeleteRedisKeys, useRedisCommand, useRedisKeys, useRedisValue, useSetRedisString } from "../hooks/useDatabaseData";
import { ResultGrid } from "./ResultGrid";

/** Redis: keys (SCAN, with a pattern) on the left; a key's value, or the command box, on the right. */
export function RedisBrowser({ serviceId }: { serviceId: string }) {
  const [typed, setTyped] = useState("*");
  const [pattern, setPattern] = useState("*");
  const keys = useRedisKeys(serviceId, pattern);
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = useState<"value" | "command">("value");
  const all = keys.data?.pages.flatMap((p) => p.keys) ?? [];

  return (
    <div className="mt-4 flex gap-4">
      <aside className="flex w-[260px] shrink-0 flex-col gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPattern(typed.trim() || "*");
          }}
        >
          <input
            type="search"
            aria-label="Key pattern"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="user:*  (Enter to search)"
            className="w-full rounded-lg border border-cb bg-field px-3 py-2 font-mono text-[12px] text-body outline-none placeholder:text-faint focus:border-focus"
          />
        </form>
        {keys.isPending ? (
          <p className="flex items-center gap-2 text-[12px] text-faint"><Spinner /> Connecting…</p>
        ) : keys.isError ? (
          <p className="text-[12px] text-crit">{apiMessage(keys.error, "Couldn't reach Redis")}</p>
        ) : (
          <nav aria-label="Keys" className="flex max-h-[560px] flex-col overflow-y-auto">
            {all.map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => {
                  setPicked(k.key);
                  setMode("value");
                }}
                className={`flex items-baseline justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left font-mono text-[12px] ${picked === k.key && mode === "value" ? "bg-[#24262c] text-white" : "text-sand hover:text-strong"}`}
              >
                <span className="truncate">{k.key}</span>
                <span className="shrink-0 text-[10.5px] text-faint">{k.type}</span>
              </button>
            ))}
            {!all.length && <p className="px-2.5 text-[11.5px] text-faint">No keys match {pattern}.</p>}
            {keys.hasNextPage && (
              <button type="button" onClick={() => void keys.fetchNextPage()} disabled={keys.isFetchingNextPage} className="mt-1 cursor-pointer px-2.5 text-left text-[11.5px] text-sand hover:text-strong">
                {keys.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            )}
          </nav>
        )}
        <Button variant={mode === "command" ? "primary" : "secondary"} onClick={() => setMode("command")}>
          Command box
        </Button>
        <button type="button" onClick={() => void keys.refetch()} className="cursor-pointer text-left text-[11.5px] text-faint hover:text-strong">
          {keys.isFetching ? "Reloading…" : "Reload keys"}
        </button>
      </aside>

      <section className="min-w-0 flex-1">
        {mode === "command" ? (
          <CommandBox serviceId={serviceId} />
        ) : picked ? (
          <KeyValue key={picked} serviceId={serviceId} k={picked} onGone={() => setPicked(null)} />
        ) : (
          <EmptyState title="Pick a key">Its value shows here. Strings can be edited; use the command box for everything else.</EmptyState>
        )}
      </section>
    </div>
  );
}

function KeyValue({ serviceId, k, onGone }: { serviceId: string; k: string; onGone: () => void }) {
  const value = useRedisValue(serviceId, k);
  const set = useSetRedisString(serviceId);
  const del = useDeleteRedisKeys(serviceId);
  const [draft, setDraft] = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (value.isPending) return <p className="flex items-center gap-2 text-[12px] text-faint"><Spinner /> Loading…</p>;
  if (value.isError) return <p className="text-[12.5px] text-crit">{apiMessage(value.error, "Couldn't read the key")}</p>;
  const v = value.data;
  const editable = v.type === "string" && !v.truncated;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 font-mono text-[15px] font-semibold break-all text-strong">{v.key}</h3>
          <p className="m-0 mt-1 text-[11.5px] text-faint">
            {v.type} · {v.type === "string" ? `${v.length.toLocaleString()} characters` : `${v.length.toLocaleString()} items`} · expires {ttlText(v.ttlMs)}
            {v.truncated && (v.type === "string" ? " · only the start is shown" : " · the first 200 are shown")}
          </p>
        </div>
        <span className="flex gap-2">
          <Button variant="ghost" onClick={() => void value.refetch()} loading={value.isFetching}>
            Reload
          </Button>
          <Button variant="danger" onClick={() => setDeleting(true)}>
            Delete key
          </Button>
        </span>
      </div>

      {v.type === "string" ? (
        <>
          <textarea
            aria-label="Value"
            value={draft ?? String(v.value ?? "")}
            onChange={(e) => setDraft(e.target.value)}
            readOnly={!editable}
            spellCheck={false}
            rows={10}
            className="rounded-xl border border-fieldb bg-[#0b0c0e] px-4 py-3 font-mono text-[12px] text-[#c9ccd3] outline-none focus:border-focus"
          />
          {editable && (
            <div className="flex justify-end">
              <Button onClick={() => setConfirmSave(true)} disabled={draft === null || draft === v.value}>
                Save value
              </Button>
            </div>
          )}
        </>
      ) : (
        <ValueTable v={v} />
      )}

      <ConfirmDialog
        open={confirmSave}
        onClose={() => setConfirmSave(false)}
        onConfirm={() =>
          set.mutate(
            { key: v.key, value: draft ?? "", ttlSeconds: null },
            {
              onSuccess: () => {
                toast.success("Saved");
                setDraft(null);
                setConfirmSave(false);
              },
              onError: (e) => {
                setConfirmSave(false);
                toast.error(apiMessage(e, "Couldn't save the value"));
              },
            },
          )
        }
        loading={set.isPending}
        title={`Change ${v.key}?`}
        body="The old value is replaced; its expiry stays as it is. There's no undo."
        cta="Save value"
      />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() =>
          del.mutate(
            { keys: [v.key] },
            {
              onSuccess: () => {
                toast.success("Key deleted");
                setDeleting(false);
                onGone();
              },
              onError: (e) => {
                setDeleting(false);
                toast.error(apiMessage(e, "Couldn't delete the key"));
              },
            },
          )
        }
        loading={del.isPending}
        title={`Delete ${v.key}?`}
        body="The key and its value are gone for good. Apps reading it will find nothing."
        cta="Delete key"
        phrase={v.key.length <= 60 ? v.key : undefined}
      />
    </div>
  );
}

/** Hash, list, set, sorted set and stream values as a table. */
function ValueTable({ v }: { v: RedisValue }) {
  const items = (Array.isArray(v.value) ? v.value : []) as unknown[];
  const shape: Record<string, { columns: string[]; rows: unknown[][] }> = {
    hash: { columns: ["field", "value"], rows: items as unknown[][] },
    zset: { columns: ["member", "score"], rows: items as unknown[][] },
    list: { columns: ["#", "value"], rows: items.map((x, i) => [i, x]) },
    set: { columns: ["member"], rows: items.map((x) => [x]) },
    stream: { columns: ["id", "fields"], rows: items as unknown[][] },
  };
  const s = shape[v.type];
  if (!s) return <p className="text-[12px] text-faint">Warden doesn't show {v.type} values yet. Read it in the command box (e.g. JSON.GET {v.key}).</p>;
  if (!s.rows.length) return <p className="text-[12px] text-faint">Empty.</p>;
  return <ResultGrid columns={s.columns.map((name) => ({ name }))} rows={s.rows} />;
}

/** One redis-cli style command. Writes and admin commands ask first. */
function CommandBox({ serviceId }: { serviceId: string }) {
  const [line, setLine] = useState("");
  const [out, setOut] = useState<RedisCommandResult | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const run = useRedisCommand(serviceId);
  const go = (allowWrites: boolean) =>
    run.mutate(
      { command: line, allowWrites },
      {
        onSuccess: (r) => {
          if (r.needsConfirm) return setConfirm(r.needsConfirm);
          setConfirm(null);
          setOut(r);
        },
        onError: (e) => {
          setConfirm(null);
          toast.error(apiMessage(e, "The command failed"));
        },
      },
    );
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (line.trim()) go(false);
        }}
      >
        <input
          aria-label="Command"
          value={line}
          onChange={(e) => setLine(e.target.value)}
          spellCheck={false}
          placeholder='GET "user:1"   ·   HGETALL session:42   ·   TTL cache:home'
          className="min-w-0 flex-1 rounded-xl border border-fieldb bg-[#0b0c0e] px-4 py-3 font-mono text-[12.5px] text-[#c9ccd3] outline-none placeholder:text-faint focus:border-focus"
        />
        <Button type="submit" loading={run.isPending && !confirm} disabled={!line.trim()}>
          Run
        </Button>
      </form>
      <span className="text-[11px] text-faint">Commands that change data, or admin commands, ask first. MONITOR, SUBSCRIBE, SHUTDOWN and the like can't be run here. Every command is in the audit log.</span>
      {out && (
        <div className="flex flex-col gap-2">
          <span className="text-[11.5px] text-sand">{out.ms.toLocaleString()} ms</span>
          <pre className={`m-0 max-h-[480px] overflow-auto rounded-xl border border-cb bg-[#0b0c0e] px-4 py-3 font-mono text-[12px] break-words whitespace-pre-wrap ${isError(out.reply) ? "text-[#f0a8a0]" : "text-[#c9ccd3]"}`}>
            {isError(out.reply) ? `(error) ${out.reply.error}` : out.reply === null ? "(nil)" : typeof out.reply === "string" ? out.reply : JSON.stringify(out.reply, null, 2)}
          </pre>
        </div>
      )}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => go(true)}
        loading={run.isPending}
        title="This command changes data"
        body={`Nothing has run yet: ${confirm ?? ""}. Run it for real? There's no undo.`}
        cta="Run command"
      />
    </div>
  );
}

const isError = (r: unknown): r is { error: string } => typeof r === "object" && r !== null && !Array.isArray(r) && "error" in r;
