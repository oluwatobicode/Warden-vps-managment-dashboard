import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import type { z } from "zod";
import { SaveBackupStorageSchema, type SaveBackupStorageInput } from "shared-types";
import { Button } from "../../components/ui/Button";
import { Card, FactRow, SectionHeader } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useBackupStorage, useRemoveBackupStorage, useSaveBackupStorage } from "../../features/databases/hooks/useBackups";
import { applyApiIssues, apiMessage } from "../../utils/apiMessage";
import { formatDate } from "../../utils/formatDate";
import { atLeast } from "../../utils/roles";

const ACTIVE = {
  ORG: { title: "Your own bucket", body: "New backups go to the bucket below." },
  PLATFORM: { title: "Warden storage", body: "New backups go to the bucket this Warden install provides. Add your own below to keep them in your account instead." },
  NONE: { title: "Not set up", body: "Databases can't be backed up until a bucket is added below." },
} as const;

/**
 * Settings → Backup storage. Everyone can see where backups go; DevOps and
 * Admin can set the org's own S3-compatible bucket (e.g. Cloudflare R2), which
 * wins over Warden's. The secret key is sent once and never shown again.
 */
export default function BackupStoragePage() {
  const { user } = useAuth();
  const status = useBackupStorage();
  const remove = useRemoveBackupStorage();
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState(false);
  const canEdit = atLeast(user?.role, "DEV_OPS");

  const onRemove = () =>
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success("Your bucket was removed");
        setRemoving(false);
      },
      onError: (e) => {
        toast.error(apiMessage(e));
        setRemoving(false);
      },
    });

  return (
    <>
      <SectionHeader title="Backup storage" sub="Where database backups are kept. Every file is encrypted with your organization's key before it leaves your server." />
      <div className="mt-[22px] flex max-w-[680px] flex-col gap-3.5">
        {status.isPending && <Skeleton className="h-28 rounded-[18px]" />}
        {status.isError && <p className="text-sm text-crit">{apiMessage(status.error)}</p>}
        {status.data && (
          <>
            <Card title={`Backups go to: ${ACTIVE[status.data.active].title}`} sub={ACTIVE[status.data.active].body}>
              {status.data.own && (
                <div className="mt-3">
                  <FactRow label="Endpoint">{status.data.own.endpoint}</FactRow>
                  <FactRow label="Bucket">{status.data.own.bucket}</FactRow>
                  <FactRow label="Access key ID">{status.data.own.accessKeyId}</FactRow>
                  <FactRow label="Saved">{formatDate(status.data.own.updatedAt)}</FactRow>
                </div>
              )}
              {canEdit && (
                <div className="mt-4 flex justify-end gap-2">
                  {status.data.own && (
                    <Button variant="ghost" onClick={() => setRemoving(true)} className="px-3 py-1.5 text-xs">
                      Remove
                    </Button>
                  )}
                  {!editing && (
                    <Button variant="secondary" onClick={() => setEditing(true)} className="px-3.5 py-2 text-xs">
                      {status.data.own ? "Change bucket" : "Use my own bucket"}
                    </Button>
                  )}
                </div>
              )}
            </Card>
            {editing && canEdit && <StorageForm initial={status.data.own} onDone={() => setEditing(false)} />}
          </>
        )}
      </div>
      <ConfirmDialog
        open={removing}
        onClose={() => setRemoving(false)}
        onConfirm={onRemove}
        loading={remove.isPending}
        title="Remove your bucket?"
        body="New backups go to Warden storage, if this install has it. Backups already in your bucket stay there, but Warden can't download or restore them until you add the bucket back."
        cta="Remove bucket"
      />
    </>
  );
}

function StorageForm({ initial, onDone }: { initial: { endpoint: string; bucket: string; accessKeyId: string } | null; onDone: () => void }) {
  const save = useSaveBackupStorage();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof SaveBackupStorageSchema>, unknown, SaveBackupStorageInput>({
    resolver: zodResolver(SaveBackupStorageSchema),
    defaultValues: { endpoint: initial?.endpoint ?? "", bucket: initial?.bucket ?? "", accessKeyId: initial?.accessKeyId ?? "", secretAccessKey: "" },
  });

  const onSubmit = (input: SaveBackupStorageInput) =>
    save.mutate(input, {
      onSuccess: () => {
        toast.success("Bucket tested and saved");
        onDone();
      },
      onError: (e) => {
        if (!applyApiIssues(e, setError)) toast.error(apiMessage(e));
      },
    });

  return (
    <Card title="Your bucket" sub="Any S3-compatible store. For Cloudflare R2: R2 → Manage API tokens → create a token with Object Read & Write on one bucket.">
      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-3.5" noValidate>
        <Input label="Endpoint" mono placeholder="https://<account-id>.r2.cloudflarestorage.com" {...register("endpoint")} error={errors.endpoint?.message} />
        <Input label="Bucket" mono placeholder="warden-backups" {...register("bucket")} error={errors.bucket?.message} />
        <Input label="Access key ID" mono autoComplete="off" {...register("accessKeyId")} error={errors.accessKeyId?.message} />
        <Input
          label={initial ? "Secret access key (paste it again to save)" : "Secret access key"}
          type="password"
          mono
          autoComplete="new-password"
          {...register("secretAccessKey")}
          error={errors.secretAccessKey?.message}
        />
        <p className="m-0 text-[11px] text-faint">Warden writes and deletes one small test file before saving, so a wrong key shows up now, not at the first backup.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onDone} className="px-3 py-1.5 text-xs">
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending} className="px-3.5 py-2 text-xs">
            Test and save
          </Button>
        </div>
      </form>
    </Card>
  );
}
