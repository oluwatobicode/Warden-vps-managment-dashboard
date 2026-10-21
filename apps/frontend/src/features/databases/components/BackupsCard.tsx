import { useState } from "react";
import { Link } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import type { z } from "zod";
import { UpdateBackupSettingsSchema, type DatabaseBackup, type DatabaseInfo, type Service, type UpdateBackupSettingsInput } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Toggle } from "../../../components/ui/Toggle";
import { applyApiIssues, apiMessage } from "../../../utils/apiMessage";
import { formatBytes } from "../../../utils/formatBytes";
import { formatDate, timeAgo } from "../../../utils/formatDate";
import { downloadBackup, useBackupNow, useBackups, useRestoreBackup, useUpdateBackupSettings } from "../hooks/useBackups";

/** "03:00 (02:00 UTC)": the schedule is stored in UTC, shown in the viewer's time. */
const hourLabel = (utc: number) => {
  const local = new Date(Date.UTC(2026, 0, 1, utc)).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${local} (${String(utc).padStart(2, "0")}:00 UTC)`;
};
const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: hourLabel(h) }));

const STORAGE_LABEL = { ORG: "your own bucket", PLATFORM: "Warden storage", NONE: "nowhere yet" } as const;

const STATUS: Record<DatabaseBackup["status"], { label: string; className: string }> = {
  QUEUED: { label: "Queued", className: "bg-raised text-sand" },
  RUNNING: { label: "Backing up…", className: "bg-brand-s text-brand" },
  SUCCESS: { label: "Done", className: "bg-good-s text-good" },
  FAILED: { label: "Failed", className: "bg-crit-s text-crit" },
};

/**
 * Backups of one database: the daily schedule, the list, back up now,
 * download and restore. Restore replaces ALL current data, so it needs the
 * typed name, and it shows up as a deployment in the card above.
 */
export function BackupsCard({ service, info, canEdit, busy }: { service: Service; info: DatabaseInfo; canEdit: boolean; busy: boolean }) {
  const backups = useBackups(service.id);
  const backupNow = useBackupNow(service.id);
  const restore = useRestoreBackup(service.id);
  const [restoring, setRestoring] = useState<DatabaseBackup | null>(null);
  const [editing, setEditing] = useState(false);
  const s = info.backup;
  const running = backups.data?.some((b) => b.status === "QUEUED" || b.status === "RUNNING");
  const noStorage = s.storage === "NONE";

  const onBackupNow = () =>
    backupNow.mutate(undefined, {
      onSuccess: () => toast.success("Backing up"),
      onError: (e) => toast.error(apiMessage(e)),
    });
  const onDownload = (b: DatabaseBackup) => downloadBackup(b.id).catch((e) => toast.error(apiMessage(e)));
  const onRestore = () =>
    restoring &&
    restore.mutate(
      { backupId: restoring.id, confirmName: service.serviceName },
      {
        onSuccess: () => {
          toast.success("Restoring the backup");
          setRestoring(null);
        },
        onError: (e) => {
          toast.error(apiMessage(e));
          setRestoring(null);
        },
      },
    );

  const schedule = s.enabled ? `Daily at ${hourLabel(s.hourUtc)}, kept ${s.retentionDays} ${s.retentionDays === 1 ? "day" : "days"}` : "Daily backups are off";

  return (
    <Card
      title="Backups"
      sub={`${schedule}. Encrypted with your organization's key and stored in ${STORAGE_LABEL[s.storage]}.`}
      action={
        canEdit && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditing((v) => !v)} className="px-2 py-1.5 text-[11px]">
              {editing ? "Close" : "Schedule"}
            </Button>
            <Button variant="secondary" onClick={onBackupNow} loading={backupNow.isPending} disabled={busy || running || noStorage} className="px-3 py-1.5 text-[11px]">
              Back up now
            </Button>
          </div>
        )
      }
    >
      {noStorage && (
        <p className="mt-3.5 rounded-xl border border-cb bg-field px-3.5 py-3 text-[12px] text-muted-deep">
          No backup storage is set up, so nothing can be backed up yet. A DevOps or Admin can add a bucket in{" "}
          <Link to="/settings/backup-storage" className="text-brand underline-offset-2 hover:underline">
            Settings → Backup storage
          </Link>
          .
        </p>
      )}

      {editing && canEdit && <ScheduleForm serviceId={service.id} info={info} onDone={() => setEditing(false)} />}

      <div className="mt-3.5">
        {backups.isPending && <Skeleton className="h-20 rounded-xl" />}
        {backups.isError && <p className="text-sm text-crit">{apiMessage(backups.error)}</p>}
        {backups.data?.length === 0 && <p className="text-[12px] text-faint">No backups yet.</p>}
        {!!backups.data?.length && (
          <ul className="m-0 flex list-none flex-col divide-y divide-divider p-0">
            {backups.data.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] text-body" title={formatDate(b.createdAt)}>
                    {formatDate(b.createdAt)} <span className="text-faint">· {timeAgo(b.createdAt)}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-faint">
                    {b.trigger === "SCHEDULED" ? "Scheduled" : "Manual"}
                    {b.sizeBytes != null && ` · ${formatBytes(b.sizeBytes)}`}
                    {b.storage === "ORG" ? " · your bucket" : " · Warden storage"}
                  </div>
                  {b.error && <div className="mt-1 font-mono text-[11px] break-words text-crit">{b.error}</div>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS[b.status].className}`}>{STATUS[b.status].label}</span>
                {canEdit && b.status === "SUCCESS" && (
                  <div className="flex gap-1.5">
                    <Button variant="ghost" onClick={() => onDownload(b)} className="px-2 py-1 text-[11px]">
                      Download
                    </Button>
                    <Button variant="ghost" onClick={() => setRestoring(b)} disabled={busy || running} className="px-2 py-1 text-[11px]">
                      Restore
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!restoring}
        onClose={() => setRestoring(null)}
        onConfirm={onRestore}
        loading={restore.isPending}
        title={`Restore ${service.serviceName}?`}
        body={`All of its current data is replaced with the backup from ${restoring ? formatDate(restoring.createdAt) : ""}. Anything written since then is lost. If the current data might matter, back up now first.`}
        cta="Restore backup"
        phrase={service.serviceName}
      />
    </Card>
  );
}

function ScheduleForm({ serviceId, info, onDone }: { serviceId: string; info: DatabaseInfo; onDone: () => void }) {
  const update = useUpdateBackupSettings(serviceId);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof UpdateBackupSettingsSchema>, unknown, UpdateBackupSettingsInput>({
    resolver: zodResolver(UpdateBackupSettingsSchema),
    defaultValues: { enabled: info.backup.enabled, hourUtc: info.backup.hourUtc, retentionDays: info.backup.retentionDays },
  });
  const enabled = useWatch({ control, name: "enabled" });

  const onSubmit = (input: UpdateBackupSettingsInput) =>
    update.mutate(input, {
      onSuccess: () => {
        toast.success("Backup schedule saved");
        onDone();
      },
      onError: (e) => {
        if (!applyApiIssues(e, setError)) toast.error(apiMessage(e));
      },
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-3.5 flex flex-col gap-3.5 rounded-xl border border-cb bg-field/40 p-3.5" noValidate>
      <Toggle checked={!!enabled} onChange={(v) => setValue("enabled", v, { shouldDirty: true })} label="Daily backups" detail="Off: only the backups you take by hand." />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <Select label="Time of day" options={HOURS} disabled={!enabled} {...register("hourUtc", { setValueAs: Number })} error={errors.hourUtc?.message} />
        <Input label="Keep for (days)" type="number" min={1} max={365} {...register("retentionDays", { valueAsNumber: true })} error={errors.retentionDays?.message} />
      </div>
      <p className="m-0 text-[11px] text-faint">Older backups are deleted after the next one finishes. The newest finished backup is always kept.</p>
      <div className="flex justify-end">
        <Button type="submit" loading={update.isPending} className="px-3.5 py-2 text-xs">
          Save schedule
        </Button>
      </div>
    </form>
  );
}
