import { useState } from "react";
import toast from "react-hot-toast";
import type { RunQueryResult } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { apiMessage } from "../../../utils/apiMessage";
import { useRunQuery } from "../hooks/useDatabaseData";
import { ResultGrid } from "./ResultGrid";

/**
 * The SQL box. Every query runs read-only first; if the database says it
 * would write, nothing has changed and a confirmation asks before running it
 * for real. Ctrl/⌘ + Enter runs.
 */
export function SqlConsole({ serviceId, initial }: { serviceId: string; initial: string }) {
  const [sql, setSql] = useState(initial);
  const [out, setOut] = useState<RunQueryResult | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const run = useRunQuery(serviceId);

  const go = (allowWrites: boolean) =>
    run.mutate(
      { sql, allowWrites },
      {
        onSuccess: (r) => {
          if (r.needsConfirm) return setConfirm(r.needsConfirm);
          setConfirm(null);
          setOut(r);
          if (allowWrites) toast.success("Done");
        },
        onError: (e) => {
          setConfirm(null);
          toast.error(apiMessage(e, "The query failed"));
        },
      },
    );

  return (
    <div className="flex flex-col gap-3">
      <textarea
        aria-label="SQL"
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && sql.trim()) {
            e.preventDefault();
            go(false);
          }
        }}
        spellCheck={false}
        rows={7}
        placeholder="select * from users where email like '%@example.com' limit 50"
        className="rounded-xl border border-fieldb bg-[#0b0c0e] px-4 py-3 font-mono text-[12.5px] leading-[1.6] text-[#c9ccd3] outline-none placeholder:text-faint focus:border-focus"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-faint">Read-only first: a query that changes data asks before it runs. Stopped after 15 s; up to 500 rows shown per result. Every query is in the audit log.</span>
        <Button onClick={() => go(false)} loading={run.isPending && !confirm} disabled={!sql.trim()}>
          Run
        </Button>
      </div>

      {out && (
        <div className="flex flex-col gap-4">
          <span className="text-[11.5px] text-sand">{out.ms.toLocaleString()} ms</span>
          {out.results.map((r, i) => (
            <div key={i} className="flex flex-col gap-2">
              <span className="font-mono text-[11.5px] text-label">
                {r.command ?? "Result"}
                {r.rowCount !== null && ` · ${r.rowCount.toLocaleString()} row${r.rowCount === 1 ? "" : "s"}`}
                {r.truncated && " · only the first 500 shown"}
              </span>
              {r.columns.length > 0 && <ResultGrid columns={r.columns.map((name) => ({ name }))} rows={r.rows} />}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => go(true)}
        loading={run.isPending}
        title="This query changes data"
        body={`Nothing has changed yet. The database said: “${confirm ?? ""}”. Run it for real? There's no undo (backups are the way back).`}
        cta="Run and change data"
      />
    </div>
  );
}
