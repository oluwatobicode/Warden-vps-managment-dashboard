import { useState } from "react";
import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, Key01Icon, PlusSignCircleIcon } from "@hugeicons/core-free-icons";
import type { SshKey } from "shared-types";
import { Button } from "../../components/ui/Button";
import { Chip, SectionHeader } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { CopyButton } from "../../components/ui/CopyButton";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useDeleteSshKey, useSshKeys } from "../../features/ssh-keys/hooks/useSshKeys";
import { AddSshKeyModal } from "../../features/ssh-keys/components/AddSshKeyModal";
import { apiMessage } from "../../utils/apiMessage";
import { formatDate, timeAgo } from "../../utils/formatDate";
import { atLeast } from "../../utils/roles";

/** "ssh-ed25519 AAAA… comment" → "ed25519" */
const keyType = (publicKey: string) => publicKey.split(" ")[0]?.replace(/^ssh-/, "") ?? "key";

export default function SshKeysPage() {
  const { user } = useAuth();
  const keys = useSshKeys();
  const del = useDeleteSshKey();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<SshKey | null>(null);
  const [installId, setInstallId] = useState<string | null>(null);
  const canEdit = atLeast(user?.role, "DEV_OPS");
  const install = keys.data?.find((k) => k.id === installId) ?? keys.data?.[0];

  const onDelete = () =>
    deleting &&
    del.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`${deleting.sshKeyName} deleted`);
        setDeleting(null);
      },
      onError: (e) => {
        toast.error(apiMessage(e));
        setDeleting(null);
      },
    });

  return (
    <>
      <SectionHeader
        title="SSH keys"
        sub="Warden uses these to reach your hosts. One key can serve several servers."
        action={
          canEdit && (
            <Button onClick={() => setAdding(true)}>
              <HugeiconsIcon icon={PlusSignCircleIcon} size={14} strokeWidth={1.5} />
              Add key
            </Button>
          )
        }
      />

      <div className="mt-[22px] flex flex-col gap-[11px]">
        {keys.isPending && [0, 1].map((i) => <Skeleton key={i} className="h-[76px] rounded-2xl" />)}
        {keys.isError && <p className="text-sm text-crit">{apiMessage(keys.error)}</p>}
        {keys.data?.length === 0 && (
          <EmptyState title="No SSH keys yet" action={canEdit && <Button onClick={() => setAdding(true)}>Add key</Button>}>
            Generate one here, then add its public half to ~/.ssh/authorized_keys on each server.
          </EmptyState>
        )}
        {keys.data?.map((k) => {
          const used = k.serverCount > 0;
          return (
            <article key={k.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-2xl border border-cb bg-card px-5 py-[17px]">
              <span className="flex min-w-0 items-center gap-3">
                <span className={`grid size-8 shrink-0 place-items-center rounded-[9px] bg-chip ${used ? "text-good" : "text-serious"}`}>
                  <HugeiconsIcon icon={Key01Icon} size={15} strokeWidth={1.5} />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-mono text-[13px] text-strong">{k.sshKeyName}</span>
                  <span className="flex items-center gap-2">
                    <Chip>{keyType(k.publicKey)}</Chip>
                    <span className={`text-[10.5px] font-semibold ${used ? "text-good" : "text-serious"}`}>
                      {used ? `In use · ${k.serverCount} server${k.serverCount === 1 ? "" : "s"}` : "Not used by any server"}
                    </span>
                  </span>
                </span>
              </span>
              <span className="min-w-[220px] flex-1 truncate font-mono text-[10.5px] text-sand">{k.fingerprint}</span>
              <span className="flex shrink-0 flex-col gap-1">
                <span className="text-[11px] text-muted-deep">Added {formatDate(k.createdAt)}</span>
                <span className="text-[10.5px] text-sand">Last used {k.lastUsedAt ? timeAgo(k.lastUsedAt) : "never"}</span>
              </span>
              <span className="flex shrink-0 gap-2">
                <CopyButton value={k.publicKey} label={`Copy ${k.sshKeyName} public key`} done="Public key copied" />
                {canEdit && (
                  <button type="button" onClick={() => setDeleting(k)} aria-label={`Delete ${k.sshKeyName}`} className="grid size-[30px] cursor-pointer place-items-center rounded-lg border border-cb text-muted-warm hover:border-crit-border hover:bg-crit-s hover:text-crit">
                    <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.5} />
                  </button>
                )}
              </span>
            </article>
          );
        })}
      </div>

      {install && (
        <section className="mt-3.5 mb-2 rounded-2xl border border-divider bg-ink px-5 py-[18px]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="m-0 text-sm font-bold text-strong">Install a key on a host</h3>
              <p className="mt-[7px] text-[11.5px] text-muted-warm">
                Append this public key to <span className="font-mono">~/.ssh/authorized_keys</span> on the server, then run Test connection.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {keys.data && keys.data.length > 1 && (
                <select
                  aria-label="Key to install"
                  value={install.id}
                  onChange={(e) => setInstallId(e.target.value)}
                  className="cursor-pointer rounded-[9px] border border-navb bg-raised px-2.5 py-2 font-mono text-[11px] text-strong outline-none"
                >
                  {keys.data.map((k) => <option key={k.id} value={k.id}>{k.sshKeyName}</option>)}
                </select>
              )}
              <CopyButton value={install.publicKey} text="Copy" done="Public key copied. Paste it into ~/.ssh/authorized_keys" />
            </div>
          </div>
          <p className="mt-3.5 mb-0 rounded-[10px] border border-cb bg-[#0a0a0a] px-3.5 py-3 font-mono text-[11px] leading-relaxed break-all text-muted-deep">{install.publicKey}</p>
        </section>
      )}

      <AddSshKeyModal open={adding} onClose={() => setAdding(false)} onCreated={(k) => setInstallId(k.id)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={del.isPending}
        title={`Delete ${deleting?.sshKeyName}?`}
        body="Warden forgets the key. Refused while a server still uses it. Also remove it from authorized_keys on your hosts."
        cta="Delete key"
        phrase={deleting?.sshKeyName}
      />
    </>
  );
}
