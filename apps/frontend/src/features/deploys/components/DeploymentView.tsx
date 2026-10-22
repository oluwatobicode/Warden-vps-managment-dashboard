import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { Service } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Skeleton } from "../../../components/ui/Skeleton";
import { StatusPill } from "../../../components/ui/StatusPill";
import { apiMessage } from "../../../utils/apiMessage";
import { formatDuration, timeAgo } from "../../../utils/formatDate";
import { isRunning, useCancelDeploy, useDeployLog, useDeployment } from "../hooks/useDeploys";
import { useNow } from "../hooks/useNow";
import { RollbackDialog } from "./RollbackDialog";

const STEP_TONE: Record<string, string> = { FAILED: "text-crit", GATE_FAILED: "text-crit", CANCELLED: "text-sand", SUCCESS: "text-good" };

/** One deploy: its steps with how long each took, and its output, live while it runs. */
export function DeploymentView({ service, deploymentId, canEdit, onRolledBack }: { service: Service; deploymentId: string; canEdit: boolean; onRolledBack: (id: string) => void }) {
  const dep = useDeployment(deploymentId);
  const running = isRunning(dep.data?.status);
  const log = useDeployLog(deploymentId, running || dep.isPending);
  const cancel = useCancelDeploy(service.id);
  const now = useNow(running);
  const [rollingBack, setRollingBack] = useState(false);

  // Follow the end of the log while it grows, unless the reader scrolled up.
  const box = useRef<HTMLPreElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    const el = box.current;
    if (el && follow.current) el.scrollTop = el.scrollHeight;
  }, [log.text]);

  if (dep.isPending) return <Skeleton className="mt-5 h-64 rounded-[18px]" />;
  if (dep.isError) return <p className="mt-5 text-sm text-crit">{apiMessage(dep.error)}</p>;
  const d = dep.data;
  const end = d.finishedAt ? Date.parse(d.finishedAt) : now;

  const onCancel = () =>
    cancel.mutate(d.id, {
      onSuccess: (r) => toast.success(r.message),
      onError: (e) => toast.error(apiMessage(e)),
    });

  return (
    <div className="mt-[18px] flex flex-col gap-3.5 pb-2">
      <Card
        title={`Deploy #${d.number}${d.rollbackOfNumber ? ` · rollback to #${d.rollbackOfNumber}` : ""}`}
        sub={[d.commitMessage, d.commitSha?.slice(0, 7), d.branch, d.triggeredByName && `by ${d.triggeredByName}`, timeAgo(d.createdAt), d.startedAt && formatDuration(end - Date.parse(d.startedAt))]
          .filter(Boolean)
          .join(" · ")}
        action={
          <div className="flex items-center gap-2">
            {d.live && <span className="rounded-full bg-good-s px-2 py-0.5 text-[10.5px] font-semibold text-good">live now</span>}
            <StatusPill status={d.status} />
            {canEdit && running && (
              <Button variant="secondary" onClick={onCancel} loading={cancel.isPending} className="px-3 py-1.5 text-[11px]">
                Cancel
              </Button>
            )}
            {canEdit && d.status === "SUCCESS" && !d.live && (
              <Button variant="secondary" onClick={() => setRollingBack(true)} className="px-3 py-1.5 text-[11px]">
                Roll back to this
              </Button>
            )}
          </div>
        }
      >
        <ol className="mt-3.5 flex list-none flex-col gap-1.5 p-0" aria-live="polite">
          {d.history.map((h, i) => {
            const next = d.history[i + 1]?.at;
            const took = next ? Date.parse(next) - Date.parse(h.at) : !d.finishedAt ? now - Date.parse(h.at) : null;
            const last = i === d.history.length - 1;
            return (
              <li key={i} className="flex gap-3 text-[11.5px]">
                <span className="w-[54px] shrink-0 font-mono text-faint">{new Date(h.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                <span className={`min-w-0 flex-1 font-mono break-words whitespace-pre-wrap ${STEP_TONE[h.status] ?? "text-muted-deep"}`}>{h.message}</span>
                {took !== null && !(last && d.finishedAt) && <span className="shrink-0 font-mono text-faint">{formatDuration(took)}</span>}
              </li>
            );
          })}
        </ol>
      </Card>

      <Card title="Output" sub={running ? (log.connected ? "Live" : "Connecting…") : "Kept for 30 days."}>
        <pre
          ref={box}
          onScroll={(e) => {
            const el = e.currentTarget;
            follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
          className="mt-3.5 max-h-[560px] min-h-[160px] overflow-auto rounded-xl border border-cb bg-[#0b0c0e] px-4 py-3 font-mono text-[11.5px] leading-[1.55] break-words whitespace-pre-wrap text-[#c9ccd3]"
        >
          {log.text || (running ? "Waiting for output…" : "No output was saved.")}
        </pre>
      </Card>

      {rollingBack && <RollbackDialog service={service} target={d} onClose={() => setRollingBack(false)} onStarted={(nd) => onRolledBack(nd.id)} />}
    </div>
  );
}
