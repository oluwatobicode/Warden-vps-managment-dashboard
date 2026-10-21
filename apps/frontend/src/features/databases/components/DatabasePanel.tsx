import { useState } from "react";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { DATABASE_CATALOG, type Service } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Card, DangerZone, FactRow } from "../../../components/ui/Card";
import { CopyButton } from "../../../components/ui/CopyButton";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Skeleton } from "../../../components/ui/Skeleton";
import { StatusPill } from "../../../components/ui/StatusPill";
import { Toggle } from "../../../components/ui/Toggle";
import { apiMessage } from "../../../utils/apiMessage";
import { timeAgo } from "../../../utils/formatDate";
import { BackupsCard } from "./BackupsCard";
import { isInProgress, useDatabase, useDeleteDatabase, useRestartDatabase, useRevealConnection } from "../hooks/useDatabases";

/** A database service's page body: connection, the latest create/restart/restore log, backups, restart and delete. */
export function DatabasePanel({ service, canEdit, afterDelete }: { service: Service; canEdit: boolean; afterDelete: string }) {
  const info = useDatabase(service.id);
  const restart = useRestartDatabase(service.id);
  const reveal = useRevealConnection(service.id);
  const [shown, setShown] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (info.isPending) return <Skeleton className="mt-5 h-48 rounded-[18px]" />;
  if (info.isError) return <p className="mt-5 text-sm text-crit">{apiMessage(info.error)}</p>;
  const d = info.data;
  const spec = DATABASE_CATALOG[d.engine];
  const busy = isInProgress(d);
  const dep = d.latestDeployment;

  const onReveal = () =>
    reveal.mutate(undefined, {
      onSuccess: (r) => setShown(r.connectionString),
      onError: (e) => toast.error(apiMessage(e)),
    });
  const onRestart = () =>
    restart.mutate(undefined, {
      onSuccess: () => toast.success("Restarting the database"),
      onError: (e) => toast.error(apiMessage(e)),
    });

  return (
    <div className="mt-5 flex flex-col gap-3.5 pb-2">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-3.5">
        <Card title="Connection" sub={`Saved as the secret variable ${d.variableName} in this environment. Only reachable from services on the same server.`}>
          <div className="mt-3">
            <FactRow label="Engine">{`${spec.label} ${d.version}`}</FactRow>
            <FactRow label="Host">{d.host}</FactRow>
            <FactRow label="Port">{d.port}</FactRow>
            {d.databaseName && <FactRow label="Database">{d.databaseName}</FactRow>}
            {d.username && <FactRow label="User">{d.username}</FactRow>}
          </div>
          {canEdit && (
            <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-cb bg-field px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-body">{shown ?? "•••••••••••••••••••••••• (connection string)"}</span>
              {shown ? (
                <>
                  <CopyButton value={shown} label="Copy connection string" done="Connection string copied" />
                  <Button variant="ghost" onClick={() => setShown(null)} className="px-2 py-1 text-[11px]">
                    Hide
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={onReveal} loading={reveal.isPending} className="px-3 py-1.5 text-[11px]">
                  Reveal
                </Button>
              )}
            </div>
          )}
        </Card>

        <Card
          title={dep ? `Deployment #${dep.number}` : "Deployments"}
          sub={dep ? `${dep.finishedAt ? `Finished ${timeAgo(dep.finishedAt)}` : `Started ${timeAgo(dep.createdAt)}`}` : "Nothing yet"}
          action={dep && <StatusPill status={dep.status as never} />}
        >
          {dep && (
            <ol className="mt-3.5 flex list-none flex-col gap-1.5 p-0" aria-live="polite">
              {dep.history.map((h, i) => (
                <li key={i} className="flex gap-3 text-[11.5px]">
                  <span className="w-[54px] shrink-0 font-mono text-faint">{new Date(h.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                  <span className={`min-w-0 font-mono break-words whitespace-pre-wrap ${h.status === "FAILED" ? "text-crit" : h.status === "SUCCESS" ? "text-good" : "text-muted-deep"}`}>{h.message}</span>
                </li>
              ))}
              {busy && <li className="text-[11.5px] text-sand">…</li>}
            </ol>
          )}
          {canEdit && (
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={onRestart} loading={restart.isPending} disabled={busy} className="px-3.5 py-2 text-xs">
                Restart
              </Button>
            </div>
          )}
        </Card>
      </div>

      <BackupsCard service={service} info={d} canEdit={canEdit} busy={busy} />

      {canEdit && (
        <DangerZone
          body={`Deleting ${service.serviceName} removes its container. Its data volume (${d.volumeName}) stays on the server unless you choose to delete it too. Its backups are deleted either way.`}
          action={
            <Button variant="danger" onClick={() => setDeleting(true)} disabled={busy} className="whitespace-nowrap">
              Delete database
            </Button>
          }
        />
      )}
      {deleting && <DeleteDatabaseDialog service={service} afterDelete={afterDelete} onClose={() => setDeleting(false)} />}
    </div>
  );
}

/** Keeping the data is the default; deleting it needs the tick AND the typed name. */
function DeleteDatabaseDialog({ service, afterDelete, onClose }: { service: Service; afterDelete: string; onClose: () => void }) {
  const navigate = useNavigate();
  const del = useDeleteDatabase(service.id);
  const [deleteData, setDeleteData] = useState(false);
  const [typed, setTyped] = useState("");
  const ready = !deleteData || typed.trim() === service.serviceName;

  const onConfirm = () =>
    del.mutate(
      { deleteData, confirmName: deleteData ? typed.trim() : undefined },
      {
        onSuccess: () => {
          toast.success(deleteData ? `Deleting ${service.serviceName} and its data` : `Deleting ${service.serviceName}; its data is kept`);
          navigate(afterDelete, { replace: true });
        },
        onError: (e) => toast.error(apiMessage(e)),
      },
    );

  return (
    <Modal
      open
      onClose={onClose}
      title={`Delete ${service.serviceName}?`}
      description="The container stops and is removed, and its connection-string variable is deleted."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="px-0 text-xs">
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={!ready} loading={del.isPending}>
            {deleteData ? "Delete database and data" : "Delete database"}
          </Button>
        </>
      }
    >
      <Toggle
        checked={deleteData}
        onChange={setDeleteData}
        label="Also delete all its data"
        detail="Off: the data volume stays on the server. On: the data is gone for good, with no undo."
      />
      {deleteData && <Input label={`Type ${service.serviceName} to confirm`} mono value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />}
    </Modal>
  );
}
