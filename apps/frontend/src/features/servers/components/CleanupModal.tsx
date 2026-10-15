import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { CleanupCategoryKey, Server } from "shared-types";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Spinner } from "../../../components/ui/Spinner";
import { apiMessage } from "../../../utils/apiMessage";
import { formatBytes } from "../../../utils/formatBytes";
import { useCleanupPreview, useCleanups, useRefreshAfterCleanup, useStartCleanup } from "../hooks/useMonitoring";

const LABEL: Record<CleanupCategoryKey, { title: string; detail: string }> = {
  containers: { title: "Stopped containers", detail: "Exited, created or dead; nothing running is touched" },
  images: { title: "Dangling images", detail: "Untagged layers left behind by rebuilds" },
  buildCache: { title: "Build cache", detail: "Cached layers from earlier image builds" },
  networks: { title: "Unused networks", detail: "Networks no container is attached to" },
};

/**
 * Run cleanup: ask the server what would go (live, a few seconds), confirm,
 * then follow the worker's job until it reports back.
 */
export function CleanupModal({ server, onClose }: { server: Server; onClose: () => void }) {
  const [runId, setRunId] = useState<string | null>(null);
  const preview = useCleanupPreview(server.id, runId === null);
  const start = useStartCleanup(server.id);
  const cleanups = useCleanups(server.id);
  const refresh = useRefreshAfterCleanup(server.id);
  const run = runId ? cleanups.data?.find((c) => c.id === runId) : undefined;
  const finished = run?.status === "SUCCESS" || run?.status === "FAILED";
  const announced = useRef(false);

  useEffect(() => {
    if (!run || !finished || announced.current) return;
    announced.current = true;
    if (run.status === "SUCCESS") toast.success(`Cleanup freed ${formatBytes(run.reclaimedBytes)} on ${server.serverName}`);
    else toast.error(`Cleanup on ${server.serverName} failed`);
    void refresh();
  }, [run, finished, server.serverName, refresh]);

  const onConfirm = () =>
    start.mutate(undefined, {
      onSuccess: (row) => setRunId(row.id),
      onError: (e) => toast.error(apiMessage(e)),
    });

  const busy = runId !== null && !finished;
  const footer = finished ? (
    <>
      <span />
      <Button onClick={onClose}>Done</Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose} className="px-0 text-xs">
        {busy ? "Close" : "Cancel"}
      </Button>
      {runId === null && (
        <Button onClick={onConfirm} loading={start.isPending} disabled={!preview.data}>
          Clean up {preview.data ? `~${formatBytes(preview.data.totalBytes)}` : ""}
        </Button>
      )}
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      width="w-[560px]"
      title={`Clean up ${server.serverName}`}
      description="Removes Docker leftovers to free disk space. Volumes and images that are still tagged are never touched, so data and rollbacks are safe."
      footer={footer}
    >
      {runId === null && preview.isPending && (
        <p className="m-0 flex items-center gap-2.5 text-[12.5px] text-muted-warm">
          <Spinner className="size-3.5" /> Asking {server.serverName} what can be removed…
        </p>
      )}
      {runId === null && preview.isError && <p className="m-0 text-[12.5px] text-crit">{apiMessage(preview.error)}</p>}

      {runId === null && preview.data && (
        <>
          <div className="overflow-hidden rounded-xl border border-cb">
            {preview.data.categories.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-4 border-b border-divider px-4 py-3 last:border-b-0">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[12.5px] text-body">
                    {LABEL[c.key].title} <span className="text-sand">· {c.count}</span>
                  </span>
                  <span className="text-[11px] text-sand">{LABEL[c.key].detail}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-body">{c.bytes == null ? "—" : formatBytes(c.bytes)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between bg-head px-4 py-3">
              <span className="text-[12.5px] font-semibold text-strong">Up to</span>
              <span className="font-mono text-[13px] font-semibold text-good">{formatBytes(preview.data.totalBytes)}</span>
            </div>
          </div>
          <p className="m-0 text-[11px] text-sand">"Up to": dangling images can share layers, so the real saving may be a little less.</p>
        </>
      )}

      {runId !== null && (
        <div className="flex flex-col gap-2" aria-live="polite">
          {!finished && (
            <p className="m-0 flex items-center gap-2.5 text-[12.5px] text-muted-warm">
              <Spinner className="size-3.5" /> {run?.status === "RUNNING" ? "Cleaning up…" : "Waiting for the worker to pick it up…"}
            </p>
          )}
          {run?.status === "SUCCESS" && (
            <p className="m-0 text-[13px] text-good">Done. Freed {formatBytes(run.reclaimedBytes)}.</p>
          )}
          {run?.status === "FAILED" && (
            <>
              <p className="m-0 text-[13px] text-crit">The cleanup didn't finish.</p>
              <p className="m-0 font-mono text-[11.5px] text-muted-warm">{run.errorMessage}</p>
              {!!run.reclaimedBytes && <p className="m-0 text-[11.5px] text-sand">Steps before the failure still freed {formatBytes(run.reclaimedBytes)}.</p>}
            </>
          )}
          {!finished && <p className="m-0 text-[11px] text-sand">You can close this. The cleanup keeps running on the server, and its result shows on the Resources tab.</p>}
        </div>
      )}
    </Modal>
  );
}
